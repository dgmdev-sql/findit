import os
from contextlib import closing
import sqlite3
import tempfile
from datetime import date, datetime

import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Flask, current_app, jsonify, request


def create_app(test_config=None):
    app = Flask(__name__)
    app.config.update(TESTING=os.getenv("TESTING", "false").lower() == "true")
    if test_config:
        app.config.update(test_config)
    if app.config["TESTING"] and not app.config.get("TEST_DB_PATH"):
        fd, path = tempfile.mkstemp(prefix="findit-claims-", suffix=".sqlite3")
        os.close(fd)
        app.config["TEST_DB_PATH"] = path

    def connect_db():
        if current_app.config.get("TESTING") or os.getenv("TESTING", "false").lower() == "true":
            connection = sqlite3.connect(current_app.config["TEST_DB_PATH"])
            connection.row_factory = sqlite3.Row
            connection.executescript("""
                PRAGMA foreign_keys = ON;
                CREATE TABLE IF NOT EXISTS items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
                    claimant_name VARCHAR(100) NOT NULL,
                    student_id VARCHAR(40) NOT NULL,
                    proof_description TEXT NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
            """)
            return connection
        return psycopg2.connect(
            host=os.getenv("DB_HOST", "db"),
            port=os.getenv("DB_PORT", "5432"),
            dbname=os.getenv("DB_NAME", "findit"),
            user=os.getenv("DB_USER", "findit_user"),
            password=os.getenv("DB_PASSWORD", "change_me_in_production"),
            cursor_factory=RealDictCursor,
        )

    def execute(cursor, sql, values=()):
        if isinstance(cursor.connection, sqlite3.Connection):
            sql = sql.replace("%s", "?")
        cursor.execute(sql, values)

    def serialize_claim(row):
        result = dict(row)
        value = result.get("created_at")
        if isinstance(value, (date, datetime)):
            result["created_at"] = value.isoformat()
        elif value is not None:
            result["created_at"] = str(value).replace(" ", "T", 1)
        return result

    @app.get("/api/claims/health")
    def health():
        return jsonify(status="healthy", service="claims-api")

    @app.get("/api/claims")
    def list_claims():
        clauses = []
        values = []
        if request.args.get("item_id"):
            try:
                values.append(int(request.args["item_id"]))
            except ValueError:
                return jsonify(error="item_id must be an integer"), 400
            clauses.append("c.item_id = %s")
        if request.args.get("status"):
            clauses.append("c.status = %s")
            values.append(request.args["status"])
        sql = "SELECT c.id, c.item_id, i.title AS item_title, c.claimant_name, c.student_id, c.proof_description, c.status, c.created_at FROM claims c LEFT JOIN items i ON c.item_id = i.id"
        if clauses:
            sql += " WHERE " + " AND ".join(clauses)
        sql += " ORDER BY c.id DESC"
        connection = connect_db()
        try:
            with closing(connection.cursor()) as cursor:
                execute(cursor, sql, values)
                return jsonify([serialize_claim(row) for row in cursor.fetchall()])
        finally:
            connection.close()

    @app.post("/api/claims")
    def create_claim():
        data = request.get_json(silent=True) or {}
        fields = ("item_id", "claimant_name", "student_id", "proof_description")
        if any(field not in data or data[field] is None or (isinstance(data[field], str) and not data[field].strip()) for field in fields):
            return jsonify(error="item_id, claimant_name, student_id, and proof_description are required"), 400
        try:
            item_id = int(data["item_id"])
            if isinstance(data["item_id"], bool) or item_id <= 0:
                raise ValueError
        except (TypeError, ValueError):
            return jsonify(error="item_id must be a positive integer"), 400
        connection = connect_db()
        try:
            with connection:
                with closing(connection.cursor()) as cursor:
                    execute(cursor, "SELECT id, title, status FROM items WHERE id = %s", (item_id,))
                    item = cursor.fetchone()
                    if item is None:
                        return jsonify(error="Item not found"), 404
                    if item["status"] == "returned":
                        return jsonify(error="Returned items cannot be claimed"), 400
                    execute(cursor, "INSERT INTO claims (item_id, claimant_name, student_id, proof_description) VALUES (%s, %s, %s, %s) RETURNING *", (item_id, data["claimant_name"].strip(), data["student_id"].strip(), data["proof_description"].strip()))
                    claim = dict(cursor.fetchone())
                    claim["item_title"] = item["title"]
            return jsonify(serialize_claim(claim)), 201
        finally:
            connection.close()

    @app.patch("/api/claims/<int:claim_id>")
    def update_claim(claim_id):
        data = request.get_json(silent=True) or {}
        status = data.get("status")
        if status not in ("approved", "rejected"):
            return jsonify(error="status must be 'approved' or 'rejected'"), 400
        connection = connect_db()
        try:
            with connection:
                with closing(connection.cursor()) as cursor:
                    execute(cursor, "SELECT c.id, c.item_id, i.title AS item_title FROM claims c LEFT JOIN items i ON c.item_id = i.id WHERE c.id = %s", (claim_id,))
                    existing = cursor.fetchone()
                    if existing is None:
                        return jsonify(error="Claim not found"), 404
                    execute(cursor, "UPDATE claims SET status = %s WHERE id = %s", (status, claim_id))
                    if status == "approved":
                        execute(cursor, "UPDATE items SET status = 'returned' WHERE id = %s", (existing["item_id"],))
                    execute(cursor, "SELECT c.id, c.item_id, i.title AS item_title, c.claimant_name, c.student_id, c.proof_description, c.status, c.created_at FROM claims c LEFT JOIN items i ON c.item_id = i.id WHERE c.id = %s", (claim_id,))
                    claim = serialize_claim(cursor.fetchone())
                    if status == "approved":
                        claim["item_status"] = "returned"
            return jsonify(claim)
        finally:
            connection.close()

    return app


app = create_app()





