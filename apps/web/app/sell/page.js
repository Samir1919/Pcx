"use client";
import { useEffect, useMemo, useState } from "react";
import { storefrontApi } from "../../lib/storefront-api";

function moneyRange(range) {
  if (!range) return null;
  const fmt = (n) => `৳${Number(n).toLocaleString("en-BD")}`;
  return `${fmt(range.low)} – ${fmt(range.high)}`;
}

function message(kind, text) {
  return text ? <div className={`banner ${kind}`} role={kind === "error" ? "alert" : "status"}><span>{text}</span></div> : null;
}

export default function SellPage() {
  const [identity, setIdentity] = useState(null);
  const [checking, setChecking] = useState(true);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [productModelId, setProductModelId] = useState("");
  const [modelSpecs, setModelSpecs] = useState([]);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [fulfilmentPreference, setFulfilmentPreference] = useState("DROP_OFF");
  const [ageEstimate, setAgeEstimate] = useState("");
  const [warrantyRemaining, setWarrantyRemaining] = useState("");
  const [repairDeclared, setRepairDeclared] = useState(false);
  const [repairNotes, setRepairNotes] = useState("");
  const [boxAvailable, setBoxAvailable] = useState(false);
  const [invoiceAvailable, setInvoiceAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let active = true;
    storefrontApi.me()
      .then((r) => { if (active) setIdentity(r.data); })
      .catch(() => { if (active) setIdentity(null); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([storefrontApi.categories(), storefrontApi.brands()])
      .then(([c, b]) => { if (active) { setCategories(c.data); setBrands(b.data); } })
      .catch(() => { });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!categoryId) { setModels([]); return; }
    let active = true;
    setBusy(true);
    storefrontApi.productModels({ categoryId, brandId, limit: 50, sort: "name_asc" })
      .then((r) => { if (active) setModels(r.data ?? []); })
      .catch(() => { if (active) setModels([]); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [categoryId, brandId]);

  const selectedModel = useMemo(() => models.find((m) => m.id === productModelId) ?? null, [models, productModelId]);

  useEffect(() => {
    if (!productModelId) { setModelSpecs([]); return; }
    let active = true;
    storefrontApi.productModel(productModelId)
      .then((r) => { if (active) setModelSpecs(r.data?.specifications ?? []); })
      .catch(() => { if (active) setModelSpecs([]); });
    return () => { active = false; };
  }, [productModelId]);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const selectedSpecs = modelSpecs.map((s) => ({ key: s.key, value: s.value }));
      const created = await storefrontApi.createSellRequest({
        categoryId,
        productModelId,
        contactName,
        contactPhone,
        contactEmail: contactEmail || undefined,
        fulfilmentPreference,
        selectedSpecs,
        ageEstimate: ageEstimate || undefined,
        warrantyRemaining: warrantyRemaining || undefined,
        repairDeclared,
        repairNotes: repairNotes || undefined,
        boxAvailable,
        invoiceAvailable,
        ownershipDeclared: true
      });
      setResult(created.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (checking) return <main><div className="wrap"><p className="state" role="status">Checking your session…</p></div></main>;

  return (
    <main>
      <div className="topbar">
        <div className="topbarInner">
          <a className="brand" href="/storefront" aria-label="PCX Storefront home"><b>PCX</b><small>CERTIFIED PRE-OWNED</small></a>
          <nav aria-label="Primary"><a href="/storefront">Storefront</a><a className="selected" href="/sell">Sell</a></nav>
        </div>
      </div>
      <div className="wrap">
        <a className="back" href="/storefront">← Back to storefront</a>
        <div className="sell">
          <h1>Sell to PCX</h1>
          {!identity ? (
            <div className="buyBox">
              <p className="meta">You need to <a href="/storefront">sign in</a> from an item page before submitting a sell request.</p>
              <a className="primary" href="/storefront">Go to storefront</a>
            </div>
          ) : result ? (
            <div className="card">
              <h2>Request submitted</h2>
              <p className="meta">Sell request <b>#{result.publicRequestNo ?? result.id}</b> is now a draft and ready to submit after your review.</p>
              {result.estimatedRange && (
                <div className="estimate">
                  <div className="eprice">{moneyRange(result.estimatedRange)}</div>
                  <p className="disclaimer">{result.estimatedRange.disclaimer}</p>
                </div>
              )}
              <a className="primary" href="/sell">Create another request</a>
            </div>
          ) : (
            <form className="sellForm" onSubmit={handleSubmit}>
              {message("error", error)}
              <label><span>Category</span>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
                  <option value="">Select category</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label><span>Brand</span>
                <select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
                  <option value="">Any brand</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
              <label><span>Model / variant</span>
                <select value={productModelId} onChange={(e) => setProductModelId(e.target.value)} required>
                  <option value="">Select model</option>
                  {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </label>
              {selectedModel && modelSpecs.length > 0 && (
                <div className="specReview">
                  <p className="specTitle">Selected specifications (from catalog)</p>
                  <dl>
                    {modelSpecs.map((s) => (
                      <div key={s.key}><dt>{s.label}</dt><dd>{s.value}{s.unit ? ` ${s.unit}` : ""}</dd></div>
                    ))}
                  </dl>
                </div>
              )}
              <label><span>Your name</span><input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)} required /></label>
              <label><span>Phone</span><input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} required /></label>
              <label><span>Email (optional)</span><input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /></label>
              <label><span>Fulfilment preference</span>
                <select value={fulfilmentPreference} onChange={(e) => setFulfilmentPreference(e.target.value)}>
                  <option value="DROP_OFF">Drop off</option>
                  <option value="PICKUP">Pickup</option>
                  <option value="COURIER">Courier</option>
                </select>
              </label>
              <label><span>Estimated age</span><input type="text" value={ageEstimate} onChange={(e) => setAgeEstimate(e.target.value)} placeholder="e.g. 2 years" /></label>
              <label><span>Warranty remaining (if any)</span><input type="text" value={warrantyRemaining} onChange={(e) => setWarrantyRemaining(e.target.value)} placeholder="e.g. none" /></label>
              <label className="check"><input type="checkbox" checked={repairDeclared} onChange={(e) => setRepairDeclared(e.target.checked)} /><span>Has repair history</span></label>
              {repairDeclared && <label><span>Repair notes</span><input type="text" value={repairNotes} onChange={(e) => setRepairNotes(e.target.value)} /></label>}
              <label className="check"><input type="checkbox" checked={boxAvailable} onChange={(e) => setBoxAvailable(e.target.checked)} /><span>Original box available</span></label>
              <label className="check"><input type="checkbox" checked={invoiceAvailable} onChange={(e) => setInvoiceAvailable(e.target.checked)} /><span>Invoice available</span></label>
              <label className="check"><input type="checkbox" checked readOnly /><span>I confirm I own this item</span></label>
              <button className="primary" type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit sell request"}</button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
