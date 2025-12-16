import { useEffect, useState } from "react";
import { masterApi, MasterItem } from "../../api/master";

type Props = { kind: string };

export default function MasterPanel({ kind }: Props) {
  const [items, setItems] = useState<MasterItem[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      setErr(null);
      setLoading(true);
      const data = await masterApi.list(kind);
      setItems(data);
    } catch (e: any) {
      setErr(e?.message || "Network Error");
    } finally {
      setLoading(false);
    }
  }

  async function add() {
    const v = name.trim();
    if (!v) return;
    try {
      setErr(null);
      setLoading(true);
      await masterApi.create(kind, v);
      setName("");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Network Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [kind]);

  return (
    <div className="panel">
      <div className="panel__header">
        <h3 className="panel__title">List</h3>

        <div className="panel__add">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tambah item baru..."
          />
          <button className="btn btn--primary" onClick={add} disabled={loading}>
            Add
          </button>
          <button className="btn" onClick={load} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      {err && <div className="alert">{err}</div>}

      <ul className="list">
        {items.map((it) => (
          <li key={it.id} className="list__item">
            <span className="badge">#{it.id}</span>
            <div style={{ fontWeight: 800 }}>{it.name}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
