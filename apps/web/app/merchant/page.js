"use client";
import { useCallback, useEffect, useState } from "react";
import { storefrontApi } from "../../lib/storefront-api";
import { isMerchant } from "../../lib/access.js";
import { money } from "../../lib/format";
import StorefrontNav from "../StorefrontNav";

function Banner({ notice, onClose }) {
  if (!notice) return null;
  return <div className={`banner ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.message}</span><button type="button" onClick={onClose} aria-label="Dismiss message">×</button></div>;
}

export default function MerchantPage() {
  const [identity, setIdentity] = useState(null);
  const [checking, setChecking] = useState(true);
  const [listings, setListings] = useState([]);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [productModelId, setProductModelId] = useState("");
  const [proposedPrice, setProposedPrice] = useState("");
  const [editId, setEditId] = useState(null);
  const [editModelId, setEditModelId] = useState("");
  const [editPrice, setEditPrice] = useState("");

  useEffect(() => {
    let active = true;
    storefrontApi.me()
      .then((r) => { if (active) setIdentity(r.data); })
      .catch(() => { if (active) setIdentity(null); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  const merchant = isMerchant(identity);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listingsResult, modelsResult] = await Promise.all([
        storefrontApi.merchantListings(),
        storefrontApi.productModels({ limit: 50, sort: "name_asc" })
      ]);
      setListings(listingsResult.data ?? []);
      setModels(modelsResult.data ?? []);
      setNotice(null);
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (merchant) load(); }, [merchant, load]);

  async function createListing(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await storefrontApi.merchantCreateListing({
        productModelId,
        proposedPrice: proposedPrice ? Number(proposedPrice) : null
      });
      setProductModelId("");
      setProposedPrice("");
      setNotice({ kind: "success", message: "Listing draft created. PCX reviews and approves the final price." });
      await load();
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  function startEdit(listing) {
    setEditId(listing.id);
    setEditModelId(listing.productModelId ?? "");
    setEditPrice(listing.proposedPrice == null ? "" : String(listing.proposedPrice));
  }

  async function saveEdit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await storefrontApi.merchantUpdateListing(editId, {
        productModelId: editModelId,
        proposedPrice: editPrice ? Number(editPrice) : null
      });
      setEditId(null);
      setNotice({ kind: "success", message: "Listing draft updated." });
      await load();
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function archiveListing(id) {
    if (!window.confirm("Archive this draft? This cannot be undone.")) return;
    setBusy(true);
    try {
      await storefrontApi.merchantArchiveListing(id);
      setNotice({ kind: "success", message: "Listing draft archived." });
      await load();
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  if (checking) return <main><div className="wrap"><p className="state" role="status">Checking your session…</p></div></main>;

  if (!merchant) {
    return (
      <main>
        <StorefrontNav />
        <div className="wrap">
          <div className="sell">
            <h1>Merchant dashboard</h1>
            <div className="banner error" role="alert"><span>Merchant access is required. An administrator can grant you the Merchant role.</span></div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <StorefrontNav />
      <div className="wrap">
        <div className="sell">
          <h1>Merchant dashboard</h1>
          <p className="meta">Create listing drafts with a proposed price. PCX reviews, approves, and records the final sellable price before publication.</p>
          <Banner notice={notice} onClose={() => setNotice(null)} />

          <div className="card">
            <h2>New listing draft</h2>
            <form className="sellForm" onSubmit={createListing}>
              <label><span>Product model *</span>
                <select value={productModelId} onChange={(e) => setProductModelId(e.target.value)} required>
                  <option value="">Select product model</option>
                  {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </label>
              <label><span>Proposed price (৳)</span>
                <input type="number" min="0" step="0.01" value={proposedPrice} onChange={(e) => setProposedPrice(e.target.value)} placeholder="Indicative — PCX approves final price" />
              </label>
              <button className="primary" type="submit" disabled={busy}>{busy ? "Creating…" : "Create draft"}</button>
            </form>
          </div>

          <div className="card">
            <h2>My listings</h2>
            {loading ? <p className="state">Loading listings…</p> : listings.length === 0 ? <p className="state">No listings yet.</p> : (
              <div className="tableWrap">
                <table>
                  <thead><tr><th>Model</th><th>Status</th><th>Proposed price</th><th>Actions</th></tr></thead>
                  <tbody>
                    {listings.map((l) => (
                      <tr key={l.id}>
                        <td>{l.modelName ?? l.productModelId}</td>
                        <td><span className="pill">{l.status}</span></td>
                        <td>{l.proposedPrice == null ? "—" : money(l.proposedPrice)}</td>
                        <td>
                          {l.status === "DRAFT" && (
                            <div className="actions">
                              <button type="button" disabled={busy} onClick={() => startEdit(l)}>Edit</button>
                              <button type="button" className="danger" disabled={busy} onClick={() => archiveListing(l.id)}>Archive</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {editId && (
              <form className="sellForm" onSubmit={saveEdit} style={{ marginTop: 18 }}>
                <h2>Edit draft</h2>
                <label><span>Product model *</span>
                  <select value={editModelId} onChange={(e) => setEditModelId(e.target.value)} required>
                    <option value="">Select product model</option>
                    {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </label>
                <label><span>Proposed price (৳)</span>
                  <input type="number" min="0" step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
                </label>
                <button className="primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
                <button type="button" className="secondary" disabled={busy} onClick={() => setEditId(null)}>Cancel</button>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
