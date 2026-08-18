"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { acquisitionApi } from "../../../lib/acquisition-api.js";
import { quotesApi } from "../../../lib/quotes-api.js";
import { catalogApi } from "../../../lib/catalog-api.js";

const TABS = [
  { key: "workflow", label: "Sell requests & workflow" },
  { key: "quotes", label: "Quotes" }
];

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

function QuotesTab() {
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
      <p className="state" role="status" style={{ padding: "12px 0" }}>Set the estimated price range shown on public sell requests. Ranges are indicative, never a final offer.</p>
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
            <button className="refresh" type="button" onClick={loadPrices} disabled={loading}>↻ Refresh</button>
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

export default function AcquisitionPage() {
  const [tab, setTab] = useState("workflow");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sellRequests, setSellRequests] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await acquisitionApi.sellRequests();
      setSellRequests(payload.data ?? []);
      setNotice(null);
    } catch (error) {
      setNotice({ kind: "error", message: error.status === 401 ? "Sign in to view sell requests." : error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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
          <p>Valuation, offer, acceptance, acquisition, payment, and indicative quotes. Agreed price and status are always server-owned.</p>
        </div>
        {tab === "workflow" && <button className="refresh" type="button" onClick={load} disabled={loading}>↻ Refresh</button>}
      </header>

      <div className="tabs" role="tablist" aria-label="Acquisition sections" style={{ marginBottom: 18 }}>
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "workflow" ? (
        <>
          <Banner notice={notice} onClose={() => setNotice(null)} />
          <section className="panel">
            <div className="panelTitle">
              <div>
                <p className="eyebrow">SELL REQUESTS</p>
                <h2>Admin queue</h2>
              </div>
            </div>
            {loading ? <p className="state" role="status">Loading sell requests…</p> : sellRequests.length === 0 ? <p className="state">No sell requests yet.</p> : (
              <div className="tableWrap">
                <table>
                  <thead><tr><th>Request</th><th>Entry</th><th>Build</th><th>Model</th><th>Status</th><th>Submitted</th></tr></thead>
                  <tbody>
                    {sellRequests.map((r) => (
                      <tr key={r.id}>
                        <td><strong>{r.id.slice(0, 8)}…</strong></td>
                        <td>{r.sellEntry ?? "—"}</td>
                        <td>
                          {r.buildComponents && r.buildComponents.length > 0
                            ? r.buildComponents.map((c) => <span key={c.role} className="pill" style={{ marginRight: 4 }}>{c.role}</span>)
                            : "—"}
                        </td>
                        <td>{r.productModelId ? `${r.productModelId.slice(0, 8)}…` : "—"}</td>
                        <td><span className="pill">{r.status}</span></td>
                        <td>{r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <div className="grid" style={{ marginTop: 18 }}>
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
      ) : (
        <QuotesTab />
      )}
    </>
  );
}
