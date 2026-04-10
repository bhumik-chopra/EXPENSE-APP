# ══════════════════════════════════════════════════════════════════════════════
# model_trainer.py  —  Receipt Category Classifier Training
# ══════════════════════════════════════════════════════════════════════════════
#
# WHAT THIS DOES:
#   1. Reads all receipt images from RECEIPTS_ROOT (organised by category folder)
#   2. OCRs each image using EasyOCR
#   3. Trains a TF-IDF + Logistic Regression classifier
#   4. Saves model.pkl, vectorizer.pkl, encoder.pkl, meta.pkl → MODELS_DIR
#
# FOLDER STRUCTURE EXPECTED:
#   receipts/
#     Food/         ← folder name = category label
#       bill1.jpg
#       bill2.png
#     Shopping/
#       receipt1.jpg
#     Healthcare/
#       ...
#
# USAGE:
#   python model_trainer.py
#
# After running, copy the models/ folder next to ocr_pipeline.py on the server.
# ══════════════════════════════════════════════════════════════════════════════

import os
import re
import sys
import pickle
import warnings
import datetime
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

import cv2
import numpy as np
import pandas as pd
import easyocr

from sklearn.linear_model import LogisticRegression
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import cross_val_score, StratifiedKFold
from sklearn.metrics import accuracy_score

print("✅ All imports OK")

# ══════════════════════════════════════════════════════════════════════════════
# CONFIG — update these two paths before running
# ══════════════════════════════════════════════════════════════════════════════

MODULE_DIR    = Path(__file__).resolve().parent
RECEIPTS_ROOT = MODULE_DIR / "receipts"    # folder with category sub-folders of images
MODELS_DIR    = MODULE_DIR / "models"      # where model artifacts will be saved

IMAGE_EXTS  = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"}
OCR_WORKERS = 4     # parallel OCR threads — lower to 2 if RAM is tight

# ══════════════════════════════════════════════════════════════════════════════
# VALIDATE PATHS
# ══════════════════════════════════════════════════════════════════════════════

if not RECEIPTS_ROOT.exists() or not RECEIPTS_ROOT.is_dir():
    print(f"\n❌ RECEIPTS_ROOT not found: {RECEIPTS_ROOT.resolve()}")
    print("   Update the RECEIPTS_ROOT variable at the top of this file.")
    sys.exit(1)

MODELS_DIR.mkdir(parents=True, exist_ok=True)
print(f"Receipts root : {RECEIPTS_ROOT.resolve()}")
print(f"Models dir    : {MODELS_DIR.resolve()}")

# ══════════════════════════════════════════════════════════════════════════════
# 1. OCR HELPERS
# ══════════════════════════════════════════════════════════════════════════════

_reader = easyocr.Reader(["en"], gpu=False)
print("✅ EasyOCR reader initialised")


def load_image_robust(image_path: str) -> np.ndarray:
    """Load image robustly — handles Windows paths and mixed encodings."""
    data = np.fromfile(str(image_path), dtype=np.uint8)
    if data.size > 0:
        img = cv2.imdecode(data, cv2.IMREAD_COLOR)
        if img is not None:
            return img
    img = cv2.imread(str(image_path), cv2.IMREAD_COLOR)
    if img is not None:
        return img
    raise FileNotFoundError(f"Cannot load image: {image_path}")


def preprocess_image(image_path: str) -> np.ndarray:
    """
    Preprocessing pipeline:
      1. Upscale if smaller than 1500px on longest side
      2. Grayscale
      3. CLAHE contrast normalisation
      4. Light unsharp-mask sharpening
    """
    img = load_image_robust(image_path)
    h, w = img.shape[:2]
    if max(h, w) < 1500:
        scale = 1500 / max(h, w)
        img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    gray  = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray  = clahe.apply(gray)
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    return cv2.filter2D(gray, -1, kernel)


def ocr_image(image_path: str) -> str:
    processed = preprocess_image(image_path)
    results   = _reader.readtext(processed, detail=0)
    return " ".join(results)

# ══════════════════════════════════════════════════════════════════════════════
# 2. AMOUNT EXTRACTION HELPER
# ══════════════════════════════════════════════════════════════════════════════

