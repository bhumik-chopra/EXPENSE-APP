# ══════════════════════════════════════════════════════════════════════════════
# ocr_pipeline.py  —  Receipt OCR Inference Pipeline
# PaddleOCR v3 primary · EasyOCR fallback · HuggingFace QA for amount & date
# ══════════════════════════════════════════════════════════════════════════════
#
# USAGE (from your backend):
#   from ocr_pipeline import process_receipt
#   result = process_receipt("path/to/receipt.jpg")
#
# RESULT DICT:
#   {
#     "image"        : "receipt.jpg",
#     "category"     : "Food",
#     "confidence"   : 0.87,
#     "total_amount" : 556.50,     # float, None if not found
#     "date"         : "2024-04-21",  # ISO string, None if not found
#     "raw_text"     : "...",
#     "error"        : None        # string if something failed, else None
#   }
# ══════════════════════════════════════════════════════════════════════════════

import re
import sys
import pickle
from pathlib import Path

import cv2
import numpy as np
import transformers

MODULE_DIR = Path(__file__).resolve().parent

# ── CONFIG — paths are resolved relative to this file so imports work from backend/app.py ──
MODELS_DIR = MODULE_DIR / "models"   # folder containing model.pkl, vectorizer.pkl, encoder.pkl

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"}

# ══════════════════════════════════════════════════════════════════════════════
# 1. LOAD ML MODELS
# ══════════════════════════════════════════════════════════════════════════════

def _load_models():
    required = ["model.pkl", "vectorizer.pkl", "encoder.pkl"]
    for f in required:
        if not (MODELS_DIR / f).exists():
            raise FileNotFoundError(
                f"Missing {f} in {MODELS_DIR}. "
                "Run model_trainer.py first to generate model artifacts."
            )

    with open(MODELS_DIR / "model.pkl",      "rb") as f: model      = pickle.load(f)
    with open(MODELS_DIR / "vectorizer.pkl", "rb") as f: vectorizer = pickle.load(f)
    with open(MODELS_DIR / "encoder.pkl",    "rb") as f: encoder    = pickle.load(f)

    # Patch stale attribute from older sklearn versions
    if hasattr(model, "multi_class"):
        del model.multi_class

    return model, vectorizer, encoder


_model, _vectorizer, _encoder = _load_models()
print("[OK] ML models loaded from", MODELS_DIR)

# ══════════════════════════════════════════════════════════════════════════════
# 2. QA PIPELINE (singleton)
# ══════════════════════════════════════════════════════════════════════════════

try:
    _qa_pipe = transformers.pipeline(
        task="question-answering",
        model="deepset/roberta-base-squad2",
        tokenizer="deepset/roberta-base-squad2",
    )
    print("[OK] QA pipeline loaded")
except Exception as exc:
    _qa_pipe = None
    print(f"[WARN] QA pipeline unavailable, using regex fallback only: {exc}")

# ══════════════════════════════════════════════════════════════════════════════
# 3. OCR — PaddleOCR primary, EasyOCR fallback (both singletons)
# ══════════════════════════════════════════════════════════════════════════════

def _init_paddle():
    try:
        from paddleocr import PaddleOCR
    except Exception as exc:
        print(f"[WARN] PaddleOCR unavailable, using EasyOCR only: {exc}")
        return None
    ocr = PaddleOCR(
        lang="en",
        ocr_version="PP-OCRv4",
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
    )
    print("[OK] PaddleOCR loaded")
    return ocr


def _init_easyocr():
    import easyocr
    reader = easyocr.Reader(["en"], gpu=False)
    print("[OK] EasyOCR fallback loaded")
    return reader


_paddle_ocr = _init_paddle()
_easy_reader = _init_easyocr()


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


def _preprocess_for_easyocr(image_path: str) -> np.ndarray:
    """CLAHE + sharpen preprocessing — used only by EasyOCR fallback."""
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


def _paddle_ocr_text(image_path: str) -> str:
    if _paddle_ocr is None:
        raise RuntimeError("PaddleOCR is not installed")
    results = _paddle_ocr.predict(str(image_path))
    texts = []
    for page in results:
        rec_texts  = page.get("rec_texts",  []) or []
        rec_scores = page.get("rec_scores", []) or []
        if len(rec_scores) < len(rec_texts):
            rec_scores = rec_scores + [1.0] * (len(rec_texts) - len(rec_scores))
        for txt, score in zip(rec_texts, rec_scores):
            if txt and str(txt).strip() and float(score) > 0.5:
                texts.append(str(txt).strip())
    return " ".join(texts)


