from datetime import datetime
from .extensions import db

class MasterBase(db.Model):
    __abstract__ = True
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), unique=True, nullable=False)

class JenisCase(MasterBase):
    __tablename__ = "m_jenis_case"

class JenisKaryawanTerlapor(MasterBase):
    __tablename__ = "m_jenis_karyawan_terlapor"

class StatusProses(MasterBase):
    __tablename__ = "m_status_proses"

class StatusPengajuan(MasterBase):
    __tablename__ = "m_status_pengajuan"

class DivisiCase(MasterBase):
    __tablename__ = "m_divisi_case"

class Case(db.Model):
    __tablename__ = "t_case"

    id = db.Column(db.Integer, primary_key=True)

    # 1) ID Case per case  -> kita pakai case_code
    case_code = db.Column(db.String(64), unique=True, nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # 2) Divisi Case (dropdown)
    divisi_case_id = db.Column(db.Integer, db.ForeignKey("m_divisi_case.id"), nullable=True)
    divisi_case = db.relationship("DivisiCase")

    # 3) Tanggal Lapor
    tanggal_lapor = db.Column(db.Date, nullable=True)

    # 4) Tanggal Kejadian
    tanggal_kejadian = db.Column(db.Date, nullable=True)

    # 5) Lokasi Kejadian
    lokasi_kejadian = db.Column(db.String(255), nullable=True)

    # 6) Jenis Case (dropdown)
    jenis_case_id = db.Column(db.Integer, db.ForeignKey("m_jenis_case.id"), nullable=True)
    jenis_case = db.relationship("JenisCase")

    # 7) Judul IER
    judul_ier = db.Column(db.String(255), nullable=True)

    # 8) Tanggal Proses IER
    tanggal_proses_ier = db.Column(db.Date, nullable=True)

    # 9) Kerugian
    kerugian = db.Column(db.Numeric(18, 2), nullable=True)

    # 10) Kerugian by Case (Per individu terlapor)
    kerugian_by_case = db.Column(db.Numeric(18, 2), nullable=True)

    # 11) Kronologi
    kronologi = db.Column(db.Text, nullable=True)

    # 12) Nama Terlapor
    nama_terlapor = db.Column(db.String(255), nullable=True)

    # 13) Lokasi Terlapor
    lokasi_terlapor = db.Column(db.String(255), nullable=True)

    # 14) Divisi Terlapor
    divisi_terlapor = db.Column(db.String(255), nullable=True)

    # 15) Departemen Terlapor
    departemen_terlapor = db.Column(db.String(255), nullable=True)

    # 16) Jenis Karyawan Terlapor (dropdown)
    jenis_karyawan_terlapor_id = db.Column(
        db.Integer, db.ForeignKey("m_jenis_karyawan_terlapor.id"), nullable=True
    )
    jenis_karyawan_terlapor = db.relationship("JenisKaryawanTerlapor")

    # 17) Keputusan IER
    keputusan_ier = db.Column(db.Text, nullable=True)

    # 18) Keputusan Final
    keputusan_final = db.Column(db.Text, nullable=True)

    # 19) Persentase Beban Karyawan
    persentase_beban_karyawan = db.Column(db.Numeric(6, 3), nullable=True)

    # 20) Nominal Beban Karyawan
    nominal_beban_karyawan = db.Column(db.Numeric(18, 2), nullable=True)

    # 21) Approval GM HC&CA (di excel contoh dd-mm-yyyy -> kita simpan date)
    approval_gm_hcca = db.Column(db.Date, nullable=True)

    # 22) Approval GM FAD
    approval_gm_fad = db.Column(db.Date, nullable=True)

    # 23) Status Process (dropdown)
    status_proses_id = db.Column(db.Integer, db.ForeignKey("m_status_proses.id"), nullable=True)
    status_proses = db.relationship("StatusProses")

    # 24) Status Pengajuan (dropdown)
    status_pengajuan_id = db.Column(db.Integer, db.ForeignKey("m_status_pengajuan.id"), nullable=True)
    status_pengajuan = db.relationship("StatusPengajuan")

    # 25) Notes
    notes = db.Column(db.Text, nullable=True)

    # 26) Cara Mencegah ke depannya
    cara_mencegah = db.Column(db.Text, nullable=True)

    # 27) HRBP
    hrbp = db.Column(db.String(255), nullable=True)