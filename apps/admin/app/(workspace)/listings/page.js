"use client";

import { useCallback, useEffect, useState } from "react";
import { listingApi } from "../../../lib/listing-api.js";

function slug(value) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function Banner({ notice, onClose }) { if (!notice) return null; return <div className={`banner ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.message}</span><button type="button" onClick={onClose} aria-label="Dismiss message">×</button></div>; }

export default function ListingsPage() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await listingApi.list();
      setListings(payload.data ?? []);
      setNotice(null);
    } catch (error) {
      setNotice({ kind: "error", message: error.status === 401 ? "Sign in with pricing access to manage listings." : error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createDraft(event) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await listingApi.createDraft({
        inventoryItemId: form.get("inventoryItemId"),
        publicSlug: slug(form.get("publicSlug") || "") || null
      });
      event.currentTarget.reset();
      setNotice({ kind: "success", message: "Listing draft created." });
      await load();
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function publish(listing) {
    const publicSlug = window.prompt("Publishing requires a canonical public slug", listing.publicSlug ?? "");
    if (publicSlug == null) return;
    setBusy(true);
    try {
      await listingApi.publish(listing.id, { publicSlug: slug(publicSlug) });
      setNotice({ kind: "success", message: "Listing published." });
      await load();
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function setPrice(listing) {
    const value = window.prompt(`Set listing price${listing.price ? ` (current ${listing.price})` : ""}`, listing.price ?? "");
    if (value == null) return;
    setBusy(true);
    try {
      await listingApi.setPrice({ listingId: listing.id, price: Number(value), reason: "admin-set" });
      setNotice({ kind: "success", message: "Listing price updated." });
      await load();
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header>
        <div>
          <p className="eyebrow">OPERATIONS / LISTINGS</p>
          <h1>Listings</h1>
          <p>Create drafts, publish sellable listings, and set asking price. Status and transition rules are server-owned.</p>
        </div>
        <button className="refresh" type="button" onClick={load} disabled={loading}>↻ Refresh</button>
      </header>
      <Banner notice={notice} onClose={() => setNotice(null)} />
      <div className="grid">
        <section className="panel">
          <div className="panelTitle">
            <div>
              <p className="eyebrow">LISTINGS</p>
              <h2>All listings</h2>
            </div>
          </div>
          {loading ? <p className="state" role="status">Loading listings…</p> : listings.length === 0 ? <p className="state">No listings found.</p> : (
            <div className="tableWrap">
              <table>
                <thead><tr><th>Model</th><th>PCX ID</th><th>Status</th><th>Price</th><th><span className="sr">Actions</span></th></tr></thead>
                <tbody>
                  {listings.map((l) => (
                    <tr key={l.id}>
                      <td><strong>{l.modelName}</strong><small>{l.id.slice(0, 8)}…</small></td>
                      <td>{l.pcxItemId ?? "—"}</td>
                      <td><span className="pill">{l.status}</span></td>
                      <td>{l.price == null ? "—" : l.price}</td>
                      <td>
                        <div className="actions">
                          {l.status === "DRAFT" && <button type="button" disabled={busy} onClick={() => publish(l)}>Publish</button>}
                          <button type="button" disabled={busy} onClick={() => setPrice(l)}>Set price</button>
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
          <p className="eyebrow">CREATE DRAFT</p>
          <h2>New listing</h2>
          <p>The listing always starts as DRAFT. Publication is a separate server-owned action.</p>
          <form onSubmit={createDraft}>
            <label><span>Inventory item ID</span><input name="inventoryItemId" required /></label>
            <label><span>Public slug (optional)</span><input name="publicSlug" /></label>
            <button className="primary" disabled={busy || loading}>{busy ? "Saving…" : "Create draft"}</button>
          </form>
        </section>
      </div>
    </>
  );
}
