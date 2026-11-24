"""Move legacy upload files and evaluation JSON results into PostgreSQL."""

import glob
import json
import os
import sys
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

load_dotenv(BACKEND_DIR / ".env")

from main import (  # noqa: E402
    Base,
    EvaluationRun,
    Report,
    ReportImage,
    SessionLocal,
    engine,
    ensure_schema,
)

CONTENT_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}


def _resolve_path(value: str, default: Path) -> Path:
    path = Path(value).expanduser() if value else default
    if not path.is_absolute():
        path = BACKEND_DIR / path
    return path.resolve()


def _upload_dir() -> Path:
    return _resolve_path(os.getenv("UPLOAD_DIR", "./uploads"), BACKEND_DIR / "uploads")


def _results_dir() -> Path:
    return _resolve_path(
        os.getenv("EVALUATION_RESULTS_DIR", "../datasets/evaluation/results"),
        REPO_ROOT / "datasets" / "evaluation" / "results",
    )


def _image_content_type(path: Path) -> str:
    return CONTENT_TYPES.get(path.suffix.lower(), "application/octet-stream")


def _find_image_path(report: Report, upload_dir: Path):
    direct = [
        path
        for path in sorted(glob.glob(str(upload_dir / f"{report.id}.*")))
        if Path(path).suffix.lower() in CONTENT_TYPES
    ]
    if direct:
        return Path(direct[0])

    legacy = [
        path
        for path in sorted(glob.glob(str(upload_dir / f"{report.owner_id}_*")))
        if Path(path).suffix.lower() in CONTENT_TYPES
    ]
    if not legacy:
        return None

    created = report.created_at.timestamp() if report.created_at else None
    if created is None:
        return Path(legacy[0])

    closest = min(legacy, key=lambda path: abs(os.path.getmtime(path) - created))
    if abs(os.path.getmtime(closest) - created) <= 10:
        return Path(closest)
    return None


def _migrate_images(db) -> int:
    upload_dir = _upload_dir()
    if not upload_dir.exists():
        return 0

    migrated = 0
    for report in db.query(Report).all():
        if db.query(ReportImage).filter(ReportImage.report_id == report.id).first():
            continue

        image_path = _find_image_path(report, upload_dir)
        if image_path is None:
            continue

        db.add(
            ReportImage(
                report_id=report.id,
                content_type=_image_content_type(image_path),
                image_data=image_path.read_bytes(),
            )
        )
        migrated += 1

    if migrated:
        db.commit()
    return migrated


def _migrate_evaluation_results(db) -> int:
    if db.query(EvaluationRun).count():
        return 0

    results_dir = _results_dir()
    if not results_dir.exists():
        return 0

    paths = sorted(results_dir.glob("evaluation-*.json"))
    latest = results_dir / "latest.json"
    if latest.exists():
        paths.append(latest)

    migrated = 0
    seen_run_times = set()
    for path in paths:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue

        run = payload.get("run") or {}
        dataset = payload.get("dataset") or {}
        run_at_value = run.get("run_at")
        if run_at_value in seen_run_times:
            continue
        seen_run_times.add(run_at_value)

        run_at = None
        if run_at_value:
            try:
                run_at = datetime.fromisoformat(run_at_value)
            except ValueError:
                run_at = None

        db.add(
            EvaluationRun(
                run_at=run_at,
                scoring_version=run.get("scoring_version"),
                top_k=run.get("top_k"),
                dataset_name=dataset.get("name"),
                dataset_version=dataset.get("version"),
                query_count=dataset.get("query_count"),
                candidate_count=dataset.get("candidate_count"),
                results=payload,
            )
        )
        migrated += 1

    if migrated:
        db.commit()
    return migrated


def main() -> int:
    Base.metadata.create_all(bind=engine)
    ensure_schema()

    with SessionLocal() as db:
        image_count = _migrate_images(db)
        evaluation_count = _migrate_evaluation_results(db)

    print(f"Migrated report images: {image_count}")
    print(f"Migrated evaluation runs: {evaluation_count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
