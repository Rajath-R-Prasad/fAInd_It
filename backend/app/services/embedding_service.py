"""Lazy pretrained-model embedding service.

Models are loaded once per process and reused. No training or fine-tuning is
performed. Imports of torch/transformers/sentence-transformers are intentionally
lazy so the API can start even when the ML stack is not installed.
"""

import io
import os
import threading
from typing import Optional

import numpy as np

_lock = threading.Lock()
_clip_model = None
_clip_processor = None
_clip_model_name: Optional[str] = None
_text_model = None
_text_model_name: Optional[str] = None


def _device() -> str:
    import torch

    requested = os.getenv("MODEL_DEVICE", "auto").lower()
    if requested == "auto":
        return "cuda" if torch.cuda.is_available() else "cpu"
    if requested == "cuda" and not torch.cuda.is_available():
        return "cpu"
    return requested


def get_clip_model():
    """Return (model, processor, model_name, device) using a process singleton."""
    global _clip_model, _clip_processor, _clip_model_name

    if _clip_model is None or _clip_processor is None:
        with _lock:
            if _clip_model is None or _clip_processor is None:
                from transformers import CLIPModel, CLIPProcessor

                name = os.getenv("CLIP_MODEL_NAME", "openai/clip-vit-base-patch32")
                device = _device()
                model = CLIPModel.from_pretrained(name).to(device)
                model.eval()
                processor = CLIPProcessor.from_pretrained(name)
                _clip_model = model
                _clip_processor = processor
                _clip_model_name = name

    return _clip_model, _clip_processor, _clip_model_name, _device()


def get_text_model():
    """Return (model, model_name, device) using a process singleton."""
    global _text_model, _text_model_name

    if _text_model is None:
        with _lock:
            if _text_model is None:
                from sentence_transformers import SentenceTransformer

                name = os.getenv(
                    "TEXT_MODEL_NAME", "sentence-transformers/all-MiniLM-L6-v2"
                )
                device = _device()
                _text_model = SentenceTransformer(name, device=device)
                _text_model_name = name

    return _text_model, _text_model_name, _device()


def _embed_pil_image(image) -> list[float]:
    import torch

    model, processor, _, device = get_clip_model()
    rgb = image.convert("RGB")
    inputs = processor(images=rgb, return_tensors="pt")
    inputs = {key: value.to(device) for key, value in inputs.items()}

    with torch.inference_mode():
        features = model.get_image_features(**inputs)

    vector = features[0].detach().cpu().numpy().astype(np.float32)
    norm = np.linalg.norm(vector)
    if norm > 0:
        vector = vector / norm
    return vector.tolist()


def embed_image(image_path: str) -> list[float]:
    """Generate a normalized CLIP image embedding for a local image file."""
    from PIL import Image

    with Image.open(image_path) as image:
        return _embed_pil_image(image)


def embed_image_data(image_data: bytes) -> list[float]:
    """Generate a normalized CLIP image embedding from stored image bytes."""
    from PIL import Image

    with Image.open(io.BytesIO(image_data)) as image:
        return _embed_pil_image(image)


def build_report_text(report) -> str:
    """Build the canonical text used for report text embeddings."""
    title = (getattr(report, "title", None) or "").strip()
    description = (getattr(report, "description", None) or "").strip()
    category = (getattr(report, "category", None) or "").strip()
    color = (getattr(report, "color", None) or "").strip()

    parts = [f"Item: {title}."]
    if description:
        parts.append(f"Description: {description}.")
    if category:
        parts.append(f"Category: {category}.")
    if color:
        parts.append(f"Colour: {color}.")
    return " ".join(parts)


def embed_report_text(report) -> list[float]:
    """Generate a normalized Sentence Transformer embedding for a report."""
    model, _, _ = get_text_model()
    text = build_report_text(report)
    vector = model.encode(text, normalize_embeddings=True, convert_to_numpy=True)
    return vector.astype(np.float32).tolist()


def embedding_dimensions() -> dict:
    """Load both models and report their actual output dimensions."""
    import torch

    clip_model, _, clip_name, _ = get_clip_model()
    text_model, text_name, _ = get_text_model()

    with torch.inference_mode():
        clip_dim = int(clip_model.config.projection_dim)
    text_dim = int(text_model.get_sentence_embedding_dimension())

    return {
        "image_model": clip_name,
        "image_dimension": clip_dim,
        "text_model": text_name,
        "text_dimension": text_dim,
    }
