# FindIt: Technical Architecture & Systems Integration Report

> **System Architecture and Integration (SYSIN) • Final Course Project**  
> **Containerized Multi-Module Infrastructure and Automated CI/CD Pipeline**  
> **Course & Section:** ITE-305 | **Date:** October 2026  
> **Group Name:** Team TraceOps  
> **Repository:** `https://github.com/dgmdev-sql/findit`  

---

## 1. Title Page & Team Roster

| Member Full Name | Assigned Primary Role | GitHub Profile Handle |
| :--- | :--- | :--- |
| **Joshua Andrei Lunca** | Project Lead / Scrum Master | `github.com/josh-lunca` |
| **Dominic Marasigan** | Frontend & Docker Infrastructure Lead | `github.com/dgmdev-sql` |
| **Rey Fritz Eisen Tan** | Backend & Database Engineer | `github.com/tanreyfritz` |
| **Charles Kennedy Lawingco** | DevOps & CI/CD Engineer | `github.com/lawingcocharles7-star` |
| **Kim Carlo Abarientos** | QA Automation & Technical Documentation Lead | `github.com/kim-abarientos` |

---

## 2. Project Description & Application Modules

Across university and college campuses, lost items—student identification cards, calculators, laptops, chargers, and water flasks—are frequently turned in to disparate campus offices (library, security desks, department laboratories, canteen admin) with no synchronized system. Students spend hours checking multiple desks, while campus staff (ITSO / Student Affairs) lack a unified system to verify ownership claims.

**FindIt** is a containerized, cloud-native web application built to centralize campus lost-and-found operations:
1. **Public Student Portal (`index.html`):** Allows students to browse active lost and found items, search by keywords, filter by category/status, report missing belongings, and submit verified ownership claims.
2. **Restricted ITSO Staff Console (`admin.html`):** Provides staff with an authenticated console to review submitted claims, verify student IDs and ownership proofs, approve/reject recovery requests, and update item lifecycle states.
3. **Automated Cross-Service Lifecycle:** Approving an item claim automatically transitions the parent item's status to `returned` across database records.
4. **Automated CI/CD Pipeline:** Every Git commit triggers an automated Jenkins pipeline that executes isolated multi-stage container unit tests, builds production images, deploys the stack, and runs automated health smoke tests before approving deployment.

### System Modules Breakdown

| Module Identifier | Base Technology | Container Name | Responsibilities |
| :--- | :--- | :--- | :--- |
| **Gateway / Proxy** | `nginx:1.27-alpine` | `findit-proxy-1` | Reverse proxies public ingress on port 8080. Routes `/` to frontend, `/api/items` to Items API, and `/api/claims` to Claims API. |
| **Web Frontend** | `nginx:1.27-alpine` + Vanilla ES6 | `findit-frontend-1` | Serves the responsive Student Portal and ITSO Admin Console. Renders dynamic live build badge (`Build #<num> | Live API`). |
| **Items Microservice** | Python 3.12 + Flask + Gunicorn | `findit-items-api-1` | Handles lost and found catalog CRUD, keyword searches, filtering, and health endpoints on internal port 5000. |
| **Claims Microservice** | Python 3.12 + Flask + Gunicorn | `findit-claims-api-1` | Handles ownership claim submissions, validation against existing items, and atomic status transitions on internal port 5001. |
| **Relational Database** | PostgreSQL 16 Alpine | `findit-db-1` | Provides ACID-compliant relational persistence for items and claims tables, backed by named volume `findit-db-data`. |
| **Automation Controller** | Jenkins LTS + Docker CLI | `findit-jenkins` | Dedicated CI/CD server executing the 5-stage pipeline via `/var/run/docker.sock` on port 8081. |

---

## 3. System Architecture & Request Topology

### 3.1 Network Topology Diagram

