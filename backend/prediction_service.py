from __future__ import annotations

import calendar
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LinearRegression

DEFAULT_MONTHLY_BUDGET = 10000.0


@dataclass
class MonthlyAggregate:
    key: str
    year: int
    month: int
    month_index: int
    days_in_month: int
    final_total: float
    final_count: int
    final_category_totals: dict[str, float]
    partial_total: float
    partial_count: int
    partial_category_totals: dict[str, float]
    elapsed_days: int


def _parse_expense_date(value: Any) -> datetime | None:
    try:
        return datetime.strptime(str(value), "%Y-%m-%d")
    except (TypeError, ValueError):
        return None


def _risk_label(amount: float, budget: float) -> str:
    if budget <= 0:
        budget = DEFAULT_MONTHLY_BUDGET
    ratio = amount / budget
    if ratio > 1:
        return "overspending"
    if ratio > 0.8:
        return "warning"
    return "safe"


def _risk_severity(label: str) -> int:
    order = {
        "safe": 0,
        "warning": 1,
        "overspending": 2,
    }
    return order.get(str(label or "").strip().lower(), 0)


def _max_risk_label(*labels: str) -> str:
    normalized_labels = [str(label or "").strip().lower() for label in labels if label]
    if not normalized_labels:
        return "safe"
    return max(normalized_labels, key=_risk_severity)


def _confidence_label(training_rows: int, used_fallback: bool) -> str:
    if used_fallback or training_rows < 3:
        return "low"
    if training_rows < 6:
        return "medium"
    return "high"


def _round_money(value: float) -> float:
    return round(float(value or 0.0), 2)


def _build_monthly_aggregates(
    expenses: list[dict],
    amount_to_inr,
    now: datetime,
) -> tuple[list[MonthlyAggregate], list[str], MonthlyAggregate | None]:
    grouped: dict[str, dict[str, Any]] = {}

    for expense in expenses:
        expense_date = _parse_expense_date(expense.get("date"))
        if expense_date is None:
            continue

        month_key = expense_date.strftime("%Y-%m")
        if month_key not in grouped:
            grouped[month_key] = {
                "year": expense_date.year,
                "month": expense_date.month,
                "days_in_month": calendar.monthrange(expense_date.year, expense_date.month)[1],
                "entries": [],
                "category_totals": defaultdict(float),
                "total": 0.0,
            }

        amount_inr = float(amount_to_inr(expense.get("amount", 0), expense.get("currency")))
        category = str(expense.get("category") or "Other").strip() or "Other"
        grouped[month_key]["entries"].append((expense_date.day, category, amount_inr))
        grouped[month_key]["category_totals"][category] += amount_inr
        grouped[month_key]["total"] += amount_inr

    if not grouped:
        return [], [], None

    all_categories = sorted(
        {
            category
            for month_data in grouped.values()
            for category in month_data["category_totals"].keys()
        }
    )

    ordered_keys = sorted(grouped.keys())
    current_month_key = now.strftime("%Y-%m")
    current_day = now.day
    current_days_in_month = calendar.monthrange(now.year, now.month)[1]
    progress_ratio = current_day / current_days_in_month if current_days_in_month else 1.0

    aggregates: list[MonthlyAggregate] = []
    current_aggregate = None

    for month_index, month_key in enumerate(ordered_keys):
        month_data = grouped[month_key]
        cutoff_day = max(1, min(month_data["days_in_month"], round(progress_ratio * month_data["days_in_month"])))
        if month_key == current_month_key:
            cutoff_day = min(current_day, month_data["days_in_month"])

        partial_category_totals = defaultdict(float)
        partial_total = 0.0
        partial_count = 0

        for expense_day, category, amount_inr in month_data["entries"]:
            if expense_day <= cutoff_day:
                partial_total += amount_inr
                partial_count += 1
                partial_category_totals[category] += amount_inr

        aggregate = MonthlyAggregate(
            key=month_key,
            year=month_data["year"],
            month=month_data["month"],
            month_index=month_index,
            days_in_month=month_data["days_in_month"],
            final_total=float(month_data["total"]),
            final_count=len(month_data["entries"]),
            final_category_totals={key: float(value) for key, value in month_data["category_totals"].items()},
            partial_total=float(partial_total),
            partial_count=partial_count,
            partial_category_totals={key: float(value) for key, value in partial_category_totals.items()},
            elapsed_days=cutoff_day,
        )
        aggregates.append(aggregate)
        if month_key == current_month_key:
            current_aggregate = aggregate

    return aggregates, all_categories, current_aggregate


