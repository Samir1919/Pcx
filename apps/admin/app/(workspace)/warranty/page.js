"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { warrantyApi } from "../../../lib/warranty-api.js";

function Banner({ notice, onClose }) { if (!notice) return null; return <div className={`banner ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.message}</span><button type="button" onClick={onClose} aria-label="Dismiss message">×</button></div>; }
function Field({ label, name, ...props }) { return <label><span>{label}</span><input name={name} {...props} /></label>; }

// The warranty starts now by default; the expiry is derived server-side from the
// selected policy's duration. The operator never types an expiry — the server
// owns the coverage window from the authored policy.
function defaultStart() {
  return new Date().toISOString().slice(0, 16);
}

const RESOLUTION_TYPES = ["REPAIR", "REPLACE", "REFUND", "REJECT"];

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

function ResolveClaimDialog({ claim, busy, onClose, onConfirm }) {
  const [resolutionType, setResolutionType] = useState("REPAIR");
  const [notes, setNotes] = useState("");
  const [costAmount, setCostAmount] = useState("");

  function submit(event) {
    event.preventDefault();
    onConfirm(claim.id, {
      resolutionType,
      notes: notes.trim() || null,
      costAmount: costAmount ? Number(costAmount) : null
    });
  }

  return createPortal(
    <div className="modalOverlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="modalDialog" role="dialog" aria-modal="true" aria-labelledby="resolve-claim-title" onSubmit={submit}>
        <button type="button" className="modalClose" aria-label="Close" onClick={onClose}>×</button>
        <h2 id="resolve-claim-title">Resolve claim</h2>
        <p>Claim <strong>{claim?.id ? `${claim.id.slice(0, 8)}…` : ""}</strong>. Resolution type is a manual decision; the server records the typed resolution.</p>
        <label>
          <span>Resolution type</span>
          <select value={resolutionType} onChange={(e) => setResolutionType(e.target.value)}>
            {RESOLUTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>
          <span>Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </label>
        <label>
          <span>Cost amount</span>
          <input type="number" min="0" step="0.01" value={costAmount} onChange={(e) => setCostAmount(e.target.value)} />
        </label>
        <div className="modalActions">
          <button type="button" className="danger" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="primary" disabled={busy}>{busy ? "Resolving…" : "Resolve claim"}</button>
        </div>
      </form>
    </div>,
    document.body
  );
}

export default function WarrantyPage() {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [warranties, setWarranties] = useState([]);
  const [claims, setClaims] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [resolveTarget, setResolveTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [warrantyResult, claimResult, policyResult] = await Promise.all([warrantyApi.warranties(), warrantyApi.claims(), warrantyApi.policies()]);
      setWarranties(warrantyResult.data ?? []);
      setClaims(claimResult.data ?? []);
      setPolicies(policyResult.data ?? []);
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
    const form = event.currentTarget;
    const data = new FormData(form);
    await run(() => warrantyApi.createWarranty({
      orderItemId: data.get("orderItemId"),
      inventoryItemId: data.get("inventoryItemId"),
      policyId: data.get("policyId"),
      startsAt: data.get("startsAt")
    }), setBusy, setNotice);
    form.reset();
    await load();
  }

  async function createClaim(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await run(() => warrantyApi.createClaim({
      warrantyId: data.get("warrantyId"),
      orderItemId: data.get("orderItemId"),
      reasonCode: data.get("reasonCode"),
      symptoms: data.get("symptoms") || null
    }), setBusy, setNotice);
    form.reset();
    await load();
  }

  async function resolveClaim(claimId, body) {
    await run(() => warrantyApi.resolveClaim({ claimId, ...body }), setBusy, setNotice);
    setResolveTarget(null);
    await load();
  }

  async function createPolicy(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await run(() => warrantyApi.createPolicy({
      name: data.get("name"),
      durationDays: Number(data.get("durationDays")),
      coverageSummary: data.get("coverageSummary"),
      terms: data.get("terms") || null
    }), setBusy, setNotice);
    form.reset();
    await load();
  }

  async function archivePolicy(policyId) {
    await run(() => warrantyApi.archivePolicy(policyId), setBusy, setNotice);
    await load();
  }

  async function linkInspection(claimId) {
    const inspectionId = window.prompt("Enter the inspection ID to link to this claim:");
    if (!inspectionId) return;
    await run(() => warrantyApi.linkInspection(claimId, inspectionId.trim()), setBusy, setNotice);
    await load();
  }

  async function linkShipment(claimId) {
    const shipmentId = window.prompt("Enter the return shipment (carrier pickup) ID:");
    if (!shipmentId) return;
    await run(() => warrantyApi.linkShipment(claimId, shipmentId.trim()), setBusy, setNotice);
    await load();
  }

  return (
    <>
      <header>
        <div>
          <p className="eyebrow">OPERATIONS / WARRANTY</p>
          <h1>Warranty & claims</h1>
          <p>Create warranties and claims, and resolve requested claims directly from the table. Status is server-owned.</p>
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
                      <td>{w.endsAt ? new Date(w.endsAt).toLocaleDateString() : "—"}</td>
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
                <thead><tr><th>Claim</th><th>Warranty</th><th>Reason</th><th>Inspection</th><th>Pickup</th><th>Status</th><th><span className="sr">Actions</span></th></tr></thead>
                <tbody>
                  {claims.map((c) => (
                    <tr key={c.id}>
                      <td><strong>{c.id.slice(0, 8)}…</strong></td>
                      <td>{c.warrantyId.slice(0, 8)}…</td>
                      <td>{c.reasonCode}</td>
                      <td>{c.inspectionId ? c.inspectionId.slice(0, 8) : "—"}</td>
                      <td>{c.shipmentId ? c.shipmentId.slice(0, 8) : "—"}</td>
                      <td><span className="pill">{c.status}</span></td>
                      <td>
                        {(c.status === "REQUESTED" || c.status === "IN_REVIEW") && (
                          <div className="actions">
                            {c.status === "REQUESTED" && <button type="button" disabled={busy} onClick={() => linkInspection(c.id)}>Link inspection</button>}
                            <button type="button" disabled={busy} onClick={() => linkShipment(c.id)}>Schedule pickup</button>
                            <button type="button" disabled={busy} onClick={() => setResolveTarget(c)}>Resolve</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      <section className="panel">
        <div className="panelTitle">
          <div>
            <p className="eyebrow">WARRANTY POLICIES</p>
            <h2>Authored policies</h2>
          </div>
        </div>
        {policies.length === 0 ? <p className="state">No policies authored yet.</p> : (
          <div className="tableWrap">
            <table>
              <thead><tr><th>Name</th><th>Duration</th><th>Coverage</th><th>Status</th><th><span className="sr">Actions</span></th></tr></thead>
              <tbody>
                {policies.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong></td>
                    <td>{p.durationDays} days</td>
                    <td>{p.coverageSummary}</td>
                    <td><span className="pill">{p.status}</span></td>
                    <td>{p.status === "ACTIVE" && <button type="button" disabled={busy} onClick={() => archivePolicy(p.id)}>Archive</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="panel formPanel">
        <p className="eyebrow">AUTHOR POLICY</p>
        <h2>New warranty policy</h2>
        <form onSubmit={createPolicy}>
          <Field label="Name" name="name" required />
          <Field label="Duration (days)" name="durationDays" type="number" min="1" required />
          <Field label="Coverage summary" name="coverageSummary" required />
          <Field label="Terms" name="terms" />
          <button className="primary" disabled={busy}>Author policy</button>
        </form>
      </section>
      <div className="grid" style={{ marginTop: 18 }}>
        <section className="panel formPanel">
          <p className="eyebrow">WARRANTY</p>
          <h2>Create warranty</h2>
          <form onSubmit={createWarranty}>
            <Field label="Order item ID" name="orderItemId" required />
            <Field label="Inventory item ID" name="inventoryItemId" required />
            <label>
              <span>Policy</span>
              <select name="policyId" required defaultValue="">
                <option value="" disabled>Select a policy…</option>
                {policies.filter((p) => p.status === "ACTIVE").map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.durationDays} days)</option>
                ))}
              </select>
            </label>
            <Field label="Starts at" name="startsAt" type="datetime-local" defaultValue={defaultStart()} required />
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
      </div>
      {resolveTarget && (
        <ResolveClaimDialog
          claim={resolveTarget}
          busy={busy}
          onClose={() => setResolveTarget(null)}
          onConfirm={resolveClaim}
        />
      )}
    </>
  );
}
