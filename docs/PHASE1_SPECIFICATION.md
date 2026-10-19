# FindIt — Phase 1 Technical Contract (Schema, API Routes & Environment Variables)

This document locks in the exact **PostgreSQL database schema**, **REST API routes & JSON payloads**, and **environment variables** agreed upon in **Phase 1** so all five team members (**Josh, Dom, Rey, Kennedy, Kim**) can work in parallel during **Phase 2 & Phase 3** with zero naming mismatches.

---

## 1. Service & Port Mapping

| Container / Service | Internal Port | Host Published Port | Docker Network(s) | Base Image |
| :--- | :--- | :--- | :--- | :--- |
| `proxy` (Nginx Reverse Proxy) | `80` | **`8080`** (Only public port) | `frontend-net` | `nginx:1.27-alpine` |
| `frontend` (Static Web UI) | `80` | *None* | `frontend-net` | `nginx:1.27-alpine` |
| `items-api` (Flask + Gunicorn) | `5000` | *None* | `frontend-net`, `backend-net` | `python:3.12-slim` |
| `claims-api` (Flask + Gunicorn) | `5001` | *None* | `frontend-net`, `backend-net` | `python:3.12-slim` |
| `db` (PostgreSQL Database) | `5432` | *None* | `backend-net` (Isolated) | `postgres:16-alpine` |
| `jenkins` (Separate Compose) | `8080` | **`8081`** | `jenkins` default bridge | `jenkins/jenkins:lts-jdk17` |

---

## 2. Nginx Reverse Proxy Routing (`proxy/nginx.conf`)

- `GET /` $\rightarrow$ `http://frontend:80`
- `GET|POST|PATCH /api/items...` $\rightarrow$ `http://items-api:5000/api/items...`
- `GET|POST|PATCH /api/claims...` $\rightarrow$ `http://claims-api:5001/api/claims...`

---

## 3. PostgreSQL Database Schema (`db/init.sql`)

Database Name: `findit`

### Table 1: `items`
Stores both **Lost** item reports and **Found** item reports.

```sql
CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
    title VARCHAR(120) NOT NULL,
    category VARCHAR(60) NOT NULL,          -- e.g., 'Electronics', 'ID / Cards', 'Bottles / Bags', 'Books', 'Other'
    item_type VARCHAR(20) NOT NULL          -- 'lost' or 'found'
        CHECK (item_type IN ('lost', 'found')),
    location VARCHAR(120) NOT NULL,         -- e.g., 'Library 3rd Floor', 'Main Canteen', 'Room 402'
    date_reported DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    reporter_name VARCHAR(100) NOT NULL,
    reporter_contact VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'claimed', 'returned')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Table 2: `claims`
Stores student claim requests against an item in the `items` table.

```sql
CREATE TABLE IF NOT EXISTS claims (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    claimant_name VARCHAR(100) NOT NULL,
    student_id VARCHAR(40) NOT NULL,
    proof_description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. REST API Contract

### Module 2: `items-api` (`:5000`)

| Method & Route | Purpose | Request Body (JSON) | Response Status & Body |
| :--- | :--- | :--- | :--- |
| `GET /api/items/health` | Health check for Docker & Smoke Test | *None* | `200 OK` `{"status": "healthy", "service": "items-api"}` |
| `GET /api/items` | List all items (optional query params: `?type=lost\|found`, `?status=open\|returned`, `?q=keyword`) | *None* | `200 OK` `[{"id": 1, "title": "...", ...}]` |
| `GET /api/items/<id>` | Get single item by ID | *None* | `200 OK` `{"id": 1, ...}` or `404 Not Found` |
| `POST /api/items` | Report a lost or found item | `{"title": "Black HydroFlask", "category": "Bottles / Bags", "item_type": "found", "location": "Library 3rd Floor", "date_reported": "2026-10-19", "description": "32oz matte black with sticker", "reporter_name": "Dom", "reporter_contact": "dom@campus.edu"}` | `201 Created` `{"id": 4, ...}` or `400 Bad Request` if required fields are missing or `item_type` is invalid |
| `PATCH /api/items/<id>/status` | Update item status (`open`, `claimed`, `returned`) | `{"status": "returned"}` | `200 OK` `{"id": 1, "status": "returned", ...}` |

### Module 3: `claims-api` (`:5001`)

| Method & Route | Purpose | Request Body (JSON) | Response Status & Body |
| :--- | :--- | :--- | :--- |
| `GET /api/claims/health` | Health check for Docker & Smoke Test | *None* | `200 OK` `{"status": "healthy", "service": "claims-api"}` |
| `GET /api/claims` | List all claims (optional `?item_id=<id>` or `?status=pending`) | *None* | `200 OK` `[{"id": 1, "item_id": 1, "item_title": "...", ...}]` |
| `POST /api/claims` | Submit a claim for an item | `{"item_id": 1, "claimant_name": "Rey", "student_id": "2024-10492", "proof_description": "Has my initials engraved on the bottom"}` | `201 Created` (Also rejects with `404` if item doesn't exist, or `400` if item status is already `returned`) |
| `PATCH /api/claims/<id>` | Review a claim (`approved` or `rejected`). If `approved`, automatically sets the linked item's status to `returned`! | `{"status": "approved"}` | `200 OK` `{"id": 1, "status": "approved", "item_status": "returned"}` |

---

## 5. Environment Variables Contract (`.env.example`)

```dotenv
# PostgreSQL Configuration
POSTGRES_DB=findit
POSTGRES_USER=findit_user
POSTGRES_PASSWORD=change_me_in_production

# Backend Database Connection
DB_HOST=db
DB_PORT=5432
DB_NAME=findit
DB_USER=findit_user
DB_PASSWORD=change_me_in_production

# Deployment / Build Tag (Set automatically by Jenkins to BUILD_NUMBER)
TAG=latest
```