def extract_total_amount(raw_text: str) -> float:
    """
    Extract grand total from raw OCR text.
    Priority: Grand Total → Total → largest number.
    Returns 0.0 if nothing plausible found.
    """
    cleaned = re.sub(r"\b\d{10,}\b", " ", raw_text)
    cleaned = re.sub(r"\d{1,2}[:/]\d{2}(?:[:/]\d{2,4})?", " ", cleaned)
    cleaned = re.sub(r"\b(?:No|#|Ref|Order|Invoice|Bill No)[.:\s]*\d+\b", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"www\.\S+", " ", cleaned, flags=re.IGNORECASE)

    def parse_number(token: str):
        t = token.strip().strip(",.₹$Rs")
        if not t:
            return None
        t = re.sub(r",(?=\d{3}(?:[,.]|$))", "", t)
        t = t.replace(",", ".")
        try:
            v = float(t)
            return v if v >= 1.0 else None
        except ValueError:
            return None

    def amounts_in_window(text: str):
        pattern = r"(?:[₹$Rs.]{0,3}\s*)(\d{1,3}(?:[,.]\d{3})*(?:\.\d{1,2})?|\d+\.\d{1,2}|\d{3,})"
        return [v for m in re.finditer(pattern, text, flags=re.IGNORECASE)
                if (v := parse_number(m.group(1))) is not None]

    strong = re.compile(
        r"(?:grand\s*total|net\s*total|amount\s*due|invoice\s*total|total\s*payment)",
        re.IGNORECASE,
    )
    for m in strong.finditer(cleaned):
        a = amounts_in_window(cleaned[m.end(): m.end() + 60])
        if a:
            return a[0]

    for m in re.finditer(r"(?<!sub)(?<!beverage)(?<!food)\btotal\b", cleaned, re.IGNORECASE):
        a = amounts_in_window(cleaned[m.end(): m.end() + 60])
        if a:
            return a[0]

    all_amounts = amounts_in_window(cleaned)
    return max(all_amounts) if all_amounts else 0.0

# ══════════════════════════════════════════════════════════════════════════════
# 3. DATE EXTRACTION HELPER
# ══════════════════════════════════════════════════════════════════════════════

MONTH_MAP = {
    "jan": "01", "feb": "02", "mar": "03", "apr": "04",
    "may": "05", "jun": "06", "jul": "07", "aug": "08",
    "sep": "09", "oct": "10", "nov": "11", "dec": "12",
    "january": "01",  "february": "02", "march": "03",    "april": "04",
    "june": "06",     "july": "07",     "august": "08",   "september": "09",
    "october": "10",  "november": "11", "december": "12",
}

_MONTH_RE = (
    r"Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
    r"Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?"
)

DATE_PATTERNS = [
    (
        rf"(\d{{1,2}})\s+({_MONTH_RE})\s+(\d{{2,4}})",
        lambda m: f"{m.group(3)}-{MONTH_MAP[m.group(2).lower()[:3]]}-{int(m.group(1)):02d}",
    ),
    (
        r"(\d{2})/(\d{2})/(\d{2,4})",
        lambda m: f"{m.group(3) if len(m.group(3))==4 else '20'+m.group(3)}-{m.group(2)}-{m.group(1)}",
    ),
    (
        r"(\d{2})-(\d{2})-(\d{4})",
        lambda m: f"{m.group(3)}-{m.group(2)}-{m.group(1)}",
    ),
    (
        r"(\d{2})-(\d{2})-(\d{2})\b",
        lambda m: f"20{m.group(3)}-{m.group(1)}-{m.group(2)}",
    ),
    (
        r"(\d{2})/(\d{2})/(\d{2})\b",
        lambda m: f"20{m.group(3)}-{m.group(2)}-{m.group(1)}",
    ),
]


def extract_date(raw_text: str):
    """Return ISO date string (YYYY-MM-DD) or None."""
    for pattern, formatter in DATE_PATTERNS:
        m = re.search(pattern, raw_text, flags=re.IGNORECASE)
        if m:
            try:
                return formatter(m)
            except Exception:
                continue
    return None


# Quick self-test
_date_tests = [
    ("21 May 2025 02:01 PM", "2025-05-21"),
    ("07/09/2025  05:37 PM", "2025-09-07"),
    ("24-04-2024",           "2024-04-24"),
    ("16/09/23",             "2023-09-16"),
]
_date_pass = sum(1 for txt, exp in _date_tests if extract_date(txt) == exp)
print(f"✅ extract_date() self-test: {_date_pass}/{len(_date_tests)} passed")

# ══════════════════════════════════════════════════════════════════════════════
# 4. BUILD TRAINING DATASET (parallel OCR)
# ══════════════════════════════════════════════════════════════════════════════

image_paths = [p for p in RECEIPTS_ROOT.rglob("*") if p.suffix.lower() in IMAGE_EXTS]

if not image_paths:
    print(f"\n❌ No image files found under {RECEIPTS_ROOT.resolve()}")
    sys.exit(1)