```text
                           PUBLIC INTERNET / BROWSER
                                      │
                                      ▼ [Published Host Port: 8080]
┌─────────────────────────────────────────────────────────────────────────────────┐
│ proxy (Nginx 1.27 Alpine)                                                       │
│ Reverse Proxy Gateway on frontend-net                                           │
└───────┬─────────────────────────────────┬───────────────────────────────────────┘
        │                                 │
   GET /│                        /api/items, /api/claims
        ▼                                 ▼
┌────────────────────────┐       ┌────────────────────────────────────────────────┐
│ frontend               │       │ items-api (:5000) & claims-api (:5001)         │
│ Static Web Assets      │       │ Python 3.12 + Flask + Gunicorn                 │
│ Network: frontend-net  │       │ Dual Network: frontend-net AND backend-net     │
└────────────────────────┘       └───────────────────────┬────────────────────────┘
                                                         │
                                                         ▼ [Internal Port: 5432]
                                         ┌────────────────────────────────────────┐
                                         │ db (PostgreSQL 16 Alpine)              │
                                         │ Network: backend-net ONLY              │
                                         │ Persistent Volume: findit-db-data      │
                                         └────────────────────────────────────────┘
```

### 3.2 Network Segmentation & Zero-Trust Principles
- **`frontend-net` (Bridge):** Interconnects `proxy`, `frontend`, `items-api`, and `claims-api`. The database container is strictly excluded from this network.
- **`backend-net` (Bridge):** Isolated internal network interconnecting `items-api`, `claims-api`, and `db`.
- **Zero Exposed Database Port:** Port 5432 is never mapped to the host operating system. The public proxy and frontend containers have no network route to PostgreSQL.

---

## 4. Technology Stack & Technical Justifications

| Component | Selected Technology | Technical Justification |
| :--- | :--- | :--- |
| **Web Server / Ingress** | Nginx 1.27 (Alpine) | Extremely lightweight footprint (~40MB), non-blocking event-driven architecture, robust path-based reverse proxying, and minimal resource utilization. |
| **Frontend UI** | Semantic HTML5, CSS3, ES6 JS | Zero framework bloat; fast initial load times; universal browser compatibility; easily containerized with static Nginx serving. |
| **Microservices Backend** | Python 3.12 + Flask + Gunicorn | Lightweight micro-framework architecture with minimal overhead. Gunicorn provides pre-fork worker processes for production concurrency. Native `pytest` testability. |
| **Database** | PostgreSQL 16 (Alpine) | Strong relational integrity (foreign keys, cascading constraints, check constraints for item types and status), high write consistency, and battle-tested ACID compliance. |
| **Container Engine** | Docker Compose v2 | Declarative multi-container orchestration with native support for user-defined bridge networks, persistent named volumes, and healthcheck dependencies. |
| **CI/CD Automation** | Jenkins LTS (JDK 17) | Industry-standard automation server supporting declarative pipeline-as-code (`Jenkinsfile`), credential management, and direct Docker socket integration. |

---

## 5. Dockerfile Implementation & Security Hardening

### 5.1 Multi-Stage Build Architecture
Both `items-api` and `claims-api` utilize 3-stage Dockerfiles:
1. **`base` Stage:** Installs system dependencies and python wheels into `/app` with layer caching enabled.
2. **`test` Stage (CI Quality Gate):** Sets `ENV TESTING=true` and runs `RUN pytest -q`. Unit tests execute against an in-memory SQLite backend, allowing tests to run during `docker build --target test` without requiring an active PostgreSQL container.
3. **`production` Stage:** Creates an unprivileged system user (`appuser`, UID 10001), exposes internal ports, configures native healthchecks, and launches via Gunicorn with 2 worker processes.

### 5.2 Security Choices & Best Practices
- **Pinned Slim Base Images:** Specific tags (`python:3.12-slim`, `postgres:16-alpine`, `nginx:1.27-alpine`) are used to prevent unexpected upstream breaking changes.
- **Principle of Least Privilege:** Production containers execute under `USER appuser` (UID 10001) rather than `root`.
- **Zero Host Bind Mounts:** Configuration files (`nginx.conf`, `init.sql`) are baked directly into images, preventing Windows/Linux path resolution conflicts.
- **Layer Caching:** Dependency manifests (`requirements.txt`) are copied and installed prior to application source code.

---

## 6. Docker Compose Orchestration

The root `docker-compose.yml` manages all 5 application services:
- **Service Dependency & Healthchecks:** The reverse proxy depends on `frontend`, `items-api`, and `claims-api` with `condition: service_healthy`. The API microservices depend on `db` with `condition: service_healthy` using `pg_isready`.
- **Persistent Volume:** Declares named volume `findit-db-data` mounted to `/var/lib/postgresql/data` ensuring zero data loss during container teardowns.
- **Environment Configuration:** Sensitive credentials (`POSTGRES_PASSWORD`, `DB_PASSWORD`) are externalized into `.env` (excluded via `.gitignore`) with committed template `.env.example`.

