import { useEffect, useMemo, useRef, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { casesApi, CaseCreatePayload } from "../api/cases";
import { masterApi, MasterItem } from "../api/master";
import { isValidDateInput, normalizeDateDisplay, normalizeDateForPayload } from "../utils/date";

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

function formatPercentage(value: string): string {
  if (value === "") return "";
  const cleaned = value.replace(/[^\d.]/g, "");
  return `${cleaned}%`;
}

function parsePercentage(value: string): string {
  return value.replace(/[^\d.]/g, "");
}

type Masters = {
  divisiCase: MasterItem[];
  jenisCase: MasterItem[];
  jenisKaryawan: MasterItem[];
  statusProses: MasterItem[];
  statusPengajuan: MasterItem[];
};

function toNumOrNull(v: string): number | null {
  const s = v.trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export default function InputCase() {
  const [isConfirming, setIsConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const msgRef = useRef<HTMLDivElement | null>(null);
  const errRef = useRef<HTMLDivElement | null>(null);

  const [masters, setMasters] = useState<Masters>({
    divisiCase: [],
    jenisCase: [],
    jenisKaryawan: [],
    statusProses: [],
    statusPengajuan: [],
  });

  const [form, setForm] = useState({
    divisi_case_id: "",
    tanggal_lapor: null as Date | null,
    tanggal_kejadian: null as Date | null,
    lokasi_kejadian: "",

    jenis_case_id: "",
    judul_ier: "",
    tanggal_proses_ier: null as Date | null,

    kerugian: "",
    kerugian_by_case: "",

    kronologi: "",
    nama_terlapor: "",
    lokasi_terlapor: "",
    divisi_terlapor: "",
    departemen_terlapor: "",

    jenis_karyawan_terlapor_id: "",

    keputusan_ier: "",
    keputusan_final: "",

    persentase_beban_karyawan: "",
    nominal_beban_karyawan: "",

    approval_gm_hcca: null as Date | null,
    approval_gm_fad: null as Date | null,

    status_proses_id: "",
    status_pengajuan_id: "",

    notes: "",
    cara_mencegah: "",
    hrbp: "",
  });

  const persentaseBeban = useMemo(() => {
    const kerugian = parseIDR(form.kerugian) ?? 0;
    const byCase = parseIDR(form.kerugian_by_case) ?? 0;
    if (!kerugian || kerugian <= 0 || !byCase || byCase < 0) return "";
    const pct = Math.max(0, Math.min(100, (byCase / kerugian) * 100));
    return `${pct.toFixed(0)}%`;
  }, [form.kerugian, form.kerugian_by_case]);

  useEffect(() => {
    if (form.nominal_beban_karyawan !== "0") {
      setForm((p) => ({ ...p, nominal_beban_karyawan: "0" }));
    }
  }, []);

  const set = (k: keyof typeof form) => (e: any) => {
    const value = e && e.target ? e.target.value : e;
    setForm((p) => ({ ...p, [k]: value }));
  };

  const setDate = (k: keyof typeof form) => (date: Date | null) => {
    setForm((p) => ({ ...p, [k]: date }));
  };

  useEffect(() => {
    (async () => {
      try {
        setErr(null);
        const [divisiCase, jenisCase, jenisKaryawan, statusProses, statusPengajuan] =
          await Promise.all([
            masterApi.list("divisi-case"),
            masterApi.list("jenis-case"),
            masterApi.list("jenis-karyawan-terlapor"),
            masterApi.list("status-proses"),
            masterApi.list("status-pengajuan"),
          ]);

        setMasters({ divisiCase, jenisCase, jenisKaryawan, statusProses, statusPengajuan });
      } catch (e: any) {
        setErr(e?.message || "Network Error (master data)");
      }
    })();
  }, []);

  useEffect(() => {
    if (!err) return;
    errRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [err]);
  
  useEffect(() => {
    if (!msg) return;
    msgRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msg]);

  const payload: CaseCreatePayload = useMemo(() => {
    const n = (s: string) => (s ? Number(s) : null);
    const formatDateForPayload = (date: Date | null) => (date ? normalizeDateForPayload(date.toISOString().split('T')[0]) : null);

    return {
      divisi_case_id: n(form.divisi_case_id),
      tanggal_lapor: formatDateForPayload(form.tanggal_lapor),
      tanggal_kejadian: formatDateForPayload(form.tanggal_kejadian),
      lokasi_kejadian: form.lokasi_kejadian.trim() || null,

      jenis_case_id: n(form.jenis_case_id),
      judul_ier: form.judul_ier.trim() || null,
      tanggal_proses_ier: formatDateForPayload(form.tanggal_proses_ier),

      kerugian: parseIDR(form.kerugian),
      kerugian_by_case: parseIDR(form.kerugian_by_case),

      kronologi: form.kronologi.trim() || null,
      nama_terlapor: form.nama_terlapor.trim() || null,
      lokasi_terlapor: form.lokasi_terlapor.trim() || null,
      divisi_terlapor: form.divisi_terlapor.trim() || null,
      departemen_terlapor: form.departemen_terlapor.trim() || null,

      jenis_karyawan_terlapor_id: n(form.jenis_karyawan_terlapor_id),

      keputusan_ier: form.keputusan_ier.trim() || null,
      keputusan_final: form.keputusan_final.trim() || null,

      persentase_beban_karyawan: toNumOrNull(parsePercentage(persentaseBeban)),
      nominal_beban_karyawan: parseIDR(form.nominal_beban_karyawan),

      approval_gm_hcca: formatDateForPayload(form.approval_gm_hcca),
      approval_gm_fad: formatDateForPayload(form.approval_gm_fad),

      status_proses_id: n(form.status_proses_id),
      status_pengajuan_id: n(form.status_pengajuan_id),

      notes: form.notes.trim() || null,
      cara_mencegah: form.cara_mencegah.trim() || null,
      hrbp: form.hrbp.trim() || null,
    };
  }, [form, persentaseBeban]);

  async function handleFinalSubmit() {
    setIsConfirming(false);
    try {
      setErr(null);
      setMsg(null);
      const dateChecks: Array<{ key: keyof typeof form; label: string }> = [
        { key: "tanggal_lapor", label: "Tanggal Lapor" },
        { key: "tanggal_kejadian", label: "Tanggal Kejadian" },
        { key: "tanggal_proses_ier", label: "Tanggal Proses IER" },
        { key: "approval_gm_hcca", label: "Approval GM HC&CA" },
        { key: "approval_gm_fad", label: "Approval GM FAD" },
      ];
      for (const c of dateChecks) {
        if (c.key.startsWith("tanggal_") && !form[c.key]) {
          setErr(`${c.label} wajib diisi.`);
          return;
        }
      }


      if (!payload.divisi_case_id) {
        setErr("Divisi Case wajib dipilih.");
        return;
      }
      if (!payload.jenis_case_id) {
        setErr("Jenis Case wajib dipilih.");
        return;
      }

      setLoading(true);
      const res = await casesApi.create(payload);
      setMsg(`✅ Case tersimpan. ID Case: ${res.case_code}`);

      setForm({
        divisi_case_id: "",
        tanggal_lapor: null,
        tanggal_kejadian: null,
        lokasi_kejadian: "",

        jenis_case_id: "",
        judul_ier: "",
        tanggal_proses_ier: null,

        kerugian: "",
        kerugian_by_case: "",

        kronologi: "",
        nama_terlapor: "",
        lokasi_terlapor: "",
        divisi_terlapor: "",
        departemen_terlapor: "",

        jenis_karyawan_terlapor_id: "",

        keputusan_ier: "",
        keputusan_final: "",

        persentase_beban_karyawan: "",
        nominal_beban_karyawan: "",

        approval_gm_hcca: null,
        approval_gm_fad: null,

        status_proses_id: "",
        status_pengajuan_id: "",

        notes: "",
        cara_mencegah: "",
        hrbp: "",
      });
    } catch (e: any) {
      setErr(e?.message || "Network Error");
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    try {
      setErr(null);
      setMsg(null);
      const dateChecks: Array<{ key: keyof typeof form; label: string }> = [
        { key: "tanggal_lapor", label: "Tanggal Lapor" },
        { key: "tanggal_kejadian", label: "Tanggal Kejadian" },
        { key: "tanggal_proses_ier", label: "Tanggal Proses IER" },
        { key: "approval_gm_hcca", label: "Approval GM HC&CA" },
        { key: "approval_gm_fad", label: "Approval GM FAD" },
      ];
      for (const c of dateChecks) {
        if (c.key.startsWith("tanggal_") && !form[c.key]) {
          setErr(`${c.label} wajib diisi.`);
          return;
        }
      }


      if (!payload.divisi_case_id) {
        setErr("Divisi Case wajib dipilih.");
        return;
      }
      if (!payload.jenis_case_id) {
        setErr("Jenis Case wajib dipilih.");
        return;
      }

      setIsConfirming(true);
    } catch (e: any) {
      setErr(e?.message || "Network Error");
    }
  }

  const getMasterNameById = (masterList: MasterItem[], id: string) => {
    const numId = Number(id);
    if (!numId) return "-";
    return masterList.find((item) => item.id === numId)?.name || "-";
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Input Case</h1>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <div className="form-grid">
          <div className="field">
            <div className="field__label">Divisi Case</div>
            <select className="input" value={form.divisi_case_id} onChange={set("divisi_case_id")}>
              <option value="">-- pilih --</option>
              {masters.divisiCase.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <div className="field__label">Jenis Case</div>
            <select className="input" value={form.jenis_case_id} onChange={set("jenis_case_id")}>
              <option value="">-- pilih --</option>
              {masters.jenisCase.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <div className="field__label">Tanggal Lapor</div>
            <DatePicker
              className="input"
              dateFormat="dd-MM-yyyy"
              selected={form.tanggal_lapor}
              onChange={setDate("tanggal_lapor")}
              placeholderText="dd-mm-yyyy"
            />
          </div>

          <div className="field">
            <div className="field__label">Tanggal Kejadian</div>
            <DatePicker
              className="input"
              dateFormat="dd-MM-yyyy"
              selected={form.tanggal_kejadian}
              onChange={setDate("tanggal_kejadian")}
              placeholderText="dd-mm-yyyy"
            />
          </div>

          <div className="field">
            <div className="field__label">Lokasi Kejadian</div>
            <input className="input" value={form.lokasi_kejadian} onChange={set("lokasi_kejadian")} />
          </div>

          <div className="field">
            <div className="field__label">Judul IER</div>
            <input className="input" value={form.judul_ier} onChange={set("judul_ier")} />
          </div>

          <div className="field">
            <div className="field__label">Tanggal Proses IER</div>
            <DatePicker
              className="input"
              dateFormat="dd-MM-yyyy"
              selected={form.tanggal_proses_ier}
              onChange={setDate("tanggal_proses_ier")}
              placeholderText="dd-mm-yyyy"
            />
          </div>

          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <div className="field__label">Kronologi</div>
            <textarea className="input" rows={4} value={form.kronologi} onChange={set("kronologi")} />
          </div>

          <div className="field">
            <div className="field__label">Nama Terlapor</div>
            <input className="input" value={form.nama_terlapor} onChange={set("nama_terlapor")} />
          </div>

          <div className="field">
            <div className="field__label">Lokasi Terlapor</div>
            <input className="input" value={form.lokasi_terlapor} onChange={set("lokasi_terlapor")} />
          </div>

          <div className="field">
            <div className="field__label">Divisi Terlapor</div>
            <input className="input" value={form.divisi_terlapor} onChange={set("divisi_terlapor")} />
          </div>

          <div className="field">
            <div className="field__label">Departemen Terlapor</div>
            <input className="input" value={form.departemen_terlapor} onChange={set("departemen_terlapor")} />
          </div>

          <div className="field">
            <div className="field__label">Jenis Karyawan Terlapor</div>
            <select className="input" value={form.jenis_karyawan_terlapor_id} onChange={set("jenis_karyawan_terlapor_id")}>
              <option value="">-- pilih --</option>
              {masters.jenisKaryawan.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </div>

          {/* <div className="field" style={{ gridColumn: "1 / -1" }}>
            <div className="field__label">Keputusan IER</div>
            <textarea className="input" rows={3} value={form.keputusan_ier} onChange={set("keputusan_ier")} />
          </div>

          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <div className="field__label">Keputusan Final</div>
            <textarea className="input" rows={3} value={form.keputusan_final} onChange={set("keputusan_final")} />
          </div>

          <div className="field">
            <div className="field__label">Approval GM HC&CA (tanggal)</div>
            <DatePicker
              className="input"
              dateFormat="dd-MM-yyyy"
              selected={form.approval_gm_hcca}
              onChange={setDate("approval_gm_hcca")}
              placeholderText="dd-mm-yyyy"
            />
          </div>

          <div className="field">
            <div className="field__label">Approval GM FAD (tanggal)</div>
            <DatePicker
              className="input"
              dateFormat="dd-MM-yyyy"
              selected={form.approval_gm_fad}
              onChange={setDate("approval_gm_fad")}
              placeholderText="dd-mm-yyyy"
            />
          </div>

          <div className="field">
            <div className="field__label">Status Process</div>
            <select className="input" value={form.status_proses_id} onChange={set("status_proses_id")}>
              <option value="">-- pilih --</option>
              {masters.statusProses.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <div className="field__label">Status Pengajuan</div>
            <select className="input" value={form.status_pengajuan_id} onChange={set("status_pengajuan_id")}>
              <option value="">-- pilih --</option>
              {masters.statusPengajuan.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <div className="field__label">Notes</div>
            <textarea className="input" rows={3} value={form.notes} onChange={set("notes")} />
          </div>

          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <div className="field__label">Cara Mencegah ke depannya</div>
            <textarea className="input" rows={3} value={form.cara_mencegah} onChange={set("cara_mencegah")} />
          </div>

          <div className="field">
            <div className="field__label">HRBP</div>
            <input className="input" value={form.hrbp} onChange={set("hrbp")} />
          </div>

          <div className="field">
            <div className="field__label">Kerugian</div>
            <input
              className="input no-spinner"
              type="text"
              value={formatToIDR(form.kerugian)}
              onChange={(e) => setForm((p) => ({ ...p, kerugian: parseIDR(e.target.value)?.toString() || "" }))}
            />
          </div>

          <div className="field">
            <div className="field__label">Kerugian by Case (per individu)</div>
            <input
              className="input no-spinner"
              type="text"
              value={formatToIDR(form.kerugian_by_case)}
              onChange={(e) => setForm((p) => ({ ...p, kerugian_by_case: parseIDR(e.target.value)?.toString() || "" }))}
            />
          </div>

          <div className="field">
            <div className="field__label">Persentase Beban Karyawan</div>
            <input
              className="input no-spinner"
              type="text"
              value={persentaseBeban}
              readOnly
            />
          </div> */}

        </div>

        <div className="form-actions">
          <button className="btn btn--primary" onClick={submit} disabled={loading}>
            Submit
          </button>
        </div>

        {err && (
            <div
                ref={errRef}
                className="alert"
                style={{ margin: "0 12px 12px" }}
            >
                {err}
            </div>
        )}

        {msg && (
            <div
                ref={msgRef}
                className="alert alert--success"
                style={{ margin: "0 12px 12px" }}
            >
                {msg}
            </div>
        )}
      </div>

      {isConfirming && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          onMouseDown={(e) => {
            // klik backdrop untuk close (tapi jangan kalau klik isi modal)
            if (e.target === e.currentTarget) setIsConfirming(false);
          }}
        >
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <div>
                <h2 id="confirm-title" className="modal__title">Konfirmasi Data</h2>
                <p className="modal__subtitle">Pastikan semua data sudah benar sebelum disimpan.</p>
              </div>
              <button className="icon-btn" onClick={() => setIsConfirming(false)} aria-label="Tutup">
                ✕
              </button>
            </div>

            <div className="modal__body">
              <div className="summary-card">
                <div className="summary-card__title">Informasi Umum Kasus</div>
                <div className="summary-grid">
                  <div className="k">Divisi Case</div>
                  <div className="v">{getMasterNameById(masters.divisiCase, form.divisi_case_id)}</div>

                  <div className="k">Jenis Case</div>
                  <div className="v">{getMasterNameById(masters.jenisCase, form.jenis_case_id)}</div>

                  <div className="k">Judul IER</div>
                  <div className="v">{form.judul_ier || "-"}</div>
                </div>
              </div>

              <div className="summary-card">
                <div className="summary-card__title">Waktu & Lokasi</div>
                <div className="summary-grid">
                  <div className="k">Tanggal Lapor</div>
                  <div className="v">{form.tanggal_lapor?.toLocaleDateString("id-ID") || "-"}</div>

                  <div className="k">Tanggal Kejadian</div>
                  <div className="v">{form.tanggal_kejadian?.toLocaleDateString("id-ID") || "-"}</div>

                  <div className="k">Lokasi Kejadian</div>
                  <div className="v">{form.lokasi_kejadian || "-"}</div>

                  <div className="k">Tanggal Proses IER</div>
                  <div className="v">{form.tanggal_proses_ier?.toLocaleDateString("id-ID") || "-"}</div>
                </div>
              </div>

              <div className="summary-card">
                <div className="summary-card__title">Informasi Terlapor</div>
                <div className="summary-grid">
                  <div className="k">Nama Terlapor</div>
                  <div className="v">{form.nama_terlapor || "-"}</div>

                  <div className="k">Jenis Karyawan</div>
                  <div className="v">{getMasterNameById(masters.jenisKaryawan, form.jenis_karyawan_terlapor_id)}</div>
                </div>
              </div>

              {/* <div className="summary-card">
                <div className="summary-card__title">Detail Kerugian & Beban</div>
                <div className="summary-grid">
                  <div className="k">Kerugian</div>
                  <div className="v v--money">{formatToIDR(form.kerugian) || "-"}</div>

                  <div className="k">Kerugian by Case</div>
                  <div className="v v--money">{formatToIDR(form.kerugian_by_case) || "-"}</div>

                  <div className="k">Persentase Beban</div>
                  <div className="v v--money">{persentaseBeban || "-"}</div>
                </div>
              </div>

              <div className="summary-card">
                <div className="summary-card__title">Status</div>
                <div className="summary-grid">
                  <div className="k">Status Proses</div>
                  <div className="v">{getMasterNameById(masters.statusProses, form.status_proses_id)}</div>

                  <div className="k">Status Pengajuan</div>
                  <div className="v">{getMasterNameById(masters.statusPengajuan, form.status_pengajuan_id)}</div>
                </div>
              </div> */}
            </div>

            <div className="modal__footer">
              <button className="btn btn--ghost" onClick={() => setIsConfirming(false)} disabled={loading}>
                Periksa Lagi
              </button>
              <button className="btn btn--primary" onClick={handleFinalSubmit} disabled={loading}>
                {loading ? "Menyimpan..." : "Konfirmasi & Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
