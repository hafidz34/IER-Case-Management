import { useEffect, useState, useMemo } from "react";
import { casesApi, CaseRow, CasePersonRow } from "../api/cases";
import { displayDateOrDash } from "../utils/date";
import { masterApi, MasterItem } from "../api/master";
import { client } from "../api/client";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Modal from "../components/Modal";

function fmtDateOnly(v?: string | null) {
  return displayDateOrDash(v);
}

function fmtMoney(n?: number | null) {
  if (n === null || n === undefined) return "-";
  try {
    return new Intl.NumberFormat("id-ID").format(n);
  } catch {
    return String(n);
  }
}

function formatToIDR(value: string | number | null): string {
  if (value === null || value === "") return "";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "";
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num);
}

function parseIDR(value: string): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[^\d]/g, "");
  if (!cleaned) return null;
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

function parseDateString(dateString: any): Date | null {
  if (!dateString) return null;
  try {
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function fmtPercentage(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "0.00";
  return value.toFixed(2);
}

type CaseStats = {
  total: number;
  open: number;
  ongoing: number;
  closed: number;
  details?: Record<string, number>;
};

type MastersState = {
  statusProses: MasterItem[];
  statusPengajuan: MasterItem[];
  divisiCase: MasterItem[];
};

type FiltersState = {
  lokasi: string;
  divisiCaseId: string;
  startDate: Date | null;
  endDate: Date | null;
};

function kebabToTitle(str: string) {
  return str
    .split("-")
    .map((s) => (s ? s[0].toUpperCase() + s.slice(1) : s))
    .join(" ");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(new Blob([blob]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/** ===== Modal: Edit Case ===== */
function EditCaseModal({
  caseRow,
  masters,
  onClose,
  onSave,
  onDelete,
}: {
  caseRow: CaseRow;
  masters: MastersState;
  onClose: () => void;
  onSave: (updated: CaseRow) => void;
  onDelete: (deletedId: number) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [aiInfo, setAiInfo] = useState<string | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [kerugian, setKerugian] = useState<string>(caseRow.kerugian?.toString() ?? "");
  const [statusProsesId, setStatusProsesId] = useState<string>(caseRow.status_proses_id?.toString() ?? "");
  const [statusPengajuanId, setStatusPengajuanId] = useState<string>(caseRow.status_pengajuan_id?.toString() ?? "");
  const [notes, setNotes] = useState<string>(caseRow.notes ?? "");
  const [caraMencegah, setCaraMencegah] = useState<string>(caseRow.cara_mencegah ?? "");
  const [hrbp, setHrbp] = useState<string>(caseRow.hrbp ?? "");

  function applyAiCaseData(data: any) {
    setAiInfo("Form terisi otomatis oleh AI. Silakan periksa kembali sebelum menyimpan.");
    setKerugian(data.kerugian?.toString() ?? kerugian);
    setStatusProsesId(data.status_proses_id?.toString() ?? statusProsesId);
    setStatusPengajuanId(data.status_pengajuan_id?.toString() ?? statusPengajuanId);
    setNotes(data.notes ?? notes);
    setCaraMencegah(data.cara_mencegah ?? caraMencegah);
    setHrbp(data.hrbp ?? hrbp);
  }

  async function handlePrefillWithAi() {
    if (!aiPrompt.trim()) {
      setErr("Masukkan deskripsi sebelum meminta AI.");
      return;
    }
    setAiLoading(true);
    setErr(null);
    try {
      const result = await client.post<any>("/ai/prefill-case", { prompt: aiPrompt });
      const data = result?.data ?? result;
      applyAiCaseData(data);
      setShowAiModal(false);
      setAiPrompt("");
    } catch (e: any) {
      setErr(e?.message || "Gagal memuat prefill AI");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSave() {
    try {
      setErr(null);
      setLoading(true);

      const payload = {
        kerugian: kerugian ? parseInt(kerugian, 10) : null,
        status_proses_id: statusProsesId ? parseInt(statusProsesId, 10) : null,
        status_pengajuan_id: statusPengajuanId ? parseInt(statusPengajuanId, 10) : null,
        notes,
        cara_mencegah: caraMencegah,
        hrbp,
      };

      const updatedCase = await casesApi.updateCase(caseRow.id, payload);
      onSave(updatedCase);
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Gagal menyimpan");
    } finally {
      setLoading(false);
    }
  }

  function handleDelete() {
    setShowDeleteConfirm(true);
  }

  async function confirmDelete() {
    setShowDeleteConfirm(false);
    setLoading(true);
    setErr(null);
    try {
      await casesApi.deleteCase(caseRow.id);
      onDelete(caseRow.id);
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Gagal menghapus kasus");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Modal
        title={`Edit Case: ${caseRow.case_code}`}
        onClose={onClose}
        footer={
          <>
            <button className="btn btn--danger" onClick={handleDelete} disabled={loading} style={{ marginRight: "auto" }}>
              {loading ? "Menghapus..." : "Hapus Kasus"}
            </button>
            <button className="btn btn--ghost" onClick={onClose} disabled={loading}>
              Batal
            </button>
            <button className="btn btn--primary" onClick={handleSave} disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan"}
            </button>
          </>
        }
      >
        {err && <div className="alert">{err}</div>}
        {aiInfo && <div className="alert alert--success">{aiInfo}</div>}

        <div className="form-grid">
          <div className="field">
            <div className="field__label">Kerugian</div>
            <input className="input" value={formatToIDR(kerugian)} onChange={(e) => setKerugian(parseIDR(e.target.value)?.toString() ?? "")} />
          </div>
          <div className="field">
            <div className="field__label">Status Proses</div>
            <select className="input" value={statusProsesId} onChange={(e) => setStatusProsesId(e.target.value)}>
              <option value="">-- pilih --</option>
              {masters.statusProses.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <div className="field__label">Status Pengajuan</div>
            <select className="input" value={statusPengajuanId} onChange={(e) => setStatusPengajuanId(e.target.value)}>
              <option value="">-- pilih --</option>
              {masters.statusPengajuan.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <div className="field__label">Notes</div>
            <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="field">
            <div className="field__label">Cara Mencegah</div>
            <textarea className="input" value={caraMencegah} onChange={(e) => setCaraMencegah(e.target.value)} />
          </div>
          <div className="field">
            <div className="field__label">HRBP</div>
            <input className="input" value={hrbp} onChange={(e) => setHrbp(e.target.value)} />
          </div>
          <div className="field" style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
            <button className="btn btn--outline" onClick={() => setShowAiModal(true)}>
              Prefill by AI
            </button>
          </div>
        </div>
      </Modal>

      {showAiModal && (
        <Modal
          title="Prefill Case by AI"
          onClose={() => setShowAiModal(false)}
          footer={
            <>
              <button className="btn btn--ghost" onClick={() => setShowAiModal(false)}>
                Batal
              </button>
              <button className="btn btn--primary" onClick={handlePrefillWithAi} disabled={aiLoading}>
                {aiLoading ? "Memproses..." : "Isi Otomatis"}
              </button>
            </>
          }
        >
          <div className="field">
            <div className="field__label">Deskripsi singkat kasus (untuk AI)</div>
            <textarea className="input" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} rows={6} />
          </div>
        </Modal>
      )}

      {showDeleteConfirm && (
        <Modal
          title="Konfirmasi Hapus"
          onClose={() => setShowDeleteConfirm(false)}
          footer={
            <>
              <button className="btn btn--ghost" onClick={() => setShowDeleteConfirm(false)}>
                Batal
              </button>
              <button className="btn btn--danger" onClick={confirmDelete} disabled={loading}>
                {loading ? "Menghapus..." : "Hapus"}
              </button>
            </>
          }
        >
          <div>Yakin ingin menghapus kasus ini?</div>
        </Modal>
      )}
    </>
  );
}

/** ===== Modal: Edit Keputusan Person ===== */
function EditPersonModal({
  person,
  masters,
  onClose,
  onSave,
}: {
  person: CasePersonRow;
  masters: MastersState;
  onClose: () => void;
  onSave: (updated: CasePersonRow) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [aiInfo, setAiInfo] = useState<string | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const [nominalBeban, setNominalBeban] = useState<string>(person.nominal_beban_karyawan?.toString() ?? "");
  const [persentaseBeban, setPersentaseBeban] = useState<number>(person.persentase_beban_karyawan ?? 0);
  const [approvalHcca, setApprovalHcca] = useState<Date | null>(parseDateString(person.approval_gm_hcca));
  const [approvalFad, setApprovalFad] = useState<Date | null>(parseDateString(person.approval_gm_fad));

  const [hasilInvestigasi, setHasilInvestigasi] = useState<string>(person.hasil_investigasi ?? "");
  const [penilaianAwal, setPenilaianAwal] = useState<string>(person.penilaian_awal ?? "");
  const [faktaInvestigasi, setFaktaInvestigasi] = useState<string>(person.fakta_investigasi ?? "");
  const [akarMasalah, setAkarMasalah] = useState<string>(person.akar_masalah ?? "");
  const [statusProsesId, setStatusProsesId] = useState<string>(person.status_proses_id?.toString() ?? "");
  const [statusPengajuanId, setStatusPengajuanId] = useState<string>(person.status_pengajuan_id?.toString() ?? "");
  const [tindakanPerbaikan, setTindakanPerbaikan] = useState<string>(person.tindakan_perbaikan ?? "");
  const [pic, setPic] = useState<string>(person.pic ?? "");
  const [targetSelesai, setTargetSelesai] = useState<Date | null>(parseDateString(person.target_selesai));
  const [status, setStatus] = useState<string>(person.status ?? "");
  const [closingDate, setClosingDate] = useState<Date | null>(parseDateString(person.closing_date));
  const [approvalBy, setApprovalBy] = useState<string>(person.approval_by ?? "");

  useEffect(() => {
    const nominal = parseFloat(nominalBeban);
    const totalKerugian = person.total_kerugian ?? 0;
    const persentase = totalKerugian > 0 && !isNaN(nominal) ? (nominal / totalKerugian) * 100 : 0;
    setPersentaseBeban(persentase);
  }, [nominalBeban, person.total_kerugian]);

  function applyAiPersonData(data: any) {
    setAiInfo("Form terisi otomatis oleh AI. Silakan periksa kembali sebelum menyimpan.");
    if (data.nominal_beban_karyawan != null) setNominalBeban(String(data.nominal_beban_karyawan));
    if (data.hasil_investigasi != null) setHasilInvestigasi(String(data.hasil_investigasi));
    if (data.penilaian_awal != null) setPenilaianAwal(String(data.penilaian_awal));
    if (data.fakta_investigasi != null) setFaktaInvestigasi(String(data.fakta_investigasi));
    if (data.akar_masalah != null) setAkarMasalah(String(data.akar_masalah));
    if (data.status_proses_id != null) setStatusProsesId(String(data.status_proses_id));
    if (data.status_pengajuan_id != null) setStatusPengajuanId(String(data.status_pengajuan_id));
    if (data.tindakan_perbaikan != null) setTindakanPerbaikan(String(data.tindakan_perbaikan));
    if (data.pic != null) setPic(String(data.pic));
    if (data.target_selesai != null) setTargetSelesai(parseDateString(data.target_selesai));
    if (data.status != null) setStatus(String(data.status));
    if (data.closing_date != null) setClosingDate(parseDateString(data.closing_date));
    if (data.approval_by != null) setApprovalBy(String(data.approval_by));
    if (data.approval_gm_hcca != null) setApprovalHcca(parseDateString(data.approval_gm_hcca));
    if (data.approval_gm_fad != null) setApprovalFad(parseDateString(data.approval_gm_fad));
  }

  async function handleSave() {
    try {
      setErr(null);
      setLoading(true);

      const payload = {
        nominal_beban_karyawan: nominalBeban ? parseInt(nominalBeban, 10) : null,
        persentase_beban_karyawan: persentaseBeban,
        hasil_investigasi: hasilInvestigasi,
        penilaian_awal: penilaianAwal,
        fakta_investigasi: faktaInvestigasi,
        akar_masalah: akarMasalah,
        status_proses_id: statusProsesId ? parseInt(statusProsesId, 10) : null,
        status_pengajuan_id: statusPengajuanId ? parseInt(statusPengajuanId, 10) : null,
        tindakan_perbaikan: tindakanPerbaikan,
        pic,
        target_selesai: targetSelesai ? targetSelesai.toISOString().split("T")[0] : null,
        status,
        closing_date: closingDate ? closingDate.toISOString().split("T")[0] : null,
        approval_by: approvalBy,
        approval_gm_hcca: approvalHcca ? approvalHcca.toISOString().split("T")[0] : null,
        approval_gm_fad: approvalFad ? approvalFad.toISOString().split("T")[0] : null,
      };

      const updatedPerson = await casesApi.updatePerson(person.id, payload);
      onSave(updatedPerson);
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Gagal menyimpan");
    } finally {
      setLoading(false);
    }
  }

  async function handlePrefillWithAi() {
    if (!aiPrompt.trim()) {
      setErr("Masukkan deskripsi sebelum meminta AI.");
      return;
    }
    setAiLoading(true);
    setErr(null);
    try {
      const result = await client.post<any>("/ai/prefill-person", { prompt: aiPrompt });
      const data = result?.data ?? result;
      applyAiPersonData(data);
      setShowAiModal(false);
      setAiPrompt("");
    } catch (e: any) {
      setErr(e?.message || "Gagal memuat prefill AI");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <>
      <Modal
        title={`Edit Keputusan: ${person.nama}`}
        onClose={onClose}
        footer={
          <>
            <button className="btn btn--ghost" onClick={onClose}>
              Batal
            </button>
            <button className="btn btn--primary" onClick={handleSave} disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan"}
            </button>
          </>
        }
      >
        {err && <div className="alert">{err}</div>}
        {aiInfo && <div className="alert alert--success">{aiInfo}</div>}

        <div className="form-grid">
          <div className="field">
            <div className="field__label">Nominal Beban Karyawan</div>
            <input className="input" value={formatToIDR(nominalBeban)} onChange={(e) => setNominalBeban(parseIDR(e.target.value)?.toString() ?? "")} />
          </div>
          <div className="field">
            <div className="field__label">Persentase Beban Karyawan</div>
            <input className="input" value={`${fmtPercentage(persentaseBeban)}%`} readOnly />
          </div>
          <div className="field">
            <div className="field__label">Approval GM HC&CA</div>
            <DatePicker className="input" selected={approvalHcca} onChange={(date) => setApprovalHcca(date)} dateFormat="dd-MM-yyyy" placeholderText="dd-mm-yyyy" />
          </div>
          <div className="field">
            <div className="field__label">Approval GM FAD</div>
            <DatePicker className="input" selected={approvalFad} onChange={(date) => setApprovalFad(date)} dateFormat="dd-MM-yyyy" placeholderText="dd-mm-yyyy" />
          </div>

          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <div className="field__label">Hasil Investigasi</div>
            <textarea className="input" value={hasilInvestigasi} onChange={(e) => setHasilInvestigasi(e.target.value)} />
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <div className="field__label">Penilaian Awal</div>
            <textarea className="input" value={penilaianAwal} onChange={(e) => setPenilaianAwal(e.target.value)} />
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <div className="field__label">Fakta Investigasi</div>
            <textarea className="input" value={faktaInvestigasi} onChange={(e) => setFaktaInvestigasi(e.target.value)} />
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <div className="field__label">Akar Masalah</div>
            <textarea className="input" value={akarMasalah} onChange={(e) => setAkarMasalah(e.target.value)} />
          </div>

          <div className="field">
            <div className="field__label">Status Proses</div>
            <select className="input" value={statusProsesId} onChange={(e) => setStatusProsesId(e.target.value)}>
              <option value="">-- pilih --</option>
              {masters.statusProses.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <div className="field__label">Status Pengajuan</div>
            <select className="input" value={statusPengajuanId} onChange={(e) => setStatusPengajuanId(e.target.value)}>
              <option value="">-- pilih --</option>
              {masters.statusPengajuan.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <div className="field__label">Tindakan Perbaikan</div>
            <textarea className="input" value={tindakanPerbaikan} onChange={(e) => setTindakanPerbaikan(e.target.value)} />
          </div>
          <div className="field">
            <div className="field__label">PIC</div>
            <input className="input" value={pic} onChange={(e) => setPic(e.target.value)} />
          </div>
          <div className="field">
            <div className="field__label">Target Selesai</div>
            <DatePicker className="input" selected={targetSelesai} onChange={(date) => setTargetSelesai(date)} dateFormat="dd-MM-yyyy" placeholderText="dd-mm-yyyy" />
          </div>
          <div className="field">
            <div className="field__label">Status</div>
            <input className="input" value={status} onChange={(e) => setStatus(e.target.value)} />
          </div>
          <div className="field">
            <div className="field__label">Closing Date</div>
            <DatePicker className="input" selected={closingDate} onChange={(date) => setClosingDate(date)} dateFormat="dd-MM-yyyy" placeholderText="dd-mm-yyyy" />
          </div>
          <div className="field">
            <div className="field__label">Approval By</div>
            <input className="input" value={approvalBy} onChange={(e) => setApprovalBy(e.target.value)} />
          </div>

          <div className="field" style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
            <button className="btn btn--outline" onClick={() => setShowAiModal(true)}>
              Prefill by AI
            </button>
          </div>
        </div>
      </Modal>

      {showAiModal && (
        <Modal
          title="Prefill Keputusan by AI"
          onClose={() => setShowAiModal(false)}
          footer={
            <>
              <button className="btn btn--ghost" onClick={() => setShowAiModal(false)}>
                Batal
              </button>
              <button className="btn btn--primary" onClick={handlePrefillWithAi} disabled={aiLoading}>
                {aiLoading ? "Memproses..." : "Isi Otomatis"}
              </button>
            </>
          }
        >
          <div className="field">
            <div className="field__label">Deskripsi singkat (untuk AI)</div>
            <textarea className="input" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} rows={6} />
          </div>
        </Modal>
      )}
    </>
  );
}

export default function Dashboard() {
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [editingCase, setEditingCase] = useState<CaseRow | null>(null);
  const [editingPerson, setEditingPerson] = useState<CasePersonRow | null>(null);
  const [viewingCase, setViewingCase] = useState<CaseRow | null>(null);

  const [masters, setMasters] = useState<MastersState>({
    statusProses: [],
    statusPengajuan: [],
    divisiCase: [],
  });

  const [stats, setStats] = useState<CaseStats | null>(null);

  const [filters, setFilters] = useState<FiltersState>({
    lokasi: "",
    divisiCaseId: "",
    startDate: null,
    endDate: null,
  });

  const rowsToRender = useMemo(() => {
    const filtered = rows.filter((r) => {
      const lokasiMatch = filters.lokasi ? (r.lokasi_kejadian ?? "").toLowerCase().includes(filters.lokasi.toLowerCase()) : true;
      const divisiMatch = filters.divisiCaseId ? String(r.divisi_case_id ?? "") === filters.divisiCaseId : true;
      const kejadianDate = parseDateString(r.tanggal_kejadian);
      const startOk = filters.startDate ? !!kejadianDate && kejadianDate >= filters.startDate : true;
      const endOk = filters.endDate ? !!kejadianDate && kejadianDate <= filters.endDate : true;
      return lokasiMatch && divisiMatch && startOk && endOk;
    });
    return filtered;
  }, [rows, filters]);

  const hasFilter = useMemo(() => Boolean(filters.lokasi || filters.divisiCaseId || filters.startDate || filters.endDate), [filters]);

  const statusBuckets = useMemo(() => {
    const buckets = { open: 0, ongoing: 0, closed: 0, total: rowsToRender.length };
    const closedWords = ["selesai", "closed", "finish", "done", "complete"];
    const ongoingWords = ["ongoing", "proses", "progress", "jalan"];
    const openWords = ["open", "baru", "new"];

    rowsToRender.forEach((r) => {
      const proses = (r.status_proses_name || r.status_proses?.name || "").toLowerCase();
      const pengajuan = (r.status_pengajuan_name || r.status_pengajuan?.name || "").toLowerCase();
      const statusText = `${proses} ${pengajuan}`.trim();
      if (!statusText) return;

      if (closedWords.some((w) => statusText.includes(w))) {
        buckets.closed += 1;
      } else if (ongoingWords.some((w) => statusText.includes(w))) {
        buckets.ongoing += 1;
      } else if (openWords.some((w) => statusText.includes(w))) {
        buckets.open += 1;
      }
    });

    return buckets;
  }, [rowsToRender]);

  const statusBreakdown = useMemo(() => {
    if (rowsToRender.length) {
      const counts: Record<string, number> = {};
      rowsToRender.forEach((r) => {
        const key = r.status_pengajuan_name || r.status_pengajuan?.name || r.status_proses_name || r.status_proses?.name || "Terlapor";
        counts[key] = (counts[key] || 0) + 1;
      });
      return counts;
    }
    return stats?.details ?? {};
  }, [rowsToRender, stats]);

  const displayStatusBreakdown = useMemo(() => {
    const openWords = ["open", "baru", "new"];
    const ongoingWords = ["ongoing", "proses", "progress", "jalan"];
    const closedWords = ["selesai", "closed", "finish", "done", "complete"];
    return Object.entries(statusBreakdown).filter(([key]) => {
      const keyLower = key.toLowerCase();
      if (closedWords.some((w) => keyLower.includes(w))) return false;
      if (ongoingWords.some((w) => keyLower.includes(w))) return false;
      if (openWords.some((w) => keyLower.includes(w))) return false;
      return true;
    });
  }, [statusBreakdown]);

  const totalCases = useMemo(() => (hasFilter ? rowsToRender.length : stats?.total ?? rows.length), [hasFilter, rowsToRender.length, stats, rows.length]);

  async function load() {
    try {
      setErr(null);
      setLoading(true);
      const [data, statusProses, statusPengajuan, divisiCase, statsData] = await Promise.all([
        casesApi.list(),
        masterApi.list("status-proses"),
        masterApi.list("status-pengajuan"),
        masterApi.list("divisi-case"),
        fetch("/api/cases/stats").then((res) => (res.ok ? res.json() : null)).catch(() => null),
      ]);
      setRows(data);
      setMasters({ statusProses, statusPengajuan, divisiCase });
      if (statsData) setStats(statsData);
    } catch (e: any) {
      setErr(e?.message || "Network Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleViewDetail(caseId: number) {
    try {
      const caseData = await casesApi.getCase(caseId);
      setViewingCase(caseData);
    } catch (e: any) {
      setErr(e?.message || "Gagal memuat detail");
    }
  }

  function handleSaveCase(updatedCase: CaseRow) {
    setRows(rows.map((r) => (r.id === updatedCase.id ? updatedCase : r)));
    load();
  }

  function handleSavePerson(updatedPerson: CasePersonRow) {
    setRows(
      rows.map((r) => {
        if (r.id === updatedPerson.case_id) {
          return {
            ...r,
            persons: r.persons?.map((p) => (p.id === updatedPerson.id ? updatedPerson : p)),
          };
        }
        return r;
      })
    );
    load();
  }

  function handleDeleteCase(deletedCaseId: number) {
    setRows(rows.filter((r) => r.id !== deletedCaseId));
    load();
  }

  async function handleDownloadPdf(personId: number, personCode: string) {
    try {
      setLoading(true);
      const blob = await casesApi.downloadIerPdf(personId);
      if (!blob || blob.size === 0) throw new Error("File PDF kosong.");
      const safeName = personCode.replace(/\//g, "-");
      downloadBlob(blob, `IER_${safeName}.pdf`);
    } catch (e: any) {
      alert("Gagal download PDF: " + (e?.message || "Server Error"));
    } finally {
      setLoading(false);
    }
  }

  function getStatusColor(status: string): string {
    const s = status.toLowerCase();
    if (s.includes("selesai") || s.includes("closed") || s.includes("finish")) return "#22c55e";
    if (s.includes("proses") || s.includes("ongoing") || s.includes("jalan")) return "#eab308";
    if (s.includes("batal") || s.includes("cancel") || s.includes("reject")) return "#ef4444";
    if (s.includes("baru") || s.includes("new") || s.includes("open")) return "#3b82f6";
    return "#64748b";
  }

  function getCaseOverallStatus(
    r: CaseRow
  ): { label: "Open" | "Ongoing" | "Closed" | "-"; color: string } {
    const closedWords = ["selesai", "closed", "finish", "done", "complete"];
    const ongoingWords = ["ongoing", "proses", "progress", "jalan"];
    const openWords = ["open", "baru", "new"];

    const proses = (r.status_proses_name || r.status_proses?.name || "").toLowerCase();
    const pengajuan = (r.status_pengajuan_name || r.status_pengajuan?.name || "").toLowerCase();
    const statusText = `${proses} ${pengajuan}`.trim();

    let label: "Open" | "Ongoing" | "Closed" | "-" = "-";
    if (statusText) {
      if (closedWords.some((w) => statusText.includes(w))) label = "Closed";
      else if (ongoingWords.some((w) => statusText.includes(w))) label = "Ongoing";
      else if (openWords.some((w) => statusText.includes(w))) label = "Open";
    }

    const color = statusText ? getStatusColor(statusText) : "#64748b";
    return { label, color };
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
      </div>

      <div className="panel" style={{ padding: 12, marginTop: 12 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
            alignItems: "end",
          }}
        >
          <div>
            <div className="field__label">Lokasi Kejadian</div>
            <input className="input" placeholder="Cari lokasi..." value={filters.lokasi} onChange={(e) => setFilters({ ...filters, lokasi: e.target.value })} />
          </div>
          <div>
            <div className="field__label">Divisi Case</div>
            <select className="input" value={filters.divisiCaseId} onChange={(e) => setFilters({ ...filters, divisiCaseId: e.target.value })}>
              <option value="">-- pilih --</option>
              {masters.divisiCase.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="field__label">Tanggal Kejadian Dari</div>
            <DatePicker className="input" selected={filters.startDate} onChange={(date) => setFilters({ ...filters, startDate: date })} dateFormat="dd-MM-yyyy" placeholderText="dd-mm-yyyy" isClearable />
          </div>
          <div>
            <div className="field__label">Tanggal Kejadian Sampai</div>
            <DatePicker className="input" selected={filters.endDate} onChange={(date) => setFilters({ ...filters, endDate: date })} dateFormat="dd-MM-yyyy" placeholderText="dd-mm-yyyy" isClearable />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn--outline" style={{ width: "100%" }} onClick={() => setFilters({ lokasi: "", divisiCaseId: "", startDate: null, endDate: null })}>
              Reset Filter
            </button>
          </div>
        </div>
      </div>

      <div className="panel" style={{ padding: 12, marginTop: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <div className="panel" style={{ padding: "16px", borderLeft: "4px solid #3b82f6" }}>
            <div style={{ color: "#64748b", fontSize: "13px", fontWeight: 700 }}>Open</div>
            <div style={{ fontSize: "24px", fontWeight: 800, marginTop: "4px" }}>{statusBuckets.open}</div>
          </div>
          <div className="panel" style={{ padding: "16px", borderLeft: "4px solid #eab308" }}>
            <div style={{ color: "#64748b", fontSize: "13px", fontWeight: 700 }}>Ongoing</div>
            <div style={{ fontSize: "24px", fontWeight: 800, marginTop: "4px" }}>{statusBuckets.ongoing}</div>
          </div>
          <div className="panel" style={{ padding: "16px", borderLeft: "4px solid #22c55e" }}>
            <div style={{ color: "#64748b", fontSize: "13px", fontWeight: 700 }}>Closed</div>
            <div style={{ fontSize: "24px", fontWeight: 800, marginTop: "4px" }}>{statusBuckets.closed}</div>
          </div>
          <div className="panel" style={{ padding: "16px", borderLeft: "4px solid #64748b" }}>
            <div style={{ color: "#64748b", fontSize: "13px", fontWeight: 700 }}>Total Kasus</div>
            <div style={{ fontSize: "24px", fontWeight: 800, marginTop: "4px" }}>{totalCases}</div>
          </div>
          {displayStatusBreakdown.map(([key, val]) => (
            <div key={key} className="panel" style={{ padding: "16px", borderLeft: `4px solid ${getStatusColor(key)}` }}>
              <div style={{ color: "#64748b", fontSize: "13px", fontWeight: 700 }}>{key}</div>
              <div style={{ fontSize: "24px", fontWeight: 800, marginTop: "4px" }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {err && <div className="alert">{err}</div>}

      <div className="panel" style={{ marginTop: 12 }}>
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>Status</th>
                <th style={{ width: 140 }}>ID Case</th>
                <th style={{ width: 140 }}>Divisi Case</th>
                <th style={{ width: 170 }}>Tanggal Kejadian</th>
                <th style={{ minWidth: 220 }}>Lokasi Kejadian</th>
                <th style={{ minWidth: 220 }}>Judul IER</th>
                <th className="col-money" style={{ width: 170 }}>
                  Kerugian
                </th>
                <th style={{ minWidth: 180 }}>Nama Terlapor</th>
                <th style={{ width: 120 }}>Action</th>
              </tr>
            </thead>

            <tbody>
              {rowsToRender.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: 12, opacity: 0.7 }}>
                    {loading ? "Loading..." : "Belum ada case."}
                  </td>
                </tr>
              ) : (
                rowsToRender.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {(() => {
                        const st = getCaseOverallStatus(r);
                        return (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: "4px 10px",
                              borderRadius: 999,
                              fontWeight: 800,
                              fontSize: 12,
                              border: "1px solid #e2e8f0",
                              background: "#f8fafc",
                              color: st.color,
                              minWidth: 72,
                            }}
                          >
                            {st.label}
                          </span>
                        );
                      })()}
                    </td>

                    <td className="mono">{r.case_code}</td>
                    <td>{r.divisi_case_name ?? "-"}</td>
                    <td>{fmtDateOnly(r.tanggal_kejadian)}</td>
                    <td>{r.lokasi_kejadian ?? "-"}</td>
                    <td>{r.judul_ier ?? "-"}</td>
                    <td className="col-money">{fmtMoney(r.kerugian)}</td>
                    <td>
                      {r.persons && r.persons.length > 0 ? (
                        <ul className="terlapor-list">
                          {r.persons.map((p) => (
                            <li key={p.id} className="terlapor-item">
                              <div className="terlapor-name">
                                {p.nama} <span style={{ color: "#666", marginLeft: "6px" }}>({p.person_code})</span>
                              </div>
                              <div style={{ display: "flex", gap: "4px" }}>
                                <button className="btn btn--sm btn--outline" onClick={() => setEditingPerson(p)}>
                                  Edit Keputusan
                                </button>
                                <button className="btn btn--sm btn--primary" title="Download IER Form PDF" onClick={() => handleDownloadPdf(p.id, p.person_code)}>
                                  PDF
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="actions">
                      <button className="btn btn--sm btn--outline" onClick={() => setEditingCase(r)}>
                        Edit
                      </button>
                      <button className="btn btn--sm btn--outline" onClick={() => handleViewDetail(r.id)}>
                        Detail
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingCase && (
        <EditCaseModal caseRow={editingCase} masters={masters} onClose={() => setEditingCase(null)} onSave={handleSaveCase} onDelete={handleDeleteCase} />
      )}

      {editingPerson && (
        <EditPersonModal person={editingPerson} masters={masters} onClose={() => setEditingPerson(null)} onSave={handleSavePerson} />
      )}

      {viewingCase && (
        <Modal title={`Detail Case: ${viewingCase.case_code}`} onClose={() => setViewingCase(null)}>
          <div className="form-grid">
            <div className="field">
              <div className="field__label">ID Case</div>
              <div className="mono">{viewingCase.case_code}</div>
            </div>
            <div className="field">
              <div className="field__label">Divisi Case</div>
              <div>{viewingCase.divisi_case_name ?? "-"}</div>
            </div>
            <div className="field">
              <div className="field__label">Tanggal Kejadian</div>
              <div>{fmtDateOnly(viewingCase.tanggal_kejadian)}</div>
            </div>
            <div className="field">
              <div className="field__label">Lokasi Kejadian</div>
              <div>{viewingCase.lokasi_kejadian ?? "-"}</div>
            </div>
            <div className="field">
              <div className="field__label">Judul IER</div>
              <div>{viewingCase.judul_ier ?? "-"}</div>
            </div>
            <div className="field">
              <div className="field__label">Kerugian</div>
              <div>{fmtMoney(viewingCase.kerugian)}</div>
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <div className="field__label">Persons</div>
              {viewingCase.persons && viewingCase.persons.length > 0 ? (
                <ul>
                  {viewingCase.persons.map((p) => (
                    <li key={p.id}>
                      {p.nama} ({p.person_code})
                    </li>
                  ))}
                </ul>
              ) : (
                "-"
              )}
            </div>
          </div>
        </Modal>
      )}

      <div style={{ height: 30 }} />
    </div>
  );
}
