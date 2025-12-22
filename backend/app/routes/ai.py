from __future__ import annotations

import json
import logging
from typing import Any
from datetime import datetime

import requests
from flask import Blueprint, jsonify, request
from ..extensions import db
from ..models import DivisiCase, JenisCase, JenisKaryawanTerlapor, StatusProses, StatusPengajuan

bp = Blueprint("ai", __name__, url_prefix="/api/ai")


LLM_URL = "http://pe.spil.co.id/kobold/v1/chat/completions"


def call_llm(prompt: str) -> dict:
    if not prompt:
        return {}

    master_data = get_divisi_jenis_case()
    divisi_hint = "; ".join(f"{row['id']}={row['name']}" for row in master_data["divisi_case"])
    jenis_hint = "; ".join(f"{row['id']}={row['name']}" for row in master_data["jenis_case"])
    status_proses_hint = "; ".join(f"{row['id']}={row['name']}" for row in master_data["status_proses"])
    status_pengajuan_hint = "; ".join(f"{row['id']}={row['name']}" for row in master_data["status_pengajuan"])

    instruction = f"""
    TUGAS:
    Ekstrak informasi dari teks kasus dan hasilkan OUTPUT JSON SAJA.

    ATURAN OUTPUT:
    - Output HARUS berupa JSON valid
    - Jangan sertakan teks, komentar, atau markdown apa pun
    - Jika data tidak ditemukan, gunakan null (bukan string)

    FORMAT JSON WAJIB:
    {{
    "divisi_case_id": number | null,
    "jenis_case_id": number | null,
    "tanggal_lapor": "YYYY-MM-DD" | null,
    "tanggal_kejadian": "YYYY-MM-DD" | null,
    "lokasi_kejadian": string | null,
    "judul_ier": string | null,
    "tanggal_proses_ier": "YYYY-MM-DD" | null,
    "kerugian": number | null,
    "kronologi": string | null,
    "status_proses_id": number | null,
    "status_pengajuan_id": number | null,
    "notes": string | null,
    "cara_mencegah": string | null,
    "hrbp": string | null
    }}

    KONSTRAINT ID:
    - divisi_case_id HARUS dipilih dari daftar berikut, jika tidak cocok gunakan null:
    {divisi_hint}

    - jenis_case_id HARUS dipilih dari daftar berikut, jika tidak cocok gunakan null:
    {jenis_hint}

    - status_proses_id HARUS dipilih dari daftar berikut, jika tidak cocok gunakan null:
    {status_proses_hint}

    - status_pengajuan_id HARUS dipilih dari daftar berikut, jika tidak cocok gunakan null:
    {status_pengajuan_hint}

    ATURAN KRONOLOGI:
    - Tulis ulang kronologi dengan bahasa formal, jelas, dan ringkas dengan poin-poin 1,2,3,4...
    - Fokus pada urutan kejadian, aktor, dan dampak
    - Jangan menyalin kalimat mentah dari teks
    - Jangan menambahkan asumsi baru

    ATURAN STATUS/NOTES:
    - Jika ada indikasi status proses/pengajuan, cocokkan ke master status di atas.
    - Isi "notes" dengan ringkasan relevan (maks 2 kalimat) jika ada konteks tambahan.
    - Isi "cara_mencegah" jika ada saran perbaikan/pencegahan.
    - Isi "hrbp" jika disebutkan pihak HRBP yang menangani.

    ATURAN JUDUL IER:
    - judul_ier HARUS berupa ringkasan singkat dari isi kronologi
    - Panjang maksimal 10–12 kata
    - Tidak mengandung detail teknis berlebihan (tanggal lengkap, nominal rinci)
    - Mewakili inti peristiwa utama
    - Jika kronologi null, maka judul_ier HARUS null

    TEKS KASUS:
    {prompt}
    """

    payload = {
        "Content-Type": "application/json",
        "messages": [{"role": "user", "content": instruction}],
        "temperature": 0,
    }

    try:
        response = requests.post(LLM_URL, json=payload, timeout=10)
    except Exception as exc:  
        logging.warning("LLM request failed: %s", exc)
        return {}

    if response.status_code != 200:
        logging.info(
            "LLM request failed with status code %s, response: %s",
            response.status_code,
            response.text,
        )
        return {}

    content = response.json()["choices"][0]["message"]["content"]
    parsed = extract_json(content)
    return parsed if isinstance(parsed, dict) else {}


