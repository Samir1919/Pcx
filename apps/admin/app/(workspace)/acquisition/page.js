"use client";

import { useState } from "react";
import { acquisitionApi } from "../../../lib/acquisition-api.js";

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

export default function AcquisitionPage() {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

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
      amount: Number(form.get("amount"))
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

  return (
    <>
      <header>
        <div>
          <p className="eyebrow">OPERATIONS / ACQUISITION</p>
          <h1>Acquisition</h1>
          <p>Valuation, offer, acceptance, acquisition, and payment. Agreed price and status are always server-owned.</p>
        </div>
      </header>
      <Banner notice={notice} onClose={() => setNotice(null)} />
      <div className="grid">
        <section className="panel formPanel">
          <p className="eyebrow">VALUATION</p>
          <h2>Create valuation</h2>
          <form onSubmit={createValuation}>
            <Field label="Sell request ID" name="sellRequestId" required />
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
            <Field label="Sell request ID" name="sellRequestId" required />
            <Field label="Valuation ID (optional)" name="valuationId" />
            <Field label="Amount" name="amount" type="number" min="0" step="0.01" required />
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
            <Field label="Sell request ID" name="sellRequestId" required />
            <Field label="Accepted offer ID" name="acceptedOfferId" required />
            <Field label="Seller user ID (optional)" name="sellerUserId" />
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
