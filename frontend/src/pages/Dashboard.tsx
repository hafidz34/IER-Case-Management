import { useEffect, useState, useMemo } from "react";
import { casesApi, CaseRow, CasePersonRow } from "../api/cases";
import { displayDateOrDash } from "../utils/date";
import { masterApi, MasterItem } from "../api/master";
import { client } from "../api/client";
import { pushToast } from "../components/ToastHost";
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
  const cleaned = value.replace(/[^\d]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function fmtPercentage(n?: number | null): string {
  if (n === null || n === undefined) return "-";
  return parseFloat(n.toFixed(3)).toString();
}

function parseDateString(dateString: string | null | undefined): Date | null {
  if (!dateString) return null;
  const parts = dateString.split("-");
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const date = new Date(year, month, day);
    if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
      return date;
    }
  }
  return null;
}

type CaseStats = {
  total: number;
  details: Record<string, number>;
};

// --- KOMPONEN MODAL ---

function EditCaseModal({
  caseRow,
  masters,
  onClose,
  onSave,
  onDelete,
}: {
  caseRow: CaseRow;
  masters: { statusProses: MasterItem[]; statusPengajuan: MasterItem[] };
  onClose: () => void;
  onSave: (updatedCase: CaseRow) => void;
  onDelete: (deletedCaseId: number) => void;
}) {
  const [kerugian, setKerugian] = useState(caseRow.kerugian?.toString() ?? "");
  const [statusProsesId, setStatusProsesId] = useState(caseRow.status_proses_id?.toString() ?? "");
  const [statusPengajuanId, setStatusPengajuanId] = useState(caseRow.status_pengajuan_id?.toString() ?? "");
  const [notes, setNotes] = useState(caseRow.notes ?? "");
  const [caraMencegah, setCaraMencegah] = useState(caseRow.cara_mencegah ?? "");
  const [hrbp, setHrbp] = useState(caseRow.hrbp ?? "");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiInfo, setAiInfo] = useState<string | null>(null);

  async function handleSave() {
    setLoading(true);
    setErr(null);
    try {
      const payload = {
        kerugian: parseIDR(kerugian),
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

  function applyAiCaseData(data: any) {
    setAiInfo("Form terisi otomatis oleh AI. Silakan periksa kembali sebelum menyimpan.");
    setKerugian(data.kerugian?.toString() ?? kerugian);
    setStatusProsesId(data.status_proses_id?.toString() ?? statusProsesId);
    setStatusPengajuanId(data.status_pengajuan_id?.toString() ?? statusPengajuanId);
    setNotes(data.notes ?? notes);
    setCaraMencegah(data.cara_mencegah ?? caraMencegah);
    setHrbp(data.hrbp ?? hrbp);
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
      pushToast(e?.message || "Layanan AI sedang tidak tersedia. Coba lagi nanti.");
    } finally {
      setAiLoading(false);
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
        </div>

        <div
          style={{
            margin: "0 0 12px",
            padding: "12px",
            border: "1px solid #e3e3e3",
            borderRadius: 10,
            background: "#f7f9fb",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Prompt to Form (AI)</div>
            <div style={{ color: "#4b5563", fontSize: "0.95rem" }}>Masukkan deskripsi kasus, AI akan isi kerugian, status, notes, cara mencegah, dan HRBP.</div>
          </div>
          <button className="btn btn--primary btn--sm" type="button" onClick={() => setShowAiModal(true)}>
            Gunakan AI
          </button>
        </div>
      </Modal>

      {showAiModal && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-case-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowAiModal(false);
          }}
        >
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <div>
                <h2 id="ai-case-title" className="modal__title">
                  Gunakan AI
                </h2>
                <p className="modal__subtitle">Isi deskripsi kasus singkat. AI akan mengisi kerugian, status proses/pengajuan, notes, cara mencegah, dan HRBP (jika disebut).</p>
              </div>
            </div>
            <div className="modal__body">
              <label className="field__label" htmlFor="ai-case-prompt">
                Deskripsi kasus
              </label>
              <textarea
                id="ai-case-prompt"
                className="input"
                rows={5}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Contoh: Kerugian 9 juta, status proses approval GM HC&CA, pengajuan open, catatan pencegahan, HRBP: Rina."
              />
              <div style={{ marginTop: 8, fontSize: "0.9rem", color: "#555" }}>Sertakan kerugian, status, catatan, dan HRBP agar hasil lebih akurat.</div>
              <div style={{ marginTop: 4, fontSize: "0.9rem", color: "#555" }}>
                Catatan: Deskripsi kasus dianjurkan berisi divisi/jenis kasus, tanggal lapor & kejadian, lokasi kejadian, tanggal proses, serta estimasi kerugian untuk memudahkan klasifikasi dan peninjauan.
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn--ghost" onClick={() => setShowAiModal(false)} disabled={aiLoading}>
                Batal
              </button>
              <button className="btn btn--primary" onClick={handlePrefillWithAi} disabled={aiLoading || !aiPrompt.trim()}>
                {aiLoading ? "Memproses..." : "Generate & Isi"}
              </button>
            </div>
          </div>
        </div>
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
          <p>
            Apakah Anda yakin ingin menghapus kasus <strong>{caseRow.case_code}</strong>?
          </p>
          {err && <div className="alert">{err}</div>}
        </Modal>
      )}
    </>
  );
}

function EditPersonModal({ person, caseKerugian, onClose, onSave }: { person: CasePersonRow; caseKerugian: number | null; onClose: () => void; onSave: (updatedPerson: CasePersonRow) => void }) {
  const [keputusanIer, setKeputusanIer] = useState(person.keputusan_ier ?? "");
  const [keputusanFinal, setKeputusanFinal] = useState(person.keputusan_final ?? "");
  const [nominalBeban, setNominalBeban] = useState(person.nominal_beban_karyawan?.toString() ?? "");
  const [approvalHcca, setApprovalHcca] = useState<Date | null>(parseDateString(person.approval_gm_hcca));
  const [approvalFad, setApprovalFad] = useState<Date | null>(parseDateString(person.approval_gm_fad));
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiInfo, setAiInfo] = useState<string | null>(null);

  const [persentaseBeban, setPersentaseBeban] = useState<number | null>(person.persentase_beban_karyawan ?? null);

  useEffect(() => {
    const kerugian = caseKerugian ?? 0;
    const beban = parseIDR(nominalBeban) ?? 0;
    if (!kerugian || kerugian <= 0 || !beban || beban < 0) {
      setPersentaseBeban(0);
      return;
    }
    const pct = Math.max(0, (beban / kerugian) * 100);
    setPersentaseBeban(pct);
  }, [caseKerugian, nominalBeban]);

  useEffect(() => {
    setKeputusanIer(person.keputusan_ier ?? "");
    setKeputusanFinal(person.keputusan_final ?? "");
    setNominalBeban(person.nominal_beban_karyawan?.toString() ?? "");
    setApprovalHcca(parseDateString(person.approval_gm_hcca));
    setApprovalFad(parseDateString(person.approval_gm_fad));
    setPersentaseBeban(person.persentase_beban_karyawan ?? null);
    setAiInfo(null);
    setAiPrompt("");
    setShowAiModal(false);
  }, [person]);

  function applyAiPersonData(data: any) {
    setAiInfo("Form terisi otomatis oleh AI. Silakan periksa kembali sebelum menyimpan.");
    setKeputusanIer(data.keputusan_ier ?? keputusanIer);
    setKeputusanFinal(data.keputusan_final ?? keputusanFinal);
    setNominalBeban(data.nominal_beban_karyawan?.toString() ?? nominalBeban);
    setPersentaseBeban(data.persentase_beban_karyawan ?? persentaseBeban);
    setApprovalHcca(parseDateString(data.approval_gm_hcca) ?? approvalHcca);
    setApprovalFad(parseDateString(data.approval_gm_fad) ?? approvalFad);
  }

  async function handleSave() {
    setLoading(true);
    setErr(null);
    try {
      const payload = {
        keputusan_ier: keputusanIer,
        keputusan_final: keputusanFinal,
        nominal_beban_karyawan: parseIDR(nominalBeban),
        persentase_beban_karyawan: persentaseBeban,
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
      pushToast(e?.message || "Layanan AI sedang tidak tersedia. Coba lagi nanti.");
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
            <div className="field__label">Keputusan IER</div>
            <textarea className="input" value={keputusanIer} onChange={(e) => setKeputusanIer(e.target.value)} />
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <div className="field__label">Keputusan Final</div>
            <textarea className="input" value={keputusanFinal} onChange={(e) => setKeputusanFinal(e.target.value)} />
          </div>
        </div>
        <div
          style={{
            margin: "0 0 12px",
            padding: "12px",
            border: "1px solid #e3e3e3",
            borderRadius: 10,
            background: "#f7f9fb",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Prompt to Form (AI)</div>
            <div style={{ color: "#4b5563", fontSize: "0.95rem" }}>Masukkan deskripsi keputusan, AI akan prefill beban & keputusan.</div>
          </div>
          <button className="btn btn--primary btn--sm" type="button" onClick={() => setShowAiModal(true)}>
            Gunakan AI
          </button>
        </div>
      </Modal>

      {showAiModal && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-person-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowAiModal(false);
          }}
        >
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <div>
                <h2 id="ai-person-title" className="modal__title">
                  Gunakan AI
                </h2>
                <p className="modal__subtitle">Isi deskripsi keputusan singkat. AI akan mengisi keputusan & beban karyawan.</p>
              </div>
            </div>
            <div className="modal__body">
              <label className="field__label" htmlFor="ai-person-prompt">
                Deskripsi keputusan
              </label>
              <textarea
                id="ai-person-prompt"
                className="input"
                rows={5}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Contoh: Beban kerugian 5 juta karena kelalaian, disetujui GM HC&CA tanggal 12-02-2026..."
              />
              <div style={{ marginTop: 8, fontSize: "0.9rem", color: "#555" }}>Catatan: Sertakan nominal beban, keputusan IER/final, dan tanggal approval bila ada agar hasil lebih akurat.</div>
            </div>
            <div className="modal__footer">
              <button className="btn btn--ghost" onClick={() => setShowAiModal(false)} disabled={aiLoading}>
                Batal
              </button>
              <button className="btn btn--primary" onClick={handlePrefillWithAi} disabled={aiLoading || !aiPrompt.trim()}>
                {aiLoading ? "Memproses..." : "Generate & Isi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CaseDetailModal({ caseRow, masters, onClose }: { caseRow: CaseRow; masters: { divisiCase: MasterItem[] }; onClose: () => void }) {
  const divisiDisplay = (p: CasePersonRow) => {
    if (p.divisi_name) return p.divisi_name;
    const raw = p.divisi ?? "";
    if (!raw) return "-";
    const n = Number(raw);
    if (Number.isFinite(n)) {
      const found = masters.divisiCase.find((d) => d.id === n);
      if (found) return found.name;
    }
    return raw;
  };

  return (
    <Modal
      title={`Detail Case: ${caseRow.case_code}`}
      onClose={onClose}
      footer={
        <button className="btn btn--primary" onClick={onClose}>
          Tutup
        </button>
      }
    >
      <div className="summary-card">
        <div className="summary-card__title">Informasi Umum</div>
        <div className="summary-grid">
          <div className="k">Divisi Case</div>
          <div className="v">{caseRow.divisi_case?.name ?? "-"}</div>
          <div className="k">Jenis Case</div>
          <div className="v">{caseRow.jenis_case?.name ?? "-"}</div>
          <div className="k">Tanggal Lapor</div>
          <div className="v">{fmtDateOnly(caseRow.tanggal_lapor)}</div>
          <div className="k">Tanggal Kejadian</div>
          <div className="v">{fmtDateOnly(caseRow.tanggal_kejadian)}</div>
          <div className="k">Lokasi Kejadian</div>
          <div className="v">{caseRow.lokasi_kejadian ?? "-"}</div>
          <div className="k">Judul IER</div>
          <div className="v">{caseRow.judul_ier ?? "-"}</div>
          <div className="k">Kerugian</div>
          <div className="v">{fmtMoney(caseRow.kerugian)}</div>
        </div>
      </div>
      <div className="summary-card">
        <div className="summary-card__title">Status & Lainnya</div>
        <div className="summary-grid">
          <div className="k">Status Proses</div>
          <div className="v">{caseRow.status_proses?.name ?? "-"}</div>
          <div className="k">Status Pengajuan</div>
          <div className="v">{caseRow.status_pengajuan?.name ?? "-"}</div>
          <div className="k">Notes</div>
          <div className="v">{caseRow.notes ?? "-"}</div>
          <div className="k">Cara Mencegah</div>
          <div className="v">{caseRow.cara_mencegah ?? "-"}</div>
          <div className="k">HRBP</div>
          <div className="v">{caseRow.hrbp ?? "-"}</div>
        </div>
      </div>
      <div className="summary-card">
        <div className="summary-card__title">Terlibat</div>
        {caseRow.persons?.map((p) => (
          <div key={p.id} className="summary-grid" style={{ marginBottom: 12, borderBottom: "1px solid #eee", paddingBottom: 12 }}>
            <div className="k">Nama</div>
            <div className="v">{p.nama}</div>
            <div className="k">Divisi Terlapor</div>
            <div className="v">{divisiDisplay(p)}</div>
            <div className="k">Jenis Karyawan</div>
            <div className="v">{p.jenis_karyawan_terlapor?.name ?? "-"}</div>
            <div className="k">Nominal Beban</div>
            <div className="v">{fmtMoney(p.nominal_beban_karyawan)}</div>
            <div className="k">Persentase Beban</div>
            <div className="v">{p.persentase_beban_karyawan ? `${fmtPercentage(p.persentase_beban_karyawan)}%` : "-"}</div>
            <div className="k">Keputusan IER</div>
            <div className="v">{p.keputusan_ier ?? "-"}</div>
            <div className="k">Keputusan Final</div>
            <div className="v">{p.keputusan_final ?? "-"}</div>
            <div className="k">Approval GM HC&CA</div>
            <div className="v">{fmtDateOnly(p.approval_gm_hcca)}</div>
            <div className="k">Approval GM FAD</div>
            <div className="v">{fmtDateOnly(p.approval_gm_fad)}</div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// --- FUNGSI DASHBOARD UTAMA ---

export default function Dashboard() {
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editingCase, setEditingCase] = useState<CaseRow | null>(null);
  const [editingPerson, setEditingPerson] = useState<CasePersonRow | null>(null);
  const [viewingCase, setViewingCase] = useState<CaseRow | null>(null);
  const [masters, setMasters] = useState<{ statusProses: MasterItem[]; statusPengajuan: MasterItem[]; divisiCase: MasterItem[] }>({
    statusProses: [],
    statusPengajuan: [],
    divisiCase: [],
  });
  const [stats, setStats] = useState<CaseStats | null>(null);
  const [filters, setFilters] = useState<{ lokasi: string; divisiCaseId: string; statusPengajuanId: string; startDate: Date | null; endDate: Date | null }>({
    lokasi: "",
    divisiCaseId: "",
    statusPengajuanId: "",
    startDate: null,
    endDate: null,
  });

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const lokasiMatch = filters.lokasi ? (r.lokasi_kejadian || "").toLowerCase().includes(filters.lokasi.toLowerCase()) : true;
      const divisiMatch = filters.divisiCaseId ? String(r.divisi_case_id ?? "") === filters.divisiCaseId : true;
      const statusPengajuanMatch = filters.statusPengajuanId ? String(r.status_pengajuan_id ?? "") === filters.statusPengajuanId : true;
      const kejadianDate = parseDateString(r.tanggal_kejadian);
      const startOk = filters.startDate ? !!kejadianDate && kejadianDate >= filters.startDate : true;
      const endOk = filters.endDate ? !!kejadianDate && kejadianDate <= filters.endDate : true;
      return lokasiMatch && divisiMatch && statusPengajuanMatch && startOk && endOk;
    });
  }, [rows, filters]);

  const rowsToRender = filteredRows;
  const hasFilter = useMemo(() => Boolean(filters.lokasi || filters.divisiCaseId || filters.statusPengajuanId || filters.startDate || filters.endDate), [filters]);

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
        const key = r.status_pengajuan_name || r.status_pengajuan?.name || r.status_proses_name || r.status_proses?.name || "Open";
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
        fetch("/api/cases/stats")
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null),
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
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement("a");
      link.href = url;
      const safeName = personCode.replace(/\//g, "-");
      link.setAttribute("download", `IER_${safeName}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
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

  function getCaseOverallStatus(r: CaseRow): { label: "Open" | "Ongoing" | "Closed" | "-"; color: string } {
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, alignItems: "end" }}>
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
            <div className="field__label">Status Pengajuan</div>
            <select className="input" value={filters.statusPengajuanId} onChange={(e) => setFilters({ ...filters, statusPengajuanId: e.target.value })}>
              <option value="">-- pilih --</option>
              {masters.statusPengajuan.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
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
            <button className="btn btn--outline" style={{ width: "100%" }} onClick={() => setFilters({ lokasi: "", divisiCaseId: "", statusPengajuanId: "", startDate: null, endDate: null })}>
              Reset Filter
            </button>
          </div>
        </div>
      </div>

      {(stats || rows.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginTop: "12px" }}>
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
      )}

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
                                {p.nama} <span style={{ fontSize: "0.8em", color: "#666", marginLeft: "0px" }}>({p.person_code})</span>
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
                    <td className="actions ">
                      <button className="btn btn--sm btn--outline" onClick={() => setEditingCase(r)}>
                        Edit
                      </button>
                      <button className="btn btn--sm btn--primary" onClick={() => handleViewDetail(r.id)}>
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

      {editingCase && <EditCaseModal caseRow={editingCase} masters={masters} onClose={() => setEditingCase(null)} onSave={handleSaveCase} onDelete={handleDeleteCase} />}

      {editingPerson && <EditPersonModal person={editingPerson} caseKerugian={rows.find((r) => r.id === editingPerson.case_id)?.kerugian ?? null} onClose={() => setEditingPerson(null)} onSave={handleSavePerson} />}

      {viewingCase && <CaseDetailModal caseRow={viewingCase} masters={{ divisiCase: masters.divisiCase }} onClose={() => setViewingCase(null)} />}
    </div>
  );
}