def _easyocr_text(image_path: str) -> str:
    """EasyOCR fallback — uses CLAHE-preprocessed image."""
    processed = _preprocess_for_easyocr(image_path)
    results   = _easy_reader.readtext(processed, detail=0)
    text      = " ".join(results)
    # EasyOCR commonly misreads ₹ as "7" or "T" — fix it
    text = re.sub(r"\b7\s(?=\d)", "₹ ", text)
    text = re.sub(r"\bT\s(?=\d)", "₹ ", text)
    return text


def ocr_image(image_path: str) -> str:
    """
    Run OCR with automatic fallback.
    Primary  : PaddleOCR (PP-OCRv4)
    Fallback : EasyOCR — used when PaddleOCR crashes or returns < 20 chars
    """
    try:
        text = _paddle_ocr_text(image_path)
        if len(text.strip()) >= 20:
            print("  [OCR: PaddleOCR OK]")
            return text
        print("  [OCR: PaddleOCR returned too little -> EasyOCR fallback]")
    except Exception as e:
        print(f"  [OCR: PaddleOCR error: {e} -> EasyOCR fallback]")
    text = _easyocr_text(image_path)
    print("  [OCR: EasyOCR fallback used]")
    return text

# ══════════════════════════════════════════════════════════════════════════════
# 4. TEXT CLEANING
# ══════════════════════════════════════════════════════════════════════════════

def clean_text_for_model(text: str) -> str:
    """Lowercase + remove punctuation noise. Keeps digits."""
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s\.]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()

# ══════════════════════════════════════════════════════════════════════════════
# 5. CATEGORY PREDICTION
# ══════════════════════════════════════════════════════════════════════════════

CATEGORY_KEYWORDS = {
    "Food": [
        "restaurant", "cafe", "hotel", "dhaba", "eatery", "diner", "bistro",
        "pizza", "burger", "biryani", "noodles", "pasta", "sandwich", "roti",
        "naan", "rice", "dal", "paneer", "chicken", "mutton", "fish", "prawn",
        "coffee", "tea", "juice", "shake", "mojito", "beer", "wine",
        "dominos", "kfc", "mcdonalds", "subway", "zomato", "swiggy",
        "bakery", "cake", "bread", "muffin", "snack", "quick bill", "dine in",
        "dining", "food", "thali", "menu", "order", "flame kitchen",
        "amrut sagar", "jamjar", "molly's", "molly",
    ],
    "Healthcare": [
        "hospital", "clinic", "doctor", "medical", "pharmacy", "medicine",
        "prescription", "vaccine", "vaccination", "treatment", "therapy",
        "patient", "veterinary", "vet", "galliprant", "multivitamin",
        "paracetamol", "ibuprofen", "amoxicillin", "antibiotic",
        "blood test", "x-ray", "xray", "ultrasound", "consultation",
        "heartworm", "bordetella", "rabies", "fssai", "diagnostic",
        "pain relief", "cough", "lozenges", "sdn bhd", "health care",
        "healthy life", "medical store",
    ],
    "Shopping": [
        "supermarket", "mart", "store", "mall", "hypermart", "fresh mart",
        "easy day", "bigbasket", "dmart", "d-mart",
        "shirt", "jeans", "shoes", "jacket", "bag", "watch", "cloth",
        "detergent", "shampoo", "soap", "grocery", "groceries",
        "sugar", "milk", "tomato", "banana",
        "carpet", "pillow", "slipper", "furniture", "home center",
        "amazon", "flipkart", "zara", "nike", "adidas",
        "informa", "carrefour", "walmart", "uma enterprises", "biscuit",
        "frontier", "freshmart", "wal-mart", "wal*mart",
    ],
    "Transport": [
        "uber", "ola", "bus", "metro", "petrol", "diesel", "fuel",
        "train", "taxi", "cab", "flight", "airline", "parking", "toll",
    ],
    "Entertainment": [
        "netflix", "spotify", "movie", "cinema", "concert", "gaming",
        "playstation", "xbox", "ticket", "show", "theater",
    ],
    "Bills": [
        "electricity", "internet", "broadband", "wifi", "recharge",
        "postpaid", "prepaid", "utility",
    ],
}


