# FindIt — Technical Documentation & Architecture Report

> **System Architecture and Integration (SYSIN) • Final Course Project**  
> **Containerized Infrastructure and CI/CD Automation using Docker and Jenkins**  
> **Course Section:** ITE-305 | **Date:** October 2026  
> **Team FindIt:** Dominic Marasigan, Rey Fritz Eisen Tan, Charles Kennedy Lawingco, Kim Carlo Abarientos, Joshua Andrei Lunca  

---

## 1. Executive Summary & Project Purpose

Across university and college campuses, lost items—student identification cards, calculators, laptops, chargers, and water flasks—are frequently turned in to disparate campus offices (library, security desks, department laboratories, canteen admin) with no synchronized system. Students spend hours checking multiple desks, while campus staff (ITSO / Student Affairs) lack a unified system to verify ownership claims.

**FindIt** is a containerized, cloud-native web application built to centralize campus lost-and-found operations:
1. **Public Student Portal (`index.html`):** Allows students to browse active lost and found items, search by keywords, filter by category/status, report missing belongings, and submit verified ownership claims.
2. **Restricted ITSO Staff Console (`admin.html`):** Provides staff with an authenticated console to review submitted claims, verify student IDs and ownership proofs, approve/reject recovery requests, and update item lifecycle states.
3. **Automated Cross-Service Lifecycle:** Approving an item claim automatically transitions the parent item's status to `returned` across database records.
4. **Automated CI/CD Pipeline:** Every Git commit triggers an automated Jenkins pipeline that executes isolated multi-stage container unit tests, builds production images, deploys the stack, and runs automated health smoke tests before approving deployment.

---

## 2. System Architecture & Topology

### 2.1 Multi-Container Overview

FindIt is engineered as a decoupled, multi-tier microservice architecture comprising **five application containers** coordinated via a root `docker-compose.yml`, alongside a **dedicated Jenkins CI/CD container** deployed in an isolated Compose stack:

```text
Host Network (Browser / Client)
       │
       ▼ [Port :8080]
┌─────────────────────────────────────────────────────────────┐
│ proxy (Nginx 1.27 Alpine)                                   │
│ Single public entry point on frontend-net                   │
└───────┬─────────────────────────────┬───────────────────────┘
        │                             │
   GET /│                        /api/items, /api/claims
        ▼                             ▼
┌────────────────────────┐    ┌──────────────────────────────────────────┐
│ frontend               │    │ items-api (:5000) & claims-api (:5001)   │
│ Nginx Static Web UI    │    │ Python 3.12 + Flask + Gunicorn           │
│ (frontend-net)         │    │ Dual-network: frontend-net & backend-net │
└────────────────────────┘    └────────────────────┬─────────────────────┘
                                                   │
                                                   ▼ [Port :5432 - Internal]
                                      ┌────────────────────────┐
                                      │ db (PostgreSQL 16)     │
                                      │ backend-net ONLY       │
                                      │ Volume: findit-db-data │
                                      └────────────────────────┘
```

| Container Name | Technology Base | Internal Port | Published Host Port | Networks | Function |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`proxy`** | `nginx:1.27-alpine` | `80` | **`8080:80`** | `frontend-net` | Public gateway; reverse-proxies requests to `frontend`, `items-api`, and `claims-api`. |
| **`frontend`** | `nginx:1.27-alpine` | `80` | *None* | `frontend-net` | Serves the responsive web UI; displays dynamic build tag (`Build #<num>`). |
| **`items-api`** | `python:3.12-slim` + Gunicorn | `5000` | *None* | `frontend-net`, `backend-net` | REST microservice managing catalog CRUD and queries for lost and found items. |
| **`claims-api`** | `python:3.12-slim` + Gunicorn | `5001` | *None* | `frontend-net`, `backend-net` | REST microservice handling claim submissions, verification, and item state synchronization. |
| **`db`** | `postgres:16-alpine` | `5432` | *None* | `backend-net` | Persistent relational store backed by named volume `findit-db-data`. |
| **`jenkins`** | `jenkins/jenkins:lts-jdk17` | `8080`, `50000` | **`8081:8080`** | `jenkins_default` | Independent automation server executing CI/CD pipelines via `/var/run/docker.sock`. |

