from __future__ import annotations

import os
import re
import sys
import tempfile
import threading
import time
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import fitz
import pdfplumber
import PyPDF2
from dateutil import parser as date_parser
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
from pymongo.errors import PyMongoError
from bson import ObjectId
from prediction_service import DEFAULT_MONTHLY_BUDGET, generate_predictions

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = Path(__file__).resolve().parent


def resolve_ocr_paths() -> tuple[Path, Path, str]:
    candidates = [
        (BACKEND_DIR / "ocr_module", BACKEND_DIR / "ocr_module" / "models", "bhumik"),
        (BACKEND_DIR / "ocr_module" / "src", BACKEND_DIR / "ocr_module" / "models", "production"),
        (BACKEND_DIR / "ocr_module(old)" / "src", BACKEND_DIR / "ocr_module(old)" / "models", "production"),
        (BACKEND_DIR / "ocr_module" / "bhumik", BACKEND_DIR / "ocr_module" / "bhumik" / "models", "bhumik"),
        (ROOT_DIR / "ocr_module", ROOT_DIR / "ocr_module" / "models", "bhumik"),
        (ROOT_DIR / "ocr_module" / "src", ROOT_DIR / "ocr_module" / "models", "production"),
        (ROOT_DIR / "ocr_module(old)" / "src", ROOT_DIR / "ocr_module(old)" / "models", "production"),
        (ROOT_DIR / "ocr_module" / "bhumik", ROOT_DIR / "ocr_module" / "bhumik" / "models", "bhumik"),
    ]

    for src_dir, models_dir, backend_kind in candidates:
        if backend_kind == "production" and (src_dir / "production.py").exists():
            return src_dir, models_dir, backend_kind
        if backend_kind == "bhumik" and (src_dir / "ocr_pipeline.py").exists():
            return src_dir, models_dir, backend_kind

    raise FileNotFoundError(
        "No compatible OCR module was found. Expected either "
        "'ocr_module/ocr_pipeline.py' or 'ocr_module/src/production.py'."
    )


OCR_SRC_DIR, OCR_MODELS_DIR, OCR_BACKEND_KIND = resolve_ocr_paths()

if str(OCR_SRC_DIR) not in sys.path:
    sys.path.insert(0, str(OCR_SRC_DIR))

if OCR_BACKEND_KIND == "production":
    from production import OCRService
else:
    from ocr_pipeline import extract_amount, predict_category, process_receipt

    class OCRService:
        def __init__(self, models_dir: str | None = None, use_gpu: bool = False, ocr_backend: str = "bhumik") -> None:
            self.models_dir = models_dir or str(OCR_MODELS_DIR)
            self.use_gpu = use_gpu
            self.ocr_backend = ocr_backend or "bhumik"

        def process_receipt(self, image_path: str) -> dict:
            result = process_receipt(image_path)
            amount = result.get("total_amount")
            all_amounts = [amount] if amount not in (None, "", 0) else []
            return {
                "category": result.get("category"),
                "amount": amount,
                "all_amounts": all_amounts,
                "raw_text": result.get("raw_text", "") or "",
                "cleaned_text": "",
                "ocr_backend": self.ocr_backend,
                "date": result.get("date"),
                "confidence": result.get("confidence"),
                "error": result.get("error"),
            }

        def predict_category(self, text: str) -> str:
            category, _confidence = predict_category(text)
            return category

        def refine_category(self, raw_text: str, category: str) -> str:
            return category

        @staticmethod
        def extract_bill_amount(raw_text: str) -> tuple[list[float], float]:
            amount = extract_amount(raw_text)
            if amount is None:
                return [], 0.0
            return [float(amount)], float(amount)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

load_dotenv(Path(__file__).with_name(".env"))

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SMARTSPEND_SECRET_KEY", "smartspend-dev-secret")
CORS(
    app,
    supports_credentials=True,
    origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
)

USD_TO_INR_RATE = 80.0
MONGODB_URI = os.environ.get("MONGODB_URI", "").strip()
MONGODB_DB_NAME = os.environ.get("MONGODB_DB_NAME", "EXPENSE").strip() or "EXPENSE"
def normalize_currency(value) -> str:
    currency = str(value or "INR").strip().upper()
    return currency if currency in {"INR", "USD"} else "INR"


def amount_to_inr(amount, currency) -> float:
    normalized_currency = normalize_currency(currency)
    return float(amount) * (USD_TO_INR_RATE if normalized_currency == "USD" else 1.0)


