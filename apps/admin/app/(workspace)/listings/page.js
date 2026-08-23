"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { listingApi } from "../../../lib/listing-api.js";
import ListingMediaModal from "./media-modal";

function slug(value) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function Banner({ notice, onClose }) { if (!notice) return null; return <div className={`banner ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.message}</span><button type="button" onClick={onClose} aria-label="Dismiss message">×</button></div>; }

function parseSlug(value) {
  const normalized = slug(value);
  if (normalized.length > 0) return { ok: true, value: normalized };
  return { ok: false, message: "Enter a public slug using letters, numbers, or dashes." };
}

function parsePrice(value) {
  const amount = Number(value);
  if (Number.isFinite(amount) && amount > 0) return { ok: true, value: amount };
  return { ok: false, message: "Price must be a positive number." };
}

function FieldDialog({ title, description, label, initialValue, inputMode, submitLabel, busy, parse, onSubmit, onClose }) {
  const [value, setValue] = useState(initialValue ?? "");
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function submit() {
    const result = parse(value);
    if (!result.ok) { setError(result.message); return; }
    onSubmit(result.value);
  }

  return createPortal(
    <div className="modalOverlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modalDialog" role="dialog" aria-modal="true" aria-labelledby="listing-dialog-title">
        <button type="button" className="modalClose" aria-label="Close" onClick={onClose}>×</button>
        <h2 id="listing-dialog-title">{title}</h2>
        <p>{description}</p>
        <label>
          <span>{label}</span>
          <input
            ref={inputRef}
            value={value}
            inputMode={inputMode}
            onChange={(event) => { setValue(event.target.value); setError(null); }}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); submit(); } }}
          />
        </label>
        {error && <p className="dialogError" role="alert">{error}</p>}
        <div className="modalActions">
          <button type="button" className="danger" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="primary" onClick={submit} disabled={busy}>{busy ? "Saving…" : submitLabel}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function ListingsPage() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [mediaListing, setMediaListing] = useState(null);

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

  async function publish(listing, publicSlug) {
    setBusy(true);
    try {
      await listingApi.publish(listing.id, { publicSlug });
      setNotice({ kind: "success", message: "Listing published." });
      await load();
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function setPrice(listing, price) {
    setBusy(true);
    try {
      await listingApi.setPrice({ listingId: listing.id, price, reason: "admin-set" });
      setNotice({ kind: "success", message: "Listing price updated." });
      await load();
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  function openDialog(kind, listing) {
    if (kind === "publish") {
      setDialog({
        kind,
        listing,
        title: "Publish listing",
        description: "Publishing requires a canonical public slug. Only lowercase letters, numbers, and dashes are allowed.",
        label: "Public slug",
        initialValue: listing.publicSlug ?? slug(listing.modelName ?? ""),
        inputMode: "text",
        submitLabel: "Publish",
        parse: parseSlug
      });
    } else {
      setDialog({
        kind,
        listing,
        title: "Set listing price",
        description: listing.price != null
          ? `Current price: ${listing.price}. The server records every price change.`
          : "The server records every price change and requires a positive amount.",
        label: "Price",
        initialValue: listing.price == null ? "" : String(listing.price),
        inputMode: "decimal",
        submitLabel: "Save price",
        parse: parsePrice
      });
    }
  }

  function submitDialog(config, value) {
    setDialog(null);
    if (config.kind === "publish") publish(config.listing, value);
    else setPrice(config.listing, value);
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
                          {l.status === "DRAFT" && <button type="button" disabled={busy} onClick={() => openDialog("publish", l)}>Publish</button>}
                          <button type="button" disabled={busy} onClick={() => openDialog("price", l)}>Set price</button>
                          <button type="button" disabled={busy} onClick={() => setMediaListing(l)}>Photos</button>
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
      {mediaListing && <ListingMediaModal listing={mediaListing} onClose={() => setMediaListing(null)} onUploaded={() => load()} />}
      {dialog && (
        <FieldDialog
          title={dialog.title}
          description={dialog.description}
          label={dialog.label}
          initialValue={dialog.initialValue}
          inputMode={dialog.inputMode}
          submitLabel={dialog.submitLabel}
          busy={busy}
          parse={dialog.parse}
          onSubmit={(value) => submitDialog(dialog, value)}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
