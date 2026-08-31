"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { opsApi } from "../../../lib/ops-api";
import { listingApi } from "../../../lib/listing-api.js";
import { statusLabel, statusTone, gradeLabel, gradeTone, formatPrice } from "../../../lib/ui-format";
import InspectionModal from "./inspection-modal";

function ItemDetailModal({ item, onClose }) {
  return createPortal(
    <div className="modalOverlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modalDialog" role="dialog" aria-modal="true" aria-labelledby="inventory-detail-title">
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
          <div><dt>Received</dt><dd>{new Date(item.receivedAt).toLocaleString()}</dd></div>
          {item.approvedAt ? <div><dt>Approved</dt><dd>{new Date(item.approvedAt).toLocaleString()}</dd></div> : null}
        </dl>
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
    const form = new FormData(event.currentTarget);
    try {
      await opsApi.intakeInventory({
        productModelId: form.get("productModelId"),
        identifiers: [{ identifierType: "SERIAL", value: form.get("serial"), isPrimary: true }]
      });
      event.currentTarget.reset();
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
                        <button type="button" disabled={busy} onClick={() => createListing(item)}>List</button>
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