class MongoExpenseStore:
    def __init__(self, uri: str, db_name: str) -> None:
        self.uri = uri
        self.db_name = db_name
        self.client = None
        self.db = None
        self.expenses = None
        self.users = None
        self.error = None
        self._last_connect_attempt = 0.0
        self._retry_cooldown_seconds = 3.0

        if not self.uri:
            self.error = "MongoDB connection string is not configured."
            return

        self._connect(force=True)

    def _connect(self, force: bool = False) -> bool:
        if not self.uri:
            self.error = "MongoDB connection string is not configured."
            return False

        now = time.monotonic()
        if not force and (now - self._last_connect_attempt) < self._retry_cooldown_seconds:
            return self.is_ready

        self._last_connect_attempt = now

        try:
            client = MongoClient(
                self.uri,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=5000,
                socketTimeoutMS=5000,
            )
            client.admin.command("ping")

            db = client[self.db_name]
            expenses = db["expenses"]
            users = db["users"]
            expenses.create_index([("user_id", 1), ("date", -1), ("createdAt", -1)])
            users.create_index(
                "user_id",
                unique=True,
                partialFilterExpression={"user_id": {"$type": "string"}},
            )

            self.client = client
            self.db = db
            self.expenses = expenses
            self.users = users
            self.error = None
            return True
        except Exception as exc:
            self.client = None
            self.db = None
            self.expenses = None
            self.users = None
            self.error = str(exc)
            return False

    def ensure_ready(self) -> bool:
        if self.is_ready:
            return True
        return self._connect()

    @property
    def is_ready(self) -> bool:
        return self.client is not None and self.db is not None and self.error is None

    def ensure_user(self, user: dict) -> None:
        if not self.is_ready:
            raise RuntimeError(self.error or "MongoDB is unavailable.")

        now = datetime.utcnow().isoformat()
        username = user.get("email", "").split("@")[0].strip() or user["id"]
        self.users.update_one(
            {"user_id": user["id"]},
            {
                "$set": {
                    "email": user.get("email", ""),
                    "name": user.get("name", ""),
                    "username": username,
                    "updatedAt": now,
                },
                "$setOnInsert": {
                    "user_id": user["id"],
                    "createdAt": now,
                },
            },
            upsert=True,
        )

    def get_user_budget(self, user: dict) -> float:
        if not self.is_ready:
            raise RuntimeError(self.error or "MongoDB is unavailable.")

        self.ensure_user(user)
        doc = self.users.find_one({"user_id": user["id"]}, {"monthly_budget": 1})
        raw_budget = (doc or {}).get("monthly_budget", DEFAULT_MONTHLY_BUDGET)
        try:
            budget = float(raw_budget)
        except (TypeError, ValueError):
            budget = DEFAULT_MONTHLY_BUDGET
        return budget if budget > 0 else DEFAULT_MONTHLY_BUDGET

    def set_user_budget(self, user: dict, monthly_budget: float) -> float:
        if not self.is_ready:
            raise RuntimeError(self.error or "MongoDB is unavailable.")

        self.ensure_user(user)
        budget = float(monthly_budget)
        self.users.update_one(
            {"user_id": user["id"]},
            {
                "$set": {
                    "monthly_budget": budget,
                    "updatedAt": datetime.utcnow().isoformat(),
                }
            },
        )
        return budget

    def create_expense(self, user: dict, expense: dict) -> dict:
        if not self.is_ready:
            raise RuntimeError(self.error or "MongoDB is unavailable.")

        self.ensure_user(user)
        payload = {
            **expense,
            "user_id": user["id"],
            "user_email": user.get("email", ""),
            "user_name": user.get("name", ""),
        }
        result = self.expenses.insert_one(payload)
        payload["id"] = str(result.inserted_id)
        payload.pop("_id", None)
        return payload

    def list_expenses(
        self,
        user_id: str,
        start_date: str | None = None,
        end_date: str | None = None,
        category: str | None = None,
    ) -> list[dict]:
        if not self.is_ready:
            raise RuntimeError(self.error or "MongoDB is unavailable.")

        query: dict = {"user_id": user_id}
        date_filter = {}
        if start_date:
            date_filter["$gte"] = start_date
        if end_date:
            date_filter["$lte"] = end_date
        if date_filter:
            query["date"] = date_filter
        if category and category != "All Categories":
            query["category"] = category

        docs = list(self.expenses.find(query).sort([("date", -1), ("createdAt", -1)]))
        expenses = []
        for doc in docs:
            doc["id"] = str(doc.pop("_id"))
            expenses.append(doc)
        return expenses

    def delete_expense(self, user_id: str, expense_id: str) -> bool:
        if not self.is_ready:
            raise RuntimeError(self.error or "MongoDB is unavailable.")

        if not ObjectId.is_valid(expense_id):
            return False

        result = self.expenses.delete_one({"_id": ObjectId(expense_id), "user_id": user_id})
        return result.deleted_count > 0

    def clear_expenses(self, user_id: str) -> int:
        if not self.is_ready:
            raise RuntimeError(self.error or "MongoDB is unavailable.")

        result = self.expenses.delete_many({"user_id": user_id})
        return result.deleted_count

    def count_expenses(self) -> int:
        if not self.is_ready:
            return 0
        return self.expenses.count_documents({})


expense_store = MongoExpenseStore(MONGODB_URI, MONGODB_DB_NAME)


def get_request_user():
    user_id = str(request.headers.get("X-User-Id", "")).strip()
    user_email = str(request.headers.get("X-User-Email", "")).strip().lower()
    user_name = str(request.headers.get("X-User-Name", "")).strip()

    if not user_id:
        return None, jsonify({"error": "User context is required for this request."}), 401

    return {
        "id": user_id,
        "email": user_email,
        "name": user_name,
    }, None, None


def require_expense_store():
    if expense_store.ensure_ready():
        return None
    return jsonify({"error": "Expense data is temporarily unavailable. Reconnecting to storage."}), 503


