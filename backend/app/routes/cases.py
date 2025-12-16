from __future__ import annotations

from datetime import datetime, date
from zoneinfo import ZoneInfo
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any, Optional, Dict

from flask import Blueprint, jsonify, request
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from ..extensions import db
from ..models import Case
from ..services.case_code import next_case_code

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


# ---------- helpers ----------
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
    # Format: dd-mm-yyyy
    return d.strftime("%d-%m-%Y")


def _format_datetime_ddmmyyyy(dt: datetime) -> str:
    # Format: dd-mm-yyyy HH:MM:SS (24h)
    local = dt
    if dt.tzinfo is not None:
        local = dt.astimezone(JAKARTA)
    else:
        # assume naive datetime stored in Jakarta time
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


TEXT_FIELDS = [
    "lokasi_kejadian",
    "judul_ier",
    "kronologi",
    "nama_terlapor",
    "lokasi_terlapor",
    "divisi_terlapor",
    "departemen_terlapor",
    "keputusan_ier",
    "keputusan_final",
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
        "jenis_karyawan_terlapor_id": _parse_int_id(payload.get("jenis_karyawan_terlapor_id"), "Jenis Karyawan Terlapor"),
        "persentase_beban_karyawan": _parse_decimal_field(
            payload, "persentase_beban_karyawan", "Persentase Beban Karyawan", scale="0.001"
        ),
        "nominal_beban_karyawan": _parse_decimal_field(payload, "nominal_beban_karyawan", "Nominal Beban Karyawan"),
        "approval_gm_hcca": _parse_date_field(payload, "approval_gm_hcca", "Approval GM HC&CA"),
        "approval_gm_fad": _parse_date_field(payload, "approval_gm_fad", "Approval GM FAD"),
        "status_proses_id": _parse_int_id(payload.get("status_proses_id"), "Status Proses"),
        "status_pengajuan_id": _parse_int_id(payload.get("status_pengajuan_id"), "Status Pengajuan"),
    }

    for field in TEXT_FIELDS:
        attrs[field] = _clean_text_value(payload.get(field))

    return attrs


# ---------- routes ----------
@bp.get("")
def list_cases():
    sql = text(
        """
        SELECT
            c.id,
            c.case_code,
            c.created_at,

            c.divisi_case_id,
            d.name AS divisi_case_name,

            c.jenis_case_id,
            jc.name AS jenis_case_name,

            c.status_proses_id,
            sp.name AS status_proses_name,

            c.status_pengajuan_id,
            sj.name AS status_pengajuan_name,

            c.tanggal_lapor,
            c.tanggal_kejadian,
            c.lokasi_kejadian,
            c.judul_ier,
            c.kerugian,
            c.nama_terlapor

        FROM t_case c
        LEFT JOIN m_divisi_case d ON d.id = c.divisi_case_id
        LEFT JOIN m_jenis_case jc ON jc.id = c.jenis_case_id
        LEFT JOIN m_status_proses sp ON sp.id = c.status_proses_id
        LEFT JOIN m_status_pengajuan sj ON sj.id = c.status_pengajuan_id
        ORDER BY c.id DESC
        """
    )
    rows = db.session.execute(sql).fetchall()
    data = [row_to_dict(r) for r in rows]
    return jsonify({"value": data, "Count": len(data)})


@bp.post("")
def create_case():
    payload = request.get_json(silent=True)

    try:
        attributes = _build_case_attributes(payload)

        case = Case(
            case_code=next_case_code(db.session),
            created_at=datetime.now(JAKARTA).replace(tzinfo=None),
            **attributes,
        )
        db.session.add(case)
        db.session.flush()

        out_sql = text(
            """
            SELECT
                c.id,
                c.case_code,
                c.created_at,

                c.divisi_case_id,
                d.name AS divisi_case_name,

                c.jenis_case_id,
                jc.name AS jenis_case_name,

                c.status_proses_id,
                sp.name AS status_proses_name,

                c.status_pengajuan_id,
                sj.name AS status_pengajuan_name,

                c.tanggal_lapor,
                c.tanggal_kejadian,
                c.lokasi_kejadian,
                c.judul_ier,
                c.kerugian,
                c.nama_terlapor
            FROM t_case c
            LEFT JOIN m_divisi_case d ON d.id = c.divisi_case_id
            LEFT JOIN m_jenis_case jc ON jc.id = c.jenis_case_id
            LEFT JOIN m_status_proses sp ON sp.id = c.status_proses_id
            LEFT JOIN m_status_pengajuan sj ON sj.id = c.status_pengajuan_id
            WHERE c.id = :id
            """
        )
        row = db.session.execute(out_sql, {"id": case.id}).first()
        if not row:
            raise RuntimeError("Case gagal dibaca setelah disimpan.")

        db.session.commit()
        return jsonify(row_to_dict(row)), 201

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