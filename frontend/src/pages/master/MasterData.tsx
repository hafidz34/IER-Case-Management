import { useCallback, useEffect, useMemo, useState } from "react";
import { masterApi, MasterItem } from "../../api/master";
import Modal from "../../components/Modal";

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
  const [editing, setEditing] = useState<MasterItem | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleting, setDeleting] = useState<MasterItem | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

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

  useEffect(() => {
    setEditing(null);
    setEditingName("");
    setDeleting(null);
  }, [active]);

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

  function openEdit(item: MasterItem) {
    setEditing(item);
    setEditingName(item.name);
  }

  async function saveEdit() {
    if (!editing) return;
    const name = editingName.trim();
    if (!name) {
      setError("Nama tidak boleh kosong.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await masterApi.update(active, editing.id, name);
      setEditing(null);
      setEditingName("");
      await refresh();
    } catch (err: any) {
      setError(err?.message || "Gagal update data");
    } finally {
      setSaving(false);
    }
  }

  function openDelete(item: MasterItem) {
    setDeleting(item);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeletingBusy(true);
    setError(null);
    try {
      await masterApi.remove(active, deleting.id);
      setDeleting(null);
      await refresh();
    } catch (err: any) {
      setError(err?.message || "Gagal hapus data");
    } finally {
      setDeletingBusy(false);
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
                <th style={{ width: 170 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} style={{ color: "var(--muted)", padding: 14 }}>
                    Loading...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ color: "var(--muted)", padding: 14 }}>
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
                    <td className="actions">
                      <button className="btn btn--sm" type="button" onClick={() => openEdit(it)}>
                        Edit
                      </button>
                      <button className="btn btn--sm btn--danger" type="button" onClick={() => openDelete(it)}>
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <Modal
          title={`Edit ${activeTab.label}`}
          onClose={() => {
            setEditing(null);
            setEditingName("");
          }}
          footer={
            <>
              <button
                className="btn btn--ghost"
                type="button"
                onClick={() => {
                  setEditing(null);
                  setEditingName("");
                }}
              >
                Batal
              </button>
              <button className="btn btn--primary" type="button" onClick={saveEdit} disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </>
          }
        >
          <div className="form-grid">
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <div className="field__label">Nama</div>
              <input
                className="input"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit();
                }}
                autoFocus
              />
              <div style={{ marginTop: 8, color: "var(--muted)" }}>
                ID: <span className="mono">#{editing.id}</span>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {deleting && (
        <Modal
          title={`Hapus ${activeTab.label}`}
          onClose={() => setDeleting(null)}
          footer={
            <>
              <button className="btn btn--ghost" type="button" onClick={() => setDeleting(null)} disabled={deletingBusy}>
                Batal
              </button>
              <button className="btn btn--danger" type="button" onClick={confirmDelete} disabled={deletingBusy}>
                {deletingBusy ? "Menghapus..." : "Hapus"}
              </button>
            </>
          }
        >
          <div>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>{deleting.name}</div>
            <div style={{ color: "var(--muted)" }}>
              ID: <span className="mono">#{deleting.id}</span>
            </div>
            <div style={{ marginTop: 12 }}>
              Data yang sudah dipakai oleh case/person biasanya tidak bisa dihapus.
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