def _feature_vector(aggregate: MonthlyAggregate, categories: list[str], budget: float) -> list[float]:
    average_transaction = aggregate.partial_total / aggregate.partial_count if aggregate.partial_count else 0.0
    daily_pace = aggregate.partial_total / aggregate.elapsed_days if aggregate.elapsed_days else 0.0
    features = [
        float(aggregate.month_index),
        float(aggregate.days_in_month),
        float(aggregate.elapsed_days),
        float(aggregate.partial_count),
        float(aggregate.partial_total),
        float(average_transaction),
        float(daily_pace),
        float(budget),
    ]
    for category in categories:
        features.append(float(aggregate.partial_category_totals.get(category, 0.0)))
    return features


def _predict_top_category(
    current_aggregate: MonthlyAggregate | None,
    historical_aggregates: list[MonthlyAggregate],
    categories: list[str],
    predicted_month_end_spend: float,
) -> str:
    if not categories:
        return "Other"

    current_totals = current_aggregate.partial_category_totals if current_aggregate else {}
    current_spend = current_aggregate.partial_total if current_aggregate else 0.0
    growth_factor = predicted_month_end_spend / current_spend if current_spend > 0 else 1.0

    projected_totals: dict[str, float] = {}
    for category in categories:
        current_amount = float(current_totals.get(category, 0.0))
        if current_amount > 0:
            projected_totals[category] = current_amount * max(growth_factor, 1.0)
            continue

        historical_values = [
            aggregate.final_category_totals.get(category, 0.0)
            for aggregate in historical_aggregates
        ]
        projected_totals[category] = sum(historical_values) / len(historical_values) if historical_values else 0.0

    best_category = max(projected_totals.items(), key=lambda item: item[1], default=("Other", 0.0))[0]
    return best_category or "Other"


