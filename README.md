# fAInd It - AI-powered Lost & Found Platform

fAInd It is a web-based lost-and-found platform that uses pretrained AI models (CLIP and Sentence Transformers) to intelligently match lost and found items based on images, descriptions, and metadata.

## Features

- User registration and authentication (JWT)
- Report lost or found items with images
- AI-powered multimodal matching (image + text + metadata)
- Top 5 ranked suggestions for potential matches
- Claims workflow (submit, accept/reject)
- Admin dashboard for moderation
- Evaluation/research dashboard

## Tech Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS (Neo-brutalist design)
- **Backend:** FastAPI + SQLAlchemy + PostgreSQL + pgvector
- **AI/ML:** CLIP (openai/clip-vit-base-patch32), Sentence Transformers (all-MiniLM-L6-v2) - inference only
- **Auth:** JWT tokens with bcrypt password hashing

## Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL 15+ with pgvector extension
- Docker and Docker Compose (optional)

## Setup Instructions

### 1. Clone the repository
```bash
git clone <repo-url>
cd dbms_project
```

### 2. Environment Setup

Copy example env files and configure:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit the `.env` files with your configuration.

### 3. Database Setup (with Docker)
```bash
docker-compose up -d db
```

Or install PostgreSQL locally and create database with pgvector.

### 4. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

The API will be available at http://localhost:8000
API docs at http://localhost:8000/docs

### 5. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

The app will be available at http://localhost:5173

## Database Migrations

Using Alembic:
```bash
cd backend
alembic init alembic
alembic revision --autogenerate -m "Initial migration"
alembic upgrade head
```

## Models

This project uses pretrained models only:
- Image embeddings: `openai/clip-vit-base-patch32`
- Text embeddings: `sentence-transformers/all-MiniLM-L6-v2`

Models are downloaded automatically on first use and cached locally.

## Project Structure

```
dbms_project/
├── backend/          # FastAPI backend
├── frontend/         # React + Vite frontend
├── notebooks/        # Jupyter notebooks for experimentation
├── datasets/         # Dataset storage
├── PRD.md           # Product Requirements Document
└── PROGRESS.md      # Implementation progress
```

## License

This project is for educational purposes.
