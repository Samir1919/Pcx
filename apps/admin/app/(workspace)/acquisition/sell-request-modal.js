"use client";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { acquisitionApi } from "../../../lib/acquisition-api.js";

function Banner({ notice, onClose }) {
  if (!notice) return null;
  return (
    <div className={`banner ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>
      <span>{notice.message}</span>
      <button type="button" onClick={onClose} aria-label="Dismiss message">×</button>
    </div>
  );
}

function Field({ label, name, defaultValue, ...props }) {
  return (
    <label>
      <span>{label}</span>
      <input name={name} defaultValue={defaultValue ?? ""} {...props} />
    </label>
  );
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

function defaultOfferExpiry() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

export default function SellRequestModal({ request, onClose, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    try {
      const payload = await acquisitionApi.sellRequest(request.id);
      setDetail(payload.data);
    } catch (error) {
      setDetail(null);
      setNotice({ kind: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  }, [request.id]);

  useEffect(() => { load(); }, [load]);

  async function run(action) {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      setNotice({ kind: "success", message: "Action completed." });
      await load();
      if (onChanged) onChanged();
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  function formBody(event) {
    return new FormData(event.currentTarget);
  }

  async function createValuation(event) {
    event.preventDefault();
    const form = formBody(event);
    await run(() => acquisitionApi.createValuation({
      sellRequestId: form.get("sellRequestId"),
      valuationType: form.get("valuationType"),
      lowValue: Number(form.get("lowValue")) || null,
      highValue: Number(form.get("highValue")) || null,
      recommendedValue: Number(form.get("recommendedValue")) || null,
      inputsSnapshot: {}
    }));
    event.currentTarget.reset();
  }

  async function createOffer(event) {
    event.preventDefault();
    const form = formBody(event);
    await run(() => acquisitionApi.createOffer({
      sellRequestId: form.get("sellRequestId"),
      valuationId: form.get("valuationId") || null,
      amount: Number(form.get("amount")),
      expiresAt: form.get("expiresAt")
    }));
    event.currentTarget.reset();
  }

  async function acceptOffer(event) {
    event.preventDefault();
    const form = formBody(event);
    await run(() => acquisitionApi.acceptOffer(form.get("offerId")));
    event.currentTarget.reset();
  }

  async function createAcquisition(event) {
    event.preventDefault();
    const form = formBody(event);
    await run(() => acquisitionApi.createAcquisition({
      sellRequestId: form.get("sellRequestId"),
      acceptedOfferId: form.get("acceptedOfferId"),
      sellerUserId: form.get("sellerUserId") || null,
      sourceType: form.get("sourceType"),
      idempotencyKey: form.get("idempotencyKey")
    }));
    event.currentTarget.reset();
  }

  async function markPaid(event) {
    event.preventDefault();
    const form = formBody(event);
    await run(() => acquisitionApi.markAcquisitionPaid(form.get("acquisitionId")));
    event.currentTarget.reset();
  }

  async function transition(toStatus) {
    await run(() => acquisitionApi.transitionSellRequest(detail.id, toStatus));
  }

  return createPortal(
    <div className="modalOverlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modalDialog wide" role="dialog" aria-modal="true" aria-labelledby="sell-request-detail-title">
        <button type="button" className="modalClose" aria-label="Close" onClick={onClose}>×</button>

        <p className="eyebrow">SELL REQUEST DETAIL</p>
        <h2 id="sell-request-detail-title">
          {detail ? (detail.publicRequestNo ?? detail.id.slice(0, 8)) : "Loading…"}
        </h2>

        <Banner notice={notice} onClose={() => setNotice(null)} />

        {loading ? (
          <p className="state">Loading sell request…</p>
        ) : !detail ? (
          <p className="state">The sell request could not be loaded.</p>
        ) : (
          <>
            <dl className="detailList">
              <div><dt>Status</dt><dd><span className="pill">{detail.status}</span></dd></div>
              <div><dt>Entry</dt><dd>{detail.sellEntry ?? "—"}</dd></div>
              <div><dt>Contact</dt><dd>{detail.contactName ?? "—"}{detail.contactPhone ? ` · ${detail.contactPhone}` : ""}{detail.contactEmail ? ` · ${detail.contactEmail}` : ""}</dd></div>
              <div><dt>Fulfilment</dt><dd>{detail.fulfilmentPreference ?? "—"}</dd></div>
              <div><dt>Submitted</dt><dd>{detail.submittedAt ? new Date(detail.submittedAt).toLocaleString() : "—"}</dd></div>
            </dl>

            {(TRANSITIONS[detail.status] ?? []).length > 0 && (
              <div className="modalActions" style={{ justifyContent: "flex-start", marginTop: 12 }}>
                {(TRANSITIONS[detail.status] ?? []).map((target) => (
                  <button key={target} type="button" disabled={busy} onClick={() => transition(target)}>→ {target}</button>
                ))}
              </div>
            )}

            {detail.declaration ? (
              <>
                <p className="eyebrow" style={{ marginTop: 16 }}>SELLER DECLARATION</p>
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
                <p className="eyebrow" style={{ marginTop: 16 }}>BUILD COMPONENTS</p>
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

            <div className="grid" style={{ marginTop: 20, gridTemplateColumns: "1fr" }}>
              <section className="panel formPanel">
                <p className="eyebrow">VALUATION</p>
                <h2>Create valuation</h2>
                <form onSubmit={createValuation}>
                  <Field label="Sell request ID" name="sellRequestId" defaultValue={detail.id} readOnly required />
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
                  <Field label="Sell request ID" name="sellRequestId" defaultValue={detail.id} readOnly required />
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
                  <Field label="Sell request ID" name="sellRequestId" defaultValue={detail.id} readOnly required />
                  <Field label="Accepted offer ID" name="acceptedOfferId" required />
                  <Field label="Seller user ID" name="sellerUserId" defaultValue={detail.userId} required />
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

            <div className="modalActions">
              <button type="button" onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