def preprocessing_ai_date(raw: Any) -> str | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None

    try:
        if len(s) == 10 and s[2] == "-" and s[5] == "-":
            dt = datetime.strptime(s, "%d-%m-%Y")
            return dt.strftime("%d-%m-%Y")
    except Exception:
        pass

    try:
        if len(s) == 10 and s[4] == "-" and s[7] == "-":
            dt = datetime.strptime(s, "%Y-%m-%d")
            return dt.strftime("%d-%m-%Y")
    except Exception:
        pass

    for sep in (" ", "/", "-"):
        parts = s.replace(",", " ").replace("/", sep).replace("-", sep).split(sep)
        if len(parts) == 3 and parts[0].isdigit() and parts[2].isdigit():
            try:
                day = int(parts[0])
                year = int(parts[2])
                month_part = parts[1].strip().lower()
                MONTHS = {
                    "januari": 1, "februari": 2, "maret": 3, "april": 4, "mei": 5, "juni": 6,
                    "juli": 7, "agustus": 8, "september": 9, "oktober": 10, "november": 11, "desember": 12,
                    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "mei": 5, "jun": 6, "jul": 7,
                    "aug": 8, "sep": 9, "oct": 10, "okt": 10, "nov": 11, "dec": 12, "des": 12,
                }
                if month_part.isdigit():
                    month = int(month_part)
                else:
                    month = MONTHS.get(month_part)
                if month:
                    dt = datetime(year, month, day)
                    return dt.strftime("%d-%m-%Y")
            except Exception:
                continue

    return None


def call_llm_person(prompt: str) -> dict:
    if not prompt:
        return {}

    master_data = get_jenis_karyawan_terlapor()
    jenis_karyawan_hint = "; ".join(f"{row['id']}={row['name']}" for row in master_data["jenis_karyawan_terlapor"])

    instruction = f"""
    TUGAS:
    Ekstrak informasi dari teks keputusan dan hasilkan OUTPUT JSON SAJA.

    ATURAN OUTPUT:
    - Output HARUS berupa JSON valid
    - Jangan sertakan teks, komentar, atau markdown apa pun
    - Jika data tidak ditemukan, gunakan null (bukan string)

    FORMAT JSON WAJIB:
    {{
    "jenis_karyawan_terlapor_id": number | null,
    "nominal_beban_karyawan": number | null,
    "persentase_beban_karyawan": number | null,
    "keputusan_ier": string | null,   // TULIS ULANG formal & ringkas, sebut tindakan + alasan/dasar
    "keputusan_final": string | null, // TULIS ULANG formal & ringkas, sebut tindakan + alasan/dasar
    "approval_gm_hcca": "DD-MM-YYYY" | null, // format dd-mm-yyyy
    "approval_gm_fad": "DD-MM-YYYY" | null   // format dd-mm-yyyy
    }}

    ATURAN KHUSUS:
    - Jika ada frasa persetujuan/approval HC&CA atau FAD beserta tanggal (format bebas, mis. "19 desember 2025"), konversi ke "YYYY-MM-DD" dan isi kolomnya.
    - Jika ada persetujuan tanpa tanggal, set kolom approval terkait ke null.
    - Tanggal boleh pakai nama bulan Indonesia/Inggris; normalisasi ke YYYY-MM-DD.
    - Jika nominal disebut (mis. "9 juta"), konversi ke angka penuh (9000000).
    - Contoh gaya keputusan formal:
      "Menetapkan pemutusan hubungan kerja karena pelanggaran prosedur yang menimbulkan kerugian perusahaan."
      "Menetapkan pemutusan hubungan kerja efektif setelah persetujuan GM HC&CA dan GM FAD."

    TEKS KEPUTUSAN:
    {prompt}
    """

    payload = {
        "Content-Type": "application/json",
        "messages": [{"role": "user", "content": instruction}],
        "temperature": 0,
    }

    try:
        response = requests.post(LLM_URL, json=payload, timeout=10)
    except Exception as exc:  
        logging.warning("LLM request failed: %s", exc)
        return {}

    if response.status_code != 200:
        logging.info(
            "LLM request failed with status code %s, response: %s",
            response.status_code,
            response.text,
        )
        return {}

    content = response.json()["choices"][0]["message"]["content"]
    parsed = extract_json(content)
    print(parsed)
    return parsed if isinstance(parsed, dict) else {}


