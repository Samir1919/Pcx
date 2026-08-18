"use client";

import { useState } from "react";
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
  }

  return (
    <>
      <header>
        <div>
          <p className="eyebrow">OPERATIONS / WARRANTY</p>
          <h1>Warranty & claims</h1>
          <p>Create warranties and claims, and record typed resolutions. Status is server-owned.</p>
        </div>
      </header>
      <Banner notice={notice} onClose={() => setNotice(null)} />
      <div className="grid">
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
