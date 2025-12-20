from __future__ import annotations

from datetime import datetime, date
from operator import index
from zoneinfo import ZoneInfo
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any, Optional, Dict

from flask import Blueprint, jsonify, request
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload, subqueryload

from ..extensions import db
from ..models import Case, CasePerson
from ..services.case_code import next_case_code
from ..models import Case, CasePerson 

from app.services.dashboard import get_case_stats

bp = Blueprint("cases", __name__, url_prefix="/api/cases")

DATE_INPUT_FORMATS = (
    "%Y-%m-%d",
    "%Y/%m/%d",
    "%Y.%m.%d",
    "%d/%m/%Y",
    "%d-%m-%Y",
    "%d.%m.%Y",
    "%m/%d/%Y",
    "%m-%d-%Y",
    "%m.%d.%Y",
    "%Y%m%d",
    "%d%m%Y",
)

JAKARTA = ZoneInfo("Asia/Jakarta")


class ValidationError(Exception):
    """Raised when incoming payload is invalid."""
    pass


def _none_if_empty(v: Any) -> Any:
    if v is None:
        return None
    if isinstance(v, str) and v.strip() == "":
        return None
    return v


def _strip_time_component(raw: str) -> str:
    for sep in ("T", " "):
        if sep in raw:
            return raw.split(sep, 1)[0]
    return raw


def parse_date(v: Any) -> Optional[date]:
    v = _none_if_empty(v)
    if v is None:
        return None
    if isinstance(v, date) and not isinstance(v, datetime):
        return v
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, str):
        base = _strip_time_component(v.strip())
        if not base:
            return None

        normalized = base.replace(".", "/")
        candidates = {normalized, normalized.replace("/", "-")}

        digits_only = "".join(ch for ch in normalized if ch.isdigit())
        if len(digits_only) == 8:
            candidates.add(digits_only)

        for candidate in list(candidates):
            for fmt in DATE_INPUT_FORMATS:
                try:
                    return datetime.strptime(candidate, fmt).date()
                except ValueError:
                    continue
    raise ValueError(f"Invalid date: {v!r}")


def parse_decimal_money(v: Any, scale: str = "0.01") -> Optional[Decimal]:
    v = _none_if_empty(v)
    if v is None:
        return None

    try:
        if isinstance(v, Decimal):
            d = v
        elif isinstance(v, int):
            d = Decimal(v)
        elif isinstance(v, float):
            d = Decimal(str(v))
        elif isinstance(v, str):
            s = v.strip().replace(" ", "")

            if "," in s:
                s = s.replace(".", "")
                s = s.replace(",", ".")
            else:
                if "." in s:
                    parts = s.split(".")
                    if all(p.isdigit() and len(p) == 3 for p in parts[1:]):
                        s = s.replace(".", "")
            d = Decimal(s)
        else:
            d = Decimal(str(v))

        return d.quantize(Decimal(scale), rounding=ROUND_HALF_UP)

    except (InvalidOperation, ValueError) as e:
        raise ValueError(f"Invalid money value: {v!r}") from e


def _format_date_ddmmyyyy(d: date) -> str:
    return d.strftime("%d-%m-%Y")


def _format_datetime_ddmmyyyy(dt: datetime) -> str:
    local = dt
    if dt.tzinfo is not None:
        local = dt.astimezone(JAKARTA)
    else:
        local = dt.replace(tzinfo=JAKARTA)
    return local.strftime("%d-%m-%Y %H:%M:%S")


def _json_safe(v: Any) -> Any:

    if isinstance(v, datetime):
        return _format_datetime_ddmmyyyy(v)
    if isinstance(v, date):
        return _format_date_ddmmyyyy(v)
    if isinstance(v, Decimal):
        if v == v.to_integral():
            return int(v)
        return float(v)
    return v


def row_to_dict(r: Any) -> Dict[str, Any]:
    d = dict(r._mapping)
    return {k: _json_safe(v) for k, v in d.items()}

def model_to_dict(model_instance: Any, relationships: Dict[str, Any] = {}) -> Dict[str, Any]:
    d = {}
    for column in model_instance.__table__.columns:
        value = getattr(model_instance, column.name)
        d[column.name] = _json_safe(value)
    
    for rel_name, rel_data in relationships.items():
        rel_value = getattr(model_instance, rel_name)
        if rel_value:
            if isinstance(rel_value, list):
                d[rel_name] = [model_to_dict(item, rel_data.get("relationships", {})) for item in rel_value]
            else:
                d[rel_name] = model_to_dict(rel_value, rel_data.get("relationships", {}))
    return d

