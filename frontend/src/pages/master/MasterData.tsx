import { useCallback, useEffect, useMemo, useState } from "react";
import { masterApi, MasterItem } from "../../api/master";

const TABS = [
  { key: "jenis-case", label: "Jenis Case" },
  { key: "jenis-karyawan-terlapor", label: "Jenis Karyawan Terlapor" },
  { key: "status-proses", label: "Status Proses" },
  { key: "status-pengajuan", label: "Status Pengajuan" },
  { key: "divisi-case", label: "Divisi Case" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function MasterData() {
  const [active, setActive] = useState<TabKey>(TABS[0].key);
  const activeTab = useMemo(() => TABS.find((t) => t.key === active)!, [active]);

  const [items, setItems] = useState<MasterItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await masterApi.list(active);
      setItems(data);
    } catch (err: any) {
      setError(err?.message || "Network Error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [active]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function addItem() {
    const name = newName.trim();
    if (!name) return;

    setSaving(true);
    setError(null);
    try {
      await masterApi.create(active, name);
      setNewName("");
      await refresh();
    } catch (err: any) {
      setError(err?.message || "Gagal menambah data");
    } finally {
      setSaving(false);
    }
  }

  const segmentedWrap: React.CSSProperties = {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    padding: 10,
    borderRadius: 14,
    border: "1px solid var(--border)",
    background: "#fff",
  };

  const tabBtn = (isActive: boolean): React.CSSProperties => ({
    height: 34,
    padding: "0 12px",
    borderRadius: 12,
    border: "1px solid " + (isActive ? "#d5efdf" : "var(--border)"),
    background: isActive ? "#eaf6ef" : "#fff",
    color: isActive ? "var(--spil-green)" : "var(--text)",
    fontWeight: isActive ? 900 : 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
  });

  return (
    <div className="app-content">
      <div className="page-header">
        <h1 className="page-title">Master Data</h1>
      </div>

      <div className="panel" style={{ padding: 14 }}>
        {/* Tabs */}
        <div style={segmentedWrap}>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              style={tabBtn(t.key === active)}
            >
              {t.label}
            </button>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <span className="badge">
              Total: <span className="mono">{items.length}</span>
            </span>
          </div>
        </div>

        {/* Add Row */}
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
            marginTop: 12,
          }}
        >
          <div style={{ flex: "1 1 360px", maxWidth: 520 }}>
            <div className="field__label">Tambah item baru</div>
            <input
              className="input"
              placeholder={`Nama ${activeTab.label}...`}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addItem();
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "end" }}>
            <button
              className="btn btn--primary"
              type="button"
              onClick={addItem}
              disabled={saving || !newName.trim()}
            >
              Add
            </button>
          </div>
        </div>

        {/* Error */}
        {error && <div className="alert">{error}</div>}

        {/* List/Table */}
        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>ID</th>
                <th>Nama</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={2} style={{ color: "var(--muted)", padding: 14 }}>
                    Loading...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={2} style={{ color: "var(--muted)", padding: 14 }}>
                    Belum ada data.
                  </td>
                </tr>
              ) : (
                items.map((it) => (
                  <tr key={it.id}>
                    <td>
                      <span className="badge mono">#{it.id}</span>
                    </td>
                    <td style={{ fontWeight: 800 }}>{it.name}</td>
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
