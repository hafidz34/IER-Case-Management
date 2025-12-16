from flask import Blueprint, jsonify, request
from ..extensions import db
from ..models import (
    JenisCase, JenisKaryawanTerlapor, StatusProses, StatusPengajuan, DivisiCase
)

bp = Blueprint("master", __name__, url_prefix="/api/master")

MODEL_MAP = {
    "jenis-case": JenisCase,
    "jenis-karyawan-terlapor": JenisKaryawanTerlapor,
    "status-proses": StatusProses,
    "status-pengajuan": StatusPengajuan,
    "divisi-case": DivisiCase,
}

def _get_model(kind: str):
    model = MODEL_MAP.get(kind)
    if not model:
        return None, (jsonify({"error": "unknown master kind"}), 404)
    return model, None

@bp.get("/<kind>")
def list_master(kind):
    model, err = _get_model(kind)
    if err: return err
    rows = db.session.query(model).order_by(model.id.asc()).all()
    return jsonify([{"id": r.id, "name": r.name} for r in rows])

@bp.post("/<kind>")
def create_master(kind):
    model, err = _get_model(kind)
    if err: return err

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400

    exists = db.session.query(model).filter_by(name=name).first()
    if exists:
        return jsonify({"id": exists.id, "name": exists.name}), 200

    row = model(name=name)
    db.session.add(row)
    db.session.commit()
    return jsonify({"id": row.id, "name": row.name}), 201