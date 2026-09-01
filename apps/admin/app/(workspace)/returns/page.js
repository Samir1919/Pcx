"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { returnApi } from "../../../lib/return-api.js";

function Banner({ notice, onClose }) { if (!notice) return null; return <div className={`banner ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.message}</span><button type="button" onClick={onClose} aria-label="Dismiss message">×</button></div>; }

// Server-owned lifecycle; mirrors the return state machine for UI affordances.
// The server is the enforcement point and rejects any invalid transition.
const RETURNS_ACTIONS = {
  REQUESTED: ["approve"],
  APPROVED: ["receive"],
  RECEIVED: ["refund"]
};

const ACTION_LABEL = {
  approve: "Approve",
  receive: "Mark received",
  refund: "Settle refund"
};

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

function RefundDialog({ target, busy, onClose, onConfirm }) {
  const [amount, setAmount] = useState(target?.resolutionAmount != null ? String(target.resolutionAmount) : "");

  function submit(event) {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    onConfirm(target.id, value);
  }

  return createPortal(
    <div className="modalOverlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="modalDialog" role="dialog" aria-modal="true" aria-labelledby="refund-dialog-title" onSubmit={submit}>
        <button type="button" className="modalClose" aria-label="Close" onClick={onClose}>×</button>
        <h2 id="refund-dialog-title">Settle refund</h2>
        <p>Return <strong>{target?.id ? `${target.id.slice(0, 8)}…` : ""}</strong>. The server records every refund idempotently.</p>
        <label>
          <span>Amount</span>
          <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
        </label>
        <div className="modalActions">
          <button type="button" className="danger" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="primary" disabled={busy}>{busy ? "Settling…" : "Settle refund"}</button>
        </div>
      </form>
    </div>,
    document.body
  );
}

export default function ReturnsPage() {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [returns, setReturns] = useState([]);
  const [refundTarget, setRefundTarget] = useState(null);

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

  async function approve(id) {
    await run(() => returnApi.approve(id), setBusy, setNotice);
    await load();
  }

  async function receive(id) {
    await run(() => returnApi.receive(id), setBusy, setNotice);
    await load();
  }

  async function refund(id, amount) {
    await run(() => returnApi.refund(id, amount), setBusy, setNotice);
    setRefundTarget(null);
    await load();
  }

  function actionFor(r) {
    const key = (RETURNS_ACTIONS[r.status] ?? [])[0];
    if (!key) return null;
    return { key, label: ACTION_LABEL[key] };
  }

  return (
    <>
      <header>
        <div>
          <p className="eyebrow">OPERATIONS / RETURNS</p>
          <h1>Returns & refunds</h1>
          <p>Approve, receive, and settle refunds directly from each row. Lifecycle state is server-owned.</p>
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
              <thead><tr><th>Return</th><th>Order item</th><th>Reason</th><th>Status</th><th>Amount</th><th>Refund provider</th><th><span className="sr">Actions</span></th></tr></thead>
              <tbody>
                {returns.map((r) => {
                  const action = actionFor(r);
                  return (
                    <tr key={r.id}>
                      <td><strong>{r.id.slice(0, 8)}…</strong></td>
                      <td>{r.orderItemId.slice(0, 8)}…</td>
                      <td>{r.reasonCode}</td>
                      <td><span className="pill">{r.status}</span></td>
                      <td>{r.resolutionAmount == null ? "—" : r.resolutionAmount}</td>
                      <td>{r.refundProviderStatus ? <span className="pill">{r.refundProviderStatus}</span> : "—"}{r.refundProviderTransactionId ? <small>{r.refundProviderTransactionId.slice(0, 18)}…</small> : null}</td>
                      <td>
                        {action && (
                          <div className="actions">
                            {action.key === "refund"
                              ? <button type="button" disabled={busy} onClick={() => setRefundTarget(r)}>{action.label}</button>
                              : <button type="button" disabled={busy} onClick={() => (action.key === "approve" ? approve(r.id) : receive(r.id))}>{action.label}</button>}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {refundTarget && (
        <RefundDialog
          target={refundTarget}
          busy={busy}
          onClose={() => setRefundTarget(null)}
          onConfirm={refund}
        />
      )}
    </>
  );
}
