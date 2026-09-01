"use client";

import { useCallback, useEffect, useState } from "react";
import { opsApi } from "../../../lib/ops-api";
import { formatPrice } from "../../../lib/ui-format";

function Stat({ label, value }) {
  return (
    <div className="panel" style={{ padding: "22px" }}>
      <p className="eyebrow">{label}</p>
      <h2 style={{ fontSize: "34px", letterSpacing: "-1px", margin: "8px 0 0" }}>{value}</h2>
    </div>
  );
}

export default function ReportsPage() {
  const [bi, setBi] = useState(null);
  const [scheduled, setScheduled] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [biPayload, scheduledPayload] = await Promise.all([
        opsApi.biDashboard(),
        opsApi.scheduledExports()
      ]);
      setBi(biPayload.data);
      setScheduled(scheduledPayload.data ?? []);
    } catch (err) {
      setError(err.code === "UNAUTHENTICATED" ? "Sign in to view reports." : err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function download(path) {
    setNotice(null);
    try {
      if (path === "csv") await opsApi.exportOperationsCsv();
      else if (path === "ndjson") await opsApi.auditExportNdjson();
      setNotice({ kind: "success", message: "Export started." });
    } catch (err) {
      setNotice({ kind: "error", message: err.message });
    }
  }

  const revenue = bi?.revenue ?? { orderCount: 0, revenue: 0, averageOrder: 0 };
  const inventoryCost = bi?.inventoryCost ?? { totalCost: 0, acquisition: 0, allocated: 0 };

  return (
    <>
      <header>
        <div>
          <p className="eyebrow">OPERATIONS / REPORTS</p>
          <h1>Reporting &amp; exports</h1>
          <p>Business intelligence KPIs, report exports, and scheduled export runs. All values are server-derived.</p>
        </div>
        <button className="refresh" type="button" onClick={load} disabled={loading}>↻ Refresh</button>
      </header>
      {error ? <div className="banner error" role="alert"><span>{error}</span></div> : null}
      {notice ? <div className={`banner ${notice.kind}`} role="status"><span>{notice.message}</span></div> : null}
      {loading ? <p className="state" role="status">Loading reports…</p> : bi ? (
        <>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", marginBottom: "18px" }}>
            <Stat label="Orders" value={revenue.orderCount} />
            <Stat label="Revenue" value={formatPrice(revenue.revenue)} />
            <Stat label="Average order" value={formatPrice(revenue.averageOrder)} />
            <Stat label="Inventory cost" value={formatPrice(inventoryCost.totalCost)} />
          </div>
          <section className="panel">
            <div className="panelTitle">
              <div><p className="eyebrow">EXPORTS</p><h2>Download reports</h2></div>
              <div className="rowActions">
                <button className="primary" type="button" onClick={() => download("csv")}>Download CSV</button>
                <button type="button" onClick={() => download("ndjson")}>Download SIEM (NDJSON)</button>
              </div>
            </div>
            <div className="tableWrap">
              <table>
                <thead><tr><th>Report</th><th>Orders</th><th>Revenue</th><th>Tax</th><th>Shipping</th></tr></thead>
                <tbody>
                  <tr>
                    <td><strong>Operations</strong></td>
                    <td>{revenue.orderCount}</td>
                    <td>{formatPrice(revenue.revenue)}</td>
                    <td>{formatPrice(revenue.tax)}</td>
                    <td>{formatPrice(revenue.shipping)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel">
            <div className="panelTitle"><div><p className="eyebrow">SCHEDULED EXPORTS</p><h2>Recurring runs</h2></div></div>
            {scheduled.length === 0 ? <p className="state">No scheduled exports configured.</p> : (
              <div className="tableWrap">
                <table>
                  <thead><tr><th>Name</th><th>Report</th><th>Format</th><th>Cadence</th><th>Last run</th><th>Rows</th></tr></thead>
                  <tbody>
                    {scheduled.map((e) => (
                      <tr key={e.id}>
                        <td><strong>{e.name}</strong></td>
                        <td><span className="pill">{e.report}</span></td>
                        <td>{e.format}</td>
                        <td>{e.cadence}</td>
                        <td>{e.lastRunAt ? new Date(e.lastRunAt).toLocaleString() : "—"}</td>
                        <td>{e.lastRowCount ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </>
  );
}