import { useEffect, useMemo, useRef, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { casesApi, CaseCreatePayload } from "../api/cases";
import { masterApi, MasterItem } from "../api/master";
import { normalizeDateForPayload } from "../utils/date";

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

type PersonFormState = {
  nama: string;
  lokasi: string;
  divisi: string;
  departemen: string;
  jenis_karyawan_terlap_id: string;
  keputusan_ier: string;
  keputusan_final: string;
  persentase_beban_karyawan: string;
  nominal_beban_karyawan: string;
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

    approval_gm_hcca: null as Date | null,
    approval_gm_fad: null as Date | null,

    status_proses_id: "",
    status_pengajuan_id: "",

    notes: "",
    cara_mencegah: "",
    hrbp: "",
  });

  const [persons, setPersons] = useState<PersonFormState[]>([
    {
      nama: "",
      lokasi: "",
      divisi: "",
      departemen: "",
      jenis_karyawan_terlap_id: "",
      keputusan_ier: "",
      keputusan_final: "",
      persentase_beban_karyawan: "",
      nominal_beban_karyawan: "",
    },
  ]);

  const addPerson = () => {
    setPersons([
      ...persons,
      {
        nama: "",
        lokasi: "",
        divisi: "",
        departemen: "",
        jenis_karyawan_terlap_id: "",
        keputusan_ier: "",
        keputusan_final: "",
        persentase_beban_karyawan: "",
        nominal_beban_karyawan: "",
      },
    ]);
  };

  const removePerson = (index: number) => {
    if (persons.length > 1) {
      setPersons(persons.filter((_, i) => i !== index));
    }
  };

  // Helper untuk hitung persen
  const calculatePercent = (nominalStr: string, kerugianStr: string) => {
    const nominal = parseIDR(nominalStr) || 0;
    const kerugian = parseIDR(kerugianStr) || 0;
    
    if (kerugian > 0 && nominal >= 0) {
      return ((nominal / kerugian) * 100).toFixed(2) + "%";
    }
    return "";
  };

  const handlePersonChange = (index: number, field: keyof PersonFormState, value: string) => {
    const newPersons = [...persons];
    newPersons[index][field] = value;

    // Hitung persentase otomatis jika nominal berubah
    if (field === "nominal_beban_karyawan") {
      newPersons[index].persentase_beban_karyawan = calculatePercent(value, form.kerugian);
    }

    setPersons(newPersons);
  };

  const handleKerugianChange = (e: any) => {
    const rawVal = e.target.value;
    const numVal = parseIDR(rawVal);
    const strVal = numVal !== null ? numVal.toString() : "";
    
    setForm((p) => ({ ...p, kerugian: strVal }));

    // Hitung ulang persentase semua orang karena kerugian berubah
    setPersons((prevPersons) => 
      prevPersons.map((p) => ({
        ...p,
        persentase_beban_karyawan: calculatePercent(p.nominal_beban_karyawan, strVal)
      }))
    );
  };

  const persentaseBeban = useMemo(() => {
    const kerugian = parseIDR(form.kerugian) ?? 0;
    const byCase = parseIDR(form.kerugian_by_case) ?? 0;
    if (!kerugian || kerugian <= 0 || !byCase || byCase < 0) return "";
    const pct = Math.max(0, Math.min(100, (byCase / kerugian) * 100));
    return `${pct.toFixed(0)}%`;
  }, [form.kerugian, form.kerugian_by_case]);

  useEffect(() => {}, []);

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

      approval_gm_hcca: formatDateForPayload(form.approval_gm_hcca),
      approval_gm_fad: formatDateForPayload(form.approval_gm_fad),

      status_proses_id: n(form.status_proses_id),
      status_pengajuan_id: n(form.status_pengajuan_id),

      notes: form.notes.trim() || null,
      cara_mencegah: form.cara_mencegah.trim() || null,
      hrbp: form.hrbp.trim() || null,

      persons: persons.map((p) => ({
        nama: p.nama.trim() || null,
        lokasi: p.lokasi.trim() || null,
        divisi: p.divisi.trim() || null,
        departemen: p.departemen.trim() || null,
        jenis_karyawan_terlapor_id: n(p.jenis_karyawan_terlap_id),
        keputusan_ier: p.keputusan_ier.trim() || null,
        keputusan_final: p.keputusan_final.trim() || null,
        persentase_beban_karyawan: toNumOrNull(parsePercentage(p.persentase_beban_karyawan)),
        nominal_beban_karyawan: parseIDR(p.nominal_beban_karyawan),
      })),
    };
  }, [form, persentaseBeban, persons]);

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

      if (persons.some((p) => !p.nama.trim())) {
        setErr("Nama Terlapor wajib diisi untuk setiap orang.");
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
        
        approval_gm_hcca: null,
        approval_gm_fad: null,

        status_proses_id: "",
        status_pengajuan_id: "",

        notes: "",
        cara_mencegah: "",
        hrbp: "",
      });

      setPersons([
        {
          nama: "",
          lokasi: "",
          divisi: "",
          departemen: "",
          jenis_karyawan_terlap_id: "",
          keputusan_ier: "",
          keputusan_final: "",
          persentase_beban_karyawan: "",
          nominal_beban_karyawan: "",
        },
      ]);
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

      if (persons.some((p) => !p.nama.trim())) {
        setErr("Nama Terlapor wajib diisi untuk setiap orang.");
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

          {/* MENAMBAHKAN INPUT KERUGIAN YANG SEBELUMNYA HILANG */}
          <div className="field">
            <div className="field__label">Kerugian (Rp)</div>
            <input 
              className="input" 
              value={formatToIDR(form.kerugian)} 
              onChange={handleKerugianChange} 
              placeholder="Rp 0"
            />
          </div>

          <div className="field">
            <div className="field__label">Kerugian by Case (Rp)</div>
            <input 
              className="input" 
              value={formatToIDR(form.kerugian_by_case)} 
              onChange={(e) => {
                const val = parseIDR(e.target.value)?.toString() ?? "";
                setForm(p => ({ ...p, kerugian_by_case: val }));
              }} 
              placeholder="Rp 0"
            />
          </div>

          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <div className="field__label">Kronologi</div>
            <textarea className="input" rows={4} value={form.kronologi} onChange={set("kronologi")} />
          </div>

        </div>

        {/* UI Dinamis untuk Daftar Orang */}
        <div style={{ padding: "0 12px" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginTop: 24, marginBottom: 12 }}>
            Informasi Terlapor
          </h2>
          {persons.map((person, index) => (
            <div key={index} className="panel" style={{ marginBottom: 16, padding: 16, background: "#f9f9f9" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: "1rem" }}>Terlapor #{index + 1}</h3>
                {persons.length > 1 && (
                  <button type="button" className="btn btn--danger" onClick={() => removePerson(index)}>
                    Hapus
                  </button>
                )}
              </div>
              <div className="form-grid">
                <div className="field">
                  <div className="field__label">Nama Terlapor</div>
                  <input
                    className="input"
                    value={person.nama}
                    onChange={(e) => handlePersonChange(index, "nama", e.target.value)}
                  />
                </div>
                <div className="field">
                  <div className="field__label">Lokasi Terlapor</div>
                  <input
                    className="input"
                    value={person.lokasi}
                    onChange={(e) => handlePersonChange(index, "lokasi", e.target.value)}
                  />
                </div>
                <div className="field">
                  <div className="field__label">Divisi Terlapor</div>
                  <input
                    className="input"
                    value={person.divisi}
                    onChange={(e) => handlePersonChange(index, "divisi", e.target.value)}
                  />
                </div>
                <div className="field">
                  <div className="field__label">Departemen Terlapor</div>
                  <input
                    className="input"
                    value={person.departemen}
                    onChange={(e) => handlePersonChange(index, "departemen", e.target.value)}
                  />
                </div>
                <div className="field">
                  <div className="field__label">Jenis Karyawan Terlapor</div>
                  <select
                    className="input"
                    value={person.jenis_karyawan_terlap_id}
                    onChange={(e) => handlePersonChange(index, "jenis_karyawan_terlap_id", e.target.value)}
                  >
                    <option value="">-- pilih --</option>
                    {masters.jenisKaryawan.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="field">
                  <div className="field__label">Nominal Beban Karyawan</div>
                  <input
                    className="input"
                    value={formatToIDR(person.nominal_beban_karyawan)}
                    onChange={(e) =>
                      handlePersonChange(index, "nominal_beban_karyawan", parseIDR(e.target.value)?.toString() ?? "")
                    }
                  />
                </div>

                {/* INPUT PERSENTASE BARU (READ ONLY) */}
                <div className="field">
                  <div className="field__label">Persentase Beban (%)</div>
                  <input
                    className="input"
                    value={person.persentase_beban_karyawan}
                    readOnly
                    style={{ backgroundColor: "#e9ecef", cursor: "not-allowed" }}
                    placeholder="Otomatis..."
                  />
                </div>

                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <div className="field__label">Keputusan IER</div>
                  <textarea
                    className="input"
                    rows={2}
                    value={person.keputusan_ier}
                    onChange={(e) => handlePersonChange(index, "keputusan_ier", e.target.value)}
                  />
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <div className="field__label">Keputusan Final</div>
                  <textarea
                    className="input"
                    rows={2}
                    value={person.keputusan_final}
                    onChange={(e) => handlePersonChange(index, "keputusan_final", e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
          <button type="button" className="btn" onClick={addPerson} style={{ marginTop: 8 }}>
            + Tambah Terlapor
          </button>
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
                {persons.map((p, i) => (
                  <div key={i} style={{ borderBottom: "1px solid #eee", paddingBottom: 8, marginBottom: 8 }}>
                    <div style={{ fontWeight: "bold", marginBottom: 4 }}>Terlapor #{i + 1}</div>
                    <div className="summary-grid">
                      <div className="k">Nama</div>
                      <div className="v">{p.nama || "-"}</div>
                      <div className="k">Jenis Karyawan</div>
                      <div className="v">{getMasterNameById(masters.jenisKaryawan, p.jenis_karyawan_terlap_id)}</div>
                      <div className="k">Nominal Beban</div>
                      <div className="v">{formatToIDR(p.nominal_beban_karyawan) || "-"}</div>
                      <div className="k">Persentase Beban</div>
                      <div className="v">{p.persentase_beban_karyawan || "-"}</div>
                    </div>
                  </div>
                ))}
              </div>
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