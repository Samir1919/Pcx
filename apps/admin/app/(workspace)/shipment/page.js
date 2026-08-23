"use client";

import { useCallback, useEffect, useState } from "react";
import { shipmentApi } from "../../../lib/shipment-api.js";

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

export default function ShipmentPage() {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await shipmentApi.list();
      setShipments(payload.data ?? []);
      setNotice(null);
    } catch (error) {
      setNotice({ kind: "error", message: error.status === 401 ? "Sign in to view shipments." : error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(() => shipmentApi.create({
      orderId: form.get("orderId"),
      courier: form.get("courier"),
      packageType: form.get("packageType") || null,
      weight: form.get("weight") ? Number(form.get("weight")) : null,
      codAmount: form.get("codAmount") ? Number(form.get("codAmount")) : null,
      shippingCharge: form.get("shippingCharge") ? Number(form.get("shippingCharge")) : null
    }), setBusy, setNotice);
    event.currentTarget.reset();
    await load();
  }

  async function ship(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const address = {
      recipientName: form.get("recipientName"),
      phone: form.get("phone"),
      line1: form.get("line1"),
      city: form.get("city"),
      postalCode: form.get("postalCode"),
      country: form.get("country") || "BD"
    };
    await run(() => shipmentApi.ship(form.get("shipmentId"), address), setBusy, setNotice);
    event.currentTarget.reset();
    await load();
  }

  async function deliver(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(() => shipmentApi.deliver(form.get("shipmentId")), setBusy, setNotice);
    event.currentTarget.reset();
    await load();
  }

  return (
    <>
      <header>
        <div>
          <p className="eyebrow">OPERATIONS / SHIPMENT</p>
          <h1>Shipment</h1>
          <p>Create, ship, and deliver. Tracking id and lifecycle state are server-owned.</p>
        </div>
        <button className="refresh" type="button" onClick={load} disabled={loading}>↻ Refresh</button>
      </header>
      <Banner notice={notice} onClose={() => setNotice(null)} />
      <section className="panel">
        <div className="panelTitle">
          <div>
            <p className="eyebrow">SHIPMENTS</p>
            <h2>Recent shipments</h2>
          </div>
        </div>
        {loading ? <p className="state" role="status">Loading shipments…</p> : shipments.length === 0 ? <p className="state">No shipments yet.</p> : (
          <div className="tableWrap">
            <table>
              <thead><tr><th>Shipment</th><th>Order</th><th>Courier</th><th>Tracking</th><th>Status</th></tr></thead>
              <tbody>
                {shipments.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.id.slice(0, 8)}…</strong></td>
                    <td>{s.orderId.slice(0, 8)}…</td>
                    <td>{s.courier}</td>
                    <td>{s.trackingId ?? "—"}</td>
                    <td><span className="pill">{s.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="grid" style={{ marginTop: 18 }}>
        <section className="panel formPanel">
          <p className="eyebrow">CREATE</p>
          <h2>New shipment</h2>
          <form onSubmit={create}>
            <Field label="Order ID" name="orderId" required />
            <Field label="Courier" name="courier" required />
            <Field label="Package type" name="packageType" required />
            <Field label="Weight" name="weight" type="number" min="0" step="any" required />
            <Field label="COD amount" name="codAmount" type="number" min="0" />
            <Field label="Shipping charge" name="shippingCharge" type="number" min="0" />
            <button className="primary" disabled={busy}>Create shipment</button>
          </form>
        </section>
        <section className="panel formPanel">
          <p className="eyebrow">SHIP</p>
          <h2>Mark shipped</h2>
          <form onSubmit={ship}>
            <Field label="Shipment ID" name="shipmentId" required />
            <Field label="Recipient name" name="recipientName" required />
            <Field label="Phone" name="phone" required />
            <Field label="Address line 1" name="line1" required />
            <Field label="City" name="city" required />
            <Field label="Postal code" name="postalCode" />
            <Field label="Country" name="country" defaultValue="BD" />
            <button className="primary" disabled={busy}>Mark shipped</button>
          </form>
        </section>
        <section className="panel formPanel">
          <p className="eyebrow">DELIVER</p>
          <h2>Mark delivered</h2>
          <form onSubmit={deliver}>
            <Field label="Shipment ID" name="shipmentId" required />
            <button className="primary" disabled={busy}>Mark delivered</button>
          </form>
        </section>
      </div>
    </>
  );
}
