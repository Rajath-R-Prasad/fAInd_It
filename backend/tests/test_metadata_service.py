from datetime import datetime, timedelta, timezone

import pytest

from app.services.metadata_service import (
    category_score,
    color_score,
    date_score,
    location_score,
    metadata_similarity,
)


class FakeReport:
    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)


def test_category_and_color_scores():
    assert category_score("Water Bottle", "water bottle") == 1.0
    assert category_score("Water Bottle", "Bottle") == pytest.approx(0.25)
    assert category_score(None, "Bottle") is None
    assert color_score("Red", "red") == 1.0
    assert color_score("Dark Red", "Red") == pytest.approx(0.25)
    assert color_score("Red", None) is None


def test_location_scores_substring_and_tokens():
    assert location_score("Golden Jubilee Bhavan", "golden jubilee bhavan") == 1.0
    assert location_score("Golden Jubilee", "Golden Jubilee Bhavan bench") == 0.8
    assert location_score("CS001 classroom", "Library") == 0.0
    assert location_score(None, "Library") is None


def test_date_scores_buckets():
    base = datetime(2026, 11, 6, tzinfo=timezone.utc)

    assert date_score(base, base) == 1.0
    assert date_score(base, base + timedelta(days=3)) == 0.7
    assert date_score(base, base + timedelta(days=10)) == 0.4
    assert date_score(base, base + timedelta(days=60)) == 0.1
    assert date_score(base, None) is None


def test_metadata_similarity_renormalizes_missing_fields():
    left = FakeReport(category="Bottle", color="Red", location=None, event_date=None)
    right = FakeReport(category="Bottle", color="Red", location=None, event_date=None)

    assert metadata_similarity(left, right) == 1.0

    left_only_category = FakeReport(
        category="Bottle", color=None, location=None, event_date=None
    )
    right_only_category = FakeReport(
        category="Mouse", color=None, location=None, event_date=None
    )
    assert metadata_similarity(left_only_category, right_only_category) == 0.0
