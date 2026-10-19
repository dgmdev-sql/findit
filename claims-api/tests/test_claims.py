import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import sqlite3

import pytest

from app import create_app


@pytest.fixture
def client(tmp_path):
    db_path = tmp_path / "claims.sqlite3"
    app = create_app({"TESTING": True, "TEST_DB_PATH": str(db_path)})
    with sqlite3.connect(db_path) as connection:
        connection.execute("""
            CREATE TABLE items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title VARCHAR(120) NOT NULL,
                category VARCHAR(60) NOT NULL,
                item_type VARCHAR(20) NOT NULL,
                location VARCHAR(120) NOT NULL,
                date_reported DATE NOT NULL DEFAULT CURRENT_DATE,
                description TEXT NOT NULL,
                reporter_name VARCHAR(100) NOT NULL,
                reporter_contact VARCHAR(100) NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'open',
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        connection.execute("""
            INSERT INTO items (title, category, item_type, location, description, reporter_name, reporter_contact, status)
            VALUES ('Blue umbrella', 'Other', 'lost', 'Science Hall', 'Wood handle', 'Rey', 'rey@students.edu.ph', 'open')
        """)
        connection.execute("""
            INSERT INTO items (title, category, item_type, location, description, reporter_name, reporter_contact, status)
            VALUES ('Red notebook', 'Books / Notes', 'found', 'Library', 'Grid paper', 'Kim', 'kim@students.edu.ph', 'returned')
        """)
    return app.test_client()


def submit(client, item_id=1):
    return client.post("/api/claims", json={
        "item_id": item_id,
        "claimant_name": "Dom",
        "student_id": "2024-100482",
        "proof_description": "Scratch on the lid and campus sticker",
    })


def test_health_check(client):
    response = client.get("/api/claims/health")
    assert response.status_code == 200
    assert response.get_json()["status"] == "healthy"


def test_submit_claim_success(client):
    response = submit(client)
    assert response.status_code == 201
    assert response.get_json()["status"] == "pending"
    assert response.get_json()["item_title"] == "Blue umbrella"
    assert "T" in response.get_json()["created_at"]


def test_submit_claim_for_missing_or_returned_item(client):
    assert submit(client, 999).status_code == 404
    assert submit(client, 2).status_code == 400


def test_approve_claim_marks_item_returned(client):
    claim_id = submit(client).get_json()["id"]
    response = client.patch(f"/api/claims/{claim_id}", json={"status": "approved"})
    assert response.status_code == 200
    assert response.get_json()["item_status"] == "returned"
    with sqlite3.connect(client.application.config["TEST_DB_PATH"]) as connection:
        status = connection.execute("SELECT status FROM items WHERE id = 1").fetchone()[0]
    assert status == "returned"


def test_reject_claim_keeps_item_open(client):
    claim_id = submit(client).get_json()["id"]
    response = client.patch(f"/api/claims/{claim_id}", json={"status": "rejected"})
    assert response.status_code == 200
    with sqlite3.connect(client.application.config["TEST_DB_PATH"]) as connection:
        status = connection.execute("SELECT status FROM items WHERE id = 1").fetchone()[0]
    assert status == "open"



def test_list_claims_filters_and_update_errors(client):
    assert client.post("/api/claims", json={}).status_code == 400
    claim = submit(client).get_json()
    response = client.get("/api/claims?item_id=1&status=pending")
    assert response.status_code == 200
    assert response.get_json()[0]["item_title"] == "Blue umbrella"
    assert client.get("/api/claims?item_id=not-a-number").status_code == 400
    assert client.patch(f"/api/claims/{claim['id']}", json={"status": "pending"}).status_code == 400
    assert client.patch("/api/claims/999", json={"status": "approved"}).status_code == 404


def test_testing_config_can_be_enabled_after_app_creation():
    app = create_app({"TESTING": False})
    app.config["TESTING"] = True
    assert app.test_client().get("/api/claims").status_code == 200


def test_test_db_path_environment_variable_is_used(monkeypatch, tmp_path):
    db_path = tmp_path / "configured.sqlite3"
    monkeypatch.setenv("TESTING", "true")
    monkeypatch.setenv("TEST_DB_PATH", str(db_path))
    app = create_app()
    assert app.config["TEST_DB_PATH"] == str(db_path)
    assert app.test_client().get("/api/claims").status_code == 200


def test_invalid_claim_bodies_are_rejected(client):
    assert client.post("/api/claims", json=[]).status_code == 400
    assert client.post("/api/claims", json={"item_id": 1, "claimant_name": 12, "student_id": "42", "proof_description": "proof"}).status_code == 400
    assert client.post("/api/claims", json={"item_id": 1.5, "claimant_name": "Dom", "student_id": "42", "proof_description": "proof"}).status_code == 400
    assert client.patch("/api/claims/1", json=[]).status_code == 400
