from flask import Blueprint, jsonify, request
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from ..extensions import db
from ..models import (
    JenisCase,
    JenisKaryawanTerlapor,
    StatusProses,
    StatusPengajuan,
    DivisiCase,
    Case,
    CasePerson,
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


@bp.put("/<kind>/<int:item_id>")
def update_master(kind: str, item_id: int):
    model, err = _get_model(kind)
    if err:
        return err

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400

    row = db.session.get(model, item_id)
    if not row:
        return jsonify({"error": "not found"}), 404

    # Enforce uniqueness (same behavior as create: unique names)
    exists = (
        db.session.query(model)
        .filter(model.name == name, model.id != item_id)
        .first()
    )
    if exists:
        return jsonify({"error": "conflict", "detail": "Nama sudah ada."}), 409

    row.name = name
    db.session.commit()
    return jsonify({"id": row.id, "name": row.name}), 200


@bp.delete("/<kind>/<int:item_id>")
def delete_master(kind: str, item_id: int):
    model, err = _get_model(kind)
    if err:
        return err

    row = db.session.get(model, item_id)
    if not row:
        return jsonify({"error": "not found"}), 404

    # Pre-check references to provide a clearer error than raw FK exceptions.
    # This does not modify database schema; it only checks usage.
    usage_checks = {
        "jenis-case": ("t_case.jenis_case_id", Case, Case.jenis_case_id),
        "divisi-case": ("t_case.divisi_case_id", Case, Case.divisi_case_id),
        "status-proses": ("t_case.status_proses_id", Case, Case.status_proses_id),
        "status-pengajuan": ("t_case.status_pengajuan_id", Case, Case.status_pengajuan_id),
        "jenis-karyawan-terlapor": (
            "t_case_person.jenis_karyawan_terlapor_id",
            CasePerson,
            CasePerson.jenis_karyawan_terlapor_id,
        ),
    }
    usage = usage_checks.get(kind)
    if usage:
        field_label, ref_model, ref_col = usage
        used_count = (
            db.session.query(func.count())
            .select_from(ref_model)
            .filter(ref_col == item_id)
            .scalar()
        )
        if used_count and int(used_count) > 0:
            return (
                jsonify(
                    {
                        "error": "in use",
                        "detail": f"Data tidak bisa dihapus karena masih dipakai oleh {int(used_count)} baris pada {field_label}.",
                    }
                ),
                409,
            )

    try:
        db.session.delete(row)
        db.session.commit()
        return jsonify({"status": "deleted", "id": item_id}), 200
    except IntegrityError as exc:
        db.session.rollback()
        # Fallback: usually happens if the master row is referenced by existing cases/persons.
        return (
            jsonify(
                {
                    "error": "in use",
                    "detail": "Data tidak bisa dihapus karena masih dipakai oleh data case/person.",
                }
            ),
            409,
        )
