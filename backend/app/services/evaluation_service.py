"""Reproducible offline evaluation for the four PRD matching experiments."""

import csv
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import Optional

from .embedding_service import (
    embed_image,
    embed_report_text,
    get_clip_model,
    get_text_model,
)
from .matching_service import (
    IMAGE_WEIGHT,
    METADATA_WEIGHT,
    SCORING_VERSION,
    TEXT_WEIGHT,
    cosine_similarity,
    fuse_scores,
)
from .metadata_service import metadata_similarity

REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_DATASET_PATH = REPO_ROOT / "datasets" / "evaluation" / "dataset.json"
DEFAULT_RESULTS_DIR = REPO_ROOT / "datasets" / "evaluation" / "results"
TOP_K = 5

EXPERIMENTS = [
    {
        "id": "image_only",
        "name": "Image only",
        "description": "CLIP image embeddings and cosine similarity only.",
    },
    {
        "id": "text_only",
        "name": "Text only",
        "description": "MiniLM report-text embeddings and cosine similarity only.",
    },
    {
        "id": "image_text",
        "name": "Image + text",
        "description": "Weighted fusion of image and text similarity, renormalized over the two available modalities.",
    },
    {
        "id": "full_fusion",
        "name": "Image + text + metadata",
        "description": "The application's full fusion: 0.40 image + 0.35 text + 0.25 metadata.",
    },
]


class EvaluationError(RuntimeError):
    """Raised when the evaluation dataset or output cannot be processed."""


def _report_namespace(data: dict) -> SimpleNamespace:
    event_date = data.get("event_date")
    if isinstance(event_date, str):
        try:
            event_date = datetime.fromisoformat(event_date)
        except ValueError as exc:
            raise EvaluationError(f"Invalid event_date: {event_date}") from exc
    return SimpleNamespace(
        type=data.get("type"),
        title=data.get("title"),
        description=data.get("description"),
        category=data.get("category"),
        color=data.get("color"),
        location=data.get("location"),
        event_date=event_date,
    )


def _resolve_path(path_value: Optional[str], default: Path) -> Path:
    path = Path(path_value).expanduser() if path_value else default
    if not path.is_absolute():
        path = Path.cwd() / path
    return path.resolve()


def load_dataset(dataset_path: Optional[str] = None) -> tuple[dict, Path]:
    path = _resolve_path(
        dataset_path or os.getenv("EVALUATION_DATASET_PATH"),
        DEFAULT_DATASET_PATH,
    )
    if not path.exists():
        raise EvaluationError(f"Evaluation dataset not found: {path}")

    try:
        with path.open("r", encoding="utf-8") as handle:
            dataset = json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        raise EvaluationError(f"Could not read evaluation dataset: {exc}") from exc

    queries = dataset.get("queries") or []
    candidates = dataset.get("candidates") or []
    if not queries or not candidates:
        raise EvaluationError("Evaluation dataset must contain queries and candidates")

    seen_ids = set()
    for item in queries + candidates:
        item_id = item.get("id")
        if not item_id:
            raise EvaluationError("Every query and candidate needs an id")
        if item_id in seen_ids:
            raise EvaluationError(f"Duplicate dataset id: {item_id}")
        seen_ids.add(item_id)

        report_data = item.get("report") or {}
        item["_report"] = _report_namespace(report_data)

        image_value = item.get("image")
        if not image_value:
            raise EvaluationError(f"Missing image path for {item_id}")
        image_path = (path.parent / image_value).resolve()
        if not image_path.exists():
            raise EvaluationError(f"Image not found for {item_id}: {image_path}")
        item["_image_path"] = str(image_path)

    for query in queries:
        relevant = set(query.get("relevant") or [])
        unknown = relevant - {candidate["id"] for candidate in candidates}
        if unknown:
            raise EvaluationError(
                f"Query {query['id']} references unknown candidates: {sorted(unknown)}"
            )

    return dataset, path


def _prepare_embeddings(dataset: dict) -> tuple[dict, dict, float]:
    start = time.perf_counter()
    image_cache = {}
    text_cache = {}
    image_by_path = {}

    for item in dataset["queries"] + dataset["candidates"]:
        image_path = item["_image_path"]
        if image_path not in image_by_path:
            image_by_path[image_path] = embed_image(image_path)
        image_cache[item["id"]] = image_by_path[image_path]
        text_cache[item["id"]] = embed_report_text(item["_report"])

    elapsed_ms = (time.perf_counter() - start) * 1000.0
    return image_cache, text_cache, elapsed_ms


