"use client";
import { useEffect, useMemo, useState } from "react";
import { storefrontApi } from "../../lib/storefront-api";
import StorefrontNav from "../StorefrontNav";

const ENTRIES = [
  { key: "DESKTOP_PC", label: "Desktop PC", icon: "🖥️", hint: "Sell a complete desktop build" },
  { key: "PC_PARTS", label: "PC Parts", icon: "🔧", hint: "Sell a single desktop part" },
  { key: "LAPTOP", label: "Laptop", icon: "💻", hint: "Sell a complete laptop" },
  { key: "LAPTOP_PARTS", label: "Laptop Parts", icon: "🔩", hint: "Sell a single laptop part" }
];

const BUILDS = {
  DESKTOP_PC: {
    title: "Desktop PC",
    systemCategorySlug: "desktop-pc",
    roles: [
      { role: "cpu", categorySlug: "cpu", label: "CPU", required: true },
      { role: "motherboard", categorySlug: "motherboard", label: "Motherboard", required: true },
      { role: "ram", categorySlug: "ram", label: "RAM", required: true },
      { role: "storage", categorySlug: "storage", label: "Storage", required: true },
      { role: "psu", categorySlug: "psu", label: "PSU", required: false },
      { role: "gpu", categorySlug: "gpu", label: "GPU", required: false }
    ]
  },
  LAPTOP: {
    title: "Laptop",
    systemCategorySlug: "laptop",
    roles: [
      { role: "ram", categorySlug: "laptop-ram", label: "RAM", required: true },
      { role: "storage", categorySlug: "laptop-storage", label: "Storage", required: true },
      { role: "battery", categorySlug: "battery", label: "Battery", required: false },
      { role: "keyboard", categorySlug: "keyboard", label: "Keyboard", required: false },
      { role: "charger", categorySlug: "charger", label: "Charger", required: false },
      { role: "screen", categorySlug: "screen", label: "Screen", required: false }
    ]
  }
};

const PART_ENTRIES = {
  PC_PARTS: {
    title: "PC Parts",
    parentSlug: "pc-parts",
    children: ["gpu", "cpu", "motherboard", "ram", "storage", "psu"]
  },
  LAPTOP_PARTS: {
    title: "Laptop Parts",
    parentSlug: "laptop-parts",
    children: ["laptop-ram", "laptop-storage", "battery", "keyboard", "charger", "screen"]
  }
};

function moneyRange(range) {
  if (!range || range.lowValue == null || range.highValue == null) return null;
  const fmt = (n) => `৳${Number(n).toLocaleString("en-BD")}`;
  return `${fmt(range.lowValue)} – ${fmt(range.highValue)}`;
}

function disclaimer() {
  return "Estimated market range, not a final offer. The final offer is determined only after physical inspection.";
}