def extract_json(raw_content: str) -> Any:
    text = raw_content.strip()

    if "```" in text:
        for block in text.split("```"):
            candidate = block.strip()
            if not candidate:
                continue
            if candidate.lower().startswith("json"):
                candidate = candidate[4:].strip()
            if candidate.startswith("{") and candidate.endswith("}"):
                return safe_json_loads(candidate)

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return safe_json_loads(text[start : end + 1])

    logging.warning("LLM response not valid JSON: %s", text)
    return {}


def safe_json_loads(content: str) -> Any:
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        logging.warning("LLM response not valid JSON: %s", content)
        return {}


def get_divisi_jenis_case() -> dict:
    divisi_rows = db.session.query(DivisiCase).order_by(DivisiCase.id.asc()).all()
    jenis_rows = db.session.query(JenisCase).order_by(JenisCase.id.asc()).all()
    status_proses_rows = db.session.query(StatusProses).order_by(StatusProses.id.asc()).all()
    status_pengajuan_rows = db.session.query(StatusPengajuan).order_by(StatusPengajuan.id.asc()).all()
    return {
        "divisi_case": [{"id": r.id, "name": r.name} for r in divisi_rows],
        "jenis_case": [{"id": r.id, "name": r.name} for r in jenis_rows],
        "status_proses": [{"id": r.id, "name": r.name} for r in status_proses_rows],
        "status_pengajuan": [{"id": r.id, "name": r.name} for r in status_pengajuan_rows],
    }


def get_jenis_karyawan_terlapor() -> dict:
    jenis_rows = db.session.query(JenisKaryawanTerlapor).order_by(JenisKaryawanTerlapor.id.asc()).all()
    return {
        "jenis_karyawan_terlapor": [{"id": r.id, "name": r.name} for r in jenis_rows],
    }


@bp.post("/prefill-case")
def prefill_case():
    body = request.get_json(silent=True) or {}
    prompt = body.get("prompt", "")

    llm_result = call_llm(prompt)
    suggestion = {
        "divisi_case_id": llm_result.get("divisi_case_id"),
        "jenis_case_id": llm_result.get("jenis_case_id"),
        "tanggal_lapor": llm_result.get("tanggal_lapor"),
        "tanggal_kejadian": llm_result.get("tanggal_kejadian"),
        "lokasi_kejadian": llm_result.get("lokasi_kejadian"),
        "judul_ier": llm_result.get("judul_ier"),
        "tanggal_proses_ier": llm_result.get("tanggal_proses_ier"),
        "kerugian": llm_result.get("kerugian"),
        "kronologi": llm_result.get("kronologi"),
        "kerugian_by_case": None,
        "approval_gm_hcca": None,
        "approval_gm_fad": None,
        "status_proses_id": llm_result.get("status_proses_id"),
        "status_pengajuan_id": llm_result.get("status_pengajuan_id"),
        "notes": llm_result.get("notes"),
        "cara_mencegah": llm_result.get("cara_mencegah"),
        "hrbp": llm_result.get("hrbp"),
    }

    return jsonify({"prompt": prompt, "data": suggestion})


@bp.post("/prefill-person")
def prefill_person():
    body = request.get_json(silent=True) or {}
    prompt = body.get("prompt", "")

    llm_result = call_llm_person(prompt)
    suggestion = {
        "jenis_karyawan_terlapor_id": llm_result.get("jenis_karyawan_terlapor_id"),
        "nominal_beban_karyawan": llm_result.get("nominal_beban_karyawan"),
        "persentase_beban_karyawan": llm_result.get("persentase_beban_karyawan"),
        "keputusan_ier": llm_result.get("keputusan_ier"),
        "keputusan_final": llm_result.get("keputusan_final"),
        "approval_gm_hcca": preprocessing_ai_date(llm_result.get("approval_gm_hcca")),
        "approval_gm_fad": preprocessing_ai_date(llm_result.get("approval_gm_fad")),
    }

    return jsonify({"prompt": prompt, "data": suggestion})