class ReceiptProcessor:
    def __init__(self) -> None:
        self.service_error = None
        self.ocr_service = None
        self._ocr_init_lock = threading.Lock()
        self._ocr_init_attempted = False

    @property
    def is_ready(self) -> bool:
        return self.ocr_service is not None

    @property
    def is_initialized(self) -> bool:
        return self._ocr_init_attempted

    def _ensure_ocr_service(self) -> bool:
        if self.ocr_service is not None:
            return True

        with self._ocr_init_lock:
            if self.ocr_service is not None:
                return True

            self._ocr_init_attempted = True
            self.service_error = None

            try:
                self.ocr_service = OCRService(models_dir=str(OCR_MODELS_DIR), use_gpu=False)
                return True
            except Exception as exc:
                self.ocr_service = None
                self.service_error = str(exc)
                print(f"OCR service failed to initialize: {exc}")
                return False

    def process_image_upload(self, file_storage):
        suffix = Path(file_storage.filename or "receipt.jpg").suffix or ".jpg"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_path = temp_file.name
            file_storage.save(temp_path)

        try:
            return self._build_receipt_payload(temp_path, source="image")
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    def process_pdf_upload(self, file_storage):
        pdf_bytes = file_storage.read()
        extracted_text = self._extract_text_from_pdf(pdf_bytes)

        if extracted_text.strip():
            parsed = self._build_text_payload(extracted_text, source="pdf_text")
        else:
            image_path = self._render_pdf_page_to_image(pdf_bytes)
            try:
                parsed = self._build_receipt_payload(image_path, source="pdf_ocr")
            finally:
                if image_path and os.path.exists(image_path):
                    os.remove(image_path)

        parsed["file_type"] = "pdf"
        parsed["filename"] = file_storage.filename
        return parsed

    def _build_receipt_payload(self, image_path: str, source: str):
        if not self._ensure_ocr_service():
            return self._manual_entry_payload(
                message=self.service_error or "OCR service is not available.",
                source=source,
            )

        result = self.ocr_service.process_receipt(image_path)
        raw_text = result.get("raw_text", "").strip()
        parsed = self._build_text_payload(
            raw_text,
            source=source,
            default_category=result.get("category"),
            default_amount=result.get("amount"),
            default_date=result.get("date"),
            ocr_backend=result.get("ocr_backend"),
            all_amounts=result.get("all_amounts", []),
        )
        parsed["confidence"] = 0.82 if raw_text else 0.35
        return parsed

    @staticmethod
    def _parse_amount_value(raw: str) -> float:
        try:
            return round(float(str(raw).replace(",", "")), 2)
        except (TypeError, ValueError):
            return 0.0

    @staticmethod
    def _normalize_spaced_amounts(text: str) -> str:
        normalized = str(text or "")
        normalized = re.sub(r"(?<=\d)\s*\.\s*(?=\d)", ".", normalized)
        return normalized

    @staticmethod
    def _is_valid_date_string(value: str | None) -> bool:
        if not value:
            return False
        try:
            datetime.strptime(str(value), "%Y-%m-%d")
            return True
        except (TypeError, ValueError):
            return False

    def _extract_line_amounts(self, line: str) -> list[float]:
        if not line:
            return []

        lower = line.lower()
        if any(
            token in lower
            for token in (
                "gst no",
                "gstin",
                "phone",
                "mobile",
                "invoice no",
                "bill no",
                "token no",
                "order id",
                "state code",
                "merchant id",
                "approval code",
                "transaction id",
                "ref #",
                "ref#",
                "act #",
                "point opening",
                "point collected",
                "point redeem",
                "point balance",
                "card no",
                "incard no",
                "receipt status",
            )
        ):
            return []

        values = []
        for match in re.finditer(r"\d+(?:,\d{3})*(?:\.\d{1,2})?", line):
            token = match.group(0)
            start = match.start()
            end = match.end()
            context = line[max(0, start - 6) : min(len(line), end + 6)].lower()
            before = line[start - 1] if start > 0 else ""
            after = line[end] if end < len(line) else ""

            if "/" in context or "-" in context or ":" in context:
                continue
            if before.isdigit() or after.isdigit():
                continue
            if re.fullmatch(r"\d{4}", token):
                continue
            if len(token) >= 6 and "." not in token:
                continue
            if "total item qty" in lower or "item qty" in lower:
                continue
            if before.isalpha() or after.isalpha():
                continue

            value = self._parse_amount_value(token)
            if value > 0:
                values.append(value)

        return values

    def _build_text_payload(
        self,
        extracted_text: str,
        source: str,
        default_category: str | None = None,
        default_amount: float | None = None,
        default_date: str | None = None,
        ocr_backend: str | None = None,
        all_amounts: list[float] | None = None,
    ):
        clean_text = self._normalize_spaced_amounts(extracted_text).strip()
        if not clean_text:
            return self._manual_entry_payload(
                message="No readable text was found in the uploaded receipt.",
                source=source,
                ocr_backend=ocr_backend,
            )

        amounts = [float(value) for value in (all_amounts or []) if float(value) > 0]
        detected_amount = 0.0
        try:
            extracted_amounts, detected_amount = OCRService.extract_bill_amount(clean_text)
            amounts = sorted(set([*amounts, *[float(value) for value in extracted_amounts if float(value) > 0]]), reverse=True)
        except Exception:
            extracted_amounts = []
        labeled_total = self._extract_labeled_total(clean_text)
        if labeled_total > 0:
            amounts = sorted(set([*amounts, labeled_total]), reverse=True)
        inferred_amount = self._infer_total_from_item_rows(clean_text)
        if inferred_amount > 0:
            amounts = sorted(set([*amounts, inferred_amount]), reverse=True)

        def is_implausible_ocr_merge(value: float) -> bool:
            if value < 10000:
                return False

            compact = str(int(round(value)))
            if len(compact) < 5:
                return False

            has_repeated_halves = len(compact) % 2 == 0 and compact[: len(compact) // 2] == compact[len(compact) // 2 :]
            has_misaligned_qty_price_pattern = bool(re.search(r"(?:\d{2,3})0$", compact) or re.search(r"(?:\d{3}){2,}", compact))
            return has_repeated_halves or has_misaligned_qty_price_pattern

        def score_amount_candidate(value: float) -> int:
            if not value or value <= 0:
                return -999

            variants = {
                f"{value:.2f}",
                str(int(value)) if float(value).is_integer() else "",
            }
            score = 0
            for line in clean_text.splitlines():
                lower = line.lower()
                if not any(token and token in line for token in variants):
                    continue

                if "net to pay" in lower:
                    score += 95
                elif "pls pay" in lower or "please pay" in lower:
                    score += 90
                elif "grand total" in lower:
                    score += 80
                elif "net total" in lower or "invoice total" in lower or "amount due" in lower:
                    score += 65
                elif re.search(r"\btotal\b", lower):
                    score += 50

                if any(token in lower for token in ("cgst", "sgst", "igst", "vat", "tax", "round off", "item qty")):
                    score -= 40

                number_count = len(re.findall(r"\d+(?:[.,]\d+)?", line))
                if number_count >= 3 and "total" not in lower:
                    score -= 20
            return score

        if detected_amount > 0:
            current_amount = float(default_amount) if default_amount and default_amount > 0 else 0.0
            detected_score = score_amount_candidate(detected_amount)
            current_score = score_amount_candidate(current_amount) if current_amount > 0 else -999
            is_suspicious_downgrade = current_amount > 0 and detected_amount < current_amount * 0.5
            is_implausible_upgrade = current_amount > 0 and detected_amount > current_amount * 5 and is_implausible_ocr_merge(detected_amount)

            if (
                not current_amount
                or not is_suspicious_downgrade
                and not is_implausible_upgrade
                and (
                    detected_score > current_score
                    or (detected_score == current_score and detected_amount > current_amount)
                )
            ):
                default_amount = detected_amount

        if labeled_total > 0 and (
            not default_amount
            or default_amount <= 0
            or score_amount_candidate(labeled_total) > score_amount_candidate(float(default_amount))
            or (
                score_amount_candidate(labeled_total) == score_amount_candidate(float(default_amount))
                and labeled_total <= float(default_amount) * 1.25
            )
        ):
            default_amount = labeled_total

        if inferred_amount > 0 and (
            not default_amount
            or default_amount <= 0
            or (
                inferred_amount > float(default_amount) * 2
                and not is_implausible_ocr_merge(inferred_amount)
            )
            or score_amount_candidate(inferred_amount) > score_amount_candidate(float(default_amount))
        ):
            default_amount = inferred_amount

        unique_amounts = sorted(set(amounts), reverse=True)
        amount = round(float(default_amount), 2) if default_amount and default_amount > 0 else (
            round(unique_amounts[0], 2) if unique_amounts else 0
        )
        category = self._normalize_category(default_category or self._predict_category(clean_text))
        category = self._normalize_category(self._fallback_category_from_text(clean_text, category))
        vendor = self._extract_vendor(clean_text)
        date_value = default_date if self._is_valid_date_string(default_date) else self._extract_date(clean_text)
        currency = self._detect_currency(clean_text)
        items = self._extract_items(clean_text)

        if amount <= 0:
            return self._manual_entry_payload(
                message="OCR ran, but the total amount could not be detected confidently.",
                source=source,
                ocr_backend=ocr_backend,
                extracted_text=clean_text,
                vendor=vendor,
                date_value=date_value,
                category=category,
                items=items,
            )

        return {
            "success": True,
            "manual_entry_required": False,
            "vendor": vendor,
            "amount": amount,
            "total_amount": amount,
            "currency": currency,
            "date": date_value,
            "items": items,
            "category": category,
            "confidence": 0.74,
            "ocr_backend": ocr_backend or "pdf-text",
            "source": source,
            "extracted_text": clean_text,
        }

    def _extract_labeled_total(self, text: str) -> float:
        collapsed = re.sub(r"\s+", " ", text).strip()
        if collapsed:
            explicit_match = re.search(
                r"(?:pls\.?\s*pay|please\s*pay|net\s*to\s*pay|grand\s*total|amount\s*due|net\s*total|total\s*payable)[^0-9]{0,20}(\d+(?:,\d{3})*(?:\.\d{1,2})?)",
                collapsed,
                flags=re.IGNORECASE,
            )
            if explicit_match:
                explicit_value = self._parse_amount_value(explicit_match.group(1))
                if explicit_value > 0:
                    return explicit_value

        lines = [line.strip() for line in text.splitlines() if line.strip()]
        if not lines:
            return 0.0

        def find_labeled_values(labels: tuple[str, ...]) -> list[float]:
            values = []
            for line in lines:
                lower = line.lower()
                if any(
                    token in lower
                    for token in (
                        "total item qty",
                        "qty.",
                        "gst",
                        "phone",
                        "state code",
                        "plot no",
                    )
                ):
                    continue
                if any(re.search(label, line, flags=re.IGNORECASE) for label in labels):
                    values.extend(self._extract_line_amounts(line))
            return values

        grand_total_values = find_labeled_values(
            (
                r"net\s*to\s*pay",
                r"pls\.?\s*pay",
                r"please\s*pay",
                r"grand\s*total",
                r"amount\s*due",
                r"net\s*total",
                r"total\s*payable",
            )
        )
        if grand_total_values:
            return max(grand_total_values)

        total_values = find_labeled_values((r"invoice\s*total", r"(?<!grand\s)\btotal\b"))
        gst_values = find_labeled_values((r"\bcgst\b", r"\bsgst\b", r"\bigst\b", r"\bvat\b", r"\btax\b"))

        if total_values and gst_values:
            highest_total = max(total_values)
            highest_tax = max(gst_values)
            combined = round(highest_total + highest_tax, 2)
            if combined > highest_total:
                return combined

        if total_values:
            return max(total_values)

        return 0.0

    def _infer_total_from_item_rows(self, text: str) -> float:
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        if not lines:
            return 0.0

        item_row_totals = []
        tax_total = 0.0
        round_off = 0.0
        subtotal_candidates = []
        grand_total_candidates = []

        for line in lines:
            lower = line.lower()
            if any(
                token in lower
                for token in (
                    "gst no",
                    "gstin",
                    "phone",
                    "mobile",
                    "state code",
                    "plot no",
                    "date & time",
                    "invoice no",
                    "bill no",
                )
            ):
                continue

            values = self._extract_line_amounts(line)

            if not values:
                continue

            if any(token in lower for token in ("grand total", "amount due", "net total", "invoice total", "payable", "pls pay", "please pay")):
                grand_total_candidates.append(max(values))
                continue

            if "total item qty" in lower or "item qty" in lower:
                continue

            if re.search(r"\btotal\b", lower) and "subtotal" not in lower and "grand total" not in lower:
                subtotal_candidates.append(max(values))
                continue

            if any(token in lower for token in ("cgst", "sgst", "igst", "vat", "tax", "service charge", "service tax")):
                tax_total += max(values)
                continue

            if "round off" in lower:
                round_off += max(values)
                continue

            if len(values) >= 2 and re.search(r"[a-zA-Z]", line):
                item_row_totals.append(values[-1])

        if grand_total_candidates:
            return round(max(grand_total_candidates), 2)

        if subtotal_candidates and tax_total > 0:
            return round(max(subtotal_candidates) + tax_total + round_off, 2)

        if item_row_totals:
            inferred_subtotal = round(sum(item_row_totals), 2)
            if tax_total > 0 or round_off > 0:
                return round(inferred_subtotal + tax_total + round_off, 2)
            return inferred_subtotal

        return 0.0

    def _manual_entry_payload(
        self,
        message: str,
        source: str,
        ocr_backend: str | None = None,
        extracted_text: str = "",
        vendor: str = "",
        date_value: str | None = None,
        category: str = "Other",
        items: list[str] | None = None,
    ):
        return {
            "success": True,
            "manual_entry_required": True,
            "message": message,
            "vendor": vendor or "",
            "amount": 0,
            "total_amount": 0,
            "currency": self._detect_currency(extracted_text),
            "date": date_value or datetime.now().strftime("%Y-%m-%d"),
            "items": items or [],
            "category": self._normalize_category(category),
            "confidence": 0.2,
            "ocr_backend": ocr_backend or "unavailable",
            "source": source,
            "extracted_text": extracted_text,
        }

    def _extract_text_from_pdf(self, pdf_bytes: bytes) -> str:
        text_chunks = []

        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_pdf:
                temp_pdf.write(pdf_bytes)
                temp_pdf_path = temp_pdf.name

            try:
                with pdfplumber.open(temp_pdf_path) as pdf:
                    for page in pdf.pages:
                        page_text = page.extract_text() or ""
                        if page_text.strip():
                            text_chunks.append(page_text)
            finally:
                if os.path.exists(temp_pdf_path):
                    os.remove(temp_pdf_path)
        except Exception as exc:
            print(f"pdfplumber extraction failed: {exc}")

        if text_chunks:
            return "\n".join(text_chunks)

        try:
            from io import BytesIO

            pdf_stream = BytesIO(pdf_bytes)
            reader = PyPDF2.PdfReader(pdf_stream)
            for page in reader.pages:
                page_text = page.extract_text() or ""
                if page_text.strip():
                    text_chunks.append(page_text)
        except Exception as exc:
            print(f"PyPDF2 extraction failed: {exc}")

        return "\n".join(text_chunks)

    def _render_pdf_page_to_image(self, pdf_bytes: bytes) -> str | None:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        try:
            if doc.page_count == 0:
                return None

            page = doc.load_page(0)
            pixmap = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0))
            with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as temp_image:
                temp_image.write(pixmap.tobytes("png"))
                return temp_image.name
        finally:
            doc.close()

    def _extract_vendor(self, text: str) -> str:
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        blacklist = {
            "tax invoice",
            "invoice",
            "receipt",
            "bill",
            "cash memo",
            "payment receipt",
        }

        slogan_header_match = re.match(r"\s*([A-Z][A-Za-z&.'*-]{2,40})\s+Save money", text, flags=re.IGNORECASE)
        if slogan_header_match:
            return slogan_header_match.group(1).strip()[:80]

        if "store" in text.lower():
            leading_tokens = re.findall(r"\b[A-Z][A-Z&.'*-]{2,}\b", text[:120])
            for token in leading_tokens:
                if token.lower() not in {"invoice", "receipt", "tax", "plot", "state", "phone", "name", "date", "cash"}:
                    return f"{token} STORE"[:80]

        if len(lines) <= 2:
            header_match = re.search(
                r"\b(?:receipt|invoice|tax invoice)\b\s+([A-Z][A-Za-z&.' -]{2,60}?(?:clinic|store|mart|medical|pharmacy|hospital|restaurant|cafe|veterinary clinic))\b",
                text,
                flags=re.IGNORECASE,
            )
            if header_match:
                return re.sub(r"\s+", " ", header_match.group(1)).strip()[:80]

        uppercase_header_match = re.search(
            r"\b([A-Z][A-Z&.' -]{3,60}?(?:PHARMACY|CLINIC|STORE|MART|MEDICAL|HOSPITAL|CAFE|RESTAURANT))\b",
            text,
        )
        if uppercase_header_match:
            return re.sub(r"\s+", " ", uppercase_header_match.group(1)).strip()[:80]

        def looks_like_item_row(value: str) -> bool:
            compact = re.sub(r"\s+", " ", value).strip()
            if not compact:
                return False
            return bool(
                re.search(r"\b\d+\s+\d+(?:[.,]\d{1,2})\s+\d+(?:[.,]\d{1,2})\b", compact)
                or re.search(r"\b\d+(?:[.,]\d{1,2})\s+\d+(?:[.,]\d{1,2})\b", compact)
            )

        for index, line in enumerate(lines[:8]):
            normalized = re.sub(r"[^a-zA-Z0-9&.' -]", "", line).strip()
            if len(normalized) < 3:
                continue
            lower = normalized.lower()
            if lower in blacklist:
                continue
            if any(token in lower for token in ["gst", "invoice no", "phone", "table", "server", "order id"]):
                continue
            if re.search(r"\d{3,}", normalized):
                continue
            if looks_like_item_row(line):
                continue
            prev_line = lines[index - 1] if index > 0 else ""
            next_line = lines[index + 1] if index + 1 < len(lines) else ""
            if looks_like_item_row(prev_line) or looks_like_item_row(next_line):
                continue
            return normalized[:80]

        return "Unknown Vendor"

    def _extract_date(self, text: str) -> str:
        current_year = datetime.now().year
        text = re.sub(r"\b(20\d)[sS]\b", lambda m: f"{m.group(1)}{str(current_year)[-1]}", text)
        text = re.sub(r"\b(20\d)[oO]\b", r"\g<1>0", text)

        def normalize_year(raw_year: str) -> int | None:
            try:
                year = int(raw_year)
            except ValueError:
                return None

            if len(raw_year) == 2:
                candidate = 2000 + year
                return candidate if candidate <= current_year + 1 else 1900 + year

            return year

        def build_date(day: str, month: str, year: str) -> str | None:
            normalized_year = normalize_year(year)
            if normalized_year is None:
                return None

            try:
                parsed = datetime.strptime(
                    f"{int(day):02d} {month} {normalized_year}",
                    "%d %m %Y",
                )
            except ValueError:
                try:
                    parsed = datetime.strptime(
                        f"{int(day):02d} {month} {normalized_year}",
                        "%d %b %Y",
                    )
                except ValueError:
                    try:
                        parsed = datetime.strptime(
                            f"{int(day):02d} {month} {normalized_year}",
                            "%d %B %Y",
                        )
                    except ValueError:
                        return None

            if 2000 <= parsed.year <= current_year + 1:
                return parsed.strftime("%Y-%m-%d")
            return None

        direct_patterns = [
            (r"\b(\d{4})-(\d{2})-(\d{2})\b", lambda m: f"{m.group(1)}-{m.group(2)}-{m.group(3)}"),
            (
                r"\b(\d{1,2})([A-Za-z]{3,9})(\d{2,4})(?=\d{1,2}:\d{2}(?:\s*[APMapm]{2})?)",
                lambda m: build_date(m.group(1), m.group(2), m.group(3)),
            ),
            (
                r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})(?=\d{1,2}:\d{2}(?:\s*[APMapm]{2})?)",
                lambda m: (
                    lambda parts: build_date(
                        parts[1] if parts[1].isdigit() and int(parts[1]) > 12 and parts[0].isdigit() and int(parts[0]) <= 12 else parts[0],
                        parts[0] if parts[1].isdigit() and int(parts[1]) > 12 and parts[0].isdigit() and int(parts[0]) <= 12 else parts[1],
                        parts[2],
                    )
                )(re.split(r"[/-]", m.group(1))),
            ),
            (
                r"\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b",
                lambda m: build_date(
                    m.group(2) if m.group(2).isdigit() and int(m.group(2)) > 12 and m.group(1).isdigit() and int(m.group(1)) <= 12 else m.group(1),
                    m.group(1) if m.group(2).isdigit() and int(m.group(2)) > 12 and m.group(1).isdigit() and int(m.group(1)) <= 12 else m.group(2),
                    m.group(3),
                ),
            ),
            (r"\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})\b", lambda m: build_date(m.group(1), m.group(2), m.group(3))),
            (r"\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{2,4})\b", lambda m: build_date(m.group(2), m.group(1), m.group(3))),
            (r"\b(\d{1,2})([A-Za-z]{3,9})(\d{2,4})\b", lambda m: build_date(m.group(1), m.group(2), m.group(3))),
        ]

        for pattern, parser in direct_patterns:
            for match in re.finditer(pattern, text):
                try:
                    parsed_value = parser(match)
                    if parsed_value:
                        return parsed_value
                except (ValueError, OverflowError):
                    continue

        fallback_patterns = [
            r"\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}\b",
            r"\b[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4}\b",
        ]

        for pattern in fallback_patterns:
            for match in re.findall(pattern, text):
                try:
                    parsed = date_parser.parse(match, fuzzy=False, dayfirst=True)
                    if 2000 <= parsed.year <= current_year + 1:
                        return parsed.strftime("%Y-%m-%d")
                except (ValueError, OverflowError):
                    continue

        return datetime.now().strftime("%Y-%m-%d")

    def _extract_items(self, text: str) -> list[str]:
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        if not lines:
            return []

        def normalize_item_candidate(value: str) -> str:
            candidate = re.sub(r"^\d{2}[-/]\d{2}[-/]\d{2,4}\s+[A-Za-z]+\s+\d+\s+", "", value, flags=re.IGNORECASE)
            candidate = re.sub(r"^[\d.\-:\s]+", "", candidate).strip(" -:.")
            candidate = re.sub(r"(?:\s+\d[\dA-Za-z.,/-]*){1,3}\s*$", "", candidate).strip(" -:.")
            candidate = re.sub(r"[^A-Za-z0-9&'() /.-]", "", candidate)
            candidate = re.sub(r"\(\s*\)", "", candidate)
            candidate = re.sub(r"\s+", " ", candidate).strip()
            return candidate

        def is_valid_item_candidate(candidate: str) -> bool:
            if len(candidate) < 3:
                return False
            lower_candidate = candidate.lower()
            if lower_candidate in {"item", "qty", "price", "amount", "name", "cashier", "date", "for", "date for"}:
                return False
            invalid_tokens = (
                "invoice",
                "contact",
                "gst",
                "bill no",
                "date",
                "cashier",
                "phone",
                "waiter",
                "table",
                "thank you",
                "amount",
                "subtotal",
                "total",
                "tax",
                "dhaba",
                "road",
                "superstore",
                "customer copy",
                "amount due",
                "cash sales",
            )
            return not any(token in lower_candidate for token in invalid_tokens)

        def extract_name_from_numeric_row(line: str) -> str | None:
            line = re.sub(r"\s+[A-Z]\d\s*$", "", line).strip()

            qty_first_match = re.match(
                r"^(?:[\dILl.,]+)\s+(?P<name>[A-Za-z][A-Za-z&'() /.-]{2,}?)\s+(?:[$€£₹]?\s*[\dILl.,]+)(?:\s+(?:[$€£₹]?\s*[\dILl.,]+)){0,2}$",
                line,
                flags=re.IGNORECASE,
            )
            if qty_first_match:
                return qty_first_match.group("name")

            name_first_match = re.match(
                r"^(?P<name>[A-Za-z][A-Za-z&'() /.-]{2,}?)\s+(?:[\dILl.,]+)(?:\s+(?:[$€£₹]?\s*[\dILl.,]+)){1,3}$",
                line,
                flags=re.IGNORECASE,
            )
            if name_first_match:
                return name_first_match.group("name")

            trailing_price_match = re.match(
                r"^(?P<name>[A-Za-z][A-Za-z&'() /.-]{2,}?)\s+(?:[$€£₹]?\s*[\dILl.,]+)(?:\s+[A-Z]\d)?$",
                line,
                flags=re.IGNORECASE,
            )
            if trailing_price_match:
                return trailing_price_match.group("name")

            return None

        items = []
        in_item_section = False
        stop_tokens = (
            "total",
            "subtotal",
            "sgst",
            "cgst",
            "igst",
            "tax",
            "grand total",
            "round off",
            "merchant id",
            "approval code",
            "mastercard",
            "visa",
            "your card balance",
            "old balance",
            "charges",
            "payments",
            "doctor's instructions",
            "doctors instructions",
            "reminders for",
        )

        for line in lines:
            lower = line.lower()

            if not in_item_section:
                if ("item" in lower or "description" in lower) and ("qty" in lower or "price" in lower or "amount" in lower):
                    in_item_section = True
                continue

            if any(token in lower for token in stop_tokens):
                break

            if not any(char.isdigit() for char in line):
                continue

            candidate = normalize_item_candidate(line)

            if not is_valid_item_candidate(candidate):
                continue
            if candidate not in items:
                items.append(candidate)
            if len(items) == 25:
                break

        section_items = items

        row_items = []
        pending_parts = []
        row_section_started = False
        header_tokens = ("item", "description", "particular", "particulars", "name")
        metric_tokens = ("qty", "quantity", "price", "amount", "value", "rate", "piice")

        for line in lines:
            lower = line.lower()

            if any(token in lower for token in stop_tokens):
                break

            if not row_section_started:
                if any(token in lower for token in header_tokens) and any(token in lower for token in metric_tokens):
                    row_section_started = True
                    continue
                if extract_name_from_numeric_row(line):
                    row_section_started = True
                elif any(char.isdigit() for char in line):
                    continue
                else:
                    continue

            name_from_row = extract_name_from_numeric_row(line)
            if name_from_row:
                combined_name = " ".join(part for part in [*pending_parts, name_from_row] if part)
                candidate = normalize_item_candidate(combined_name)
                pending_parts = []
                if not is_valid_item_candidate(candidate):
                    continue
                if candidate not in row_items:
                    row_items.append(candidate)
                if len(row_items) == 25:
                    break
                continue

            alpha_candidate = normalize_item_candidate(line)
            if is_valid_item_candidate(alpha_candidate) and not any(char.isdigit() for char in line):
                pending_parts.append(alpha_candidate)
                continue

            if pending_parts:
                candidate = normalize_item_candidate(" ".join(pending_parts))
                pending_parts = []
                if is_valid_item_candidate(candidate) and candidate not in row_items:
                    row_items.append(candidate)
                if len(row_items) == 25:
                    break

        if pending_parts:
            candidate = normalize_item_candidate(" ".join(pending_parts))
            if is_valid_item_candidate(candidate) and candidate not in row_items:
                row_items.append(candidate)

        if row_items:
            return row_items

        menu_row_pattern = re.compile(
            r"^(?P<name>[A-Za-z][A-Za-z&'() /.-]{2,}?)\s+(?P<n1>[\dILl.,]+)\s+(?P<n2>[\dILl.,]+)(?:\s+(?P<n3>[\dILl.,]+))?$",
            flags=re.IGNORECASE,
        )
        row_items = []
        for line in lines:
            lower = line.lower()
            if any(token in lower for token in stop_tokens):
                continue
            match = menu_row_pattern.match(line)
            if not match:
                continue
            candidate = normalize_item_candidate(match.group("name"))
            if not is_valid_item_candidate(candidate):
                continue
            if candidate not in row_items:
                row_items.append(candidate)
            if len(row_items) == 25:
                break

        if row_items:
            return row_items

        if section_items:
            return section_items

        flat_text = re.sub(r"\s+", " ", text).strip()
        section_match = re.search(
            r"(?:item|description)\s+(?:qty|quantity)(?:\s+(?:rate|price))?(?:\s+(?:amount|total))+\s+(.*?)(?=\b(?:grand\s+total|total\s+qty|subtotal|sgst|cgst|igst|tax)\b|$)",
            flat_text,
            flags=re.IGNORECASE,
        )
        if section_match:
            section_text = section_match.group(1)
            section_text = re.sub(r"(?<=\d)\.(?=[A-Za-z])", " ", section_text)
            section_text = re.sub(r"\b([ILl])(?=[A-Z][a-z])", "", section_text)
            inline_pattern = re.compile(
                r"([A-Za-z][A-Za-z&'() /.-]{2,}?)\s+\d[\dA-Za-z.,/-]*\s+\d[\d.,/-]*(?:\s+\d[\d.,/-]*)?(?=\s+(?:[\dILl][.)]?\s*[A-Za-z]|total\b|grand\s+total\b|subtotal\b|tax\b)|$)",
                flags=re.IGNORECASE,
            )

            inline_items = []
            for match in inline_pattern.finditer(section_text):
                candidate = normalize_item_candidate(match.group(1))
                if not is_valid_item_candidate(candidate):
                    continue
                if candidate not in inline_items:
                    inline_items.append(candidate)
                if len(inline_items) == 25:
                    break

            if inline_items:
                return inline_items

        # Fallback if no item section was detected.
        fallback_items = []
        for line in lines:
            lower = line.lower()
            if any(token in lower for token in stop_tokens):
                continue
            candidate = re.sub(r"\s+\d[\d.,/:%-]*.*$", "", line).strip(" -:.")
            candidate = normalize_item_candidate(candidate)

            if not is_valid_item_candidate(candidate):
                continue
            if candidate not in fallback_items:
                fallback_items.append(candidate)
            if len(fallback_items) == 25:
                break

        return fallback_items

    def _predict_category(self, text: str) -> str:
        if self.ocr_service is None:
            return "Other"

        try:
            category = self.ocr_service.predict_category(text)
            category = self.ocr_service.refine_category(text, category)
            normalized = str(category or "").strip().lower()
            text_lower = str(text or "").lower()

            if normalized in {"", "other", "others"}:
                if any(token in text_lower for token in ("pharmacy", "medical", "clinic", "hospital", "doctor", "medicine")):
                    return "Healthcare"

                if (
                    any(token in text_lower for token in ("store", "mart", "supermarket", "market"))
                    and any(token in text_lower for token in ("qty", "mrp", "rate", "amt", "pls pay", "bill no"))
                ):
                    return "Shopping"

            return category
        except Exception:
            return "Other"

    def _fallback_category_from_text(self, text: str, current_category: str | None = None) -> str:
        normalized = str(current_category or "").strip().lower()
        if normalized not in {"", "other", "others"}:
            return current_category or "Other"

        text_lower = str(text or "").lower()

        if any(token in text_lower for token in ("pharmacy", "medical", "clinic", "hospital", "doctor", "medicine")):
            return "Healthcare"

        if (
            any(token in text_lower for token in ("store", "mart", "supermarket", "market"))
            and any(token in text_lower for token in ("qty", "mrp", "rate", "amt", "pls pay", "bill no"))
        ):
            return "Shopping"

        return current_category or "Other"

    def _normalize_category(self, category: str | None) -> str:
        if not category:
            return "Other"

        mapping = {
            "food": "Food & Dining",
            "food & dining": "Food & Dining",
            "transport": "Transportation",
            "transportation": "Transportation",
            "bills": "Bills & Utilities",
            "bills & utilities": "Bills & Utilities",
            "healthcare": "Healthcare",
            "shopping": "Shopping",
            "entertainment": "Entertainment",
            "groceries": "Groceries",
            "others": "Other",
            "other": "Other",
        }

        normalized = category.strip().lower()
        return mapping.get(normalized, category.strip())

    def _detect_currency(self, text: str) -> str:
        text_lower = text.lower()

        # Strong Indian receipt indicators should win over OCR artifacts like "Molly'$ Cafe".
        if any(token in text_lower for token in ("gstin", "sgst", "cgst", "igst", "rs.", "inr", "rupees")):
            return "INR"

        # Treat USD only when the symbol is used like a currency amount or USD words are present.
        if re.search(r"\$\s*\d", text) or "usd" in text_lower or "dollar" in text_lower:
            return "USD"
        return "INR"


