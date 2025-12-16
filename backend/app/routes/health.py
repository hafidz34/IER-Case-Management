from flask import Blueprint, jsonify
from sqlalchemy import text
from ..extensions import db

bp = Blueprint("health", __name__)

@bp.get("/health")
def health():
    return jsonify({"status": "ok"})

@bp.get("/db-health")
def db_health():
    try:
        result = db.session.execute(text("SELECT 1")).scalar()
        return jsonify({"db": "ok", "result": int(result)})
    except Exception as e:
        return jsonify({"db": "error", "error": str(e)}), 500