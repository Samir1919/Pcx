"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { acquisitionApi } from "../../../lib/acquisition-api.js";

function Banner({ notice, onClose }) { if (!notice) return null; return <div className={`banner ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.message}</span><button type="button" onClick={onClose} aria-label="Dismiss message">×</button></div>; }
function Field({ label, name, ...props }) { return <label><span>{label}</span><input name={name} {...props} /></label>; }

// UI convenience default for the offer expiry. The server remains authoritative:
// it validates the transition graph and never lets the client author status,
// price, or final offer amounts. Seven days is a safe, reversible default.
function defaultOfferExpiry() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

// Server-owned transition graph (mirrors SellRequestTransitions for UI actions).
const TRANSITIONS = {
  SUBMITTED: ["REVIEWING", "CANCELLED"],
  REVIEWING: ["INFO_REQUIRED", "INSPECTION_REQUIRED", "REJECTED", "CANCELLED"],
  INFO_REQUIRED: ["REVIEWING"],
  INSPECTION_REQUIRED: ["INSPECTING"],
  INSPECTING: ["OFFERED", "REJECTED"],
  OFFERED: ["ACCEPTED", "REJECTED_BY_SELLER", "EXPIRED"],
  ACCEPTED: ["ACQUISITION_PENDING"],
  ACQUISITION_PENDING: ["PAID"],
  PAID: ["CLOSED"]
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

export default function AcquisitionPage() {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sellRequests, setSellRequests] = useState([]);
  const [detail, setDetail] = useState(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const detailRef = useRef(null);

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

  async function createValuation(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(() => acquisitionApi.createValuation({
      sellRequestId: form.get("sellRequestId"),
      valuationType: form.get("valuationType"),
      lowValue: Number(form.get("lowValue")) || null,
      highValue: Number(form.get("highValue")) || null,
      recommendedValue: Number(form.get("recommendedValue")) || null,
      inputsSnapshot: {}
    }), setBusy, setNotice);
    event.currentTarget.reset();
  }

  async function createOffer(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(() => acquisitionApi.createOffer({
      sellRequestId: form.get("sellRequestId"),
      valuationId: form.get("valuationId") || null,
      amount: Number(form.get("amount")),
      expiresAt: form.get("expiresAt")
    }), setBusy, setNotice);
    event.currentTarget.reset();
  }

  async function acceptOffer(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(() => acquisitionApi.acceptOffer(form.get("offerId")), setBusy, setNotice);
    event.currentTarget.reset();
  }

  async function createAcquisition(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(() => acquisitionApi.createAcquisition({
      sellRequestId: form.get("sellRequestId"),
      acceptedOfferId: form.get("acceptedOfferId"),
      sellerUserId: form.get("sellerUserId") || null,
      sourceType: form.get("sourceType"),
      idempotencyKey: form.get("idempotencyKey")
    }), setBusy, setNotice);
    event.currentTarget.reset();
  }

  async function markPaid(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(() => acquisitionApi.markAcquisitionPaid(form.get("acquisitionId")), setBusy, setNotice);
    event.currentTarget.reset();
  }

  async function transition(r, toStatus) {
    setBusy(true);
    setNotice(null);
    try {
      await acquisitionApi.transitionSellRequest(r.id, toStatus);
      setNotice({ kind: "success", message: `Request ${r.publicRequestNo ?? r.id.slice(0, 8)} → ${toStatus}.` });
      await load();
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function openDetail(r) {
    setSelectedRequest(r);
    setDetailBusy(true);
    setNotice(null);
    try {
      const payload = await acquisitionApi.sellRequest(r.id);
      setDetail(payload.data);
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setDetailBusy(false);
    }
  }

  // The detail section renders below the (tall) admin queue table, so a "View"
  // click looks like a no-op unless it is scrolled into view once it commits.
  useEffect(() => {
    if (detail) {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [detail]);

  return (
    <>
      <header>
        <div>
          <p className="eyebrow">OPERATIONS / ACQUISITION</p>
          <h1>Acquisition</h1>
          <p>Valuation, offer, acceptance, acquisition, and payment. Agreed price and status are always server-owned. Indicative quote ranges are configured in Catalog → Quotes.</p>
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
                        <button type="button" disabled={detailBusy} onClick={() => openDetail(r)}>View</button>
                        {(TRANSITIONS[r.status] ?? []).map((target) => (
                          <button key={target} type="button" disabled={busy} onClick={() => transition(r, target)}>→ {target}</button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {detail ? (
        <section className="panel" style={{ marginTop: 18 }} ref={detailRef}>
          <div className="panelTitle">
            <div>
              <p className="eyebrow">SELL REQUEST DETAIL</p>
              <h2>{detail.publicRequestNo ?? detail.id.slice(0, 8)}</h2>
            </div>
            <button type="button" className="refresh" onClick={() => setDetail(null)}>Close</button>
          </div>
          <dl className="detailList">
            <div><dt>Status</dt><dd><span className="pill">{detail.status}</span></dd></div>
            <div><dt>Entry</dt><dd>{detail.sellEntry ?? "—"}</dd></div>
            <div><dt>Contact</dt><dd>{detail.contactName ?? "—"}{detail.contactPhone ? ` · ${detail.contactPhone}` : ""}{detail.contactEmail ? ` · ${detail.contactEmail}` : ""}</dd></div>
            <div><dt>Fulfilment</dt><dd>{detail.fulfilmentPreference ?? "—"}</dd></div>
            <div><dt>Submitted</dt><dd>{detail.submittedAt ? new Date(detail.submittedAt).toLocaleString() : "—"}</dd></div>
          </dl>
          {detail.declaration ? (
            <>
              <p className="eyebrow" style={{ marginTop: 12 }}>SELLER DECLARATION</p>
              <dl className="detailList">
                <div><dt>Age</dt><dd>{detail.declaration.ageEstimate ?? "—"}</dd></div>
                <div><dt>Warranty</dt><dd>{detail.declaration.warrantyRemaining ?? "—"}</dd></div>
                <div><dt>Repair</dt><dd>{detail.declaration.repairDeclared ? (detail.declaration.repairNotes ?? "Yes") : "No"}</dd></div>
                <div><dt>Box / Invoice</dt><dd>{detail.declaration.boxAvailable ? "Box" : ""}{detail.declaration.boxAvailable && detail.declaration.invoiceAvailable ? " · " : ""}{detail.declaration.invoiceAvailable ? "Invoice" : ""}{(!detail.declaration.boxAvailable && !detail.declaration.invoiceAvailable) ? "—" : ""}</dd></div>
                <div><dt>Ownership</dt><dd>{detail.declaration.ownershipDeclared ? "Confirmed" : "—"}</dd></div>
              </dl>
            </>
          ) : null}
          {detail.buildComponents?.length ? (
            <>
              <p className="eyebrow" style={{ marginTop: 12 }}>BUILD COMPONENTS</p>
              <div className="tableWrap">
                <table>
                  <thead><tr><th>Role</th><th>Model</th></tr></thead>
                  <tbody>
                    {detail.buildComponents.map((c) => (
                      <tr key={c.role}><td>{c.role}</td><td>{c.productModelId}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      <div className="grid" style={{ marginTop: 18 }}>
        <section className="panel formPanel">
          <p className="eyebrow">VALUATION</p>
          <h2>Create valuation</h2>
          <form onSubmit={createValuation}>
            <Field label="Sell request ID" name="sellRequestId" defaultValue={selectedRequest?.id ?? ""} required />
            <label><span>Valuation type</span><select name="valuationType" required><option>PRELIMINARY</option><option>POST_INSPECTION</option><option>MANUAL</option></select></label>
            <Field label="Low value" name="lowValue" type="number" min="0" />
            <Field label="High value" name="highValue" type="number" min="0" />
            <Field label="Recommended value" name="recommendedValue" type="number" min="0" />
            <button className="primary" disabled={busy}>Create valuation</button>
          </form>
        </section>
        <section className="panel formPanel">
          <p className="eyebrow">OFFER</p>
          <h2>Create offer</h2>
          <form onSubmit={createOffer}>
            <Field label="Sell request ID" name="sellRequestId" defaultValue={selectedRequest?.id ?? ""} required />
            <Field label="Valuation ID (optional)" name="valuationId" />
            <Field label="Amount" name="amount" type="number" min="0" step="0.01" required />
            <Field label="Expires at (ISO)" name="expiresAt" defaultValue={defaultOfferExpiry()} required />
            <button className="primary" disabled={busy}>Create offer</button>
          </form>
        </section>
        <section className="panel formPanel">
          <p className="eyebrow">ACCEPT</p>
          <h2>Accept offer</h2>
          <form onSubmit={acceptOffer}>
            <Field label="Offer ID" name="offerId" required />
            <button className="primary" disabled={busy}>Accept offer</button>
          </form>
        </section>
        <section className="panel formPanel">
          <p className="eyebrow">ACQUISITION</p>
          <h2>Create acquisition</h2>
          <form onSubmit={createAcquisition}>
            <Field label="Sell request ID" name="sellRequestId" defaultValue={selectedRequest?.id ?? ""} required />
            <Field label="Accepted offer ID" name="acceptedOfferId" required />
            <Field label="Seller user ID" name="sellerUserId" required />
            <label><span>Source type</span><select name="sourceType" required><option>SELL_TO_PCX</option><option>DIRECT_PURCHASE</option><option>TRADE_IN</option><option>CORPORATE</option><option>OTHER</option></select></label>
            <Field label="Idempotency key" name="idempotencyKey" required />
            <button className="primary" disabled={busy}>Create acquisition</button>
          </form>
        </section>
        <section className="panel formPanel">
          <p className="eyebrow">PAYMENT</p>
          <h2>Mark acquisition paid</h2>
          <form onSubmit={markPaid}>
            <Field label="Acquisition ID" name="acquisitionId" required />
            <button className="primary" disabled={busy}>Mark paid</button>
          </form>
        </section>
      </div>
    </>
  );
}
