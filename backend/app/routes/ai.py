from __future__ import annotations

import base64
import json
import logging
from datetime import datetime
from io import BytesIO
from typing import Any

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
    "hrbp": string | null,
    "persons": [
      {{
        "nama": string | null,
        "divisi": string | null,
        "departemen": string | null,
        "jenis_karyawan_terlapor_id": number | null
      }}
    ]
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

    ATURAN TERLAPOR:
    - Isi array "persons" jika ada nama terlapor, divisi, departemen, atau jenis karyawan terlapor.
    - Jika divisi/jenis karyawan terlapor cocok dengan master, isi ID-nya; jika tidak pasti, set null.

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


def build_case_suggestion(llm_result: dict) -> dict:
    return {
        "divisi_case_id": llm_result.get("divisi_case_id"),
        "jenis_case_id": llm_result.get("jenis_case_id"),
        "tanggal_lapor": llm_result.get("tanggal_lapor"),
        "tanggal_kejadian": llm_result.get("tanggal_kejadian"),
        "lokasi_kejadian": llm_result.get("lokasi_kejadian"),
        "judul_ier": llm_result.get("judul_ier"),
        "tanggal_proses_ier": llm_result.get("tanggal_proses_ier"),
        "kerugian": llm_result.get("kerugian"),
        "kronologi": llm_result.get("kronologi"),
        "status_proses_id": llm_result.get("status_proses_id"),
        "status_pengajuan_id": llm_result.get("status_pengajuan_id"),
        "notes": llm_result.get("notes"),
        "cara_mencegah": llm_result.get("cara_mencegah"),
        "hrbp": llm_result.get("hrbp"),
        "persons": llm_result.get("persons") or [],
    }


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


def _ocr_with_llm(base64_image: str, mime: str = "image/jpeg") -> str:
    prompt = (
        "Perform Optical Character Recognition (OCR) on the image provided. "
        "Extract all visible text, ensuring accuracy and maintaining the original reading order (left-to-right, top-to-bottom). "
        "Ignore any non-textual elements or graphics. "
        "Provide ONLY the extracted text, without any introductory phrases, explanations, or additional commentary."
    )

    url_llm = "http://pe.spil.co.id/kobold/v1/chat/completions"

    payload = {
        "messages": [{
            "role": "user",
            "content": [{
                "type": "text",
                "text": prompt
            }, {
                "type": "image_url",
                "image_url": {
                    "url": f"data:{mime};base64,{base64_image}"
                }
            }]
        }],
        "mode": "instruct",
        "temperature": 0,
    }

    responses = requests.post(url_llm, json=payload)

    if responses.status_code == 200:
        llm_response = responses.json()
        content_str = llm_response['choices'][0]['message']['content']
        return content_str
    else:
        logging.info(f"Kobold LLM request failed with status code: {responses.status_code}, response: {responses.text}")
        return ""

def _ocr_with_llm_multi(image_payloads: list[tuple[str, str]]) -> str:
    """
    Kirim banyak gambar (base64, mime) dalam satu request ke LLM OCR.
    """
    if not image_payloads:
        return ""

    prompt = (
        "Perform Optical Character Recognition (OCR) on ALL images provided. "
        "Extract all visible text, ensuring accuracy and maintaining the original reading order (left-to-right, top-to-bottom) per image. "
        "Gabungkan hasil semua gambar secara berurutan. "
        "Ignore any non-textual elements or graphics. "
        "Provide ONLY the extracted text, without any introductory phrases, explanations, or additional commentary."
    )

    content_blocks = [{"type": "text", "text": prompt}]
    for base64_image, mime in image_payloads:
        content_blocks.append({
            "type": "image_url",
            "image_url": {"url": f"data:{mime};base64,{base64_image}"}
        })

    payload = {
        "messages": [{
            "role": "user",
            "content": content_blocks
        }],
        "mode": "instruct",
        "temperature": 0,
    }

    responses = requests.post(LLM_URL, json=payload)

    if responses.status_code == 200:
        llm_response = responses.json()
        content_str = llm_response['choices'][0]['message']['content']
        return content_str
    else:
        logging.info(f"Kobold LLM request failed with status code: {responses.status_code}, response: {responses.text}")
        return ""


def llm_extract_text(file_list) -> str:
    """
    Terima beberapa file (pdf/jpg/png). PDF diubah ke image per halaman, semua image dikirim ke OCR LLM dalam 1 request.
    """
    base64_images: list[tuple[str, str]] = []
    for file_storage in file_list:
        raw_bytes = file_storage.read()
        filename = (file_storage.filename or "").lower()
        mimetype = (file_storage.mimetype or "").lower()
        is_pdf = filename.endswith(".pdf") or "pdf" in mimetype

        if is_pdf:
            try:
                from pdf2image import convert_from_bytes
            except Exception as exc: 
                logging.warning("pdf2image not available, cannot convert PDF to image: %s", exc)
                continue

            try:
                images = convert_from_bytes(raw_bytes)
                for img in images:
                    buffer = BytesIO()
                    img.save(buffer, format="JPEG")
                    base64_images.append((base64.b64encode(buffer.getvalue()).decode("utf-8"), "image/jpeg"))
            except Exception as exc:  
                logging.warning("Failed to convert PDF to images: %s", exc)
                continue
        else:
            mime = mimetype if mimetype else "image/jpeg"
            base64_images.append((base64.b64encode(raw_bytes).decode("utf-8"), mime))

    return _ocr_with_llm_multi(base64_images)

@bp.post("/prefill-case")
def prefill_case():
    body = request.get_json(silent=True) or {}
    prompt = body.get("prompt", "")

    llm_result = call_llm(prompt)
    suggestion = build_case_suggestion(llm_result)

    return jsonify({"prompt": prompt, "data": suggestion})


@bp.post("/upload-berita-acara")
def upload_berita_acara():
    files = request.files.getlist("file")
    if not files:
        return jsonify({"error": "File berita acara wajib diunggah."}), 400

    for f in files:
        filename = (f.filename or "").lower()
        if not (filename.endswith(".pdf") or filename.endswith(".jpg") or filename.endswith(".jpeg") or filename.endswith(".png")):
            return jsonify({"error": "Format file tidak didukung. Unggah PDF atau gambar (jpg/png)."}), 400

    text = llm_extract_text(files)
    if text == "":
        return jsonify({"error": "Tidak ada teks terbaca dari berkas yang diunggah. Pastikan file jelas dibaca (PDF akan diubah ke gambar sebelum OCR)."}), 400

    llm_result = call_llm(text)
    suggestion = build_case_suggestion(llm_result)
    return jsonify({"text": text, "data": suggestion})


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