function Banner({ notice, onClose }) { if (!notice) return null; return <div className={`banner ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.message}</span><button type="button" onClick={onClose} aria-label="Dismiss message">×</button></div>; }

export default function SellPage() {
  const [identity, setIdentity] = useState(null);
  const [checking, setChecking] = useState(true);
  const [categories, setCategories] = useState([]);
  const [entry, setEntry] = useState(null);
  const [buildRoles, setBuildRoles] = useState({ models: {}, selections: {} });
  const [partCategoryId, setPartCategoryId] = useState("");
  const [partModels, setPartModels] = useState([]);
  const [partModelId, setPartModelId] = useState("");
  // Contact fallbacks are only shown when the authenticated identity lacks that
  // field; when present, the server always reuses the identity value.
  const [fallbackName, setFallbackName] = useState("");
  const [fallbackPhone, setFallbackPhone] = useState("");
  const [fallbackEmail, setFallbackEmail] = useState("");
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
  const [quote, setQuote] = useState({ range: null, loading: false });

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
    storefrontApi.categories()
      .then((r) => { if (active) setCategories(r.data); })
      .catch(() => { });
    return () => { active = false; };
  }, []);

  const categoryBySlug = useMemo(() => Object.fromEntries(categories.map((c) => [c.slug, c])), [categories]);

  const build = entry && BUILDS[entry] ? BUILDS[entry] : null;
  const partEntry = entry && PART_ENTRIES[entry] ? PART_ENTRIES[entry] : null;

  // Load models for full-system build roles.
  useEffect(() => {
    if (!build) { setBuildRoles({ models: {}, selections: {} }); return; }
    let active = true;
    (async () => {
      const models = {};
      await Promise.all(build.roles.map(async (role) => {
        const category = categoryBySlug[role.categorySlug];
        if (!category) return;
        try {
          const r = await storefrontApi.productModels({ categoryId: category.id, limit: 50, sort: "name_asc" });
          models[role.role] = r.data ?? [];
        } catch { models[role.role] = []; }
      }));
      if (active) setBuildRoles((prev) => ({ ...prev, models }));
    })();
    return () => { active = false; };
  }, [entry, categories, build]);

  // Load part models when a part category is selected.
  useEffect(() => {
    if (!partEntry || !partCategoryId) { setPartModels([]); return; }
    let active = true;
    storefrontApi.productModels({ categoryId: partCategoryId, limit: 50, sort: "name_asc" })
      .then((r) => { if (active) setPartModels(r.data ?? []); })
      .catch(() => { if (active) setPartModels([]); });
    return () => { active = false; };
  }, [partCategoryId, partEntry]);

  // Live indicative quote: part mode resolves one range; build mode aggregates components.
  useEffect(() => {
    if (!entry) return;
    let active = true;
    setQuote({ range: null, loading: true });
    (async () => {
      try {
        if (partEntry) {
          if (!partModelId && !partCategoryId) { if (active) setQuote({ range: null, loading: false }); return; }
          const r = await storefrontApi.quoteRanges({ productModelId: partModelId, categoryId: partCategoryId });
          if (active) setQuote({ range: r.data?.range ?? null, loading: false });
        } else if (build) {
          const selectedIds = build.roles
            .map((r) => buildRoles.selections[r.role])
            .filter(Boolean);
          if (selectedIds.length === 0) { if (active) setQuote({ range: null, loading: false }); return; }
          const responses = await Promise.all(selectedIds.map((id) => storefrontApi.quoteRanges({ productModelId: id })));
          const ranges = responses.map((r) => r.data?.range).filter((range) => range && range.lowValue != null && range.highValue != null);
          const range = ranges.length === selectedIds.length
            ? { lowValue: ranges.reduce((s, x) => s + Number(x.lowValue), 0), highValue: ranges.reduce((s, x) => s + Number(x.highValue), 0) }
            : null;
          if (active) setQuote({ range, loading: false });
        }
      } catch {
        if (active) setQuote({ range: null, loading: false });
      }
    })();
    return () => { active = false; };
  }, [entry, partEntry, build, partModelId, partCategoryId, buildRoles.selections]);

  function chooseEntry(key) {
    setEntry(key);
    setError(null);
    setBuildRoles({ models: {}, selections: {} });
    setPartCategoryId("");
    setPartModels([]);
    setPartModelId("");
  }

  function setBuildSelection(role, modelId) {
    setBuildRoles((prev) => ({ ...prev, selections: { ...prev.selections, [role]: modelId || undefined } }));
  }

  function contactReused() {
    return {
      name: identity?.fullName ?? fallbackName,
      phone: identity?.phone ?? fallbackPhone,
      email: identity?.email ?? fallbackEmail
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!identity) { window.location.href = "/login"; return; }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const contact = contactReused();
      const common = {
        contactName: contact.name || undefined,
        contactPhone: contact.phone || undefined,
        contactEmail: contact.email || undefined,
        fulfilmentPreference,
        ageEstimate: ageEstimate || undefined,
        warrantyRemaining: warrantyRemaining || undefined,
        repairDeclared,
        repairNotes: repairNotes || undefined,
        boxAvailable,
        invoiceAvailable,
        ownershipDeclared: true
      };
      let payload;
      if (build) {
        const systemCategory = categoryBySlug[build.systemCategorySlug];
        if (!systemCategory) throw new Error("Catalog is not ready. Please try again later.");
        payload = {
          ...common,
          categoryId: systemCategory.id,
          productModelId: undefined,
          sellEntry: entry,
          buildComponents: build.roles
            .filter((r) => buildRoles.selections[r.role])
            .map((r) => ({ role: r.role, productModelId: buildRoles.selections[r.role] }))
        };
      } else if (partEntry) {
        payload = {
          ...common,
          categoryId: partCategoryId,
          productModelId: partModelId || undefined,
          sellEntry: entry,
          buildComponents: []
        };
      }
      const created = await storefrontApi.createSellRequest(payload);
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
      <StorefrontNav />
      <div className="wrap">
        <a className="back" href="/storefront">← Back to storefront</a>
        <div className="sell">
          <h1>Sell to PCX</h1>
          {result ? (
            <div className="card">
              <h2>Request submitted</h2>
              <p className="meta">Sell request <b>#{result.publicRequestNo ?? result.id}</b> is now a draft and ready to submit after your review.</p>
              {result.estimatedRange && (
                <div className="estimate">
                  <div className="eprice">{moneyRange({ lowValue: result.estimatedRange.low, highValue: result.estimatedRange.high })}</div>
                  <p className="disclaimer">{result.estimatedRange.disclaimer}</p>
                </div>
              )}
              <a className="primary" href="/sell">Create another request</a>
            </div>
          ) : (
            <Banner notice={error ? { kind: "error", message: error } : null} onClose={() => setError(null)} />
          )}
        </div>

        {!result && !entry && (
          <>
            <div className="hero" style={{ paddingTop: 18 }}>
              <p className="eyebrow">SELL-TO-PCX</p>
              <h1 style={{ fontSize: 30 }}>What are you selling?</h1>
              <p>Choose an entry to continue. Your quote is an estimated range — the final offer is made only after physical inspection.</p>
            </div>
            <div className="sellEntries">
              {ENTRIES.map((e) => (
                <button key={e.key} type="button" className="sellEntryCard" onClick={() => chooseEntry(e.key)}>
                  <span className="sellEntryIcon">{e.icon}</span>
                  <strong>{e.label}</strong>
                  <small>{e.hint}</small>
                </button>
              ))}
            </div>
          </>
        )}

        {!result && entry && (
          <form className="sellForm" onSubmit={handleSubmit}>
            <button type="button" className="learn-more" onClick={() => chooseEntry(null)} style={{ justifySelf: "start" }}>← Choose a different entry</button>
            <div className="entryHeading"><h2>{build ? build.title : partEntry.title}</h2><p className="meta">{disclaimer()}</p></div>

            {build && build.roles.map((role) => (
              <label key={role.role}><span>{role.label}{role.required ? " *" : ""}</span>
                <select value={buildRoles.selections[role.role] ?? ""} onChange={(e) => setBuildSelection(role.role, e.target.value)} required={role.required}>
                  <option value="">Select {role.label}</option>
                  {(buildRoles.models[role.role] ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </label>
            ))}

            {partEntry && (
              <>
                <label><span>Part category *</span>
                  <select value={partCategoryId} onChange={(e) => { setPartCategoryId(e.target.value); setPartModelId(""); }} required>
                    <option value="">Select part category</option>
                    {partEntry.children.map((slug) => {
                      const c = categoryBySlug[slug];
                      return c ? <option key={c.id} value={c.id}>{c.name}</option> : null;
                    })}
                  </select>
                </label>
                <label><span>Part model *</span>
                  <select value={partModelId} onChange={(e) => setPartModelId(e.target.value)} required>
                    <option value="">Select part model</option>
                    {partModels.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </label>
              </>
            )}

            {quote.range && (
              <div className="estimate">
                <div className="eprice">{moneyRange(quote.range)}</div>
                <p className="disclaimer">{disclaimer()}</p>
              </div>
            )}

            <div className="entryHeading" style={{ marginTop: 12 }}><h2>Contact & fulfilment</h2></div>
            {identity ? (
              <>
                {identity.fullName
                  ? <p className="meta">Name: {identity.fullName}</p>
                  : <label><span>Your name *</span><input type="text" value={fallbackName} onChange={(e) => setFallbackName(e.target.value)} required /></label>}
                {identity.phone
                  ? <p className="meta">Phone: {identity.phone}</p>
                  : <label><span>Phone *</span><input type="tel" value={fallbackPhone} onChange={(e) => setFallbackPhone(e.target.value)} required /></label>}
                {identity.email
                  ? <p className="meta">Email: {identity.email}</p>
                  : <label><span>Email (optional)</span><input type="email" value={fallbackEmail} onChange={(e) => setFallbackEmail(e.target.value)} /></label>}
              </>
            ) : (
              <div className="card">
                <p className="meta">You can view your estimated quote without an account, but signing in is required to submit.</p>
                <a className="primary" href="/login">Sign in to continue</a>
                <a className="learn-more" href="/register">Create an account</a>
              </div>
            )}

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
            {identity ? (
              <button className="primary" type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit sell request"}</button>
            ) : (
              <a className="primary" href="/login">Sign in to submit</a>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