TEXT_FIELDS = [
    "lokasi_kejadian",
    "judul_ier",
    "kronologi",
    # Kolom-kolom ini sudah dipindahkan ke CasePerson, jadi tidak perlu di sini lagi
    # "nama_terlapor",
    # "lokasi_terlapor",
    # "divisi_terlapor",
    # "departemen_terlapor",
    # "keputusan_ier",
    # "keputusan_final",
    "notes",
    "cara_mencegah",
    "hrbp",
]


def _clean_text_value(v: Any) -> Optional[str]:
    v = _none_if_empty(v)
    if v is None:
        return None
    if not isinstance(v, str):
        v = str(v)
    v = v.strip()
    return v or None


def _parse_int_id(v: Any, label: str, required: bool = False) -> Optional[int]:
    v = _none_if_empty(v)
    if v is None:
        if required:
            raise ValidationError(f"{label} wajib dipilih.")
        return None
    try:
        ivalue = int(v)
    except (TypeError, ValueError):
        raise ValidationError(f"{label} harus berupa angka.")
    if ivalue <= 0:
        raise ValidationError(f"{label} harus berupa angka positif.")
    return ivalue


def _parse_date_field(payload: Dict[str, Any], key: str, label: str, required: bool = False) -> Optional[date]:
    try:
        value = parse_date(payload.get(key))
    except ValueError as exc:
        raise ValidationError(f"{label} tidak valid. Gunakan format dd-mm-yyyy.") from exc
    if required and value is None:
        raise ValidationError(f"{label} wajib diisi.")
    return value


def _parse_decimal_field(payload: Dict[str, Any], key: str, label: str, scale: str = "0.01") -> Optional[Decimal]:
    try:
        return parse_decimal_money(payload.get(key), scale=scale)
    except ValueError as exc:
        raise ValidationError(f"{label} tidak valid.") from exc


def _coerce_payload(payload: Any) -> Dict[str, Any]:
    if payload is None:
        raise ValidationError("Body tidak boleh kosong. Kirimkan JSON.")
    if not isinstance(payload, dict):
        raise ValidationError("Body harus berupa JSON object.")
    return payload


def _build_case_attributes(body: Any) -> Dict[str, Any]:
    payload = _coerce_payload(body)

    attrs: Dict[str, Any] = {
        "divisi_case_id": _parse_int_id(payload.get("divisi_case_id"), "Divisi Case", required=True),
        "jenis_case_id": _parse_int_id(payload.get("jenis_case_id"), "Jenis Case", required=True),
        "tanggal_lapor": _parse_date_field(payload, "tanggal_lapor", "Tanggal Lapor"),
        "tanggal_kejadian": _parse_date_field(payload, "tanggal_kejadian", "Tanggal Kejadian"),
        "tanggal_proses_ier": _parse_date_field(payload, "tanggal_proses_ier", "Tanggal Proses IER"),
        "kerugian": _parse_decimal_field(payload, "kerugian", "Kerugian"),
        "kerugian_by_case": _parse_decimal_field(payload, "kerugian_by_case", "Kerugian by Case"),
        # "jenis_karyawan_terlapor_id": _parse_int_id(payload.get("jenis_karyawan_terlapor_id"), "Jenis Karyawan Terlapor"),
        # "persentase_beban_karyawan": _parse_decimal_field(
        #     payload, "persentase_beban_karyawan", "Persentase Beban Karyawan", scale="0.001"
        # ),
        # "nominal_beban_karyawan": _parse_decimal_field(payload, "nominal_beban_karyawan", "Nominal Beban Karyawan"),
        "approval_gm_hcca": _parse_date_field(payload, "approval_gm_hcca", "Approval GM HC&CA"),
        "approval_gm_fad": _parse_date_field(payload, "approval_gm_fad", "Approval GM FAD"),
        "status_proses_id": _parse_int_id(payload.get("status_proses_id"), "Status Proses"),
        "status_pengajuan_id": _parse_int_id(payload.get("status_pengajuan_id"), "Status Pengajuan"),
    }

    for field in TEXT_FIELDS:
        attrs[field] = _clean_text_value(payload.get(field))

    return attrs

