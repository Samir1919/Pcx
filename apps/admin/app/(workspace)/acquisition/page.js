"use client";

import { useCallback, useEffect, useState } from "react";
import { acquisitionApi } from "../../../lib/acquisition-api.js";
import { catalogApi } from "../../../lib/catalog-api.js";
import SellRequestModal from "./sell-request-modal.js";
import SellFlowPanel from "./sell-flow-panel.js";
import QuoteConfigPanel from "./quote-config-panel.js";
import { sellRequestStatusLabel } from "../../../lib/sell-request-status.js";

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
  const [tab, setTab] = useState("requests");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [sellRequests, setSellRequests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [categories, setCategories] = useState([]);

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

  const loadCatalog = useCallback(async () => {
    try {
      const [cats] = await Promise.all([catalogApi.categories()]);
      setCategories(cats.data ?? []);
    } catch {
      // Sell flow / Quotes degrade gracefully without the shared catalog lists.
    }
  }, []);

  useEffect(() => { load(); loadCatalog(); }, [load, loadCatalog]);

  return (
    <>
      <header>
        <div>
          <p className="eyebrow">OPERATIONS / ACQUISITION</p>
          <h1>Acquisition</h1>
          <p>Offer, acceptance, acquisition, and payment are all available from each sell request's detail view. Agreed price and status are always server-owned. Sell flow and indicative quote ranges are configured here.</p>
        </div>
        <button className="refresh" type="button" onClick={load} disabled={loading}>↻ Refresh</button>
      </header>

      <Banner notice={notice} onClose={() => setNotice(null)} />

      <div className="tabs" role="tablist" aria-label="Acquisition sections">
        <button role="tab" aria-selected={tab === "requests"} onClick={() => setTab("requests")}>Sell requests</button>
        <button role="tab" aria-selected={tab === "sellflow"} onClick={() => setTab("sellflow")}>Sell flow</button>
        <button role="tab" aria-selected={tab === "quotes"} onClick={() => setTab("quotes")}>Quotes</button>
      </div>

      {tab === "sellflow" ? (
        <SellFlowPanel categories={categories} />
      ) : tab === "quotes" ? (
        <QuoteConfigPanel />
      ) : (
      <>
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
                    <td>{r.productModelName ?? (r.productModelId ? `${r.productModelId.slice(0, 8)}…` : "—")}</td>
                    <td><span className="pill">{sellRequestStatusLabel(r.status)}</span></td>
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
      )}
    </>
  );
}
