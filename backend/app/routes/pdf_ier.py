from __future__ import annotations

import os
import subprocess
import tempfile
from io import BytesIO
from datetime import date
import uuid
import logging

from flask import Blueprint, current_app, jsonify, send_file, after_this_request
from sqlalchemy.orm import joinedload
from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject, BooleanObject, NumberObject

from ..extensions import db
from ..models import CasePerson

bp = Blueprint("pdf_ier", __name__, url_prefix="/api/pdf")

TEMP_PDF_STORAGE = {}


def _fmt_date(d: date | None) -> str:
    return d.strftime("%d-%m-%Y") if d else ""


def _enable_need_appearances(writer: PdfWriter) -> None:
    """Ensure form field values are visible in most PDF viewers."""
    try:
        if "/AcroForm" in writer._root_object:  # type: ignore[attr-defined]
            acro_form = writer._root_object["/AcroForm"]  # type: ignore[attr-defined]
            acro_form.update({NameObject("/NeedAppearances"): BooleanObject(True)})
    except Exception:
        # If anything goes wrong, we still return the PDF; viewer may still render values.
        pass


def _ensure_acroform(writer: PdfWriter, reader: PdfReader) -> None:
    """Copy AcroForm dictionary from reader when clone doesn't attach it (safety)."""
    try:
        root = writer._root_object  # type: ignore[attr-defined]
        if "/AcroForm" in root:
            return
        acro_form = reader.trailer["/Root"].get("/AcroForm")  # type: ignore[index]
        if acro_form:
            root[NameObject("/AcroForm")] = acro_form
    except Exception:
        pass


def _mark_fields_readonly(writer: PdfWriter) -> None:
    """Set form fields as read-only so output is not editable."""
    try:
        for page in writer.pages:
            annots = page.get("/Annots")
            if not annots:
                continue
            for annot_ref in annots:
                annot = annot_ref.get_object()
                if annot.get("/FT"):
                    flags = int(annot.get("/Ff", 0))
                    annot.update({NameObject("/Ff"): NumberObject(flags | 1)})
    except Exception:
        # If we fail to set read-only, we still return filled PDF.
        pass


@bp.get("/cases/persons/<int:person_id>/ier-editable")
def download_prefilled_ier_editable(person_id: int):
    person = (
        db.session.query(CasePerson)
        .options(joinedload(CasePerson.case))
        .filter(CasePerson.id == person_id)
        .first()
    )

    if not person:
        return jsonify({"error": "Not Found", "detail": "Data person tidak ditemukan"}), 404

    case = person.case
    if not case:
        return jsonify({"error": "Not Found", "detail": "Case untuk person tidak ditemukan"}), 404

    template_path = os.path.join(current_app.root_path, "pdf_iem_editable", "ier_editable.pdf")
    if not os.path.exists(template_path):
        return jsonify({"error": "Template PDF tidak ditemukan"}), 500

    try:
        reader = PdfReader(template_path)
        writer = PdfWriter()
        writer.clone_document_from_reader(reader)
        _ensure_acroform(writer, reader)

        field_values = {
            # Header
            "id_case": person.person_code,
            "judul_ier": case.judul_ier or "",
            "tanggal_proses": _fmt_date(case.tanggal_proses_ier),

            # Body
            "area_keputusan_ier": person.keputusan_ier or "",
            "area_keputusan_final": person.keputusan_final or "",

            # Signature block
            "name_1": "Nico Erwin Hasudungan Sitorus",
            "area_jabatan1": "Industrial & Employees Relation",
            "person_2": "Dominikus Putranda Romo Ganggut",
            "jabatan_2": "Human Capital & Corporate Affairs General Manager",
            "person_3": "Sophy Widyawati",
            "area_jabatan3": "Finance & Administration General Manager",
        }

        writer.update_page_form_field_values(writer.pages[0], field_values)
        _enable_need_appearances(writer)

        pdf_stream = BytesIO()
        writer.write(pdf_stream)
        pdf_stream.seek(0)

        filename = f"IER_{person.person_code.replace('/', '-')}.pdf"
        return send_file(
            pdf_stream,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=filename,
        )
    except Exception as exc:
        return jsonify({"error": "PDF Generation Error", "detail": str(exc)}), 500