def _score_candidate(
    experiment_id: str,
    query: dict,
    candidate: dict,
    image_cache: dict,
    text_cache: dict,
) -> Optional[float]:
    image_similarity = cosine_similarity(
        image_cache[query["id"]], image_cache[candidate["id"]]
    )
    text_similarity = cosine_similarity(
        text_cache[query["id"]], text_cache[candidate["id"]]
    )

    if experiment_id == "image_only":
        return image_similarity
    if experiment_id == "text_only":
        return text_similarity
    if experiment_id == "image_text":
        return fuse_scores(image_similarity, text_similarity, None)

    metadata_similarity_value = metadata_similarity(
        query["_report"], candidate["_report"]
    )
    return fuse_scores(image_similarity, text_similarity, metadata_similarity_value)


def _rank_candidates(
    experiment_id: str,
    query: dict,
    candidates: list[dict],
    image_cache: dict,
    text_cache: dict,
) -> list[tuple[str, float]]:
    scored = []
    for candidate in candidates:
        if candidate["_report"].type == query["_report"].type:
            continue
        score = _score_candidate(
            experiment_id, query, candidate, image_cache, text_cache
        )
        if score is not None:
            scored.append((candidate["id"], float(score)))

    scored.sort(key=lambda item: (-item[1], item[0]))
    return scored[:TOP_K]


def _query_metrics(
    query_id: str,
    relevant: set[str],
    ranked: list[tuple[str, float]],
) -> dict:
    retrieved = [candidate_id for candidate_id, _ in ranked]
    hits = sum(1 for candidate_id in retrieved if candidate_id in relevant)
    returned = len(retrieved)

    precision = hits / returned if returned else 0.0
    recall = hits / len(relevant) if relevant else None
    f1 = None
    if recall is not None:
        f1 = (
            0.0
            if precision + recall == 0
            else 2 * precision * recall / (precision + recall)
        )

    reciprocal_rank = 0.0
    for rank, candidate_id in enumerate(retrieved, start=1):
        if candidate_id in relevant:
            reciprocal_rank = 1.0 / rank
            break

    return {
        "query_id": query_id,
        "relevant": sorted(relevant),
        "retrieved": [
            {"candidate_id": candidate_id, "score": round(score, 4)}
            for candidate_id, score in ranked
        ],
        "returned_count": returned,
        "hit_count": hits,
        "precision_at_5": round(precision, 4),
        "recall_at_5": None if recall is None else round(recall, 4),
        "f1": None if f1 is None else round(f1, 4),
        "reciprocal_rank": round(reciprocal_rank, 4),
    }


def _average(values: list[Optional[float]]) -> Optional[float]:
    defined = [value for value in values if value is not None]
    if not defined:
        return None
    return round(sum(defined) / len(defined), 4)


def _run_experiment(
    experiment: dict,
    dataset: dict,
    image_cache: dict,
    text_cache: dict,
) -> dict:
    start = time.perf_counter()
    per_query = []
    for query in dataset["queries"]:
        ranked = _rank_candidates(
            experiment["id"],
            query,
            dataset["candidates"],
            image_cache,
            text_cache,
        )
        per_query.append(
            _query_metrics(query["id"], set(query.get("relevant") or []), ranked)
        )
    elapsed_ms = (time.perf_counter() - start) * 1000.0

    return {
        "id": experiment["id"],
        "name": experiment["name"],
        "description": experiment["description"],
        "precision_at_5": _average([item["precision_at_5"] for item in per_query]),
        "recall_at_5": _average([item["recall_at_5"] for item in per_query]),
        "f1": _average([item["f1"] for item in per_query]),
        "mrr": _average([item["reciprocal_rank"] for item in per_query]),
        "average_retrieval_latency_ms": round(
            elapsed_ms / len(dataset["queries"]), 3
        ),
        "queries": per_query,
    }