### 2.2 Network Isolation & Port Security

To enforce zero-trust network segregation:
- **`frontend-net` (Bridge):** Connects `proxy`, `frontend`, `items-api`, and `claims-api`. The database is intentionally excluded from this network, preventing direct web or proxy compromise from reaching the database layer.
- **`backend-net` (Bridge):** Connects `items-api`, `claims-api`, and `db`. Neither the `proxy` nor `frontend` containers have access to `backend-net`.
- **Port Exposure:** Only port `8080` on `proxy` is published to the host. Ports `5000`, `5001`, and `5432` remain strictly internal within the Docker daemon.

---

## 3. Database Architecture & Relational Schema

The PostgreSQL database (`db`) initializes automatically upon first launch using `db/init.sql` baked into `db/Dockerfile`. Data persistence is guaranteed by the named volume `findit-db-data`.

### 3.1 Entity Relationship Model

```text
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│              items              │           │             claims              │
├─────────────────────────────────┤           ├─────────────────────────────────┤
│ id (PK, SERIAL)                 │◄───┐      │ id (PK, SERIAL)                 │
│ title (VARCHAR 120)             │    │      │ item_id (FK -> items.id, INT)   │
│ category (VARCHAR 60)           │    └──────┤ claimant_name (VARCHAR 100)     │
│ item_type ('lost' | 'found')    │           │ student_id (VARCHAR 40)         │
│ location (VARCHAR 120)          │           │ proof_description (TEXT)        │
│ date_reported (DATE)            │           │ status ('pending'|'approved'|..)│
│ description (TEXT)              │           │ created_at (TIMESTAMP)          │
│ reporter_name (VARCHAR 100)     │           └─────────────────────────────────┘
│ reporter_contact (VARCHAR 100)  │
│ status ('open'|'claimed'|'ret') │
│ created_at (TIMESTAMP)          │
└─────────────────────────────────┘
```

### 3.2 Schema Implementation (`db/init.sql`)

```sql
CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
    title VARCHAR(120) NOT NULL,
    category VARCHAR(60) NOT NULL,
    item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('lost', 'found')),
    location VARCHAR(120) NOT NULL,
    date_reported DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    reporter_name VARCHAR(100) NOT NULL,
    reporter_contact VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'returned')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS claims (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    claimant_name VARCHAR(100) NOT NULL,
    student_id VARCHAR(40) NOT NULL,
    proof_description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_items_item_type ON items(item_type);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_claims_item_id ON claims(item_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
```

---

## 4. REST Microservices Specification

### 4.1 Items API (`items-api` • Port `5000`)
- **`GET /api/items/health`**: Returns `{"service":"items-api","status":"healthy"}`.
- **`GET /api/items`**: Retrieves all catalog items ordered `id DESC`. Supports query parameters: `?type=lost|found`, `?status=open|returned`, `?category=...`, and keyword search `?q=...`.
- **`GET /api/items/<id>`**: Returns specific item details or `404 Not Found`.
- **`POST /api/items`**: Validates required fields (`title`, `category`, `item_type`, `location`, `description`, `reporter_name`, `reporter_contact`). Defaults `date_reported` to current date if omitted. Returns `201 Created`.
- **`PATCH /api/items/<id>/status`**: Updates status to `open`, `claimed`, or `returned`.

### 4.2 Claims API (`claims-api` • Port `5001`)
- **`GET /api/claims/health`**: Returns `{"service":"claims-api","status":"healthy"}`.
- **`GET /api/claims`**: Retrieves claims joined with item metadata (`LEFT JOIN items ON claims.item_id = items.id`) so `item_title` is populated for reviewers.
- **`POST /api/claims`**: Submits a recovery claim. Validates item existence (`404` if missing) and rejects claims against already `returned` items (`400`).
- **`PATCH /api/claims/<id>`**: Approves or rejects a claim. When `status == 'approved'`, automatically executes `UPDATE items SET status = 'returned' WHERE id = <item_id>` in the same transaction.

---

## 5. Dockerization & Multi-Stage Build Architecture

