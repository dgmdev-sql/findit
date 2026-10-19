import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import pytest

from app import create_app


@pytest.fixture
def client(tmp_path):
    app = create_app({"TESTING": True, "TEST_DB_PATH": str(tmp_path / "items.sqlite3")})
    return app.test_client()


def item_data(**updates):
    data = {
        "title": "Blue umbrella",
        "category": "Other",
        "item_type": "lost",
        "location": "Science Hall",
        "description": "Blue folding umbrella with a wooden handle",
        "reporter_name": "Rey",
        "reporter_contact": "rey@students.edu.ph",
    }
    data.update(updates)
    return data


def test_health_check(client):
    response = client.get("/api/items/health")
    assert response.status_code == 200
    assert response.get_json()["status"] == "healthy"


def test_create_and_list_items(client):
    created = client.post("/api/items", json=item_data())
    assert created.status_code == 201
    assert created.get_json()["date_reported"]
    assert "T" in created.get_json()["created_at"]
    listed = client.get("/api/items")
    assert listed.status_code == 200
    assert listed.get_json()[0]["title"] == "Blue umbrella"


def test_create_item_validation_error(client):
    assert client.post("/api/items", json={"title": "Incomplete"}).status_code == 400
    assert client.post("/api/items", json=item_data(item_type="missing")).status_code == 400


def test_filter_items_by_type_and_query(client):
    client.post("/api/items", json=item_data())
    client.post("/api/items", json=item_data(title="Red notebook", item_type="found", description="Spiral notebook with grid paper"))
    lost = client.get("/api/items?type=lost").get_json()
    searched = client.get("/api/items?q=WOODEN").get_json()
    assert len(lost) == 1 and lost[0]["title"] == "Blue umbrella"
    assert len(searched) == 1 and searched[0]["title"] == "Blue umbrella"


def test_update_item_status(client):
    item_id = client.post("/api/items", json=item_data()).get_json()["id"]
    response = client.patch(f"/api/items/{item_id}/status", json={"status": "returned"})
    assert response.status_code == 200
    assert response.get_json()["status"] == "returned"