def _keyword_vote(raw_text: str) -> dict:
    text_lower = raw_text.lower()
    return {
        cat: sum(1 for kw in kws if kw in text_lower)
        for cat, kws in CATEGORY_KEYWORDS.items()
    }


def predict_category(raw_text: str) -> tuple:
    """
    Returns (category, confidence).
    ML model is used first. Keyword vote breaks ties when confidence < 0.65.
    """
    cleaned   = clean_text_for_model(raw_text)
    X         = _vectorizer.transform([cleaned])
    scores    = _model.decision_function(X)[0]
    scores    = scores - scores.max()
    exp_s     = np.exp(scores)
    proba     = exp_s / exp_s.sum()
    best_idx  = int(np.argmax(proba))
    confidence = float(proba[best_idx])
    ml_cat    = _encoder.inverse_transform([best_idx])[0]

    if confidence >= 0.65:
        return ml_cat, confidence

    votes   = _keyword_vote(raw_text)
    best_kw = max(votes, key=votes.get)
    if votes[best_kw] > 0:
        return best_kw, confidence

    return ml_cat, confidence

# ══════════════════════════════════════════════════════════════════════════════
# 6. AMOUNT EXTRACTION
# ══════════════════════════════════════════════════════════════════════════════

AMOUNT_PAT = r"(?:(?:Rs\.?|₹|INR)\s*)?(\d[\d,]*(?:\.\d{1,2})?)"


def _parse_number(token: str):
    t = re.sub(r"(?i)^(?:rs\.?|inr|₹|\$)\s*", "", token.strip())
    t = t.strip(",.₹$+/ ")
    if not t:
        return None
    t = re.sub(r",(\d{2})$", r".\1", t)   # European decimal comma
    t = re.sub(r",(?=\d)", "", t)          # Indian thousands comma
    try:
        v = float(t)
        return v if v >= 1.0 else None
    except ValueError:
        return None


def _qa_amount_valid(answer: str) -> bool:
    """Reject QA answers that look like reference/ID numbers."""
    clean = re.sub(r"(?i)^(?:rs\.?|inr|₹|\$)\s*", "", answer.strip())
    clean = clean.replace(",", "").replace(" ", "")
    if re.search(r"[a-zA-Z]", clean):
        return False
    if re.fullmatch(r"\d+", clean) and len(clean) >= 6:
        return False
    return True


def _normalize_ocr_numbers(text: str) -> str:
    """
    Fix common OCR-split number patterns.
    '6890 00' → '6890.00'  (4+ digit left side only)
    'Rs 2 467.50' → 'Rs 2467.50'
    """
    # Pass 1: paise split — left side must be 4+ digits
    text = re.sub(
        r"(\d{4,}(?:,\d{2,3})*)\s+(\d{2})(?=\s|$|\b(?!\d))",
        lambda m: m.group(1) + "." + m.group(2),
        text,
    )
    # Pass 2: space-as-Indian-thousands only after currency symbol
    text = re.sub(
        r"(?:(?:Rs\.?|₹|INR)\s*)(\d{1,2})\s+(\d{3}(?:\.\d{1,2})?)(?=\s|$|\b)",
        r"\1\2",
        text,
    )
    return text


def _amounts_in_window(text: str):
    return [
        v
        for m in re.finditer(AMOUNT_PAT, text, re.IGNORECASE)
        if (v := _parse_number(m.group(1))) is not None
    ]


def _remove_ref_numbers(text: str) -> str:
    """Remove 7–9 digit reference numbers unless preceded by a currency symbol."""
    def replacer(m):
        prefix = text[max(0, m.start() - 5): m.start()]
        if re.search(r"(?:Rs\.?|₹|INR|\$)\s*$", prefix, re.IGNORECASE):
            return m.group(0)
        return " "
    return re.sub(r"\b\d{7,9}\b", replacer, text)


