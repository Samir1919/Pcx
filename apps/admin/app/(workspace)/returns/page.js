"use client";

import { useCallback, useEffect, useState } from "react";
import { returnApi } from "../../../lib/return-api.js";

function Banner({ notice, onClose }) { if (!notice) return null; return <div className={`banner ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.message}</span><button type="button" onClick={onClose} aria-label="Dismiss message">×</button></div>; }
function Field({ label, name, ...props }) { return <label><span>{label}</span><input name={name} {...props} /></label>; }

async function run(action, setBusy, setNotice) {
  setBusy(true);
  setNotice(null);
  try {
    await action();
    setNotice({ kind: "success", message: "Action completed." });
  } catch (error) {
    setNotice({ kind: "error", message: error.message });
  } finally {
    setBusy(false);
  }
}

export default function ReturnsPage() {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [returns, setReturns] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await returnApi.list();
      setReturns(payload.data ?? []);
      setNotice(null);
    } catch (error) {
      setNotice({ kind: "error", message: error.status === 401 ? "Sign in to view returns." : error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function approve(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(() => returnApi.approve(form.get("returnId")), setBusy, setNotice);
    event.currentTarget.reset();
    await load();
  }

  async function receive(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(() => returnApi.receive(form.get("returnId")), setBusy, setNotice);
    event.currentTarget.reset();
    await load();
  }

  async function refund(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("amount"));
    await run(() => returnApi.refund(form.get("returnId"), amount), setBusy, setNotice);
    event.currentTarget.reset();
    await load();
  }

  return (
    <>
      <header>
        <div>
          <p className="eyebrow">OPERATIONS / RETURNS</p>
          <h1>Returns & refunds</h1>
          <p>Approve, receive, and settle refunds. Lifecycle state is server-owned.</p>
        </div>
        <button className="refresh" type="button" onClick={load} disabled={loading}>↻ Refresh</button>
      </header>
      <Banner notice={notice} onClose={() => setNotice(null)} />
      <section className="panel">
        <div className="panelTitle">
          <div>
            <p className="eyebrow">RETURNS</p>
            <h2>Recent returns</h2>
          </div>
        </div>
        {loading ? <p className="state" role="status">Loading returns…</p> : returns.length === 0 ? <p className="state">No returns yet.</p> : (
          <div className="tableWrap">
            <table>
              <thead><tr><th>Return</th><th>Order item</th><th>Reason</th><th>Status</th><th>Amount</th></tr></thead>
              <tbody>
                {returns.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.id.slice(0, 8)}…</strong></td>
                    <td>{r.orderItemId.slice(0, 8)}…</td>
                    <td>{r.reasonCode}</td>
                    <td><span className="pill">{r.status}</span></td>
                    <td>{r.resolutionAmount == null ? "—" : r.resolutionAmount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="grid" style={{ marginTop: 18 }}>
        <section className="panel formPanel">
          <p className="eyebrow">APPROVE</p>
          <h2>Approve return</h2>
          <form onSubmit={approve}>
            <Field label="Return ID" name="returnId" required />
            <button className="primary" disabled={busy}>Approve</button>
          </form>
        </section>
        <section className="panel formPanel">
          <p className="eyebrow">RECEIVE</p>
          <h2>Mark received</h2>
          <form onSubmit={receive}>
            <Field label="Return ID" name="returnId" required />
            <button className="primary" disabled={busy}>Mark received</button>
          </form>
        </section>
        <section className="panel formPanel">
          <p className="eyebrow">REFUND</p>
          <h2>Settle refund</h2>
          <form onSubmit={refund}>
            <Field label="Return ID" name="returnId" required />
            <Field label="Amount" name="amount" type="number" min="0" step="0.01" required />
            <button className="primary" disabled={busy}>Settle refund</button>
          </form>
        </section>
      </div>
    </>
  );
}