---

## 7. Jenkins Containerization & CI/CD Setup

### 7.1 Architecture & Docker-in-Docker Setup
Jenkins runs inside its own container stack (`infra/jenkins/`) built from `jenkins/jenkins:lts-jdk17`. The custom image installs the official Docker CE CLI and Compose plugins:
```dockerfile
FROM jenkins/jenkins:lts-jdk17
USER root
RUN apt-get update && apt-get install -y ca-certificates curl gnupg \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl-fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
    && chmod a+r /etc/apt/keyrings/docker.asc \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list \
    && apt-get update && apt-get install -y docker-ce-cli docker-compose-plugin \
    && rm-rf /var/lib/apt/lists/*
USER jenkins
```

The container mounts the host Docker socket (`/var/run/docker.sock`), allowing Jenkins to spawn and manage sibling containers directly on the host engine.

### 7.2 Trigger & Secrets Management
- **Trigger Strategy:** Configured with `pollSCM('H/2 * * * *')`. Checks GitHub every 2 minutes for new commits on the `main` branch.
- **Credentials Store:** The production environment file is stored as a Jenkins Secret File (`findit-env`), injected securely during deployment and deleted immediately afterward.

---

## 8. Pipeline Stages & Failure Behavior

The pipeline defines 5 declarative stages in `Jenkinsfile`:

```text
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  1. Checkout │ ──► │   2. Test    │ ──► │3.Build Images│ ──► │  4. Deploy   │ ──► │5. Smoke Test │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

1. **Stage 1: Checkout:** Clones the latest commit from `main` and captures `GIT_COMMIT`.
2. **Stage 2: Test (Quality Gate):** Builds `findit/items-api:test` and `findit/claims-api:test`. If any assertion fails, pytest exits with code 1, immediately terminating the build.
3. **Stage 3: Build Images:** Builds production images tagged with `TAG=${BUILD_NUMBER}` and bakes `BUILD_NUMBER` into the static frontend.
4. **Stage 4: Deploy:** Injects `.env` secrets and runs `docker compose -p findit up -d --no-build` for a zero-downtime rolling update.
5. **Stage 5: Smoke Test:** Executes `scripts/smoke-test.sh` to verify HTTP 200 responses and functional lifecycle operations.

---

## 9. Testing Strategy & Quality Assurance

### 9.1 Unit Testing Suite (18 Tests)
- `items-api/tests/test_items.py`: 10 test cases covering catalog listing, pagination/query filters, required field validation, and 404 error handling.
- `claims-api/tests/test_claims.py`: 8 test cases covering claim creation, non-existent item handling, conflict prevention on returned items, and atomic status updates.
- **In-Memory Testing Backend:** Tests run with `TESTING=true`, activating an SQLite backend. This allows unit tests to execute inside Docker during image build without needing an active PostgreSQL instance.

### 9.2 Post-Deployment Smoke Testing (`smoke-test.sh`)
Automated bash suite executing 9 comprehensive checks against the live proxy endpoint:
1. Reverse proxy root endpoint (`GET /`)
2. Reverse proxy admin endpoint (`GET /admin.html`)
3. Items API health check (`GET /api/items/health`)
4. Claims API health check (`GET /api/claims/health`)
5. Item creation (`POST /api/items`)
6. Item retrieval (`GET /api/items/<id>`)
7. Claim submission (`POST /api/claims`)
8. Claim approval (`PATCH /api/claims/<id>`)
9. State transition verification (`GET /api/items/<id>` verifies `status == 'returned'`)

---

## 10. Rollback Procedure & Data Persistence Proof

### 10.1 Instant Rollback Mechanism
Because each build tags production images with `${BUILD_NUMBER}`, rolling back requires no image recompilation:
```bash
# In PowerShell:
$env:TAG="2"; docker compose -p findit up -d --no-build

