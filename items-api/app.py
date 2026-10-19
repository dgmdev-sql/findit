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
        fd, path = tempfile.mkstemp(prefix="findit-items-", suffix=".sqlite3")
        os.close(fd)
        app.config["TEST_DB_PATH"] = path

    def connect_db():
        if current_app.config.get("TESTING") or os.getenv("TESTING", "false").lower() == "true":
            db_path = current_app.config.get("TEST_DB_PATH")
            if not db_path:
                fd, db_path = tempfile.mkstemp(prefix="findit-items-", suffix=".sqlite3")
                os.close(fd)
                current_app.config["TEST_DB_PATH"] = db_path
            connection = sqlite3.connect(db_path)
            connection.row_factory = sqlite3.Row
            connection.executescript("""
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
                )
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

    def serialize_item(row):
        result = dict(row)
        for key in ("date_reported", "created_at"):
            value = result.get(key)
            if isinstance(value, (date, datetime)):
                result[key] = value.isoformat()
            elif value is not None:
                result[key] = value.replace(" ", "T", 1) if key == "created_at" else str(value)
        return result

    @app.get("/api/items/health")
    def health():
        return jsonify(status="healthy", service="items-api")

    @app.get("/api/items")
    def list_items():
        clauses = []
        values = []
        for parameter, column in (("type", "item_type"), ("status", "status"), ("category", "category")):
            value = request.args.get(parameter)
            if value:
                clauses.append(f"{column} = %s")
                values.append(value)
        query = request.args.get("q", "").strip()
        if query:
            clauses.append("(" + " OR ".join(f"LOWER({column}) LIKE LOWER(%s)" for column in ("title", "category", "location", "description", "reporter_name")) + ")")
            values.extend([f"%{query}%"] * 5)
        sql = "SELECT * FROM items"
        if clauses:
            sql += " WHERE " + " AND ".join(clauses)
        sql += " ORDER BY id DESC"
        connection = connect_db()
        try:
            with closing(connection.cursor()) as cursor:
                execute(cursor, sql, values)
                return jsonify([serialize_item(row) for row in cursor.fetchall()])
        finally:
            connection.close()

    @app.get("/api/items/<int:item_id>")
    def get_item(item_id):
        connection = connect_db()
        try:
            with closing(connection.cursor()) as cursor:
                execute(cursor, "SELECT * FROM items WHERE id = %s", (item_id,))
                item = cursor.fetchone()
            if item is None:
                return jsonify(error="Item not found"), 404
            return jsonify(serialize_item(item))
        finally:
            connection.close()

    @app.post("/api/items")
    def create_item():
        data = request.get_json(silent=True) or {}
        fields = ("title", "category", "item_type", "location", "description", "reporter_name", "reporter_contact")
        missing = [field for field in fields if not isinstance(data.get(field), str) or not data[field].strip()]
        if missing:
            return jsonify(error="Required fields must be non-empty: " + ", ".join(missing)), 400
        if data["item_type"] not in ("lost", "found"):
            return jsonify(error="item_type must be 'lost' or 'found'"), 400
        report_date = data.get("date_reported") or date.today().isoformat()
        try:
            date.fromisoformat(report_date)
        except (TypeError, ValueError):
            return jsonify(error="date_reported must be a valid YYYY-MM-DD date"), 400
        values = [data[field].strip() for field in fields]
        values.insert(4, report_date)
        connection = connect_db()
        try:
            with connection:
                with closing(connection.cursor()) as cursor:
                    execute(cursor, """
                        INSERT INTO items (title, category, item_type, location, date_reported, description, reporter_name, reporter_contact)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING *
                    """, values)
                    item = cursor.fetchone()
            return jsonify(serialize_item(item)), 201
        finally:
            connection.close()

    @app.patch("/api/items/<int:item_id>/status")
    def update_item_status(item_id):
        data = request.get_json(silent=True) or {}
        status = data.get("status")
        if status not in ("open", "claimed", "returned"):
            return jsonify(error="status must be 'open', 'claimed', or 'returned'"), 400
        connection = connect_db()
        try:
            with connection:
                with closing(connection.cursor()) as cursor:
                    execute(cursor, "UPDATE items SET status = %s WHERE id = %s", (status, item_id))
                    if cursor.rowcount == 0:
                        return jsonify(error="Item not found"), 404
                    execute(cursor, "SELECT * FROM items WHERE id = %s", (item_id,))
                    item = cursor.fetchone()
            return jsonify(serialize_item(item))
        finally:
            connection.close()

    return app


app = create_app()






