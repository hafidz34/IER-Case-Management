from .extensions import db
from .models import (
    JenisCase,
    JenisKaryawanTerlapor,
    StatusProses,
    StatusPengajuan,
    DivisiCase,
)

SEED_DATA = {
    JenisCase: [
        "Batal Bongkar","Batal Muat","Batal Order","Container Berlubang","Denda","Denda APD",
        "Double Trucking","Driver Ijin Pulang","Driver Terlambat","Force Majeure","Insiden Trailer",
        "Kehilangan Inventaris","Kehilangan Non Inventaris","Kerusakan APD","Kerusakan Inventaris",
        "Kerusakan Non Inventaris","Kesalahan Asuransi","Kesalahan Harga","Kesalahan Input Data - Document",
        "Kesalahan Kerja","Kesalahan Komunikasi","Kesalahan Muat","Kesalahan Pembayaran","Kesalahan Pembelian",
        "Kesalahan Pengiriman Document / Barang","Kesalahan Prosedur","Keterlambatan Informasi",
        "Keterlambatan Pembayaran","Ketidaksesuaian Nota","Outstanding Invoice","Pembatalan Tiket dan Hotel",
        "Penalti Ikatan Dinas","Penyelesaian BS","Salah Door","Salah Muat","Tidak Tertagih ke Customer",
        "Unit Storing","Vendor Kabur",
    ],
    JenisKaryawanTerlapor: [
        "Back Up","Buruh","Crew Kapal","Driver Kemitraan","Freelance","Kapal",
        "Kemitraan","Mifyadi","Mitra","Mitra Kerja","Oganic","Outsource",
        "Project","Regular","Resign","Resign ( OS )","Vendor",
    ],
    StatusProses: [
        "Pelapor","Proses PAIER","Atasan (Terlapor)","Terlapor",
        "Atasan (Terlapor) Senior Manager ke atas","Approval GM HC&CA","Approval GM FAD"
    ],
    StatusPengajuan: ["Open","Ongoing","Closed"],
    DivisiCase: ["BOD","CMD","FAD","Fleet","HC&CA","IA","OPS","SDI","TLP","NSI"],
}

def seed_all():
    report = {}
    for model, names in SEED_DATA.items():
        added = 0
        for name in names:
            name = name.strip()
            if not name:
                continue
            exists = db.session.query(model).filter_by(name=name).first()
            if exists:
                continue
            db.session.add(model(name=name))
            added += 1
        report[model.__tablename__] = added
    db.session.commit()
    return report
