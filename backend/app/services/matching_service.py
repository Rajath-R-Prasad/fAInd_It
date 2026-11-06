"""Cosine similarity, score fusion, and top-five candidate ranking."""

from typing import Iterable, Optional

import numpy as np

from .metadata_service import metadata_components, metadata_similarity

IMAGE_WEIGHT = 0.40
TEXT_WEIGHT = 0.35
METADATA_WEIGHT = 0.25
SCORING_VERSION = "v1"


def cosine_similarity(left: Optional[Iterable[float]], right: Optional[Iterable[float]]) -> Optional[float]:
    if left is None or right is None:
        return None

    left_array = np.asarray(list(left), dtype=np.float32)
    right_array = np.asarray(list(right), dtype=np.float32)
    if left_array.size == 0 or right_array.size == 0:
        return None
    if left_array.shape != right_array.shape:
        return None

    left_norm = np.linalg.norm(left_array)
    right_norm = np.linalg.norm(right_array)
    if left_norm == 0 or right_norm == 0:
        return None

    return float(np.dot(left_array / left_norm, right_array / right_norm))


def fuse_scores(
    image_similarity: Optional[float],
    text_similarity: Optional[float],
    metadata_similarity_value: Optional[float],
) -> Optional[float]:
    """Fuse available component scores and renormalize their weights."""
    components = [
        (IMAGE_WEIGHT, image_similarity),
        (TEXT_WEIGHT, text_similarity),
        (METADATA_WEIGHT, metadata_similarity_value),
    ]
    available = [(weight, score) for weight, score in components if score is not None]
    if not available:
        return None

    total_weight = sum(weight for weight, _ in available)
    if total_weight <= 0:
        return None
    return round(sum(weight * score for weight, score in available) / total_weight, 4)


def score_candidate(source, candidate) -> dict:
    image_sim = cosine_similarity(
        getattr(source, "image_embedding", None),
        getattr(candidate, "image_embedding", None),
    )
    text_sim = cosine_similarity(
        getattr(source, "text_embedding", None),
        getattr(candidate, "text_embedding", None),
    )
    metadata_sim = metadata_similarity(source, candidate)
    final_score = fuse_scores(image_sim, text_sim, metadata_sim)

    return {
        "image_similarity": None if image_sim is None else round(image_sim, 4),
        "text_similarity": None if text_sim is None else round(text_sim, 4),
        "metadata_similarity": metadata_sim,
        "metadata_components": metadata_components(source, candidate),
        "final_score": final_score if final_score is not None else 0.0,
    }


def rank_candidates(source, candidates: Iterable, top_k: int = 5, viewer_id=None) -> list[dict]:
    ranked = []
    for candidate in candidates:
        if candidate.id == source.id:
            continue
        if candidate.type == source.type:
            continue

        scores = score_candidate(source, candidate)
        ranked.append(
            {
                "report_id": str(candidate.id),
                "report": candidate.to_dict(),
                "scores": scores,
                "can_claim": candidate.type == "FOUND" and candidate.owner_id != viewer_id,
            }
        )

    ranked.sort(key=lambda item: item["scores"]["final_score"], reverse=True)
    return ranked[:top_k]
