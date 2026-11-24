# Database Design

## Local Configuration

- PostgreSQL tested: `18.6`
- Database: `fainit`
- Application user: `fainit_user`
- Driver: `psycopg` v3 via SQLAlchemy
- DSN shape: `postgresql+psycopg://USER:PASSWORD@localhost:5432/fainit`

URL-encode reserved characters in the password. For example, `Rajath@2010` becomes
`Rajath%402010` in `POSTGRES_DSN`.

The local PostgreSQL installation does **not** have the `vector` extension available, so
embeddings are stored in `ARRAY(Float)` columns instead of `VECTOR(512)` / `VECTOR(384)`.
The application uses cosine similarity in Python, so matching works without pgvector.

## Tables

### `users`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | `uuid` | No | Primary key |
| `email` | `varchar(255)` | No | Unique, indexed |
| `mobile_number` | `varchar(20)` | Yes | Private contact number; required at registration, nullable for pre-existing users |
| `hashed_password` | `varchar(255)` | No | bcrypt hash |
| `is_active` | `boolean` | Yes | Default true |
| `is_superuser` | `boolean` | Yes | Admin flag |
| `created_at` | `timestamptz` | No | Server default |

Indexes: primary key on `id`, unique index on `email`.

### `reports`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | `uuid` | No | Primary key |
| `type` | `varchar(10)` | No | `LOST` or `FOUND` |
| `title` | `varchar(255)` | No | Item title |
| `description` | `text` | Yes | Free text |
| `category` | `varchar(100)` | Yes | Metadata |
| `color` | `varchar(50)` | Yes | Metadata |
| `location` | `varchar(500)` | Yes | Metadata |
| `event_date` | `timestamptz` | Yes | When the item was lost/found |
| `created_at` | `timestamptz` | No | Server default |
| `updated_at` | `timestamptz` / `timestamp` | No | Fresh DB uses model type; `ensure_schema()` adds a naive timestamp to older DBs |
| `owner_id` | `uuid` | No | FK to `users.id` |
| `image_embedding` | `float8[]` | Yes | CLIP image embedding, 512-d |
| `text_embedding` | `float8[]` | Yes | MiniLM text embedding, 384-d |
| `category_similarity` | `float8` | Yes | Legacy/reserved score column |
| `color_similarity` | `float8` | Yes | Legacy/reserved score column |
| `location_similarity` | `float8` | Yes | Legacy/reserved score column |
| `date_similarity` | `float8` | Yes | Legacy/reserved score column |
| `final_score` | `float8` | Yes | Legacy/reserved score column |
| `is_active` | `boolean` | Yes | Soft-delete flag |
| `status` | `varchar(20)` | No | `OPEN`, `MATCHED`, `CLOSED` |
| `moderation_status` | `varchar(20)` | No | `ACTIVE`, `FLAGGED`, `REMOVED` |

Indexes: primary key on `id`, plus `ix_reports_owner_id`, `ix_reports_type`, and
`ix_reports_category`. Adding a `status` index is a recommended follow-up.

### `report_images`

| Column | Type | Null | Notes |
|---|---|---|---|
| `report_id` | `uuid` | No | Primary key and FK to `reports.id` with `ON DELETE CASCADE` |
| `content_type` | `varchar(50)` | No | `image/jpeg`, `image/png`, or `image/webp` |
| `image_data` | `bytea` | No | Raw uploaded image bytes |
| `updated_at` | `timestamptz` | No | Updated when the image is replaced |

Uploaded report images are stored in PostgreSQL and served by `GET /uploads/{report_id}`.
The API keeps the same public image URL, but the bytes now come from `report_images`.

### `claims`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | `uuid` | No | Primary key |
| `status` | `varchar(20)` | No | `PENDING`, `ACCEPTED`, `REJECTED` |
| `message` | `text` | No | Verification message, default empty string |
| `created_at` | `timestamptz` | No | Server default |
| `updated_at` | `timestamptz` / `timestamp` | No | Fresh DB uses model type; `ensure_schema()` adds a naive timestamp to older DBs |
| `reviewed_at` | `timestamptz` / `timestamp` | Yes | Fresh DB uses model type; bridge column is naive; set on accept/reject |
| `report_id` | `uuid` | No | FK to `reports.id` |
| `claimant_id` | `uuid` | No | FK to `users.id` |
| `reported_owner_id` | `uuid` | No | FK to `users.id`, copied from report owner |

