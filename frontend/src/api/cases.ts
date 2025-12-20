import { api } from "./client";
import { normalizeDateDisplay, normalizeDateTimeDisplay } from "../utils/date";

export type CasePersonPayload = {
  nama?: string | null;
  lokasi?: string | null;
  divisi?: string | null;
  departemen?: string | null;
  jenis_karyawan_terlapor_id?: number | null;
  keputusan_ier?: string | null;
  keputusan_final?: string | null;
  persentase_beban_karyawan?: number | null;
  nominal_beban_karyawan?: number | null;
  approval_gm_hcca?: string | null;
  approval_gm_fad?: string | null;
};

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
  persons?: CasePersonPayload[];
};

export type CasePersonRow = {
  id: number;
  case_id: number;
  nama: string | null;
  lokasi: string | null;
  divisi: string | null;
  departemen: string | null;
  jenis_karyawan_terlapor_id: number | null;
  keputusan_ier: string | null;
  keputusan_final: string | null;
  persentase_beban_karyawan: number | null;
  nominal_beban_karyawan: number | null;
  approval_gm_hcca: string | null;
  approval_gm_fad: string | null;
  created_at: string;
  jenis_karyawan_terlapor?: MasterItem | null;
};

export type MasterItem = {
  id: number;
  name: string;
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
  persons?: CasePersonRow[];
  notes: string | null;
  cara_mencegah: string | null;
  hrbp: string | null;
  divisi_case?: MasterItem | null;
  jenis_case?: MasterItem | null;
  status_proses?: MasterItem | null;
  status_pengajuan?: MasterItem | null;
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

function normalizePersonRow(p: any): CasePersonRow {
  return {
    id: Number(p.id),
    case_id: Number(p.case_id),
    nama: p.nama ?? null,
    lokasi: p.lokasi ?? null,
    divisi: p.divisi ?? null,
    departemen: p.departemen ?? null,
    jenis_karyawan_terlapor_id: toNumOrNull(p.jenis_karyawan_terlapor_id),
    keputusan_ier: p.keputusan_ier ?? null,
    keputusan_final: p.keputusan_final ?? null,
    persentase_beban_karyawan: toNumOrNull(p.persentase_beban_karyawan),
    nominal_beban_karyawan: toNumOrNull(p.nominal_beban_karyawan),
    approval_gm_hcca: p.approval_gm_hcca ? normalizeDateDisplay(String(p.approval_gm_hcca)) : null,
    approval_gm_fad: p.approval_gm_fad ? normalizeDateDisplay(String(p.approval_gm_fad)) : null,
    created_at: normalizeDateTimeDisplay(String(p.created_at)),
    jenis_karyawan_terlapor: p.jenis_karyawan_terlapor ?? null,
  };
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
    persons: Array.isArray(r.persons) ? r.persons.map(normalizePersonRow) : [],
    notes: r.notes ?? null,
    cara_mencegah: r.cara_mencegah ?? null,
    hrbp: r.hrbp ?? null,
    divisi_case: r.divisi_case ? { id: r.divisi_case.id, name: r.divisi_case.name } : null,
    jenis_case: r.jenis_case ? { id: r.jenis_case.id, name: r.jenis_case.name } : null,
    status_proses: r.status_proses ? { id: r.status_proses.id, name: r.status_proses.name } : null,
    status_pengajuan: r.status_pengajuan ? { id: r.status_pengajuan.id, name: r.status_pengajuan.name } : null,
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

  async getCase(id: number): Promise<CaseRow> {
    const res = await api.get<any>(`${CASES_PATH}/${id}`);
    return normalizeRow(res);
  },

  async updateCase(id: number, payload: Partial<CaseRow>): Promise<CaseRow> {
    const res = await api.put<any>(`${CASES_PATH}/${id}`, payload);
    return normalizeRow(res);
  },

  async updatePerson(id: number, payload: Partial<CasePersonRow>): Promise<CasePersonRow> {
    const res = await api.put<any>(`${CASES_PATH}/persons/${id}`, payload);
    return normalizePersonRow(res);
  },

  async deleteCase(id: number): Promise<{id: number }> {
    const res = await api.delete<{ status: string; id: number }>(`${CASES_PATH}/${id}`);
    return { id: res.id };
  }

}