def _build_person_attributes(person_payload: Dict[str, Any], index: int) -> Dict[str, Any]:
    nama = _clean_text_value(person_payload.get("nama"))
    if not nama:
        raise ValidationError(f"Nama Terlapor #{index+1} wajib diisi.")

    attrs: Dict[str, Any] = {
        "nama": nama,
        "lokasi": _clean_text_value(person_payload.get("lokasi")),
        "divisi": _clean_text_value(person_payload.get("divisi")),
        "departemen": _clean_text_value(person_payload.get("departemen")),
        "jenis_karyawan_terlapor_id": _parse_int_id(person_payload.get("jenis_karyawan_terlapor_id"), f"Jenis Karyawan Terlapor #{index+1}"),        
        "keputusan_ier": _clean_text_value(person_payload.get("keputusan_ier")),
        "keputusan_final": _clean_text_value(person_payload.get("keputusan_final")),
        "persentase_beban_karyawan": _parse_decimal_field(
            person_payload, "persentase_beban_karyawan", f"Persentase Beban Karyawan #{index+1}", scale="0.01"
        ),
        "nominal_beban_karyawan": _parse_decimal_field(person_payload, "nominal_beban_karyawan", f"Nominal Beban Karyawan #{index+1}"),
    }

    return attrs

# ---------- routes ----------
@bp.get("")
def list_cases():
    try:
        cases = db.session.query(Case).options(joinedload(Case.persons)).order_by(Case.id.desc()).all()
        
        results = []
        for case in cases:
            case_dict = model_to_dict(case)
            
            if case.divisi_case:
                case_dict["divisi_case_name"] = case.divisi_case.name
            else:
                case_dict["divisi_case_name"] = None

            case_dict["jenis_case_name"] = case.jenis_case.name if case.jenis_case else None
            case_dict["status_proses_name"] = case.status_proses.name if case.status_proses else None
            case_dict["status_pengajuan_name"] = case.status_pengajuan.name if case.status_pengajuan else None
            case_dict["persons"] = [model_to_dict(p) for p in case.persons]

            results.append(case_dict)

        return jsonify({"value": results, "Count": len(results)})
    except Exception as e:
        print(f"Error in list_cases: {e}") 
        return jsonify({"error": "Server error", "detail": str(e)}), 500

@bp.route('/stats', methods=['GET'])
def case_stats():
    stats = get_case_stats()
    return jsonify(stats)

@bp.get("/<int:case_id>")
def get_case(case_id):
    try:
        case = (
            db.session.query(Case)
            .options(
                joinedload(Case.divisi_case),
                joinedload(Case.jenis_case),
                joinedload(Case.status_proses),
                joinedload(Case.status_pengajuan),
                subqueryload(Case.persons).joinedload(CasePerson.jenis_karyawan_terlapor), # Pastikan ini dimuat
            )
            .filter(Case.id == case_id)
            .one_or_none()
        )

        if not case:
            return jsonify({"error": "Not found", "detail": f"Case dengan ID {case_id} tidak ditemukan."}), 404

        # Struktur relasi untuk konversi ke dict
        relationships = {
            "divisi_case": {},
            "jenis_case": {},
            "status_proses": {},
            "status_pengajuan": {},
            "persons": {
                "relationships": {
                    "jenis_karyawan_terlapor": {} 
                }
            }
        }
        
        case_dict = model_to_dict(case, relationships)
        return jsonify(case_dict), 200

    except Exception as e:
        return jsonify({"error": "Server error", "detail": str(e)}), 500