# In Git Bash / Linux:
TAG=2 docker compose -p findit up -d --no-build
```
Docker Compose recreates the frontend container from the local cache in under 3 seconds, restoring the previous build without touching database volumes.

### 10.2 Persistence Guarantee
Relational data is stored in Docker volume `findit-db-data`. Destroying containers via `docker compose down` leaves the volume intact. Rebuilding or restarting the database container (`docker restart findit-db-1`) immediately restores all tables and items.

---

## 11. Problems Encountered & Technical Solutions

| # | Challenge Encountered | Root Cause | Technical Resolution |
| :---: | :--- | :--- | :--- |
| **1** | Windows Named Pipe vs Linux Socket | Jenkins runs in Linux container expecting `/var/run/docker.sock`, while Windows Docker uses named pipe `//./pipe/dockerDesktopLinuxEngine`. | Mounted `/var/run/docker.sock:/var/run/docker.sock` in Compose; Docker Desktop translates socket calls seamlessly. |
| **2** | Curl JSON Escaping in Windows Bash | PowerShell/bash argument parser corrupted double-quoted JSON strings during `smoke-test.sh` execution. | Refactored curl commands in `smoke-test.sh` to use single-quoted JSON strings with `printf`, ensuring 100% test reliability. |
| **3** | Database Test Dependency During CI | Running unit tests in Docker build typically requires a live PostgreSQL instance, introducing circular dependencies. | Implemented dual-driver database logic: `sqlite3` when `TESTING=true`, `psycopg2` in production. Tests run entirely in-memory during build. |
| **4** | PowerShell Environment Variable Syntax | Inline Linux syntax `TAG=2 docker compose` fails in Windows PowerShell with `CommandNotFoundException`. | Documented and standardized cross-platform commands: `$env:TAG="2"` in PowerShell and `TAG=2` in Bash. |

---

## 12. Individual Contributions Matrix & Grading Accountability

The table below provides the detailed accountability breakdown of specific code files, architecture components, and deliverables contributed by each student for individual evaluation (15% Q&A / Peer Rubric):

| Member Name | Specific Files & Modules Authored | Technical Implementation & Responsibilities | Effort |
| :--- | :--- | :--- | :--- |
| **Dominic Marasigan** | `frontend/index.html`, `admin.html`, `css/styles.css`, `js/app.js`, `docker-compose.yml`, `proxy/Dockerfile`, `proxy/nginx.conf` | Developed responsive Student and Staff UI, Nginx reverse proxy single-ingress gateway, Compose network orchestration, multi-stage Dockerfiles. | 20% |
| **Rey Fritz Eisen Tan** | `db/init.sql`, `items-api/app.py`, `items-api/tests/`, `claims-api/app.py`, `claims-api/tests/`, `db/Dockerfile` | Engineered PostgreSQL schema and seed fixtures, built Flask REST microservices, authored dual SQLite/Postgres DB driver, created 18 unit tests. | 20% |
| **Charles Kennedy Lawingco** | `infra/jenkins/Dockerfile`, `infra/jenkins/docker-compose.yml`, root `Jenkinsfile` | Implemented custom Jenkins Dockerfile with Docker CLI and Compose plugins, scripted 5-stage declarative pipeline, SCM polling, and rollback mechanism. | 20% |
| **Kim Carlo Abarientos** | `scripts/smoke-test.sh`, `docs/TECHNICAL_DOCUMENTATION.md`, validation runbooks | Created automated 9-step HTTP health smoke test suite, authored comprehensive technical documentation report, designed QA runbook verification. | 20% |
| **Joshua Andrei Lunca** | `docs/FindIt_Phase1_Project_Proposal_AppendixA.pdf`, `docs/architecture.png`, `docs/architecture.svg`, presentation structure | Authored Phase 1 project proposal, designed system architecture diagrams, coordinated task milestones and Git branch merge management. | 20% |

### References
1. Docker Documentation: *Multi-stage builds, Dockerfile best practices, and compose specifications* (`https://docs.docker.com/`).
2. Jenkins User Handbook: *Declarative Pipeline Syntax, Docker Pipeline, and Credentials Management* (`https://www.jenkins.io/doc/book/pipeline/`).
3. PostgreSQL 16 Documentation: *ACID transactions, relational constraints, and pg_isready* (`https://www.postgresql.org/docs/16/`).
4. Flask 3.0 & Gunicorn Documentation: *Application factories and WSGI server deployment* (`https://flask.palletsprojects.com/`).