def _save_results(result: dict, results_dir: Optional[str] = None) -> Path:
    directory = _resolve_path(
        results_dir or os.getenv("EVALUATION_RESULTS_DIR"),
        DEFAULT_RESULTS_DIR,
    )
    directory.mkdir(parents=True, exist_ok=True)

    latest_path = directory / "latest.json"
    with latest_path.open("w", encoding="utf-8") as handle:
        json.dump(result, handle, indent=2)
        handle.write("\n")

    timestamp = result["run"]["run_at"].replace(":", "").replace("-", "")
    timestamp_path = directory / f"evaluation-{timestamp}.json"
    with timestamp_path.open("w", encoding="utf-8") as handle:
        json.dump(result, handle, indent=2)
        handle.write("\n")

    csv_path = directory / "latest.csv"
    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            [
                "experiment",
                "precision_at_5",
                "recall_at_5",
                "f1",
                "mrr",
                "average_retrieval_latency_ms",
            ]
        )
        for experiment in result["experiments"]:
            writer.writerow(
                [
                    experiment["name"],
                    experiment["precision_at_5"],
                    experiment["recall_at_5"],
                    experiment["f1"],
                    experiment["mrr"],
                    experiment["average_retrieval_latency_ms"],
                ]
            )

    return latest_path


def run_evaluation(
    dataset_path: Optional[str] = None,
    results_dir: Optional[str] = None,
) -> dict:
    dataset, path = load_dataset(dataset_path)
    image_cache, text_cache, embedding_latency_ms = _prepare_embeddings(dataset)

    clip_model, _, clip_model_name, _ = get_clip_model()
    text_model, text_model_name, _ = get_text_model()

    experiments = [
        _run_experiment(experiment, dataset, image_cache, text_cache)
        for experiment in EXPERIMENTS
    ]

    result = {
        "dataset": {
            "name": dataset.get("name"),
            "version": dataset.get("version"),
            "created_at": dataset.get("created_at"),
            "query_count": len(dataset["queries"]),
            "candidate_count": len(dataset["candidates"]),
            "description": dataset.get("description"),
            "provenance": dataset.get("provenance"),
            "label_procedure": dataset.get("label_procedure"),
            "metric_conventions": dataset.get("metric_conventions"),
        },
        "run": {
            "run_at": datetime.now(timezone.utc).isoformat(),
            "scoring_version": SCORING_VERSION,
            "top_k": TOP_K,
            "models": {
                "image_model": clip_model_name,
                "image_dimension": int(clip_model.config.projection_dim),
                "text_model": text_model_name,
                "text_dimension": int(text_model.get_sentence_embedding_dimension()),
            },
            "weights": {
                "image": IMAGE_WEIGHT,
                "text": TEXT_WEIGHT,
                "metadata": METADATA_WEIGHT,
            },
            "embedding_latency_ms": round(embedding_latency_ms, 3),
            "dataset_file": path.name,
        },
        "experiments": experiments,
    }

    _save_results(result, results_dir)
    return result


def load_latest_results(results_dir: Optional[str] = None) -> Optional[dict]:
    directory = _resolve_path(
        results_dir or os.getenv("EVALUATION_RESULTS_DIR"),
        DEFAULT_RESULTS_DIR,
    )
    latest_path = directory / "latest.json"
    if not latest_path.exists():
        return None

    try:
        with latest_path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        raise EvaluationError(f"Could not read saved evaluation results: {exc}") from exc


def _display_path(path: Path) -> str:
    try:
        return str(path.relative_to(REPO_ROOT))
    except ValueError:
        return path.name


def evaluation_config() -> dict:
    dataset_path = _resolve_path(
        os.getenv("EVALUATION_DATASET_PATH"), DEFAULT_DATASET_PATH
    )
    results_dir = _resolve_path(
        os.getenv("EVALUATION_RESULTS_DIR"), DEFAULT_RESULTS_DIR
    )
    return {
        "dataset_path": _display_path(dataset_path),
        "results_dir": _display_path(results_dir),
        "top_k": TOP_K,
        "experiments": EXPERIMENTS,
    }


if __name__ == "__main__":
    evaluation = run_evaluation()
    summary = {
        "dataset": evaluation["dataset"]["name"],
        "queries": evaluation["dataset"]["query_count"],
        "candidates": evaluation["dataset"]["candidate_count"],
        "experiments": [
            {
                "name": experiment["name"],
                "precision_at_5": experiment["precision_at_5"],
                "recall_at_5": experiment["recall_at_5"],
                "f1": experiment["f1"],
                "mrr": experiment["mrr"],
            }
            for experiment in evaluation["experiments"]
        ],
    }
    print(json.dumps(summary, indent=2))