receipt_processor = ReceiptProcessor()


@app.route("/api/process-bill", methods=["POST"])
def process_bill():
    try:
        uploaded_file = request.files.get("file") or request.files.get("image") or request.files.get("pdf")
        if uploaded_file is None:
            return jsonify({"error": "No receipt file was provided"}), 400

        if not uploaded_file.filename:
            return jsonify({"error": "No receipt file selected"}), 400

        filename = uploaded_file.filename.lower()
        content_type = str(uploaded_file.content_type or "").lower()
        is_pdf = filename.endswith(".pdf") or "pdf" in content_type

        if is_pdf:
            result = receipt_processor.process_pdf_upload(uploaded_file)
            return jsonify(result)

        result = receipt_processor.process_image_upload(uploaded_file)
        result["file_type"] = "image"
        result["filename"] = uploaded_file.filename
        return jsonify(result)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/categorize-expense", methods=["POST"])
def categorize_expense():
    try:
        data = request.get_json(silent=True) or {}
        description = str(data.get("description", ""))
        category = receipt_processor._normalize_category(receipt_processor._predict_category(description))
        return jsonify({"success": True, "category": category})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/expenses", methods=["GET", "POST"])
def expenses():
    try:
        store_error = require_expense_store()
        if store_error:
            return store_error

        user, error_response, status_code = get_request_user()
        if error_response:
            return error_response, status_code

        if request.method == "POST":
            data = request.get_json(silent=True) or {}

            required_fields = ["vendor", "amount", "category"]
            for field in required_fields:
                if field not in data:
                    return jsonify({"error": f"Missing required field: {field}"}), 400

            vendor = str(data["vendor"]).strip()
            if not vendor:
                return jsonify({"error": "Vendor name cannot be empty"}), 400

            try:
                amount = float(data["amount"])
            except (TypeError, ValueError):
                return jsonify({"error": "Amount must be a valid number"}), 400

            if amount <= 0:
                return jsonify({"error": "Amount must be greater than 0"}), 400

            category = str(data["category"]).strip()
            if not category:
                return jsonify({"error": "Category cannot be empty"}), 400

            current_timestamp = datetime.now()
            expense = {
                "vendor": vendor,
                "amount": amount,
                "currency": normalize_currency(data.get("currency", "INR")),
                "category": category,
                "date": str(data.get("date") or current_timestamp.strftime("%Y-%m-%d")),
                "time": current_timestamp.strftime("%H:%M:%S"),
                "items": data.get("items", []),
                "createdAt": current_timestamp.isoformat(),
            }

            stored_expense = expense_store.create_expense(user, expense)

            return jsonify(
                {
                    "success": True,
                    "message": "Expense added successfully",
                    "expense": stored_expense,
                }
            )

        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")
        category = request.args.get("category")
        filtered_expenses = expense_store.list_expenses(user["id"], start_date=start_date, end_date=end_date, category=category)
        return jsonify({"success": True, "expenses": filtered_expenses, "total": len(filtered_expenses)})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/expenses/<expense_id>", methods=["DELETE"])