def _regex_amount(raw_text: str) -> float:
    """
    Priority ladder:
    Grand Total > Charges > Total > Sub Total > largest Rs amount > largest any amount
    """
    c = raw_text

    # Fix EasyOCR ₹ misread
    c = re.sub(r"\b7\s(?=\d)", "₹ ", c)
    c = re.sub(r"\bT\s(?=\d)", "₹ ", c)

    # Noise removal
    c = re.sub(r"\b\d{10,}\b", " ", c)
    c = re.sub(r"\d{1,2}[:/]\d{2}(?:[:/]\d{2,4})?(?:\s*[APap][Mm])?", " ", c)
    c = re.sub(r"\b(?:GST(?:IN)?|FSSAI|CIN|PAN|LIC|VAT(?:TIN)?)[:\s]*[\w\d]+\b", " ", c, flags=re.IGNORECASE)
    c = re.sub(
        r"\b(?:No|Sl\.?|S\.?No|#|Ref|Order|Invoice|Bill\s*No|Table|Token|Doc|NPWP|SKU|Barcode)"
        r"[.\s:#]*[-\w\d]+\b", " ", c, flags=re.IGNORECASE,
    )
    c = re.sub(r"www\.\S+|@\S+", " ", c, flags=re.IGNORECASE)
    c = re.sub(r"\+91\s*\d+", " ", c)
    c = _remove_ref_numbers(c)
    c = re.sub(r"\b\d{1,2}(?:\.\d{1,2})?\s*%", " ", c)
    c = re.sub(r"(?:cgst|sgst|igst|gst|vat|tax)\s*(?:@|at)?\s*\d{1,2}(?:\.\d)?\b", " ", c, flags=re.IGNORECASE)
    c = re.sub(r"(?:point|points|pts?)\s*(?:opening|closing|balance|collected|redeem(?:ed)?|earned)[^\n.]*", " ", c, flags=re.IGNORECASE)
    c = re.sub(r"(?:opening|closing)\s*(?:balance|points?)[^\n.]*", " ", c, flags=re.IGNORECASE)
    c = re.sub(r"-\s*\d[\d,]*(?:\.\d{1,2})?", " ", c)

    c = _normalize_ocr_numbers(c)

    # Grand Total / Net Total / Amount Due
    GRAND = re.compile(
        r"(?:grand\s*total|net\s*(?:total|amount|payable)|amount\s*(?:due|payable|paid)|"
        r"bill\s*(?:amount|total)|payable\s*(?:amount)?|total\s*payable|"
        r"please\s*pay|net\s*pay)",
        re.IGNORECASE,
    )
    for m in GRAND.finditer(c):
        window = c[m.end(): m.end() + 150]
        window = re.sub(r"^[\s:–\-|\t]*(?:Rs\.?|₹|INR)?\s*", "", window)
        a = _amounts_in_window(window)
        if a:
            return a[0]

    # Charges (US vet / hospital receipts)
    for m in re.finditer(r"(?:charges|amount\s*charged|total\s*charges)\s*[:\s]*", c, re.IGNORECASE):
        a = _amounts_in_window(c[m.end(): m.end() + 80])
        if a:
            return a[0]

    # Generic Total — skip sub-totals and tax lines
    for m in re.finditer(r"(?<!\w)total\b", c, re.IGNORECASE):
        context = c[max(0, m.start() - 5): m.end() + 30].lower()
        if any(x in context for x in ["sub", "tax", "item", "discount", "cgst", "sgst",
                                       "service", "qty", "items", "charge", "saving", "savings"]):
            continue
        a = _amounts_in_window(c[m.end(): m.end() + 120])
        if a:
            return a[0]

    # Sub Total fallback
    for m in re.finditer(r"sub\s*[-_]?\s*total", c, re.IGNORECASE):
        a = _amounts_in_window(c[m.end(): m.end() + 120])
        if a:
            return a[0]

    # Largest Rs-prefixed amount
    rupee_amounts = [
        v for m in re.finditer(r"(?:₹|Rs\.?)\s*(\d[\d,.]*)", c, re.IGNORECASE)
        if (v := _parse_number(m.group(1))) and v >= 10
    ]
    if rupee_amounts:
        return max(rupee_amounts)

    # Last resort: largest amount ≥ 10
    all_a = [v for v in _amounts_in_window(c) if v >= 10]
    return max(all_a) if all_a else None   # None instead of 0 — means "not found"


AMOUNT_QUESTIONS = [
    "What is the grand total amount?",
    "What is the total amount to pay?",
    "What is the net total?",
    "What is the bill amount?",
]


