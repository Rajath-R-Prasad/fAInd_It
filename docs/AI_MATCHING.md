# AI Matching Design

## Models

| Modality | Model | Output dimension | Purpose |
|---|---|---|---|
| Image | `openai/clip-vit-base-patch32` | 512 | CLIP image embedding |
| Text | `sentence-transformers/all-MiniLM-L6-v2` | 384 | Report text embedding |

Both models are pretrained. There is no training or fine-tuning in this project. The models
are loaded lazily once per backend process and cached in memory. Weights are downloaded on
first use and cached under the Hugging Face cache directory.

Environment controls:

| Variable | Default | Purpose |
|---|---|---|
| `CLIP_MODEL_NAME` | `openai/clip-vit-base-patch32` | Image model identifier |
| `TEXT_MODEL_NAME` | `sentence-transformers/all-MiniLM-L6-v2` | Text model identifier |
| `MODEL_DEVICE` | `auto` | `auto`, `cpu`, or `cuda` |

The first report creation can take several minutes while model weights download. Later
requests reuse the in-memory models.

## Text Representation

Report text is built canonically before embedding:

```text
Item: <title>.
Description: <description>.
Category: <category>.
Colour: <color>.
```

Empty optional fields are omitted. Image and text embeddings are normalized before storage.

## Similarity

Image and text similarity use cosine similarity:

```text
cosine(a, b) = dot(a, b) / (||a|| * ||b||)
```

Stored embeddings use `ARRAY(Float)` because the local PostgreSQL installation does not have
pgvector. Cosine similarity is computed in Python.

## Metadata Similarity

Metadata similarity is deterministic and uses four components:

```text
0.35 * category + 0.25 * color + 0.20 * location + 0.20 * date
```

Component rules:

- Category and color: exact normalized match = `1.0`; otherwise partial token overlap scaled
  by `0.5`.
- Location: exact normalized match = `1.0`; substring match = `0.8`; otherwise token overlap.
- Date: within 1 day = `1.0`; within 7 days = `0.7`; within 30 days = `0.4`; otherwise `0.1`.

Missing metadata is not treated as an exact match. Unavailable components are removed and the
remaining weights are renormalized.

## Final Fusion

The application's full score uses:

```text
0.40 * image + 0.35 * text + 0.25 * metadata
```

If a modality is unavailable, its weight is removed and the remaining weights are
renormalized. For example, with only image available, the final score is the image score. With
image and text but no metadata, the weights become `0.40 / 0.75` and `0.35 / 0.75`.

The scoring version is exposed as `SCORING_VERSION = "v1"`.

## Candidate Retrieval

For a source report, candidates must satisfy:

- Opposite report type (`LOST` vs `FOUND`).
- Not the source report itself.
- `is_active = true`.
- `status = OPEN`.
- `moderation_status = ACTIVE`.

Candidates are scored, sorted by final score descending, and truncated to the top five.
Ties are resolved deterministically by candidate ID in the evaluation script; the live
matching service sorts only by score.

`can_claim` is true only when the candidate is a FOUND report and the viewer is not its owner.
Matching suggestions are not proof of ownership. Claims require a human verification message
and owner/admin decision.

## Example

Verified local example from Phase 4:

```text
image similarity:    1.0000
text similarity:     0.8245
metadata similarity: 0.9600
final score:         0.9286
```

A Phase 7 clean-schema demo with the evaluation images produced a final score of `0.8367`
for a lost/found red-bottle pair.

## Limitations

- CLIP and MiniLM are general-purpose pretrained models, not trained on this campus.
- Similarity scores are ranking signals, not calibrated probabilities.
- Metadata matching is heuristic and string-based.
- Text embeddings use title, description, category, and color, but not location or date.
- The local fallback stores embeddings as arrays rather than indexed vectors, so retrieval is
  linear in the candidate count.
- Model loading is synchronous and memory-heavy on CPU.
- No automatic claim approval is performed.
