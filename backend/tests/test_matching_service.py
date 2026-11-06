from datetime import datetime

import pytest

from app.services.matching_service import (
    cosine_similarity,
    fuse_scores,
    rank_candidates,
    score_candidate,
)


class FakeReport:
    def __init__(
        self,
        report_id,
        report_type,
        image_embedding=None,
        text_embedding=None,
        **metadata,
    ):
        self.id = report_id
        self.type = report_type
        self.image_embedding = image_embedding
        self.text_embedding = text_embedding
        self.owner_id = metadata.get("owner_id")
        self.title = metadata.get("title", report_id)
        self.description = metadata.get("description")
        self.category = metadata.get("category")
        self.color = metadata.get("color")
        self.location = metadata.get("location")
        self.event_date = metadata.get("event_date")

    def to_dict(self):
        return {
            "id": self.id,
            "type": self.type,
            "title": self.title,
            "category": self.category,
            "color": self.color,
            "location": self.location,
            "event_date": self.event_date.isoformat() if self.event_date else None,
        }


def test_cosine_similarity_handles_vectors_and_missing_values():
    assert cosine_similarity([1, 0], [1, 0]) == pytest.approx(1.0)
    assert cosine_similarity([1, 0], [0, 1]) == pytest.approx(0.0)
    assert cosine_similarity(None, [1, 0]) is None
    assert cosine_similarity([1, 0], [1, 0, 0]) is None
    assert cosine_similarity([0, 0], [1, 0]) is None


def test_fuse_scores_renormalizes_missing_modalities():
    assert fuse_scores(1.0, 0.0, None) == pytest.approx(0.5333)
    assert fuse_scores(1.0, None, None) == 1.0
    assert fuse_scores(None, None, None) is None


def test_score_candidate_returns_component_scores():
    source = FakeReport(
        "source",
        "LOST",
        image_embedding=[1.0, 0.0],
        text_embedding=[1.0, 0.0],
        category="Bottle",
        color="Red",
        location="Library",
        event_date=datetime.fromisoformat("2026-11-06T00:00:00+05:30"),
    )
    candidate = FakeReport(
        "candidate",
        "FOUND",
        image_embedding=[1.0, 0.0],
        text_embedding=[1.0, 0.0],
        category="Bottle",
        color="Red",
        location="Library",
        event_date=datetime.fromisoformat("2026-11-06T01:00:00+05:30"),
    )

    scores = score_candidate(source, candidate)

    assert scores["image_similarity"] == 1.0
    assert scores["text_similarity"] == 1.0
    assert scores["metadata_similarity"] == 1.0
    assert scores["final_score"] == 1.0


def test_rank_candidates_excludes_self_and_same_type():
    source = FakeReport("source", "LOST", image_embedding=[1.0, 0.0])
    same_type = FakeReport("same", "LOST", image_embedding=[1.0, 0.0])
    weak_match = FakeReport("weak", "FOUND", image_embedding=[0.0, 1.0])
    strong_match = FakeReport("strong", "FOUND", image_embedding=[1.0, 0.0])

    ranked = rank_candidates(source, [source, same_type, weak_match, strong_match], top_k=5)

    assert [item["report_id"] for item in ranked] == ["strong", "weak"]
    assert ranked[0]["scores"]["final_score"] > ranked[1]["scores"]["final_score"]
