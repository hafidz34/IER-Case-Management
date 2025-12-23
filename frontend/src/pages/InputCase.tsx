import { useEffect, useMemo, useRef, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { casesApi, CaseCreatePayload } from "../api/cases";
import { masterApi, MasterItem } from "../api/master";
import { client } from "../api/client";
import { pushToast } from "../components/ToastHost";
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

type AiCaseSuggestion = {
  divisi_case_id?: number | null;
  jenis_case_id?: number | null;
  tanggal_lapor?: string | null;
  tanggal_kejadian?: string | null;
  lokasi_kejadian?: string | null;
  judul_ier?: string | null;
  tanggal_proses_ier?: string | null;
  kerugian?: number | null;
  kronologi?: string | null;
  notes?: string | null;
  cara_mencegah?: string | null;
  hrbp?: string | null;
  persons?: Array<{
    nama?: string | null;
    divisi?: string | null;
    departemen?: string | null;
    jenis_karyawan_terlapor_id?: number | null;
  }>;
  // fields yang selalu null dari LLM diabaikan di sini
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
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [suggestionLoading, setSuggestionLoading] = useState<number | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrPreview, setOcrPreview] = useState("");
  const [pendingAiData, setPendingAiData] = useState<AiCaseSuggestion | null>(null);
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [suggestionObj, setSuggestionObj] = useState<AiCaseSuggestion>({});
  const [suggestionParseErr, setSuggestionParseErr] = useState<string | null>(null);
  const [aiDecisionPreview, setAiDecisionPreview] = useState<Record<number, { keputusan?: string; pencegahan?: string; alasan?: string[] }>>({});

  const msgRef = useRef<HTMLDivElement | null>(null);
  const errRef = useRef<HTMLDivElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

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

  const parseDateOrNull = (value: string | null | undefined) => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  };

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
        persentase_beban_karyawan: calculatePercent(p.nominal_beban_karyawan, strVal),
      }))
    );
  };

  const applyAiDataToForm = (data: AiCaseSuggestion) => {
    setForm((prev) => ({
      ...prev,
      divisi_case_id: data.divisi_case_id !== undefined && data.divisi_case_id !== null ? String(data.divisi_case_id) : prev.divisi_case_id,
      jenis_case_id: data.jenis_case_id !== undefined && data.jenis_case_id !== null ? String(data.jenis_case_id) : prev.jenis_case_id,
      tanggal_lapor: data.tanggal_lapor !== undefined ? parseDateOrNull(data.tanggal_lapor) ?? prev.tanggal_lapor : prev.tanggal_lapor,
      tanggal_kejadian: data.tanggal_kejadian !== undefined ? parseDateOrNull(data.tanggal_kejadian) ?? prev.tanggal_kejadian : prev.tanggal_kejadian,
      lokasi_kejadian: data.lokasi_kejadian !== undefined && data.lokasi_kejadian !== null ? data.lokasi_kejadian : prev.lokasi_kejadian,
      judul_ier: data.judul_ier !== undefined && data.judul_ier !== null ? data.judul_ier : prev.judul_ier,
      tanggal_proses_ier: data.tanggal_proses_ier !== undefined ? parseDateOrNull(data.tanggal_proses_ier) ?? prev.tanggal_proses_ier : prev.tanggal_proses_ier,
      kerugian: data.kerugian !== undefined && data.kerugian !== null ? data.kerugian.toString() : prev.kerugian,
      kronologi: data.kronologi !== undefined && data.kronologi !== null ? data.kronologi : prev.kronologi,
      notes: data.notes !== undefined && data.notes !== null ? data.notes : prev.notes,
      cara_mencegah: data.cara_mencegah !== undefined && data.cara_mencegah !== null ? data.cara_mencegah : prev.cara_mencegah,
      hrbp: data.hrbp !== undefined && data.hrbp !== null ? data.hrbp : prev.hrbp,
      // bidang yang selalu null (kerugian_by_case, approvals) dibiarkan seperti sebelumnya
    }));
    if (Array.isArray(data.persons) && data.persons.length > 0) {
      setPersons(
        data.persons.map((p) => ({
          nama: p.nama ?? "",
          lokasi: "",
          divisi: p.divisi ?? "",
          departemen: p.departemen ?? "",
          jenis_karyawan_terlap_id: p.jenis_karyawan_terlapor_id ? String(p.jenis_karyawan_terlapor_id) : "",
          keputusan_ier: "",
          keputusan_final: "",
          persentase_beban_karyawan: "",
          nominal_beban_karyawan: "",
        }))
      );
    }
    setMsg("Form terisi otomatis oleh AI. Silakan periksa kembali sebelum menyimpan.");
  };

  const openOcrModal = (text: string, data: AiCaseSuggestion) => {
    setOcrPreview(text || "");
    setPendingAiData(data);
    setSuggestionObj(data || {});
    setSuggestionParseErr(null);
    setShowOcrModal(true);
  };

  const handleBeritaAcaraUpload = async (files: File[]) => {
    try {
      setErr(null);
      setMsg(null);
      setOcrLoading(true);
      const formData = new FormData();
      files.forEach((f) => formData.append("file", f));

      const json = await client.post<any>("/ai/upload-berita-acara", formData);
      const data: AiCaseSuggestion = (json?.data ?? json) || {};
      const text = (json?.text as string) || "";
      openOcrModal(text, data);
    } catch (e: any) {
      setErr(e?.message || "Gagal memproses Berita Acara");
      pushToast(e?.message || "Layanan AI sedang tidak tersedia. Coba lagi nanti.");
    } finally {
      setOcrLoading(false);
    }
  };

  const handleUploadInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []) as File[];
    if (files.length > 0) {
      handleBeritaAcaraUpload(files);
    }
    e.target.value = "";
  };

  const confirmOcrToForm = () => {
    if (!suggestionObj || Object.keys(suggestionObj).length === 0) {
      setSuggestionParseErr("Suggestion kosong. Coba ulangi upload.");
      return;
    }
    setSuggestionParseErr(null);
    applyAiDataToForm(suggestionObj);
    setShowOcrModal(false);
    setMsg("Form terisi otomatis dari Berita Acara. Silakan periksa kembali sebelum menyimpan.");
  };

  async function handleAiPrefill() {
    if (!aiPrompt.trim()) {
      setErr("Masukkan deskripsi sebelum meminta AI.");
      return;
    }
    try {
      setErr(null);
      setMsg(null);
      setAiLoading(true);
      const json = await client.post<any>("/ai/prefill-case", { prompt: aiPrompt });
      const data: AiCaseSuggestion = (json?.data ?? json) || {};
      applyAiDataToForm(data);
      setShowAiModal(false);
    } catch (e: any) {
      setErr(e?.message || "Gagal mengambil saran AI");
      pushToast(e?.message || "Layanan AI sedang tidak tersedia. Coba lagi nanti.");
    } finally {
      setAiLoading(false);
    }
  }

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
        const [divisiCase, jenisCase, jenisKaryawan, statusProses, statusPengajuan] = await Promise.all([
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
    const formatDateForPayload = (date: Date | null) => (date ? normalizeDateForPayload(date.toISOString().split("T")[0]) : null);

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

  // Minta saran AI untuk keputusan IER
  async function handleAskAiSuggestion(index: number) {
    // 1. Validasi Input Dasar
    if (!form.kronologi || form.kronologi.trim().length < 10) {
      setErr("Mohon isi Kronologi dengan lengkap terlebih dahulu.");
      return;
    }
    if (!form.jenis_case_id) {
      setErr("Mohon pilih Jenis Case terlebih dahulu.");
      return;
    }

    try {
      setSuggestionLoading(index); 
      setErr(null);

      const jenisCaseName = masters.jenisCase.find((x) => x.id === Number(form.jenis_case_id))?.name || "-";

      const payload = {
        kronologi: form.kronologi,
        kerugian: form.kerugian || "0",
        jenis_case: jenisCaseName,
      };

      // Panggil API
      const res = await client.post<any>("/ai/suggest-decision", payload);
      
      // Cukup ambil res.data, jangan res.data.data
      const data = res.data || {}; 

      console.log("AI Response:", data); // Debugging: Cek di console browser

      // 4. Update Form
      const newPersons = [...persons];
      
      // Pastikan ada isinya sebelum update
      if (data.saran_keputusan) {
        newPersons[index].keputusan_ier = data.saran_keputusan;
      }
      setPersons(newPersons);
      setAiDecisionPreview((prev) => ({
        ...prev,
        [index]: { keputusan: data.saran_keputusan, pencegahan: data.saran_pencegahan, alasan: Array.isArray(data.alasan) ? data.alasan : [] },
      }));

      // Update Cara Mencegah jika ada dan form masih kosong
      if (data.saran_pencegahan && !form.cara_mencegah) {
        setForm((prev) => ({ ...prev, cara_mencegah: data.saran_pencegahan }));
        setMsg("Saran Keputusan & Pencegahan berhasil diterapkan!");
      } else if (data.saran_keputusan) {
        setMsg("Saran Keputusan berhasil diterapkan!");
      } else {
        setErr("AI tidak memberikan saran. Coba perjelas kronologi.");
      }

    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Gagal meminta saran AI");
      pushToast(e?.message || "Layanan AI sedang tidak tersedia. Coba lagi nanti.");
    } finally {
      setSuggestionLoading(null);
    }
  }

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

      for (const [i, p] of persons.entries()) {
        if (!p.nama.trim()) {
          setErr(`Nama Terlapor #${i + 1} wajib diisi.`);
          return;
        }
        if (!p.divisi.trim()) {
          setErr(`Divisi Terlapor #${i + 1} wajib dipilih.`);
          return;
        }
        if (!p.jenis_karyawan_terlap_id.trim()) {
          setErr(`Jenis Karyawan Terlapor #${i + 1} wajib dipilih.`);
          return;
        }
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
      <div
        className="page-header"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "stretch", gap: 12, flexWrap: "wrap" }}
      >
        <h1 className="page-title" style={{ margin: 0 }}>
          Input Case
        </h1>
        <input ref={uploadInputRef} type="file" accept=".pdf,application/pdf,image/*" multiple style={{ display: "none" }} onChange={handleUploadInputChange} />
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn btn--primary" type="button" onClick={() => uploadInputRef.current?.click()} disabled={ocrLoading}>
            {ocrLoading ? "Memproses..." : "OCR PDF/Gambar (multi)"}
          </button>
        </div>
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
            <DatePicker className="input" dateFormat="dd-MM-yyyy" selected={form.tanggal_lapor} onChange={setDate("tanggal_lapor")} placeholderText="dd-mm-yyyy" />
          </div>

          <div className="field">
            <div className="field__label">Tanggal Kejadian</div>
            <DatePicker className="input" dateFormat="dd-MM-yyyy" selected={form.tanggal_kejadian} onChange={setDate("tanggal_kejadian")} placeholderText="dd-mm-yyyy" />
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
            <DatePicker className="input" dateFormat="dd-MM-yyyy" selected={form.tanggal_proses_ier} onChange={setDate("tanggal_proses_ier")} placeholderText="dd-mm-yyyy" />
          </div>

          {/* MENAMBAHKAN INPUT KERUGIAN YANG SEBELUMNYA HILANG */}
          <div className="field">
            <div className="field__label">Kerugian (Rp)</div>
            <input className="input" value={formatToIDR(form.kerugian)} onChange={handleKerugianChange} placeholder="Rp 0" />
          </div>

          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <div className="field__label">Kronologi</div>
            <textarea className="input" rows={4} value={form.kronologi} onChange={set("kronologi")} />
          </div>
        </div>

        <div
          style={{
            margin: "16px 12px 8px",
            padding: "16px",
            border: "1px solid #e3e3e3",
            borderRadius: 8,
            background: "#f7f9fb",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Prompt to Form (AI)</div>
            <div style={{ color: "#4b5563", fontSize: "0.95rem" }}>Masukkan deskripsi singkat kasus untuk mengisi form otomatis. Data terlapor tetap diisi manual.</div>
          </div>
          <button className="btn btn--primary" type="button" onClick={() => setShowAiModal(true)}>
            Gunakan AI
          </button>
        </div>

        {/* UI Dinamis untuk Daftar Orang */}
        <div style={{ padding: "0 12px" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginTop: 24, marginBottom: 12 }}>Informasi Terlapor</h2>
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
                  <input className="input" value={person.nama} onChange={(e) => handlePersonChange(index, "nama", e.target.value)} />
                </div>
                <div className="field">
                  <div className="field__label">Lokasi Terlapor</div>
                  <input className="input" value={person.lokasi} onChange={(e) => handlePersonChange(index, "lokasi", e.target.value)} />
                </div>
                <div className="field">
                  <div className="field__label">Divisi Terlapor</div>
                  <select className="input" value={person.divisi} onChange={(e) => handlePersonChange(index, "divisi", e.target.value)}>
                    <option value="">-- pilih --</option>
                    {masters.divisiCase.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <div className="field__label">Departemen Terlapor</div>
                  <input className="input" value={person.departemen} onChange={(e) => handlePersonChange(index, "departemen", e.target.value)} />
                </div>
                <div className="field">
                  <div className="field__label">Jenis Karyawan Terlapor</div>
                  <select className="input" value={person.jenis_karyawan_terlap_id} onChange={(e) => handlePersonChange(index, "jenis_karyawan_terlap_id", e.target.value)}>
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
                  <input className="input" value={formatToIDR(person.nominal_beban_karyawan)} onChange={(e) => handlePersonChange(index, "nominal_beban_karyawan", parseIDR(e.target.value)?.toString() ?? "")} />
                </div>

                {/* INPUT PERSENTASE BARU (READ ONLY) */}
                <div className="field">
                  <div className="field__label">Persentase Beban (%)</div>
                  <input className="input" value={person.persentase_beban_karyawan} readOnly style={{ backgroundColor: "#e9ecef", cursor: "not-allowed" }} placeholder="Otomatis..." />
                </div>

                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div className="field__label" style={{ margin: 0 }}>Keputusan IER</div>
                    <button
                      type="button"
                      className="btn btn--primary"
                      style={{ fontSize: "0.8rem", padding: "6px 12px", borderRadius: 9999 }}
                      onClick={() => handleAskAiSuggestion(index)}
                      disabled={suggestionLoading === index}
                    >
                      {suggestionLoading === index ? "Memproses..." : "Minta Saran AI"}
                    </button>
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "#6b7280", marginBottom: 6 }}>Gunakan tombol di kanan untuk memuat draft keputusan otomatis, lalu sesuaikan manual jika perlu.</div>
                  <textarea className="input" rows={2} value={person.keputusan_ier} onChange={(e) => handlePersonChange(index, "keputusan_ier", e.target.value)} />
                  {aiDecisionPreview[index]?.keputusan && (
                    <div className="panel" style={{ marginTop: 8, padding: 10, background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>Detail Alasan AI</div>
                      <div style={{ marginBottom: 6 }}><strong>Keputusan:</strong> {aiDecisionPreview[index]?.keputusan}</div>
                      {aiDecisionPreview[index]?.alasan && aiDecisionPreview[index]!.alasan!.length > 0 && (
                        <div style={{ marginBottom: 6 }}>
                          <strong>Alasan:</strong>
                          <ul style={{ margin: "4px 0 0 18px" }}>
                            {aiDecisionPreview[index]!.alasan!.map((a, i) => (
                              <li key={i} style={{ marginBottom: 2 }}>{a}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {aiDecisionPreview[index]?.pencegahan && (
                        <div><strong>Pencegahan:</strong> {aiDecisionPreview[index]?.pencegahan}</div>
                      )}
                    </div>
                  )}
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <div className="field__label">Keputusan Final</div>
                  <textarea className="input" rows={2} value={person.keputusan_final} onChange={(e) => handlePersonChange(index, "keputusan_final", e.target.value)} />
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
          <div ref={errRef} className="alert" style={{ margin: "0 12px 12px" }}>
            {err}
          </div>
        )}

        {msg && (
          <div ref={msgRef} className="alert alert--success" style={{ margin: "0 12px 12px" }}>
            {msg}
          </div>
        )}
      </div>

      {showAiModal && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowAiModal(false);
          }}
        >
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <div>
                <h2 id="ai-title" className="modal__title">
                  Gunakan AI
                </h2>
                <p className="modal__subtitle">Isi deskripsi singkat kasus. AI hanya mengisi info kasus, tidak menyentuh data Terlapor.</p>
              </div>
            </div>
            <div className="modal__body">
              <label className="field__label" htmlFor="ai-prompt">
                Deskripsi kasus
              </label>
              <textarea id="ai-prompt" className="input" rows={5} value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="Contoh: Terdapat kasus di divisi ABC pada 2 Februari 2026..." />
              <div style={{ marginTop: 8, fontSize: "0.9rem", color: "#555" }}>
                Catatan: Deskripsi kasus dianjurkan berisi informasi pendukung seperti divisi dan jenis kasus, tanggal lapor, tanggal kejadian, lokasi kejadian, tanggal proses, serta estimasi kerugian untuk memudahkan klasifikasi dan
                peninjauan.
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn--ghost" onClick={() => setShowAiModal(false)} disabled={aiLoading}>
                Batal
              </button>
              <button className="btn btn--primary" onClick={handleAiPrefill} disabled={aiLoading}>
                {aiLoading ? "Memproses..." : "Generate & Isi"}
              </button>
            </div>
          </div>
        </div>
      )}

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
                <h2 id="confirm-title" className="modal__title">
                  Konfirmasi Data
                </h2>
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
                      <div className="k">Keputusan IER</div>
                      <div className="v">{p.keputusan_ier || "-"}</div>
                      <div className="k">Keputusan Final</div>
                      <div className="v">{p.keputusan_final || "-"}</div>
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

      {showOcrModal && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ocr-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowOcrModal(false);
          }}
        >
          <div className="modal" onMouseDown={(e) => e.stopPropagation()} style={{ width: "min(900px, 95vw)" }}>
            <div className="modal__header">
              <div>
                <h2 id="ocr-title" className="modal__title">
                  Hasil OCR Berita Acara
                </h2>
                <p className="modal__subtitle">Tinjau dan koreksi teks jika perlu sebelum mengisi form.</p>
              </div>
              <button className="icon-btn" onClick={() => setShowOcrModal(false)} aria-label="Tutup">
                ✕
              </button>
            </div>
            <div className="modal__body">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
                <div className="field">
                  <div className="field__label">Teks OCR</div>
                  <textarea
                    className="input"
                    rows={14}
                    value={ocrPreview}
                    onChange={(e) => setOcrPreview(e.target.value)}
                    style={{ fontFamily: "monospace", whiteSpace: "pre-wrap" }}
                  />
                </div>
                <div className="field">
                  <div className="field__label">Suggestion (kolom)</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8, marginBottom: "16px" }}>
                    <select
                      className="input"
                      value={suggestionObj.divisi_case_id ?? ""}
                      onChange={(e) => setSuggestionObj((p) => ({ ...p, divisi_case_id: toNumOrNull(e.target.value) }))}
                    >
                      <option value="">-- pilih Divisi Case --</option>
                      {masters.divisiCase.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="input"
                      value={suggestionObj.jenis_case_id ?? ""}
                      onChange={(e) => setSuggestionObj((p) => ({ ...p, jenis_case_id: toNumOrNull(e.target.value) }))}
                    >
                      <option value="">-- pilih Jenis Case --</option>
                      {masters.jenisCase.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                    <input className="input" placeholder="Tanggal Lapor (YYYY-MM-DD)" value={suggestionObj.tanggal_lapor ?? ""} onChange={(e) => setSuggestionObj((p) => ({ ...p, tanggal_lapor: e.target.value }))} />
                    <input className="input" placeholder="Tanggal Kejadian (YYYY-MM-DD)" value={suggestionObj.tanggal_kejadian ?? ""} onChange={(e) => setSuggestionObj((p) => ({ ...p, tanggal_kejadian: e.target.value }))} />
                    <input className="input" placeholder="Lokasi Kejadian" value={suggestionObj.lokasi_kejadian ?? ""} onChange={(e) => setSuggestionObj((p) => ({ ...p, lokasi_kejadian: e.target.value }))} />
                    <input className="input" placeholder="Judul IER" value={suggestionObj.judul_ier ?? ""} onChange={(e) => setSuggestionObj((p) => ({ ...p, judul_ier: e.target.value }))} />
                    <input className="input" placeholder="Tanggal Proses IER (YYYY-MM-DD)" value={suggestionObj.tanggal_proses_ier ?? ""} onChange={(e) => setSuggestionObj((p) => ({ ...p, tanggal_proses_ier: e.target.value }))} />
                    <input className="input" placeholder="Kerugian" value={suggestionObj.kerugian ?? ""} onChange={(e) => setSuggestionObj((p) => ({ ...p, kerugian: toNumOrNull(e.target.value) }))} />
                    <textarea className="input" rows={3} placeholder="Kronologi" value={suggestionObj.kronologi ?? ""} onChange={(e) => setSuggestionObj((p) => ({ ...p, kronologi: e.target.value }))} />
                    <textarea className="input" rows={2} placeholder="Notes" value={suggestionObj.notes ?? ""} onChange={(e) => setSuggestionObj((p) => ({ ...p, notes: e.target.value }))} />
                    <textarea className="input" rows={2} placeholder="Cara Mencegah" value={suggestionObj.cara_mencegah ?? ""} onChange={(e) => setSuggestionObj((p) => ({ ...p, cara_mencegah: e.target.value }))} />
                    <input className="input" placeholder="HRBP" value={suggestionObj.hrbp ?? ""} onChange={(e) => setSuggestionObj((p) => ({ ...p, hrbp: e.target.value }))} />
                    <div style={{ marginTop: 4, fontWeight: 600 }}>Terlapor</div>
                    {(suggestionObj.persons ?? []).map((person, idx) => (
                      <div key={idx} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8, display: "grid", gap: 6 }}>
                        <input className="input" placeholder="Nama" value={person.nama ?? ""} onChange={(e) => {
                          const persons = Array.isArray(suggestionObj.persons) ? [...suggestionObj.persons] : [];
                          persons[idx] = { ...persons[idx], nama: e.target.value };
                          setSuggestionObj((p) => ({ ...p, persons }));
                        }} />
                        <select
                          className="input"
                          value={person.divisi ?? ""}
                          onChange={(e) => {
                            const persons = Array.isArray(suggestionObj.persons) ? [...suggestionObj.persons] : [];
                            persons[idx] = { ...persons[idx], divisi: e.target.value };
                            setSuggestionObj((p) => ({ ...p, persons }));
                          }}
                        >
                          <option value="">-- pilih Divisi Terlapor --</option>
                          {masters.divisiCase.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.name}
                            </option>
                          ))}
                        </select>
                        <input className="input" placeholder="Departemen Terlapor" value={person.departemen ?? ""} onChange={(e) => {
                          const persons = Array.isArray(suggestionObj.persons) ? [...suggestionObj.persons] : [];
                          persons[idx] = { ...persons[idx], departemen: e.target.value };
                          setSuggestionObj((p) => ({ ...p, persons }));
                        }} />
                        <select
                          className="input"
                          value={person.jenis_karyawan_terlapor_id ?? ""}
                          onChange={(e) => {
                            const persons = Array.isArray(suggestionObj.persons) ? [...suggestionObj.persons] : [];
                            persons[idx] = { ...persons[idx], jenis_karyawan_terlapor_id: toNumOrNull(e.target.value) };
                            setSuggestionObj((p) => ({ ...p, persons }));
                          }}
                        >
                          <option value="">-- pilih Jenis Karyawan Terlapor --</option>
                          {masters.jenisKaryawan.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        const persons = Array.isArray(suggestionObj.persons) ? [...suggestionObj.persons] : [];
                        persons.push({});
                        setSuggestionObj((p) => ({ ...p, persons }));
                      }}
                    >
                      + Tambah Terlapor
                    </button>
                
                    {suggestionParseErr && <div className="alert" style={{ marginTop: 8 }}>{suggestionParseErr}</div>}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn--ghost" onClick={() => setShowOcrModal(false)}>
                Tutup
              </button>
              <button className="btn btn--primary" onClick={confirmOcrToForm} disabled={!pendingAiData}>
                Input ke form
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
