import json
from pathlib import Path

import pytest

from app.services import evaluation_service as service


def test_query_metrics_counts_first_relevant_rank():
    metrics = service._query_metrics(
        "q1",
        {"c1", "c2"},
        [("x", 0.9), ("c1", 0.8), ("c2", 0.7)],
    )

    assert metrics["returned_count"] == 3
    assert metrics["hit_count"] == 2
    assert metrics["precision_at_5"] == pytest.approx(0.6667)
    assert metrics["recall_at_5"] == 1.0
    assert metrics["f1"] == pytest.approx(0.8)
    assert metrics["reciprocal_rank"] == pytest.approx(0.5)


def test_query_metrics_handles_no_hits():
    metrics = service._query_metrics("q1", {"c1"}, [("x", 0.9), ("y", 0.8)])

    assert metrics["precision_at_5"] == 0.0
    assert metrics["recall_at_5"] == 0.0
    assert metrics["f1"] == 0.0
    assert metrics["reciprocal_rank"] == 0.0


def test_average_ignores_undefined_values():
    assert service._average([1.0, None, 0.0]) == pytest.approx(0.5)
    assert service._average([None, None]) is None


def _write_dataset(tmp_path: Path, relevant=None) -> Path:
    images = tmp_path / "images"
    images.mkdir()
    (images / "query.jpg").write_bytes(b"not-a-real-image")
    (images / "candidate.jpg").write_bytes(b"not-a-real-image")

    dataset = {
        "name": "test",
        "version": "1",
        "queries": [
            {
                "id": "q1",
                "image": "images/query.jpg",
                "relevant": ["c1"] if relevant is None else relevant,
                "report": {
                    "type": "LOST",
                    "title": "Lost bottle",
                    "event_date": "2026-11-06T00:00:00+05:30",
                },
            }
        ],
        "candidates": [
            {
                "id": "c1",
                "image": "images/candidate.jpg",
                "report": {"type": "FOUND", "title": "Found bottle"},
            }
        ],
    }
    path = tmp_path / "dataset.json"
    path.write_text(json.dumps(dataset), encoding="utf-8")
    return path


def test_load_dataset_resolves_images_and_reports(tmp_path):
    path = _write_dataset(tmp_path)
    dataset, resolved = service.load_dataset(str(path))

    assert resolved == path.resolve()
    assert dataset["queries"][0]["_report"].type == "LOST"
    assert dataset["queries"][0]["_report"].event_date.year == 2026
    assert Path(dataset["queries"][0]["_image_path"]).exists()


def test_load_dataset_rejects_unknown_relevant_candidate(tmp_path):
    path = _write_dataset(tmp_path, relevant=["missing"])

    with pytest.raises(service.EvaluationError, match="unknown candidates"):
        service.load_dataset(str(path))


def test_evaluation_config_points_to_repo_dataset(monkeypatch):
    monkeypatch.delenv("EVALUATION_DATASET_PATH", raising=False)
    monkeypatch.delenv("EVALUATION_RESULTS_DIR", raising=False)
    config = service.evaluation_config()

    assert config["dataset_path"] == "datasets/evaluation/dataset.json"
    assert config["top_k"] == 5
    assert [item["id"] for item in config["experiments"]] == [
        "image_only",
        "text_only",
        "image_text",
        "full_fusion",
    ]
