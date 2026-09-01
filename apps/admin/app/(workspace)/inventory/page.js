"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { opsApi } from "../../../lib/ops-api";
import { listingApi } from "../../../lib/listing-api.js";
import { statusLabel, statusTone, gradeLabel, gradeTone, formatPrice } from "../../../lib/ui-format";
import InspectionModal from "./inspection-modal";

const COST_TYPES = ["ACQUISITION", "REFURBISHMENT", "TESTING", "PACKAGING", "SHIPPING_IN", "OTHER"];

function ItemDetailModal({ item, onClose }) {
  const [costs, setCosts] = useState(null);
  const [costType, setCostType] = useState("TESTING");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const loadCosts = useCallback(async () => {
    try {
      const payload = await opsApi.itemCosts(item.id);
      setCosts(payload.data);
    } catch (err) {
      setNotice({ kind: "error", message: err.message });
    }
  }, [item.id]);

  useEffect(() => { loadCosts(); }, [loadCosts]);

  async function addCost(event) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      await opsApi.addItemCost(item.id, { costType, amount: Number(amount), reference: reference || null });
      setAmount("");
      setReference("");
      await loadCosts();
      setNotice({ kind: "success", message: "Cost entry recorded." });
    } catch (err) {
      setNotice({ kind: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  }

  // Server-owned total: acquisition seed + appended cost entries. Never typed here.
  const totalCost = costs?.totalCost ?? item.totalCost ?? item.acquisitionCost;

  return createPortal(
    <div className="modalOverlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modalDialog wide" role="dialog" aria-modal="true" aria-labelledby="inventory-detail-title">
        <button type="button" className="modalClose" aria-label="Close" onClick={onClose}>×</button>
        <h2 id="inventory-detail-title">Inventory item</h2>
        <p>Server-owned status and identity. Cost and serial value stay private to licensed reviewers.</p>
        <dl className="detailList">
          <div><dt>Product</dt><dd><strong>{item.productName ?? "—"}</strong>{item.modelCode ? <small>{item.modelCode}</small> : null}</dd></div>
          <div><dt>Brand · Category</dt><dd>{item.brandName ?? "—"} · {item.categoryName ?? "—"}</dd></div>
          <div><dt>PCX ID</dt><dd>{item.pcxItemId ?? "—"}</dd></div>
          <div><dt>Status</dt><dd><span className={`pill ${statusTone(item.status)}`}>{statusLabel(item.status)}</span></dd></div>
          <div><dt>Condition</dt><dd><span className={`pill ${gradeTone(item.conditionGrade)}`}>{gradeLabel(item.conditionGrade)}</span>{item.currentHealthScore != null ? ` · health ${item.currentHealthScore}/100` : ""}</dd></div>
          <div><dt>Serial</dt><dd>{item.serialValue ?? "—"}</dd></div>
          <div><dt>Acquisition cost</dt><dd>{item.acquisitionCost != null ? formatPrice(item.acquisitionCost) : "—"}</dd></div>
          <div><dt>Total cost</dt><dd><strong>{totalCost != null ? formatPrice(totalCost) : "—"}</strong>{costs ? <small>seed + {costs.entries.length} allocation{Number(costs.entries.length) === 1 ? "" : "s"}</small> : null}</dd></div>
          <div><dt>Received</dt><dd>{new Date(item.receivedAt).toLocaleString()}</dd></div>
          {item.approvedAt ? <div><dt>Approved</dt><dd>{new Date(item.approvedAt).toLocaleString()}</dd></div> : null}
        </dl>

        <section className="formPanel" style={{ marginTop: "14px" }}>
          <p className="eyebrow">COST ALLOCATION</p>
          <h3>Record a cost</h3>
          {notice ? <div className={`banner ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.message}</span></div> : null}
          <form onSubmit={addCost}>
            <label><span>Cost type</span>
              <select value={costType} onChange={(e) => setCostType(e.target.value)} required>
                {COST_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label><span>Amount (৳)</span><input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></label>
            <label><span>Reference</span><input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. Battery replacement" /></label>
            <button className="primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Add cost"}</button>
          </form>
          {costs && (
            <div className="tableWrap" style={{ marginTop: "12px" }}>
              <table>
                <thead><tr><th>Type</th><th>Amount</th><th>Reference</th><th>Recorded</th></tr></thead>
                <tbody>
                  {costs.entries.length === 0 ? (
                    <tr><td colSpan={4} className="state">No allocated costs yet.</td></tr>
                  ) : costs.entries.map((c) => (
                    <tr key={c.id}>
                      <td><span className="pill">{c.costType}</span></td>
                      <td>{formatPrice(c.amount)}</td>
                      <td>{c.reference ?? "—"}</td>
                      <td>{new Date(c.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="modalActions">
          <button type="button" className="primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [detail, setDetail] = useState(null);
  const [inspectItem, setInspectItem] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await opsApi.inventory();
      setItems(payload.data);
    } catch (err) {
      setError(err.code === "UNAUTHENTICATED" ? "Sign in to manage inventory." : err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function viewItem(item) {
    setBusy(true);
    setNotice(null);
    try {
      const payload = await opsApi.inventoryItem(item.id);
      setDetail(payload.data);
    } catch (err) {
      setNotice({ kind: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function intake(event) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await opsApi.intakeInventory({
        productModelId: form.get("productModelId"),
        identifiers: [{ identifierType: "SERIAL", value: form.get("serial"), isPrimary: true }]
      });
      formElement.reset();
      setNotice({ kind: "success", message: "Physical item received and registered." });
      await load();
    } catch (err) {
      setNotice({ kind: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function createListing(item) {
    setBusy(true);
    setNotice(null);
    try {
      await listingApi.createDraft({ inventoryItemId: item.id });
      setNotice({ kind: "success", message: `Draft listing created for ${item.pcxItemId}. Publish it from the Listings page.` });
    } catch (err) {
      setNotice({ kind: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header>
        <div>
          <p className="eyebrow">OPERATIONS / INVENTORY</p>
          <h1>Inventory</h1>
          <p>Physical items received for verification, approval, and listing. Serials and cost stay private.</p>
        </div>
        <button className="refresh" type="button" onClick={load} disabled={loading}>↻ Refresh</button>
      </header>
      {error ? <div className="banner error" role="alert"><span>{error}</span></div> : null}
      {notice ? <div className={`banner ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.message}</span></div> : null}
      <section className="panel">
        {loading ? <p className="state" role="status">Loading inventory…</p> : items.length === 0 ? <p className="state">No inventory items found.</p> : (
          <div className="tableWrap">
            <table>
              <thead><tr><th>Product</th><th>PCX ID</th><th>Condition</th><th>Status</th><th>Received</th><th><span className="sr">Actions</span></th></tr></thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.productName ?? "—"}</strong><small>{item.brandName ?? "Unknown brand"} · {item.categoryName ?? "Unknown category"}</small></td>
                    <td><strong>{item.pcxItemId ?? "—"}</strong></td>
                    <td><span className={`pill ${gradeTone(item.conditionGrade)}`}>{gradeLabel(item.conditionGrade)}</span>{item.currentHealthScore != null ? <small>{item.currentHealthScore}/100</small> : null}</td>
                    <td><span className={`pill ${statusTone(item.status)}`}>{statusLabel(item.status)}</span></td>
                    <td>{new Date(item.receivedAt).toLocaleString()}</td>
                    <td>
                      <div className="actions">
                        <button type="button" disabled={busy} onClick={() => viewItem(item)}>View</button>
                        <button type="button" disabled={busy} onClick={() => setInspectItem(item)}>Inspect</button>
                        <button type="button" disabled={busy || item.status !== "APPROVED"} title={item.status !== "APPROVED" ? "Inspect and approve this item before listing" : "Create a draft listing"} onClick={() => createListing(item)}>List</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="panel formPanel">
        <p className="eyebrow">PHYSICAL INTAKE</p>
        <h2>Register an item</h2>
        <p>New items start as RECEIVED. Serial is normalized server-side and cannot be registered twice.</p>
        <form onSubmit={intake}>
          <label><span>Product model ID</span><input name="productModelId" required /></label>
          <label><span>Primary serial</span><input name="serial" required /></label>
          <button className="primary" disabled={busy || loading}>{busy ? "Registering…" : "Register item"}</button>
        </form>
      </section>
      {detail && <ItemDetailModal item={detail} onClose={() => setDetail(null)} />}
      {inspectItem && <InspectionModal item={inspectItem} onClose={() => setInspectItem(null)} />}
    </>
  );
}
