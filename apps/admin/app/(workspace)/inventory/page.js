"use client";

import { useCallback, useEffect, useState } from "react";
import { opsApi } from "../../../lib/ops-api";

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await opsApi.inventory();
      setItems(payload.data);
    } catch (err) {
      setError(err.code === "UNAUTHENTICATED" ? "Sign in to manage inventory." : err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <header>
        <div>
          <p className="eyebrow">OPERATIONS / INVENTORY</p>
          <h1>Inventory</h1>
          <p>Physical items received for verification, approval, and listing. Serials and cost stay private.</p>
        </div>
        <button className="refresh" type="button" onClick={load} disabled={loading}>↻ Refresh</button>
      </header>
      {error ? <div className="banner error" role="alert"><span>{error}</span></div> : null}
      <section className="panel">
        {loading ? <p className="state" role="status">Loading inventory…</p> : items.length === 0 ? <p className="state">No inventory items found.</p> : (
          <div className="tableWrap">
            <table>
              <thead><tr><th>PCX ID</th><th>Model</th><th>Status</th><th>Received</th></tr></thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.pcxItemId ?? "—"}</strong><small>{item.id.slice(0, 8)}…</small></td>
                    <td>{item.productModelId.slice(0, 8)}…</td>
                    <td><span className="pill">{item.status}</span></td>
                    <td>{new Date(item.receivedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
