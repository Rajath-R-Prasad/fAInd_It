# fAInd It - AI-powered Lost & Found Platform

fAInd It is a web-based lost-and-found platform that uses pretrained AI models (CLIP and
Sentence Transformers) to match lost and found items using images, descriptions, and
metadata.

## Features

- User registration with a private mobile number and JWT authentication
- LOST/FOUND reports with image uploads
- CLIP image embeddings and MiniLM text embeddings
- Multimodal matching with image, text, and metadata fusion
- Top-5 ranked match suggestions with component scores and both report images
- Claims workflow with owner-only accept/reject decisions
- Contact details shared only between participants after a claim is accepted
- Admin moderation for reports and claim inspection
- Responsive Neo-Brutalist frontend with report details and edit flows
- Reproducible evaluation script and protected evaluation page

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** FastAPI, SQLAlchemy, PostgreSQL, psycopg 3
- **AI/ML:** `openai/clip-vit-base-patch32`, `sentence-transformers/all-MiniLM-L6-v2`
- **Auth:** JWT with bcrypt password hashing
- **Vector storage:** `ARRAY(Float)` fallback; pgvector is optional and not required locally

## Repository Layout

```text
dbms_project/
├── backend/
│   ├── app/services/       # embeddings, metadata, matching, evaluation
│   ├── scripts/            # verify_demo.py
│   ├── tests/              # pytest unit tests
│   ├── main.py             # FastAPI app, models, routes
│   ├── requirements.txt
│   └── requirements-dev.txt
├── frontend/
│   └── src/                # React pages, components, tests
├── datasets/evaluation/    # labelled smoke set, images, saved results
├── docs/                   # API, database, AI matching, evaluation docs
├── notebooks/              # experiment outlines
├── PRD.md
└── PROGRESS.md
```

## Prerequisites

- Python 3.10+ (tested with 3.12)
- Node.js 18+ and npm
- PostgreSQL 15+ (tested with 18.6)
- No Docker Compose file is included; use a local PostgreSQL instance

The application works without the PostgreSQL `vector` extension. Embeddings are stored in
`ARRAY(Float)` columns and cosine similarity is computed in Python.

## Setup

### 1. Create the database

Using a PostgreSQL superuser:

```bash
sudo -u postgres psql <<'SQL'
CREATE USER fainit_user WITH PASSWORD 'change-me';
CREATE DATABASE fainit OWNER fainit_user;
\c fainit
GRANT ALL ON SCHEMA public TO fainit_user;
SQL
```

If the user or database already exists, skip the matching statement.

### 2. Backend environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and set at least:

```dotenv
POSTGRES_DSN=postgresql+psycopg://fainit_user:change-me@localhost:5432/fainit
SECRET_KEY=replace-with-a-long-random-secret
BACKEND_CORS_ORIGINS=http://localhost:5173
UPLOAD_DIR=./uploads
```

URL-encode reserved characters in the password. For example, `Rajath@2010` becomes
`Rajath%402010` in the DSN.

### 3. Backend install and run

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

- API: `http://localhost:8000`
- Interactive docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

The first startup creates the tables with `Base.metadata.create_all()` and applies the
additive `ensure_schema()` bridge. The first report creation downloads model weights and can
take several minutes; later requests reuse the cached models.

### 4. Frontend install and run

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Set `frontend/.env` to:

```dotenv
VITE_API_BASE_URL=http://localhost:8000
```

Frontend: `http://localhost:5173`

### 5. Admin access

Register a user through the app, then promote it with SQL:

```bash
psql "postgresql://fainit_user:change-me@localhost:5432/fainit" \
  -c "UPDATE users SET is_superuser = true WHERE email = 'you@example.com';"
```

Log out and log in again so the frontend stores the updated role flag.

## Demo Workflow

1. Register User A and User B with email, mobile number, and password.
2. User A submits a LOST report with an image and description.
3. User B submits a FOUND report for a similar item.
4. The backend generates CLIP and MiniLM embeddings.
5. User A opens Matches and sees ranked FOUND candidates with both images and component scores.
6. User A submits a claim with a verification message.
7. User B opens Claims, reviews the claim, and accepts or rejects it.
8. Accepting a claim sets the claim to `ACCEPTED`, sets the report to `MATCHED`, and unlocks
   contact details for the two participants only.

Automated verification of clean schema creation plus this full workflow:

```bash
cd backend
venv/bin/python scripts/verify_demo.py
```

## Evaluation

```bash
cd backend
venv/bin/python -m app.services.evaluation_service
```

Results are saved to `datasets/evaluation/results/latest.json`, a timestamped JSON file, and
`latest.csv`. The protected Evaluation page reads the saved summary. The included dataset is
a small smoke/stress set, not a representative campus benchmark.

See [docs/EVALUATION.md](docs/EVALUATION.md) for the method, metrics, latest results, and
limitations.

## Tests and Checks

From the repository root:

```bash
cd backend
source venv/bin/activate
pip install -r requirements-dev.txt
venv/bin/python -m pytest tests -q

cd ../frontend
npm test -- --run
npm run lint
npm run build
```

Current verification status:

- Backend pytest: 14 tests passing
- Frontend Vitest/RTL: 3 tests passing
- ESLint: passing
- TypeScript + Vite production build: passing
- Clean-schema demo workflow: passing

## Documentation

- [API reference](docs/API.md)
- [Database design](docs/DATABASE.md)
- [AI matching design](docs/AI_MATCHING.md)
- [Evaluation method](docs/EVALUATION.md)

## Known Limitations

- No Alembic migrations yet; startup uses `create_all()` plus `ensure_schema()`.
- Embeddings use `ARRAY(Float)` because pgvector is unavailable locally.
- `backend/main.py` still contains models, auth, and routes in one module.
- Legacy images uploaded before the `{report_id}.{ext}` convention may not be discoverable.
- No dedicated report-details page; claims are submitted from the matches page.
- The admin route is backend-protected but has no frontend route guard for direct navigation.
- TanStack Query, React Hook Form, and Zod are installed but not fully adopted.
- Evaluation results are from a small smoke set and are not generalizable.
- No seed script and no Docker Compose file.

## License

This project is for educational purposes.