Indexes: primary key on `id`. No additional claim indexes are defined yet; adding indexes on
`report_id`, `claimant_id`, and `status` is a recommended follow-up.

Claim contact details are not stored as a separate table or copied into `claims`. They are
derived from the linked claimant and report-owner `users.mobile_number` values only when the
claim is `ACCEPTED` and the API viewer is one of those two participants.

### `evaluation_runs`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | `uuid` | No | Primary key |
| `created_at` | `timestamptz` | No | Database insert time |
| `run_at` | `timestamptz` | Yes | Timestamp from the evaluation payload |
| `scoring_version` | `varchar(50)` | Yes | Matching/scoring version used by the run |
| `top_k` | `integer` | Yes | Ranking cutoff used for metrics |
| `dataset_name` | `varchar(255)` | Yes | Evaluation dataset name |
| `dataset_version` | `varchar(50)` | Yes | Evaluation dataset version |
| `query_count` | `integer` | Yes | Number of labelled queries |
| `candidate_count` | `integer` | Yes | Number of candidate reports |
| `results` | `json` | No | Full evaluation payload, including per-query results |

Indexes: primary key on `id`, plus `ix_evaluation_runs_created_at`. The evaluation summary
endpoint returns the newest row. Full evaluation JSON/CSV files are no longer written by the
API.

## Relationships

```text
users 1 ─── N reports
users 1 ─── N claims (claimant)
users 1 ─── N claims (reported_owner)
reports 1 ─── N claims
reports 1 ─── 1 report_images
evaluation_runs (standalone run history)
```

## State Rules

- A FOUND report can be claimed only while `is_active = true`, `status = OPEN`, and
  `moderation_status = ACTIVE`.
- Accepting a claim sets the claim to `ACCEPTED`, the report to `MATCHED`, and rejects
  other pending claims for the same report.
- A report can have at most one accepted claim.
- Removing a report is a soft delete (`is_active = false`, `moderation_status = REMOVED`).

## Schema Initialization

There is no Alembic migration in the current repository. On startup the application runs:

1. `Base.metadata.create_all(bind=engine)` to create missing tables, including
   `report_images` and `evaluation_runs`.
2. `ensure_schema()` to add a small set of missing columns to older local databases.

To import legacy upload files and existing evaluation JSON into PostgreSQL, run:

```bash
cd backend
venv/bin/python scripts/migrate_to_db_storage.py
```

`ensure_schema()` currently adds:

- `users.mobile_number`
- `reports.updated_at`, `reports.status`, `reports.moderation_status`
- `claims.message`, `claims.updated_at`, `claims.reviewed_at`

This is a temporary bridge and is tracked as technical debt. A fresh database created by
`create_all()` already contains all current columns.

## Clean Initialization Verification

The local `fainit_user` does not have `CREATEDB` privilege, so clean initialization is
verified with a fresh PostgreSQL schema rather than a new database. The reproducible script
creates a unique schema, runs the full workflow, and drops the schema afterward:

```bash
cd backend
venv/bin/python scripts/verify_demo.py
```

The verification confirmed:

- `users`, `reports`, `claims`, `report_images`, and `evaluation_runs` were created from scratch.
- `users` included `mobile_number`, and registration validated the required mobile field.
- `reports` included `status`, `moderation_status`, `updated_at`, and both embedding columns.
- Embedding columns were `ARRAY` (`float8[]`), confirming the documented fallback.
- The full demo workflow passed: register, login, create LOST/FOUND reports, generate
  embeddings, retrieve matches, submit a claim, accept it, and set the report to `MATCHED`.

The temporary schema was dropped afterward.

## Known Limitations

- No Alembic migrations yet; startup schema changes are not versioned.
- `updated_at`/`reviewed_at` added by `ensure_schema()` are `timestamp without time zone`,
  while the SQLAlchemy models declare timezone-aware datetimes. New databases created by
  `create_all()` use the model definitions.
- Embeddings are not indexed with pgvector; ranking is computed in Python over candidates.
- Legacy upload files are imported by `scripts/migrate_to_db_storage.py`; after migration,
  PostgreSQL is the source of truth for report images.
