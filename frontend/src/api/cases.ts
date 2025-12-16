import { api } from "./client";
import { normalizeDateDisplay, normalizeDateTimeDisplay } from "../utils/date";

export type CaseCreatePayload = {
  divisi_case_id: number | null;
  tanggal_lapor?: string | null;
  tanggal_kejadian?: string | null;
  lokasi_kejadian?: string | null;

  jenis_case_id: number | null;
  judul_ier?: string | null;
  tanggal_proses_ier?: string | null;

  kerugian?: string | number | null;
  kerugian_by_case?: string | number | null;

  kronologi?: string | null;
  nama_terlapor?: string | null;
  lokasi_terlapor?: string | null;
  divisi_terlapor?: string | null;
  departemen_terlapor?: string | null;

  jenis_karyawan_terlapor_id?: number | null;

  keputusan_ier?: string | null;
  keputusan_final?: string | null;

  persentase_beban_karyawan?: string | number | null;
  nominal_beban_karyawan?: string | number | null;

  approval_gm_hcca?: string | null;
  approval_gm_fad?: string | null;

  status_proses_id?: number | null;
  status_pengajuan_id?: number | null;

  notes?: string | null;
  cara_mencegah?: string | null;
  hrbp?: string | null;
};

export type CaseRow = {
  id: number;
  case_code: string;
  created_at: string;

  divisi_case_id: number | null;
  divisi_case_name: string | null;

  jenis_case_id: number | null;
  jenis_case_name: string | null;

  tanggal_kejadian: string | null;
  lokasi_kejadian: string | null;
  judul_ier: string | null;
  kerugian: number | null;
  nama_terlapor: string | null;

  status_proses_id: number | null;
  status_proses_name: string | null;
  status_pengajuan_id: number | null;
  status_pengajuan_name: string | null;
  tanggal_lapor: string | null;
};

function normalizeList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.value)) return data.value;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}

function toNumOrNull(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeRow(r: any): CaseRow {
  return {
    id: Number(r.id),
    case_code: String(r.case_code),
    created_at: normalizeDateTimeDisplay(String(r.created_at)),

    divisi_case_id: toNumOrNull(r.divisi_case_id),
    divisi_case_name: r.divisi_case_name ?? null,

    jenis_case_id: toNumOrNull(r.jenis_case_id),
    jenis_case_name: r.jenis_case_name ?? null,

    tanggal_kejadian: r.tanggal_kejadian ? normalizeDateDisplay(String(r.tanggal_kejadian)) : null,
    lokasi_kejadian: r.lokasi_kejadian ?? null,
    judul_ier: r.judul_ier ?? null,
    kerugian: toNumOrNull(r.kerugian),
    nama_terlapor: r.nama_terlapor ?? null,

    status_proses_id: toNumOrNull(r.status_proses_id),
    status_proses_name: r.status_proses_name ?? null,
    status_pengajuan_id: toNumOrNull(r.status_pengajuan_id),
    status_pengajuan_name: r.status_pengajuan_name ?? null,
    tanggal_lapor: r.tanggal_lapor ? normalizeDateDisplay(String(r.tanggal_lapor)) : null,
  };
}

const CASES_PATH = "/api/cases";

export const casesApi = {
  async list(): Promise<CaseRow[]> {
    const data = await api.get<any>(CASES_PATH);
    return normalizeList(data).map(normalizeRow);
  },

  async create(payload: CaseCreatePayload): Promise<CaseRow> {
    const res = await api.post<any>(CASES_PATH, payload);
    return normalizeRow(res);
  },
}