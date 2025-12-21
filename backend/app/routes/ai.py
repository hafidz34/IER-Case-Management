from __future__ import annotations

import json
import logging
from typing import Any

import requests
from flask import Blueprint, jsonify, request
from ..extensions import db
from ..models import DivisiCase, JenisCase

bp = Blueprint("ai", __name__, url_prefix="/api/ai")


LLM_URL = "http://pe.spil.co.id/kobold/v1/chat/completions"


def call_llm(prompt: str) -> dict:
    if not prompt:
        return {}

    master_data = get_divisi_jenis_case()
    divisi_hint = "; ".join(f"{row['id']}={row['name']}" for row in master_data["divisi_case"])
    jenis_hint = "; ".join(f"{row['id']}={row['name']}" for row in master_data["jenis_case"])

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
    "kronologi": string | null
    }}

    KONSTRAINT ID:
    - divisi_case_id HARUS dipilih dari daftar berikut, jika tidak cocok gunakan null:
    {divisi_hint}

    - jenis_case_id HARUS dipilih dari daftar berikut, jika tidak cocok gunakan null:
    {jenis_hint}

    ATURAN KRONOLOGI:
    - Tulis ulang kronologi dengan bahasa formal, jelas, dan kronologis
    - Fokus pada urutan kejadian, aktor, dan dampak
    - Jangan menyalin kalimat mentah dari teks
    - Jangan menambahkan asumsi baru

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
    except Exception as exc:  # network or request errors
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
    return {
        "divisi_case": [{"id": r.id, "name": r.name} for r in divisi_rows],
        "jenis_case": [{"id": r.id, "name": r.name} for r in jenis_rows],
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
        "status_proses_id": None,
        "status_pengajuan_id": None,
        "notes": None,
        "cara_mencegah": None,
        "hrbp": None,
    }

    return jsonify({"prompt": prompt, "data": suggestion})
