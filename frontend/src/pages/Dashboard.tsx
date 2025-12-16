import { useEffect, useState } from "react";
import { casesApi, CaseRow } from "../api/cases";
import { displayDateOrDash } from "../utils/date";

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

export default function Dashboard() {
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      setErr(null);
      setLoading(true);
      const data = await casesApi.list();
      setRows(data);
    } catch (e: any) {
      setErr(e?.message || "Network Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
      </div>

      {err && <div className="alert">{err}</div>}

      <div className="panel" style={{ marginTop: 12 }}>
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 140 }}>ID Case</th>
                <th style={{ width: 140 }}>Divisi Case</th>
                <th style={{ width: 170 }}>Tanggal Kejadian</th>
                <th style={{ minWidth: 220 }}>Lokasi Kejadian</th>
                <th style={{ minWidth: 220 }}>Judul IER</th>
                <th className="col-money" style={{ width: 170 }}>
                  Kerugian
                </th>
                <th style={{ minWidth: 180 }}>Nama Terlapor</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 12, opacity: 0.7 }}>
                    {loading ? "Loading..." : "Belum ada case."}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.case_code}</td>
                    <td>{r.divisi_case_name ?? "-"}</td>
                    <td>{fmtDateOnly(r.tanggal_kejadian)}</td>
                    <td>{r.lokasi_kejadian ?? "-"}</td>
                    <td>{r.judul_ier ?? "-"}</td>
                    <td className="col-money">{fmtMoney(r.kerugian)}</td>
                    <td>{r.nama_terlapor ?? "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