def delete_expense(expense_id):
    try:
        store_error = require_expense_store()
        if store_error:
            return store_error

        user, error_response, status_code = get_request_user()
        if error_response:
            return error_response, status_code

        deleted = expense_store.delete_expense(user["id"], expense_id)
        if not deleted:
            return jsonify({"error": "Expense not found"}), 404
        return jsonify({"success": True, "message": "Expense deleted successfully"})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/analytics", methods=["GET"])
def analytics():
    try:
        store_error = require_expense_store()
        if store_error:
            return store_error

        user, error_response, status_code = get_request_user()
        if error_response:
            return error_response, status_code

        expenses = expense_store.list_expenses(user["id"])
        if not expenses:
            return jsonify(
                {
                    "success": True,
                    "categoryData": [],
                    "monthlyData": [],
                    "totalExpenses": 0,
                    "averageExpense": 0,
                    "expenseCount": 0,
                }
            )

        category_totals = defaultdict(float)
        monthly_totals = defaultdict(float)

        for expense in expenses:
            amount_inr = amount_to_inr(expense["amount"], expense.get("currency"))
            category_totals[expense["category"]] += amount_inr

            try:
                expense_date = datetime.strptime(str(expense["date"]), "%Y-%m-%d")
            except (TypeError, ValueError):
                expense_date = datetime.now()

            month_key = expense_date.strftime("%Y-%m")
            monthly_totals[month_key] += amount_inr

        category_data = [{"name": category, "value": round(amount, 2)} for category, amount in category_totals.items()]
        monthly_data = [{"month": month, "amount": round(amount, 2)} for month, amount in sorted(monthly_totals.items())]
        total_expenses = sum(category_totals.values())
        average_expense = total_expenses / len(expenses)

        return jsonify(
            {
                "success": True,
                "categoryData": category_data,
                "monthlyData": monthly_data,
                "totalExpenses": round(total_expenses, 2),
                "averageExpense": round(average_expense, 2),
                "expenseCount": len(expenses),
            }
        )
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/budget", methods=["GET", "PUT"])
def budget():
    try:
        store_error = require_expense_store()
        if store_error:
            return store_error

        user, error_response, status_code = get_request_user()
        if error_response:
            return error_response, status_code

        if request.method == "PUT":
            data = request.get_json(silent=True) or {}
            raw_budget = data.get("monthly_budget")
            try:
                monthly_budget = float(raw_budget)
            except (TypeError, ValueError):
                return jsonify({"error": "Monthly budget must be a valid number."}), 400

            if monthly_budget <= 0:
                return jsonify({"error": "Monthly budget must be greater than 0."}), 400

            saved_budget = expense_store.set_user_budget(user, monthly_budget)
            return jsonify({"success": True, "monthly_budget": round(saved_budget, 2)})

        monthly_budget = expense_store.get_user_budget(user)
        return jsonify({"success": True, "monthly_budget": round(monthly_budget, 2)})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/predictions", methods=["GET"])
