"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { quotesApi } from "../../../lib/quotes-api.js";
import { catalogApi } from "../../../lib/catalog-api.js";

function Banner({ notice, onClose }) { if (!notice) return null; return <div className={`banner ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.message}</span><button type="button" onClick={onClose} aria-label="Dismiss message">×</button></div>; }

export default function QuotesPage() {
  const [categories, setCategories] = useState([]);
  const [models, setModels] = useState([]);
  const [targetType, setTargetType] = useState("CATEGORY");
  const [categoryId, setCategoryId] = useState("");
  const [modelCategoryId, setModelCategoryId] = useState("");
  const [productModelId, setProductModelId] = useState("");
  const [lowValue, setLowValue] = useState("");
  const [highValue, setHighValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [prices, setPrices] = useState([]);

  const loadCategories = useCallback(async () => {
    const payload = await catalogApi.categories();
    setCategories(payload.data);
  }, []);

  const loadPrices = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await quotesApi.list();
      setPrices(payload.data ?? []);
      setNotice(null);
    } catch (error) {
      setNotice({ kind: "error", message: error.status === 401 ? "Sign in to manage quotes." : error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCategories().catch(() => { }); loadPrices(); }, [loadCategories, loadPrices]);

  useEffect(() => {
    if (targetType !== "MODEL" || !modelCategoryId) { setModels([]); return; }
    let active = true;
    catalogApi.models({ categoryId: modelCategoryId })
      .then((r) => { if (active) setModels(r.data ?? []); })
      .catch(() => { if (active) setModels([]); });
    return () => { active = false; };
  }, [targetType, modelCategoryId]);

  const categoryNames = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name])), [categories]);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const body = targetType === "CATEGORY"
        ? { categoryId, lowValue: Number(lowValue), highValue: Number(highValue) }
        : { productModelId, lowValue: Number(lowValue), highValue: Number(highValue) };
      await quotesApi.setQuote(body);
      setNotice({ kind: "success", message: "Quote range saved. The previous active range is archived." });
      event.currentTarget.reset();
      setTargetType("CATEGORY");
      setCategoryId("");
      setModelCategoryId("");
      setProductModelId("");
      setLowValue("");
      setHighValue("");
      await loadPrices();
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  function targetLabel(price) {
    if (price.productModelId) return `Model ${price.productModelId.slice(0, 8)}…`;
    if (price.categoryId) return categoryNames[price.categoryId] ?? `Category ${price.categoryId.slice(0, 8)}…`;
    return "—";
  }

  return (
    <>
      <header>
        <div>
          <p className="eyebrow">OPERATIONS / QUOTES</p>
          <h1>Sell-to-PCX quotes</h1>
          <p>Set the estimated price range shown on public sell requests. Ranges are indicative, never a final offer.</p>
        </div>
        <button className="refresh" type="button" onClick={loadPrices} disabled={loading}>↻ Refresh</button>
      </header>
      <Banner notice={notice} onClose={() => setNotice(null)} />

      <div className="grid" style={{ marginTop: 0 }}>
        <section className="panel formPanel">
          <p className="eyebrow">SET QUOTE</p>
          <h2>New indicative range</h2>
          <p>IDs, lifecycle status and actor are server-owned.</p>
          <form onSubmit={handleSubmit}>
            <label><span>Target type</span>
              <select value={targetType} onChange={(e) => setTargetType(e.target.value)}>
                <option value="CATEGORY">Category (default)</option>
                <option value="MODEL">Product model (override)</option>
              </select>
            </label>

            {targetType === "CATEGORY" ? (
              <label><span>Category</span>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
                  <option value="">Select category</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            ) : (
              <>
                <label><span>Category</span>
                  <select value={modelCategoryId} onChange={(e) => { setModelCategoryId(e.target.value); setProductModelId(""); }} required>
                    <option value="">Select category</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label><span>Product model</span>
                  <select value={productModelId} onChange={(e) => setProductModelId(e.target.value)} required disabled={!modelCategoryId}>
                    <option value="">Select model</option>
                    {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </label>
              </>
            )}

            <label><span>Low value (৳)</span><input type="number" min="0" step="0.01" value={lowValue} onChange={(e) => setLowValue(e.target.value)} required /></label>
            <label><span>High value (৳)</span><input type="number" min="0" step="0.01" value={highValue} onChange={(e) => setHighValue(e.target.value)} required /></label>
            <button className="primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save range"}</button>
          </form>
        </section>

        <section className="panel">
          <div className="panelTitle">
            <div>
              <p className="eyebrow">QUOTE HISTORY</p>
              <h2>All ranges</h2>
            </div>
          </div>
          {loading ? <p className="state" role="status">Loading quotes…</p> : prices.length === 0 ? <p className="state">No quote ranges yet.</p> : (
            <div className="tableWrap">
              <table>
                <thead><tr><th>Target</th><th>Low</th><th>High</th><th>Status</th><th>Set by</th><th>Created</th></tr></thead>
                <tbody>
                  {prices.map((p) => (
                    <tr key={p.id}>
                      <td>{targetLabel(p)}</td>
                      <td>৳{Number(p.lowValue).toLocaleString("en-BD")}</td>
                      <td>৳{Number(p.highValue).toLocaleString("en-BD")}</td>
                      <td><span className="pill">{p.status}</span></td>
                      <td>{p.setBy ? p.setBy.slice(0, 8) : "—"}</td>
                      <td>{new Date(p.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
