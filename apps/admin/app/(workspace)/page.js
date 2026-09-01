"use client";

import { useCallback, useEffect, useState } from "react";
import { opsApi } from "../../lib/ops-api";
import { formatPrice } from "../../lib/ui-format";

function Stat({ label, value }) {
  return (
    <div className="panel" style={{ padding: "22px" }}>
      <p className="eyebrow">{label}</p>
      <h2 style={{ fontSize: "34px", letterSpacing: "-1px", margin: "8px 0 0" }}>{value}</h2>
    </div>
  );
}

export default function OverviewPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await opsApi.dashboard();
      setReport(payload.data);
    } catch (err) {
      setError(err.code === "UNAUTHENTICATED" ? "Sign in to view operations." : err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Background refresh keeps the dashboard current without a manual click. The
  // server remains the source of truth; this only re-reads the operations report.
  useEffect(() => {
    const timer = setInterval(() => { load(); }, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <>
      <header>
        <div>
          <p className="eyebrow">OPERATIONS / OVERVIEW</p>
          <h1>Operations dashboard</h1>
          <p>Lifecycle counts and the most recent orders and sell requests from the live database.</p>
        </div>
        <button className="refresh" type="button" onClick={load} disabled={loading}>↻ Refresh</button>
      </header>
      {error ? <div className="banner error" role="alert"><span>{error}</span></div> : null}
      {loading ? <p className="state" role="status">Loading overview…</p> : report ? (
        <>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", marginBottom: "18px" }}>
            <Stat label="Customers" value={report.counts.customers} />
            <Stat label="Listings" value={report.counts.activeListings} />
            <Stat label="Returns" value={report.counts.pendingReturns} />
            <Stat label="Open claims" value={report.counts.openClaims} />
            <Stat label="Inventory cost" value={formatPrice(report.inventoryCost?.totalCost)} />
          </div>
          <div className="grid">
            <section className="panel">
              <div className="panelTitle"><div><p className="eyebrow">RECENT ORDERS</p><h2>Latest 10</h2></div></div>
              <div className="tableWrap">
                <table>
                  <thead><tr><th>Order</th><th>Status</th><th>Total</th></tr></thead>
                  <tbody>
                    {report.recentOrders.map((o) => (
                      <tr key={o.id}><td><strong>{o.orderNo}</strong><small>{new Date(o.createdAt).toLocaleString()}</small></td><td><span className="pill">{o.status}</span></td><td>{o.totalAmount}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="panel">
              <div className="panelTitle"><div><p className="eyebrow">RECENT SELL REQUESTS</p><h2>Latest 10</h2></div></div>
              <div className="tableWrap">
                <table>
                  <thead><tr><th>Status</th><th>Category</th><th>Created</th></tr></thead>
                  <tbody>
                    {report.recentSellRequests.map((s) => (
                      <tr key={s.id}><td><span className="pill">{s.status}</span></td><td><small>{s.categoryId.slice(0, 8)}…</small></td><td>{new Date(s.createdAt).toLocaleString()}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      ) : null}
    </>
  );
}
