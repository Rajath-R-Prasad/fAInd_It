"""Deterministic metadata similarity scoring.

Component scores are in [0, 1]. Missing metadata is not treated as an exact
match; unavailable components are excluded and the remaining weights are
renormalized.
"""

import re
from datetime import datetime
from typing import Optional

CATEGORY_WEIGHT = 0.35
COLOR_WEIGHT = 0.25
LOCATION_WEIGHT = 0.20
DATE_WEIGHT = 0.20

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _normalize(value: Optional[str]) -> str:
    if not value:
        return ""
    return " ".join(_TOKEN_RE.findall(value.lower()))


def _tokens(value: Optional[str]) -> set[str]:
    return set(_TOKEN_RE.findall((value or "").lower()))


def _token_overlap(left: Optional[str], right: Optional[str]) -> float:
    left_tokens = _tokens(left)
    right_tokens = _tokens(right)
    if not left_tokens or not right_tokens:
        return 0.0
    return len(left_tokens & right_tokens) / len(left_tokens | right_tokens)


def category_score(left: Optional[str], right: Optional[str]) -> Optional[float]:
    if not left or not right:
        return None
    if _normalize(left) == _normalize(right):
        return 1.0
    return round(0.5 * _token_overlap(left, right), 4)


def color_score(left: Optional[str], right: Optional[str]) -> Optional[float]:
    if not left or not right:
        return None
    if _normalize(left) == _normalize(right):
        return 1.0
    return round(0.5 * _token_overlap(left, right), 4)


def location_score(left: Optional[str], right: Optional[str]) -> Optional[float]:
    if not left or not right:
        return None
    left_norm = _normalize(left)
    right_norm = _normalize(right)
    if left_norm == right_norm:
        return 1.0
    if left_norm in right_norm or right_norm in left_norm:
        return 0.8
    return round(_token_overlap(left, right), 4)


def _as_datetime(value) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value))
    except ValueError:
        return None


def date_score(left, right) -> Optional[float]:
    left_dt = _as_datetime(left)
    right_dt = _as_datetime(right)
    if left_dt is None or right_dt is None:
        return None

    if left_dt.tzinfo is not None and right_dt.tzinfo is None:
        right_dt = right_dt.replace(tzinfo=left_dt.tzinfo)
    if right_dt.tzinfo is not None and left_dt.tzinfo is None:
        left_dt = left_dt.replace(tzinfo=right_dt.tzinfo)

    delta_days = abs((left_dt - right_dt).total_seconds()) / 86400.0
    if delta_days <= 1:
        return 1.0
    if delta_days <= 7:
        return 0.7
    if delta_days <= 30:
        return 0.4
    return 0.1


def metadata_components(report1, report2) -> dict:
    """Return per-component scores, with None for unavailable components."""
    return {
        "category": category_score(
            getattr(report1, "category", None), getattr(report2, "category", None)
        ),
        "color": color_score(
            getattr(report1, "color", None), getattr(report2, "color", None)
        ),
        "location": location_score(
            getattr(report1, "location", None), getattr(report2, "location", None)
        ),
        "date": date_score(
            getattr(report1, "event_date", None), getattr(report2, "event_date", None)
        ),
    }


def metadata_similarity(report1, report2) -> float:
    """Weighted metadata score with renormalization over available components."""
    components = metadata_components(report1, report2)
    weights = {
        "category": CATEGORY_WEIGHT,
        "color": COLOR_WEIGHT,
        "location": LOCATION_WEIGHT,
        "date": DATE_WEIGHT,
    }

    available = [
        (weights[name], score)
        for name, score in components.items()
        if score is not None
    ]
    if not available:
        return 0.0

    total_weight = sum(weight for weight, _ in available)
    if total_weight <= 0:
        return 0.0
    return round(sum(weight * score for weight, score in available) / total_weight, 4)
