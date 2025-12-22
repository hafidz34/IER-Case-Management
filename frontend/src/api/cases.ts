import { client } from "./client";
import { MasterItem } from "./master";

// --- DEFINISI TIPE DATA ---

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
  status_proses_id?: number | null;
  status_pengajuan_id?: number | null;
  notes?: string | null;
  cara_mencegah?: string | null;
  hrbp?: string | null;
  persons?: CasePersonPayload[];
  approval_gm_hcca?: string | null;
  approval_gm_fad?: string | null;
};

export interface CasePersonRow {
  id: number;
  case_id: number;
  person_seq: number;
  person_code: string;
  nama: string;
  lokasi?: string;
  divisi?: string;
  departemen?: string;
  jenis_karyawan_terlapor_id?: number;
  jenis_karyawan_terlapor?: { id: number; name: string };
  keputusan_ier?: string;
  keputusan_final?: string;
  persentase_beban_karyawan?: number;
  nominal_beban_karyawan?: number;
  approval_gm_hcca?: string;
  approval_gm_fad?: string;
}

export interface CaseRow {
  id: number;
  case_code: string;
  divisi_case_id: number;
  divisi_case?: { id: number; name: string };
  divisi_case_name?: string;
  jenis_case_id: number;
  jenis_case?: { id: number; name: string };
  jenis_case_name?: string;
  tanggal_lapor?: string;
  tanggal_kejadian?: string;
  tanggal_proses_ier?: string;
  lokasi_kejadian?: string;
  judul_ier?: string;
  kronologi?: string;
  kerugian?: number;
  kerugian_by_case?: number;
  status_proses_id?: number;
  status_proses?: { id: number; name: string };
  status_proses_name?: string;
  status_pengajuan_id?: number;
  status_pengajuan?: { id: number; name: string };
  status_pengajuan_name?: string;
  notes?: string;
  cara_mencegah?: string;
  hrbp?: string;
  persons: CasePersonRow[];
}

// --- FUNGSI API ---

export const casesApi = {
  list: async () => {
    const res = await client.get<{ value: CaseRow[] }>("/cases");
    return res.value; 
  },
  
  // Nama fungsi dikembalikan jadi 'create' (bukan createCase)
  // agar cocok dengan InputCase.tsx
  create: async (payload: CaseCreatePayload) => {
    const res = await client.post<CaseRow>("/cases", payload);
    return res;
  },

  getCase: async (id: number) => {
    const res = await client.get<CaseRow>(`/cases/${id}`);
    return res;
  },
  
  updateCase: async (id: number, payload: any) => {
    const res = await client.put<CaseRow>(`/cases/${id}`, payload);
    return res;
  },
  
  updatePerson: async (id: number, payload: any) => {
    const res = await client.put<CasePersonRow>(`/cases/persons/${id}`, payload);
    return res;
  },
  
  deleteCase: async (id: number) => {
    const res = await client.delete(`/cases/${id}`);
    return res;
  },
  
  // Fungsi download PDF
  downloadIerPdf: async (personId: number) => {
    const blob = await client.get<Blob>(`/cases/persons/${personId}/download-ier`, {
      responseType: "blob",
    });
    return blob;
  },
};