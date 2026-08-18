"use client";

import { useCallback, useEffect, useState } from "react";
import { warrantyApi } from "../../../lib/warranty-api.js";

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

export default function WarrantyPage() {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [warranties, setWarranties] = useState([]);
  const [claims, setClaims] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [warrantyResult, claimResult] = await Promise.all([warrantyApi.warranties(), warrantyApi.claims()]);
      setWarranties(warrantyResult.data ?? []);
      setClaims(claimResult.data ?? []);
      setNotice(null);
    } catch (error) {
      setNotice({ kind: "error", message: error.status === 401 ? "Sign in to view warranty & claims." : error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createWarranty(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(() => warrantyApi.createWarranty({
      orderItemId: form.get("orderItemId"),
      inventoryItemId: form.get("inventoryItemId"),
      policySnapshot: {},
      startsAt: form.get("startsAt"),
      endsAt: form.get("endsAt")
    }), setBusy, setNotice);
    event.currentTarget.reset();
    await load();
  }

  async function createClaim(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(() => warrantyApi.createClaim({
      warrantyId: form.get("warrantyId"),
      orderItemId: form.get("orderItemId"),
      reasonCode: form.get("reasonCode"),
      symptoms: form.get("symptoms") || null
    }), setBusy, setNotice);
    event.currentTarget.reset();
    await load();
  }

  async function resolveClaim(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(() => warrantyApi.resolveClaim({
      claimId: form.get("claimId"),
      resolutionType: form.get("resolutionType"),
      notes: form.get("notes") || null,
      costAmount: form.get("costAmount") ? Number(form.get("costAmount")) : null
    }), setBusy, setNotice);
    event.currentTarget.reset();
    await load();
  }

  return (
    <>
      <header>
        <div>
          <p className="eyebrow">OPERATIONS / WARRANTY</p>
          <h1>Warranty & claims</h1>
          <p>Create warranties and claims, and record typed resolutions. Status is server-owned.</p>
        </div>
        <button className="refresh" type="button" onClick={load} disabled={loading}>↻ Refresh</button>
      </header>
      <Banner notice={notice} onClose={() => setNotice(null)} />
      <div className="grid">
        <section className="panel">
          <div className="panelTitle">
            <div>
              <p className="eyebrow">WARRANTIES</p>
              <h2>Recent warranties</h2>
            </div>
          </div>
          {loading ? <p className="state" role="status">Loading warranties…</p> : warranties.length === 0 ? <p className="state">No warranties yet.</p> : (
            <div className="tableWrap">
              <table>
                <thead><tr><th>Warranty</th><th>Order item</th><th>Inventory</th><th>Status</th><th>Ends</th></tr></thead>
                <tbody>
                  {warranties.map((w) => (
                    <tr key={w.id}>
                      <td><strong>{w.id.slice(0, 8)}…</strong></td>
                      <td>{w.orderItemId.slice(0, 8)}…</td>
                      <td>{w.inventoryItemId.slice(0, 8)}…</td>
                      <td><span className="pill">{w.status}</span></td>
                      <td>{new Date(w.endsAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panelTitle">
            <div>
              <p className="eyebrow">CLAIMS</p>
              <h2>Recent claims</h2>
            </div>
          </div>
          {loading ? <p className="state" role="status">Loading claims…</p> : claims.length === 0 ? <p className="state">No claims yet.</p> : (
            <div className="tableWrap">
              <table>
                <thead><tr><th>Claim</th><th>Warranty</th><th>Reason</th><th>Status</th></tr></thead>
                <tbody>
                  {claims.map((c) => (
                    <tr key={c.id}>
                      <td><strong>{c.id.slice(0, 8)}…</strong></td>
                      <td>{c.warrantyId.slice(0, 8)}…</td>
                      <td>{c.reasonCode}</td>
                      <td><span className="pill">{c.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      <div className="grid" style={{ marginTop: 18 }}>
        <section className="panel formPanel">
          <p className="eyebrow">WARRANTY</p>
          <h2>Create warranty</h2>
          <form onSubmit={createWarranty}>
            <Field label="Order item ID" name="orderItemId" required />
            <Field label="Inventory item ID" name="inventoryItemId" required />
            <Field label="Starts at" name="startsAt" type="datetime-local" required />
            <Field label="Ends at" name="endsAt" type="datetime-local" required />
            <button className="primary" disabled={busy}>Create warranty</button>
          </form>
        </section>
        <section className="panel formPanel">
          <p className="eyebrow">CLAIM</p>
          <h2>Create claim</h2>
          <form onSubmit={createClaim}>
            <Field label="Warranty ID" name="warrantyId" required />
            <Field label="Order item ID" name="orderItemId" required />
            <Field label="Reason code" name="reasonCode" required />
            <Field label="Symptoms" name="symptoms" />
            <button className="primary" disabled={busy}>Create claim</button>
          </form>
        </section>
        <section className="panel formPanel">
          <p className="eyebrow">RESOLUTION</p>
          <h2>Resolve claim</h2>
          <form onSubmit={resolveClaim}>
            <Field label="Claim ID" name="claimId" required />
            <label><span>Resolution type</span><select name="resolutionType" required><option>REPAIR</option><option>REPLACE</option><option>REFUND</option><option>REJECT</option></select></label>
            <Field label="Notes" name="notes" />
            <Field label="Cost amount" name="costAmount" type="number" min="0" step="0.01" />
            <button className="primary" disabled={busy}>Resolve claim</button>
          </form>
        </section>
      </div>
    </>
  );
}