@bp.post("")
def create_case():
    payload = request.get_json(silent=True)

    try:
        attributes = _build_case_attributes(payload)

        people_payload = payload.get("persons", [])

        validated_persons_attrs = []
        for i, person_data in enumerate(people_payload):
            if not isinstance(person_data, dict):
                raise ValidationError(f"Item 'persons' #{i+1} harus berupa JSON object.")
            person_attrs = _build_person_attributes(person_data, i)
            validated_persons_attrs.append(person_attrs)

        case = Case(
            case_code=next_case_code(db.session),
            created_at=datetime.now(JAKARTA).replace(tzinfo=None),
            **attributes,
        )
        db.session.add(case)
        db.session.flush() 

        for seq, person_attrs in enumerate(validated_persons_attrs, start=1):
            person = CasePerson(
                case_id=case.id,
                person_seq=seq,
                person_code=f"{case.case_code}/{seq}",
                **person_attrs,
            )
            db.session.add(person)

        db.session.commit() 
        db.session.refresh(case) 
        
        case_dict = model_to_dict(case) 
        
        case_dict["persons"] = [model_to_dict(p) for p in case.persons]

        return jsonify(case_dict), 201

    except ValidationError as exc:
        db.session.rollback()
        return jsonify({"error": "Validation error", "detail": str(exc)}), 400

    except IntegrityError as e:
        db.session.rollback()
        msg = str(getattr(e, "orig", e))
        return jsonify({"error": "Integrity error", "detail": msg}), 409

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Server error", "detail": str(e)}), 500

@bp.put("/<int:case_id>")
def update_case(case_id):
    payload = request.get_json(silent=True)
    if not payload:
        return jsonify({"error": "Validation error", "detail": "Body tidak boleh kosong."}), 400

    case = db.session.get(Case, case_id)
    if not case:
        return jsonify({"error": "Not found", "detail": f"Case dengan ID {case_id} tidak ditemukan."}), 404

    try:
        if "kerugian" in payload:
            case.kerugian = _parse_decimal_field(payload, "kerugian", "Kerugian")
        if "status_proses_id" in payload:
            case.status_proses_id = _parse_int_id(payload.get("status_proses_id"), "Status Proses")
        if "status_pengajuan_id" in payload:
            case.status_pengajuan_id = _parse_int_id(payload.get("status_pengajuan_id"), "Status Pengajuan")
        if "notes" in payload:
            case.notes = _clean_text_value(payload.get("notes"))
        if "cara_mencegah" in payload:
            case.cara_mencegah = _clean_text_value(payload.get("cara_mencegah"))
        if "hrbp" in payload:
            case.hrbp = _clean_text_value(payload.get("hrbp"))

        db.session.commit()
        db.session.refresh(case)

        case_dict = model_to_dict(case)
        case_dict["persons"] = [model_to_dict(p) for p in case.persons]
        return jsonify(case_dict), 200

    except ValidationError as exc:
        db.session.rollback()
        return jsonify({"error": "Validation error", "detail": str(exc)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Server error", "detail": str(e)}), 500

@bp.put("/persons/<int:person_id>")
def update_person(person_id):
    payload = request.get_json(silent=True)
    if not payload:
        return jsonify({"error": "Validation error", "detail": "Body tidak boleh kosong."}), 400

    person = db.session.get(CasePerson, person_id)
    if not person:
        return jsonify({"error": "Not found", "detail": f"Person dengan ID {person_id} tidak ditemukan."}), 404

    try:
        if "keputusan_ier" in payload:
            person.keputusan_ier = _clean_text_value(payload.get("keputusan_ier"))
        if "keputusan_final" in payload:
            person.keputusan_final = _clean_text_value(payload.get("keputusan_final"))
        if "nominal_beban_karyawan" in payload:
            person.nominal_beban_karyawan = _parse_decimal_field(payload, "nominal_beban_karyawan", "Nominal Beban Karyawan")
        if "persentase_beban_karyawan" in payload:
            person.persentase_beban_karyawan = _parse_decimal_field(payload, "persentase_beban_karyawan", "Persentase Beban Karyawan", scale="0.001")
        if "approval_gm_hcca" in payload:
            person.approval_gm_hcca = _parse_date_field(payload, "approval_gm_hcca", "Approval GM HC&CA")
        if "approval_gm_fad" in payload:
            person.approval_gm_fad = _parse_date_field(payload, "approval_gm_fad", "Approval GM FAD")

        db.session.commit()
        db.session.refresh(person)
        return jsonify(model_to_dict(person)), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Server error", "detail": str(e)}), 500

@bp.delete("/<int:case_id>")
def delete_case(case_id):
    case = db.session.get(Case, case_id)
    if not case:
        return jsonify({"error": "Not found", "detail": f"Case dengan ID {case_id} tidak ditemukan."}), 404

    try:
        db.session.delete(case)
        db.session.commit()
        return jsonify({"status": "success", "id": case_id}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting case {case_id}: {e}") 
        return jsonify({"error": "Server error", "detail": str(e)}), 500