### 5.1 Multi-Stage Builds (`base` $\rightarrow$ `test` $\rightarrow$ `production`)
Both `items-api` and `claims-api` utilize 3-stage Dockerfiles:
1. **`base` Stage:** Installs system dependencies and python wheels into `/app` with layer caching enabled.
2. **`test` Stage (CI Quality Gate):** Sets `ENV TESTING=true` and runs `RUN pytest -q`. Unit tests use an in-memory SQLite backend, allowing tests to run during `docker build --target test` without requiring an active PostgreSQL container.
3. **`production` Stage:** Creates an unprivileged system user (`appuser`), exposes internal ports, configures native healthchecks, and launches via Gunicorn with 2 worker processes.

### 5.2 Zero Host Bind Mounts
To prevent path resolution errors when Jenkins controls the Docker socket via sibling containers:
- Configuration files (`nginx.conf`, `init.sql`) are baked directly into custom images (`proxy/Dockerfile`, `db/Dockerfile`).
- All persistent data resides exclusively in named Docker volumes (`findit-db-data`, `jenkins_home`).

---

## 6. Automated CI/CD Pipeline (Jenkinsfile)

The root `Jenkinsfile` defines a 5-stage declarative pipeline executed within the containerized Jenkins instance:

```text
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  1. Checkout │ ──► │   2. Test    │ ──► │3.Build Images│ ──► │  4. Deploy   │ ──► │5. Smoke Test │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

1. **Checkout:** Pulls latest branch revision from GitHub and logs commit hash.
2. **Test (Quality Gate):** Builds `findit/items-api:test` and `findit/claims-api:test`. If any unit test fails, the build terminates immediately, preventing broken code from advancing to deployment.
3. **Build Images:** Builds versioned production images tagged with `TAG=${BUILD_NUMBER}` and injects `BUILD_NUMBER` into the static frontend.
4. **Deploy:** Loads production environment variables from Jenkins Secret File credential `findit-env` and executes `docker compose -p findit up -d --no-build`.
5. **Smoke Test:** Executes automated HTTP health checks against the running proxy container.
6. **Post Actions:** Removes temporary credential files and logs success/failure status.

### 6.1 Automated Rollback Procedure
If a production issue occurs, the team can roll back instantly to any prior verified build number using the single command:

```bash
TAG=<previous-build-number> docker compose -p findit up -d --no-build
```

---

## 7. QA Verification & Smoke Testing

### Running the Automated Smoke Test Suite
The repository includes an automated testing script (`scripts/smoke-test.sh`):

```bash
chmod +x scripts/smoke-test.sh
./scripts/smoke-test.sh http://localhost:8080
```

The script exercises:
- Reverse proxy routing to `/` and `/admin.html`
- Items API and Claims API health endpoints
- Full item reporting $\rightarrow$ claim creation $\rightarrow$ claim approval $\rightarrow$ item status transition lifecycle

---

## 8. Team Roles & Contribution Matrix

| Team Member | Role | Owned Modules & Contributions |
| :--- | :--- | :--- |
| **Dominic Marasigan** | Frontend & Docker Infrastructure Lead | Developed `frontend/` UI and ITSO Admin Console, multi-stage `Dockerfile`s, `docker-compose.yml`, network isolation, and initial system architecture. |
| **Rey Fritz Eisen Tan** | Backend & Database Engineer | Authored `db/init.sql` schema and seed data, `items-api/` and `claims-api/` Flask microservices, and 18 `pytest` unit test fixtures. |
| **Charles Kennedy Lawingco** | DevOps & CI/CD Engineer | Implemented `infra/jenkins/Dockerfile` (with Docker CLI and buildx plugins), `infra/jenkins/docker-compose.yml`, and root `Jenkinsfile` 5-stage pipeline. |
| **Kim Carlo Abarientos** | QA Automation & Documentation Lead | Authored `scripts/smoke-test.sh` automated test suite, technical documentation, runbook specifications, and validation checklists. |
| **Joshua Andrei Lunca** | Project Lead & Scrum Master | Created Phase 1 project proposal (`Appendix A`), system architecture diagram, presentation slides, and Git coordination. |