def generate_predictions(
    expenses: list[dict],
    amount_to_inr,
    monthly_budget: float | None,
    now: datetime | None = None,
) -> dict[str, Any]:
    now = now or datetime.now()
    budget = float(monthly_budget or 0.0)
    if budget <= 0:
        budget = DEFAULT_MONTHLY_BUDGET

    aggregates, categories, current_aggregate = _build_monthly_aggregates(expenses, amount_to_inr, now)
    historical_aggregates = [aggregate for aggregate in aggregates if aggregate.key != now.strftime("%Y-%m")]
    training_rows = len(historical_aggregates)

    if current_aggregate is None:
        current_days_in_month = calendar.monthrange(now.year, now.month)[1]
        current_aggregate = MonthlyAggregate(
            key=now.strftime("%Y-%m"),
            year=now.year,
            month=now.month,
            month_index=len(aggregates),
            days_in_month=current_days_in_month,
            final_total=0.0,
            final_count=0,
            final_category_totals={},
            partial_total=0.0,
            partial_count=0,
            partial_category_totals={},
            elapsed_days=now.day,
        )

    current_spend = float(current_aggregate.partial_total)
    remaining_days = max(current_aggregate.days_in_month - current_aggregate.elapsed_days, 0)

    used_fallback = training_rows < 3
    fallback_reason = None

    if used_fallback:
        daily_pace = current_spend / current_aggregate.elapsed_days if current_aggregate.elapsed_days else 0.0
        predicted_month_end_spend = daily_pace * current_aggregate.days_in_month
        predicted_next_7_days_spend = daily_pace * min(7, max(remaining_days, 7 if current_spend > 0 else 0))
        fallback_reason = "Not enough historical monthly data to train models."
    else:
        X_train = [_feature_vector(aggregate, categories, budget) for aggregate in historical_aggregates]
        y_regression = [aggregate.final_total for aggregate in historical_aggregates]
        y_classification = [_risk_label(aggregate.final_total, budget) for aggregate in historical_aggregates]

        regression_model = LinearRegression()
        regression_model.fit(X_train, y_regression)

        current_vector = _feature_vector(current_aggregate, categories, budget)
        predicted_month_end_spend = float(regression_model.predict([current_vector])[0])
        predicted_month_end_spend = max(predicted_month_end_spend, current_spend)

        remaining_spend = max(predicted_month_end_spend - current_spend, 0.0)
        predicted_next_7_days_spend = remaining_spend if remaining_days <= 7 else (remaining_spend / remaining_days) * 7

    predicted_month_end_spend = _round_money(predicted_month_end_spend)
    predicted_next_7_days_spend = _round_money(max(predicted_next_7_days_spend, 0.0))
    derived_risk_label = _risk_label(predicted_month_end_spend, budget)

    if used_fallback:
        risk_label = derived_risk_label
        probability = 0.55
    else:
        X_train = [_feature_vector(aggregate, categories, budget) for aggregate in historical_aggregates]
        y_classification = [_risk_label(aggregate.final_total, budget) for aggregate in historical_aggregates]
        if len(set(y_classification)) < 2:
            risk_label = derived_risk_label
            probability = 0.6
            fallback_reason = fallback_reason or "Historical risk labels did not contain enough classes."
        else:
            classifier = RandomForestClassifier(
                n_estimators=150,
                max_depth=6,
                random_state=42,
            )
            classifier.fit(X_train, y_classification)
            current_vector = _feature_vector(current_aggregate, categories, budget)
            proba = classifier.predict_proba([current_vector])[0]
            classes = list(classifier.classes_)
            risk_index = max(range(len(proba)), key=lambda idx: proba[idx])
            model_risk_label = str(classes[risk_index])
            risk_label = _max_risk_label(model_risk_label, derived_risk_label)
            probability = float(proba[risk_index])

    predicted_top_category = _predict_top_category(
        current_aggregate=current_aggregate,
        historical_aggregates=historical_aggregates or aggregates,
        categories=categories,
        predicted_month_end_spend=predicted_month_end_spend,
    )

    confidence = _confidence_label(training_rows, used_fallback)
    budget_ratio = (predicted_month_end_spend / budget) if budget > 0 else 0.0

    insights = [
        f"Projected month-end spend is Rs.{predicted_month_end_spend:.2f} against a Rs.{budget:.2f} budget.",
        f"Top expected spending category is {predicted_top_category}.",
        f"Expected spend over the next 7 days is Rs.{predicted_next_7_days_spend:.2f}.",
    ]

    if budget_ratio > 1:
        insights.append("Spending is projected to exceed the monthly budget unless pace slows down.")
    elif budget_ratio > 0.8:
        insights.append("Spending is approaching the monthly budget threshold.")
    else:
        insights.append("Spending is projected to stay within the monthly budget.")

    return {
        "success": True,
        "forecast": {
            "predicted_month_end_spend": predicted_month_end_spend,
            "predicted_next_7_days_spend": predicted_next_7_days_spend,
            "predicted_top_category": predicted_top_category,
            "confidence": confidence,
        },
        "risk": {
            "label": risk_label,
            "probability": round(probability, 4),
            "budget": _round_money(budget),
            "current_spend": _round_money(current_spend),
        },
        "insights": insights,
        "meta": {
            "training_rows": training_rows,
            "used_fallback": used_fallback,
            "fallback_reason": fallback_reason,
        },
    }
