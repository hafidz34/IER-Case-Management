import { useEffect, useMemo, useRef, useState } from "react";
import { casesApi, CaseCreatePayload } from "../api/cases";
import { masterApi, MasterItem } from "../api/master";
import { isValidDateInput, normalizeDateDisplay, normalizeDateForPayload } from "../utils/date";

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
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // ✅ untuk auto-scroll ke pesan sukses
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
    tanggal_lapor: "",
    tanggal_kejadian: "",
    lokasi_kejadian: "",

    jenis_case_id: "",
    judul_ier: "",
    tanggal_proses_ier: "",

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

    approval_gm_hcca: "",
    approval_gm_fad: "",

    status_proses_id: "",
    status_pengajuan_id: "",

    notes: "",
    cara_mencegah: "",
    hrbp: "",
  });

  const set = (k: keyof typeof form) => (e: any) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

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

    return {
      divisi_case_id: n(form.divisi_case_id),
      tanggal_lapor: normalizeDateForPayload(form.tanggal_lapor),
      tanggal_kejadian: normalizeDateForPayload(form.tanggal_kejadian),
      lokasi_kejadian: form.lokasi_kejadian.trim() || null,

      jenis_case_id: n(form.jenis_case_id),
      judul_ier: form.judul_ier.trim() || null,
      tanggal_proses_ier: normalizeDateForPayload(form.tanggal_proses_ier),

      kerugian: toNumOrNull(form.kerugian),
      kerugian_by_case: toNumOrNull(form.kerugian_by_case),

      kronologi: form.kronologi.trim() || null,
      nama_terlapor: form.nama_terlapor.trim() || null,
      lokasi_terlapor: form.lokasi_terlapor.trim() || null,
      divisi_terlapor: form.divisi_terlapor.trim() || null,
      departemen_terlapor: form.departemen_terlapor.trim() || null,

      jenis_karyawan_terlapor_id: n(form.jenis_karyawan_terlapor_id),

      keputusan_ier: form.keputusan_ier.trim() || null,
      keputusan_final: form.keputusan_final.trim() || null,

      persentase_beban_karyawan: toNumOrNull(form.persentase_beban_karyawan),
      nominal_beban_karyawan: toNumOrNull(form.nominal_beban_karyawan),

      approval_gm_hcca: normalizeDateForPayload(form.approval_gm_hcca),
      approval_gm_fad: normalizeDateForPayload(form.approval_gm_fad),

      status_proses_id: n(form.status_proses_id),
      status_pengajuan_id: n(form.status_pengajuan_id),

      notes: form.notes.trim() || null,
      cara_mencegah: form.cara_mencegah.trim() || null,
      hrbp: form.hrbp.trim() || null,
    };
  }, [form]);

  async function submit() {
    try {
      setErr(null);
      setMsg(null);
      // Validasi format tanggal (dd-mm-yyyy) untuk semua field tanggal
      const dateChecks: Array<{ key: keyof typeof form; label: string }> = [
        { key: "tanggal_lapor", label: "Tanggal Lapor" },
        { key: "tanggal_kejadian", label: "Tanggal Kejadian" },
        { key: "tanggal_proses_ier", label: "Tanggal Proses IER" },
        { key: "approval_gm_hcca", label: "Approval GM HC&CA" },
        { key: "approval_gm_fad", label: "Approval GM FAD" },
      ];
      for (const c of dateChecks) {
        if (!isValidDateInput(form[c.key])) {
          setErr(`${c.label} tidak valid. Gunakan format dd-mm-yyyy.`);
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
        tanggal_lapor: "",
        tanggal_kejadian: "",
        lokasi_kejadian: "",

        jenis_case_id: "",
        judul_ier: "",
        tanggal_proses_ier: "",

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

        approval_gm_hcca: "",
        approval_gm_fad: "",

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
            <input className="input" placeholder="dd-mm-yyyy" inputMode="numeric" value={form.tanggal_lapor} onChange={set("tanggal_lapor")} onBlur={() => setForm((p) => ({ ...p, tanggal_lapor: normalizeDateDisplay(p.tanggal_lapor) }))} />
          </div>

          <div className="field">
            <div className="field__label">Tanggal Kejadian</div>
            <input className="input" placeholder="dd-mm-yyyy" inputMode="numeric" value={form.tanggal_kejadian} onChange={set("tanggal_kejadian")} onBlur={() => setForm((p) => ({ ...p, tanggal_kejadian: normalizeDateDisplay(p.tanggal_kejadian) }))} />
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
            <input className="input" placeholder="dd-mm-yyyy" inputMode="numeric" value={form.tanggal_proses_ier} onChange={set("tanggal_proses_ier")} onBlur={() => setForm((p) => ({ ...p, tanggal_proses_ier: normalizeDateDisplay(p.tanggal_proses_ier) }))} />
          </div>

          <div className="field">
            <div className="field__label">Kerugian</div>
            <input className="input" type="number" value={form.kerugian} onChange={set("kerugian")} />
          </div>

          <div className="field">
            <div className="field__label">Kerugian by Case (per individu)</div>
            <input className="input" type="number" value={form.kerugian_by_case} onChange={set("kerugian_by_case")} />
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

          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <div className="field__label">Keputusan IER</div>
            <textarea className="input" rows={3} value={form.keputusan_ier} onChange={set("keputusan_ier")} />
          </div>

          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <div className="field__label">Keputusan Final</div>
            <textarea className="input" rows={3} value={form.keputusan_final} onChange={set("keputusan_final")} />
          </div>

          <div className="field">
            <div className="field__label">Persentase Beban Karyawan</div>
            <input className="input" type="number" step="0.001" value={form.persentase_beban_karyawan} onChange={set("persentase_beban_karyawan")} />
          </div>

          <div className="field">
            <div className="field__label">Nominal Beban Karyawan</div>
            <input className="input" type="number" value={form.nominal_beban_karyawan} onChange={set("nominal_beban_karyawan")} />
          </div>

          <div className="field">
            <div className="field__label">Approval GM HC&CA (tanggal)</div>
            <input className="input" placeholder="dd-mm-yyyy" inputMode="numeric" value={form.approval_gm_hcca} onChange={set("approval_gm_hcca")} onBlur={() => setForm((p) => ({ ...p, approval_gm_hcca: normalizeDateDisplay(p.approval_gm_hcca) }))} />
          </div>

          <div className="field">
            <div className="field__label">Approval GM FAD (tanggal)</div>
            <input className="input" placeholder="dd-mm-yyyy" inputMode="numeric" value={form.approval_gm_fad} onChange={set("approval_gm_fad")} onBlur={() => setForm((p) => ({ ...p, approval_gm_fad: normalizeDateDisplay(p.approval_gm_fad) }))} />
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
    </div>
  );
}