print(f"\nOCR-ing {len(image_paths)} images with {OCR_WORKERS} workers...\n")


def _process_one(img_path: Path) -> dict | None:
    try:
        raw_text = ocr_image(str(img_path))
        if not raw_text.strip():
            print(f"  ⚠️  {img_path.name} — empty OCR result")
            return None
        return {
            "image"        : img_path.name,
            "category"     : img_path.parent.name,
            "raw_text"     : raw_text,
            "total_amount" : extract_total_amount(raw_text),
            "date"         : extract_date(raw_text),
        }
    except Exception as e:
        print(f"  ❌ {img_path.name} — {e}")
        return None


records = []
with ThreadPoolExecutor(max_workers=OCR_WORKERS) as pool:
    futures = {pool.submit(_process_one, p): p for p in image_paths}
    for future in as_completed(futures):
        result = future.result()
        if result:
            records.append(result)
            print(f"  ✅ {result['image']}  ({result['category']})")

if not records:
    print(f"\n❌ No usable training samples found. Check image quality or folder structure.")
    sys.exit(1)

df = pd.DataFrame(records)
print(f"\nDataset built: {len(df)} samples")
print(df["category"].value_counts().to_string())

# ══════════════════════════════════════════════════════════════════════════════
# 5. TEXT CLEANING
# ══════════════════════════════════════════════════════════════════════════════

def clean_text_for_model(text: str) -> str:
    """Lowercase + remove punctuation noise. Keeps digits."""
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s\.]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


df = df[df["raw_text"].astype(str).str.strip() != ""].copy()
df["cleaned_text"] = df["raw_text"].astype(str).apply(clean_text_for_model)
print(f"Usable rows after cleaning: {len(df)}")

# ══════════════════════════════════════════════════════════════════════════════
# 6. TRAIN
# ══════════════════════════════════════════════════════════════════════════════

if len(df) < 3:
    print(f"\n❌ Too few samples ({len(df)}). Add more readable receipt images.")
    sys.exit(1)

if df["category"].nunique() < 2:
    print("\n❌ Need at least 2 categories. Add receipts from another category folder.")
    sys.exit(1)

encoder     = LabelEncoder()
df["label"] = encoder.fit_transform(df["category"])

X_all = df["cleaned_text"]
y_all = df["label"]

# TF-IDF max_features auto-scales to corpus size — avoids over-fitting on small sets
auto_features = min(5000, len(df) * 20)

vectorizer = TfidfVectorizer(
    ngram_range=(1, 2),
    max_features=auto_features,
    min_df=1,
    sublinear_tf=True,
)
X_vec = vectorizer.fit_transform(X_all)

model = LogisticRegression(C=1.0, max_iter=1000, solver="lbfgs")

if len(df) >= 6:
    min_class_count = df["category"].value_counts().min()
    cv_folds        = min(5, min_class_count)
    skf             = StratifiedKFold(n_splits=cv_folds, shuffle=True, random_state=42)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        cv_scores = cross_val_score(model, X_vec, y_all, cv=skf, scoring="accuracy")
    print(f"\nCross-val accuracy : {cv_scores.mean():.2%} ± {cv_scores.std():.2%}  (folds={cv_folds})")

model.fit(X_vec, y_all)
train_acc = accuracy_score(y_all, model.predict(X_vec))
print(f"Train accuracy     : {train_acc:.2%}")
print(f"Categories         : {list(encoder.classes_)}")
print(f"TF-IDF features    : {auto_features}")

# ══════════════════════════════════════════════════════════════════════════════
# 7. SAVE ARTIFACTS
# ══════════════════════════════════════════════════════════════════════════════

meta = {
    "trained_at"         : datetime.datetime.now().isoformat(),
    "n_samples"          : len(df),
    "categories"         : list(encoder.classes_),
    "train_accuracy"     : round(train_acc, 4),
    "tfidf_max_features" : auto_features,
    "category_counts"    : df["category"].value_counts().to_dict(),
    "amount_coverage"    : round((df["total_amount"] > 0).mean(), 3),
    "date_coverage"      : round(df["date"].notna().mean(), 3),
}

artifacts = [
    ("model",      model),
    ("vectorizer", vectorizer),
    ("encoder",    encoder),
    ("meta",       meta),
]

print()
for name, obj in artifacts:
    path = MODELS_DIR / f"{name}.pkl"
    with open(path, "wb") as f:
        pickle.dump(obj, f)
    print(f"✅ Saved {path}")

print("\n📊 Training summary:")
for k, v in meta.items():
    print(f"   {k:<22}: {v}")

print("\n🎯 Done. Copy the models/ folder next to ocr_pipeline.py on your server.")
