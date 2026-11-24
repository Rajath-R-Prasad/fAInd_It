"""Run the evaluation and persist the result in PostgreSQL."""

import sys
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

load_dotenv(BACKEND_DIR / ".env")

from main import (  # noqa: E402
    Base,
    EvaluationRun,
    SessionLocal,
    _evaluation_run_record,
    engine,
    ensure_schema,
)
from app.services.evaluation_service import run_evaluation  # noqa: E402


def main() -> int:
    Base.metadata.create_all(bind=engine)
    ensure_schema()

    results = run_evaluation()
    with SessionLocal() as db:
        db.add(_evaluation_run_record(results))
        db.commit()

    print("Evaluation complete. Results stored in evaluation_runs.")
    for experiment in results["experiments"]:
        print(
            f"{experiment['name']}: "
            f"P@5={experiment['precision_at_5']}, "
            f"R@5={experiment['recall_at_5']}, "
            f"F1={experiment['f1']}, "
            f"MRR={experiment['mrr']}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