def extract_amount(raw_text: str, threshold: float = 0.35):
    """
    QA model (threshold=0.35) → regex fallback.
    Returns float or None if not found.
    """
    context = raw_text[:512]
    best_score, best_answer = 0.0, None
    if _qa_pipe is not None:
        for q in AMOUNT_QUESTIONS:
            try:
                r = _qa_pipe({"question": q, "context": context})
                if r["score"] > best_score:
                    best_score, best_answer = r["score"], r["answer"]
            except Exception:
                continue

    if best_answer and best_score >= threshold and _qa_amount_valid(best_answer):
        parsed = _parse_number(best_answer)
        if parsed and parsed >= 1.0:
            print(f'  [QA] amount="{best_answer}" score={best_score:.2f}')
            return round(parsed, 2)

    fallback = _regex_amount(raw_text)
    print(f"  [regex] amount={fallback}")
    return round(fallback, 2) if fallback is not None else None

# ══════════════════════════════════════════════════════════════════════════════
# 7. DATE EXTRACTION
# ══════════════════════════════════════════════════════════════════════════════

MONTH_MAP = {
    "jan": "01", "feb": "02", "mar": "03", "apr": "04",
    "may": "05", "jun": "06", "jul": "07", "aug": "08",
    "sep": "09", "oct": "10", "nov": "11", "dec": "12",
    "january": "01", "february": "02", "march": "03", "april": "04",
    "june": "06", "july": "07", "august": "08", "september": "09",
    "october": "10", "november": "11", "december": "12",
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

DATE_QUESTIONS = [
    "What is the date on this receipt?",
    "When was this purchase made?",
    "What is the bill date?",
    "What is the invoice date?",
]


def _parse_date_string(text: str):
    for pattern, formatter in DATE_PATTERNS:
        m = re.search(pattern, text.strip(), flags=re.IGNORECASE)
        if m:
            try:
                return formatter(m)
            except Exception:
                continue
    return None


def extract_date(raw_text: str, threshold: float = 0.35):
    """
    QA model (threshold=0.35) → regex fallback.
    Returns ISO date string (YYYY-MM-DD) or None.
    Threshold raised from 0.10 to 0.35 to reduce wrong date extraction.
    """
    context = raw_text[:512]
    best_score, best_answer = 0.0, None
    if _qa_pipe is not None:
        for q in DATE_QUESTIONS:
            try:
                r = _qa_pipe({"question": q, "context": context})
                if r["score"] > best_score:
                    best_score, best_answer = r["score"], r["answer"]
            except Exception:
                continue

    if best_answer and best_score >= threshold:
        normalised = _parse_date_string(best_answer)
        if normalised:
            print(f'  [QA] date="{best_answer}" -> {normalised} score={best_score:.2f}')
            return normalised

    fallback = _parse_date_string(raw_text)
    print(f"  [regex] date={fallback}")
    return fallback

# ══════════════════════════════════════════════════════════════════════════════
# 8. FULL PIPELINE
# ══════════════════════════════════════════════════════════════════════════════

def process_receipt(image_path: str) -> dict:
    """
    Run the full OCR → category → amount → date pipeline on one image.
    Returns a result dict. Never raises — errors are captured in result["error"].
    """
    result = {
        "image"        : Path(image_path).name,
        "category"     : None,
        "confidence"   : None,
        "total_amount" : None,
        "date"         : None,
        "raw_text"     : None,
        "error"        : None,
    }
    try:
        if not Path(image_path).exists():
            raise FileNotFoundError(f"Image not found: {image_path}")
        if Path(image_path).suffix.lower() not in IMAGE_EXTS:
            raise ValueError(f"Unsupported file type: {Path(image_path).suffix}")

        raw_text               = ocr_image(image_path)
        category, confidence   = predict_category(raw_text)
        total_amount           = extract_amount(raw_text)
        date                   = extract_date(raw_text)

        result["category"]     = category
        result["confidence"]   = round(confidence, 3)
        result["total_amount"] = total_amount   # float or None
        result["date"]         = date           # ISO string or None
        result["raw_text"]     = raw_text

    except Exception as e:
        result["error"] = str(e)
        print(f"  [ERROR] {e}")

    return result


# ══════════════════════════════════════════════════════════════════════════════
# 9. QUICK TEST  (python ocr_pipeline.py path/to/image.jpg)
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python ocr_pipeline.py path/to/receipt.jpg")
        sys.exit(1)

    test_path = sys.argv[1]
    print(f"\nProcessing: {test_path}\n")
    out = process_receipt(test_path)
    print("\n" + "=" * 50)
    for k, v in out.items():
        print(f"  {k:<15}: {v}")
    print("=" * 50)