def predictions():
    try:
        store_error = require_expense_store()
        if store_error:
            return store_error

        user, error_response, status_code = get_request_user()
        if error_response:
            return error_response, status_code

        expenses = expense_store.list_expenses(user["id"])
        monthly_budget = expense_store.get_user_budget(user)
        payload = generate_predictions(expenses, amount_to_inr, monthly_budget)
        return jsonify(payload)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/expenses/clear", methods=["DELETE"])
def clear_expenses():
    try:
        store_error = require_expense_store()
        if store_error:
            return store_error

        user, error_response, status_code = get_request_user()
        if error_response:
            return error_response, status_code

        deleted_count = expense_store.clear_expenses(user["id"])
        return jsonify({"success": True, "message": "All expenses cleared", "deleted_count": deleted_count})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/health", methods=["GET"])
def health_check():
    expense_store.ensure_ready()
    return jsonify(
        {
            "status": "healthy",
            "ocr_ready": receipt_processor.is_ready,
            "ocr_initialized": receipt_processor.is_initialized,
            "ocr_error": receipt_processor.service_error,
            "ocr_backend": getattr(receipt_processor.ocr_service, "ocr_backend", None),
            "mongo_ready": expense_store.is_ready,
            "mongo_error": expense_store.error,
            "expenses_count": expense_store.count_expenses(),
        }
    )


if __name__ == "__main__":
    print("Starting SmartSpend backend on http://localhost:5000")
    print("OCR mode: lazy initialization")
    print(f"OCR ready: {receipt_processor.is_ready}")
    if receipt_processor.service_error:
        print(f"OCR initialization error: {receipt_processor.service_error}")
    debug_enabled = os.environ.get("SMARTSPEND_DEBUG", "").strip().lower() in {"1", "true", "yes"}
    app.run(debug=debug_enabled, host="0.0.0.0", port=5000, use_reloader=debug_enabled)
