"use client";

import { useCallback, useEffect, useState } from "react";
import { acquisitionApi } from "../../../lib/acquisition-api.js";
import SellRequestModal from "./sell-request-modal.js";

function Banner({ notice, onClose }) {
  if (!notice) return null;
  return (
    <div className={`banner ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>
      <span>{notice.message}</span>
      <button type="button" onClick={onClose} aria-label="Dismiss message">×</button>
    </div>
  );
}

export default function AcquisitionPage() {
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [sellRequests, setSellRequests] = useState([]);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await acquisitionApi.sellRequests();
      setSellRequests(payload.data ?? []);
      setNotice(null);
    } catch (error) {
      setNotice({ kind: "error", message: error.status === 401 ? "Sign in to view sell requests." : error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <header>
        <div>
          <p className="eyebrow">OPERATIONS / ACQUISITION</p>
          <h1>Acquisition</h1>
          <p>Valuation, offer, acceptance, acquisition, and payment are all available from each sell request's detail view. Agreed price and status are always server-owned. Indicative quote ranges are configured in Catalog → Quotes.</p>
        </div>
        <button className="refresh" type="button" onClick={load} disabled={loading}>↻ Refresh</button>
      </header>

      <Banner notice={notice} onClose={() => setNotice(null)} />

      <section className="panel">
        <div className="panelTitle">
          <div>
            <p className="eyebrow">SELL REQUESTS</p>
            <h2>Admin queue</h2>
          </div>
        </div>
        {loading ? <p className="state" role="status">Loading sell requests…</p> : sellRequests.length === 0 ? <p className="state">No sell requests yet.</p> : (
          <div className="tableWrap">
            <table>
              <thead><tr><th>Request</th><th>Entry</th><th>Build</th><th>Model</th><th>Status</th><th>Submitted</th><th><span className="sr">Actions</span></th></tr></thead>
              <tbody>
                {sellRequests.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.publicRequestNo ?? r.id.slice(0, 8)}</strong></td>
                    <td>{r.sellEntry ?? "—"}</td>
                    <td>
                      {r.buildComponents && r.buildComponents.length > 0
                        ? r.buildComponents.map((c) => <span key={c.role} className="pill" style={{ marginRight: 4 }}>{c.role}</span>)
                        : "—"}
                    </td>
                    <td>{r.productModelId ? `${r.productModelId.slice(0, 8)}…` : "—"}</td>
                    <td><span className="pill">{r.status}</span></td>
                    <td>{r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "—"}</td>
                    <td>
                      <div className="actions">
                        <button type="button" onClick={() => setSelected(r)}>View</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected ? (
        <SellRequestModal
          request={selected}
          onClose={() => setSelected(null)}
          onChanged={() => load()}
        />
      ) : null}
    </>
  );
}