@bp.get("/cases/persons/<int:person_id>/generate-temp-ier")
def generate_temp_ier(person_id: int):
    person = (
        db.session.query(CasePerson)
        .options(joinedload(CasePerson.case))
        .filter(CasePerson.id == person_id)
        .first()
    )

    if not person:
        return jsonify({"error": "Not Found", "detail": "Data person tidak ditemukan"}), 404

    case = person.case
    if not case:
        return jsonify({"error": "Not Found", "detail": "Case untuk person tidak ditemukan"}), 404

    template_path = os.path.join(current_app.root_path, "pdf_iem_editable", "ier_editable.pdf")
    if not os.path.exists(template_path):
        return jsonify({"error": "Template PDF tidak ditemukan"}), 500

    try:
        reader = PdfReader(template_path)
        writer = PdfWriter()
        writer.clone_document_from_reader(reader)
        _ensure_acroform(writer, reader)

        field_values = {
            "id_case": person.person_code,
            "judul_ier": case.judul_ier or "",
            "tanggal_proses": _fmt_date(case.tanggal_proses_ier),
            "area_keputusan_ier": person.keputusan_ier or "",
            "area_keputusan_final": person.keputusan_final or "",
            "name_1": person.nama or "Nico Erwin Hasudungan Sitorus",
            "area_jabatan1": "Industrial & Employees Relation",
            "person_2": case.hrbp or "Dominikus Putranda Romo Ganggut",
            "jabatan_2": "Human Capital & Corporate Affairs General Manager",
            "person_3": "Sophy Widyawati",
            "area_jabatan3": "Finance & Administration General Manager",
        }

        writer.update_page_form_field_values(writer.pages[0], field_values)
        _enable_need_appearances(writer)

        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
        writer.write(temp_file)
        temp_file.close()

        temp_file_id = str(uuid.uuid4())
        TEMP_PDF_STORAGE[temp_file_id] = temp_file.name

        return jsonify({"temp_file_id": temp_file_id}), 200

    except Exception as exc:
        logging.error("Error generating temporary PDF: %s", exc)
        return jsonify({"error": "PDF Generation Error", "detail": str(exc)}), 500


@bp.get("/temp-ier/<string:temp_file_id>")
def serve_temp_ier(temp_file_id: str):
    file_path = TEMP_PDF_STORAGE.get(temp_file_id)
    if not file_path or not os.path.exists(file_path):
        return jsonify({"error": "Not Found", "detail": "Temporary PDF not found"}), 404

    @after_this_request
    def remove_file(response):
        # We don't delete here, as the user might want to download flattened version
        return response

    return send_file(file_path, mimetype="application/pdf")


@bp.get("/temp-ier/<string:temp_file_id>/flattened")
def download_flattened_ier(temp_file_id: str):
    file_path = TEMP_PDF_STORAGE.get(temp_file_id)
    if not file_path or not os.path.exists(file_path):
        return jsonify({"error": "Not Found", "detail": "Temporary PDF not found"}), 404

    try:
        reader = PdfReader(file_path)
        writer = PdfWriter()
        writer.clone_document_from_reader(reader)
        _ensure_acroform(writer, reader)

        # Flatten the form fields
        for page in writer.pages:
            if "/Annots" in page:
                for annot in page["/Annots"]:
                    if annot.get_object().get("/FT"):
                        annot.get_object().update({NameObject("/Ff"): NumberObject(1)})

        flattened_pdf_stream = BytesIO()
        writer.write(flattened_pdf_stream)
        flattened_pdf_stream.seek(0)

        # Clean up the temporary file after sending
        @after_this_request
        def remove_file(response):
            if os.path.exists(file_path):
                os.unlink(file_path)
                if temp_file_id in TEMP_PDF_STORAGE:
                    del TEMP_PDF_STORAGE[temp_file_id]
            return response

        filename = f"IER_{temp_file_id}.pdf"
        return send_file(
            flattened_pdf_stream,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=filename,
        )

    except Exception as exc:
        logging.error("Error flattening and downloading PDF: %s", exc)
        return jsonify({"error": "PDF Flattening Error", "detail": str(exc)}), 500


@bp.delete("/temp-ier/<string:temp_file_id>")
def delete_temp_ier(temp_file_id: str):
    file_path = TEMP_PDF_STORAGE.get(temp_file_id)
    if file_path and os.path.exists(file_path):
        try:
            os.unlink(file_path)
            del TEMP_PDF_STORAGE[temp_file_id]
            return jsonify({"status": "deleted"}), 200
        except Exception as exc:
            logging.error("Error deleting temporary PDF %s: %s", temp_file_id, exc)
            return jsonify({"error": "File Deletion Error", "detail": str(exc)}), 500
    return jsonify({"error": "Not Found", "detail": "Temporary PDF not found"}), 404
