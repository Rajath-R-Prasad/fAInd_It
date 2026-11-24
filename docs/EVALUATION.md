# Evaluation Method

## Research Question

Does combining image, text, and metadata improve lost-and-found report matching compared with
image-only or text-only similarity?

## Dataset

Location: `datasets/evaluation/dataset.json`

Current smoke set:

- 4 queries (`LOST`)
- 5 candidates (`FOUND`)
- 3 images reused from local report uploads
- 2 real-derived candidate reports: red bottle and black mouse
- 3 synthetic modality-conflict distractors:
  - `found-blue-flask`: text-similar to the bottle query, image from the mouse
  - `found-wireless-mouse`: text-similar to the mouse query, image from the bottle
  - `found-red-backpack`: image-similar to the bottle query, text/metadata different

Relevance labels are stored in the dataset JSON and are never derived from model output.
Synthetic candidates are explicitly marked and are not presented as real campus evidence.
The set is intentionally small and is a smoke/stress test, not a representative benchmark.

Label procedure:

- A candidate is relevant when it describes the same physical object as the query.
- Real-derived labels come from the local report records and their images.
- CLIP image similarity was used only to disambiguate which WhatsApp image belonged to which
  local report, not to assign relevance labels.

## Experiments

All experiments use the same queries, candidates, and labels.

1. **Image only:** CLIP image cosine similarity.
2. **Text only:** MiniLM report-text cosine similarity.
3. **Image + text:** weighted fusion of image and text, renormalized over two modalities.
4. **Image + text + metadata:** full fusion with weights `0.40 / 0.35 / 0.25`.

## Metrics

- **Precision@5:** relevant retrieved candidates in the top five divided by the number of
  candidates actually returned (capped at five). This is the PRD's returned-candidate
  convention. With five candidates in the pool, all five are returned, so Precision@5 is
  effectively Precision over the whole pool.
- **Recall@5:** relevant retrieved candidates in the top five divided by all relevant
  candidates for that query.
- **F1:** per-query harmonic mean of Precision@5 and Recall@5, macro-averaged over queries.
- **MRR:** mean reciprocal rank of the first relevant result, with zero when no relevant
  result is retrieved.
- **Latency:** embedding generation is measured once for the whole dataset; retrieval/scoring
  latency is measured separately per experiment and averaged per query.

## Running

```bash
cd backend
venv/bin/python scripts/run_evaluation.py
```

This runs the evaluation and inserts the result into PostgreSQL `evaluation_runs`. The
admin-only API can also run it:

```http
POST /evaluation/run
```

The run endpoint is disabled when `EVALUATION_RUN_ENABLED` is not truthy. It accepts no paths
or code from the client.

## Output

Each run is stored as one row in PostgreSQL `evaluation_runs`. The `results` JSON column
records dataset size, query/candidate counts, label procedure, model IDs, embedding
dimensions, scoring version, fusion weights, metric conventions, per-query retrieval, and
run date. `GET /evaluation/summary` reads the newest row; `GET /evaluation/runs` returns
recent run metadata for admins. The API no longer writes `latest.json`, `latest.csv`, or
timestamped result files.

## Latest Results

Run date: 2026-11-06 (UTC)

| Experiment | Precision@5 | Recall@5 | F1 | MRR | Retrieval latency |
|---|---:|---:|---:|---:|---:|
| Image only | 0.20 | 1.00 | 0.333 | 0.667 | 0.757 ms |
| Text only | 0.20 | 1.00 | 0.333 | 0.625 | 0.710 ms |
| Image + text | 0.20 | 1.00 | 0.333 | 1.000 | 0.767 ms |
| Image + text + metadata | 0.20 | 1.00 | 0.333 | 1.000 | 1.212 ms |

Embedding generation for the whole set took approximately `15.9 s` on CPU with cached models.

## Interpretation

- Single-modality ranking was fooled by the synthetic modality-conflict distractors.
- Image + text and full fusion ranked the first relevant candidate first for every query.
- Precision@5, Recall@5, and F1 are identical across experiments because the candidate pool
  has exactly five items and all five are returned. MRR is the informative metric here.
- These results demonstrate the evaluation pipeline and the expected direction of fusion on a
  tiny stress set. They do not establish general campus performance.

## Limitations

- Small dataset, repeated images, and synthetic distractors.
- No statistical significance testing.
- No real ground-truth campus benchmark.
- Metadata scoring is heuristic.
- Similarity scores are not calibrated probabilities.
- Product-catalogue or synthetic data must not be represented as real campus evidence.
- No model training or fine-tuning is part of the evaluation.
