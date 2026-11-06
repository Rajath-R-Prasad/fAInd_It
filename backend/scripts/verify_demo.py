"""Verify clean schema creation and the full demo workflow against PostgreSQL."""

import os
import shutil
import sys
import tempfile
import uuid
from pathlib import Path

import psycopg
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

load_dotenv(BACKEND_DIR / ".env")

DSN = os.getenv(
    "POSTGRES_DSN",
    "postgresql+psycopg://fainit_user:Rajath%402010@localhost:5432/fainit",
)
PSYCOPG_DSN = DSN.replace("+psycopg", "")
SCHEMA = f"verify_demo_{uuid.uuid4().hex[:8]}"
UPLOAD_DIR = tempfile.mkdtemp(prefix="fainit_verify_")

IMAGES = REPO_ROOT / "datasets" / "evaluation" / "images"
LOST_IMAGE = IMAGES / "lost_water_bottle.webp"
FOUND_IMAGE = IMAGES / "found_red_bottle.jpeg"


def create_schema() -> None:
    with psycopg.connect(PSYCOPG_DSN, autocommit=True) as connection:
        connection.execute(f'CREATE SCHEMA "{SCHEMA}"')


def drop_schema() -> None:
    with psycopg.connect(PSYCOPG_DSN, autocommit=True) as connection:
        connection.execute(f'DROP SCHEMA IF EXISTS "{SCHEMA}" CASCADE')


def run_demo() -> None:
    from fastapi.testclient import TestClient
    from sqlalchemy import inspect

    from main import app, engine

    with TestClient(app) as client:
        health = client.get("/health")
        assert health.status_code == 200, health.text

        def register(email: str, password: str, mobile_number: str) -> dict:
            response = client.post(
                "/auth/register",
                data={
                    "email": email,
                    "password": password,
                    "mobile_number": mobile_number,
                },
            )
            assert response.status_code == 201, response.text
            return response.json()

        def login(email: str, password: str) -> str:
            response = client.post(
                "/auth/token", data={"username": email, "password": password}
            )
            assert response.status_code == 200, response.text
            return response.json()["access_token"]

        owner = register("verify-owner@example.com", "OwnerPass123!", "+91 9000000001")
        finder = register("verify-finder@example.com", "FinderPass123!", "+91 9000000002")
        owner_token = login(owner["email"], "OwnerPass123!")
        finder_token = login(finder["email"], "FinderPass123!")
        owner_headers = {"Authorization": f"Bearer {owner_token}"}
        finder_headers = {"Authorization": f"Bearer {finder_token}"}

        me = client.get("/auth/me", headers=owner_headers)
        assert me.status_code == 200, me.text
        assert me.json()["email"] == owner["email"]

        with LOST_IMAGE.open("rb") as handle:
            lost_response = client.post(
                "/reports/",
                headers=owner_headers,
                data={
                    "report_type": "LOST",
                    "title": "Lost red water bottle",
                    "description": "Red bottle lost near the Golden Jubilee Bhavan bench.",
                    "category": "Water Bottle",
                    "color": "Red",
                    "location": "Golden Jubilee Bhavan bench",
                    "event_date": "2026-11-06T00:08:00+05:30",
                },
                files={"image": (LOST_IMAGE.name, handle, "image/webp")},
            )
        assert lost_response.status_code == 201, lost_response.text
        lost = lost_response.json()
        assert lost["embedding_status"]["image"] == "complete", lost
        assert lost["embedding_status"]["text"] == "complete", lost

        with FOUND_IMAGE.open("rb") as handle:
            found_response = client.post(
                "/reports/",
                headers=finder_headers,
                data={
                    "report_type": "FOUND",
                    "title": "Red bottle found",
                    "description": "Red water bottle found near the Golden Jubilee Bhavan lawn.",
                    "category": "Water Bottle",
                    "color": "Red",
                    "location": "Golden Jubilee Bhavan opposite lawn",
                    "event_date": "2026-11-05T14:47:00+05:30",
                },
                files={"image": (FOUND_IMAGE.name, handle, "image/jpeg")},
            )
        assert found_response.status_code == 201, found_response.text
        found = found_response.json()

        matches = client.get(f"/reports/{lost['id']}/matches", headers=owner_headers)
        assert matches.status_code == 200, matches.text
        match_data = matches.json()
        assert match_data["matches"], match_data
        top = match_data["matches"][0]
        assert top["report"]["id"] == found["id"], top
        assert top["scores"]["final_score"] > 0.5, top

        claim_response = client.post(
            "/claims",
            headers=owner_headers,
            json={
                "found_report_id": found["id"],
                "message": "It has a small scratch on the base and a red loop cap.",
            },
        )
        assert claim_response.status_code == 201, claim_response.text
        claim = claim_response.json()
        assert claim["status"] == "PENDING", claim

        received = client.get("/claims/received", headers=finder_headers)
        assert received.status_code == 200, received.text
        assert any(item["id"] == claim["id"] for item in received.json())

        accept = client.post(f"/claims/{claim['id']}/accept", headers=finder_headers)
        assert accept.status_code == 200, accept.text
        accepted = accept.json()
        assert accepted["status"] == "ACCEPTED", accepted
        assert accepted["contact"]["owner_mobile"] == "+91 9000000002", accepted
        assert accepted["contact"]["claimant_mobile"] == "+91 9000000001", accepted

        found_after = client.get(f"/reports/{found['id']}", headers=finder_headers)
        assert found_after.status_code == 200, found_after.text
        assert found_after.json()["status"] == "MATCHED", found_after.json()

        mine = client.get("/claims/mine", headers=owner_headers)
        assert mine.status_code == 200, mine.text
        assert mine.json()[0]["status"] == "ACCEPTED", mine.json()

        inspector = inspect(engine)
        tables = sorted(inspector.get_table_names(schema=SCHEMA))
        columns = {
            column["name"]
            for column in inspector.get_columns("reports", schema=SCHEMA)
        }
        embedding_types = {
            column["name"]: str(column["type"])
            for column in inspector.get_columns("reports", schema=SCHEMA)
            if column["name"] in {"image_embedding", "text_embedding"}
        }

        print("health:", health.json()["status"])
        print("tables:", ", ".join(tables))
        print("report columns:", ", ".join(sorted(columns)))
        print("embedding columns:", embedding_types)
        print("match final score:", top["scores"]["final_score"])
        print("claim status:", accepted["status"])
        print("found report status:", found_after.json()["status"])
        print("demo workflow: PASS")

    engine.dispose()


def main() -> int:
    create_schema()
    os.environ["PGOPTIONS"] = f"-c search_path={SCHEMA}"
    os.environ["UPLOAD_DIR"] = UPLOAD_DIR
    os.environ["POSTGRES_DSN"] = DSN

    try:
        run_demo()
        return 0
    finally:
        drop_schema()
        shutil.rmtree(UPLOAD_DIR, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
