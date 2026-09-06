"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { storefrontApi, mediaUrl } from "../../lib/storefront-api";
import StorefrontNav from "../StorefrontNav";
import IntlPhoneInput from "../components/IntlPhoneInput";
import { validateEmail, validatePhone } from "../../lib/contact-validation";

// Sell entries are configured server-side (admin Catalog → Sell flow). The
// storefront renders the active entries returned by the public taxonomy API;
// the icon is presentation-only and mapped from the server-owned `iconKey`.
const SELL_ICONS = {
  desktop: "🖥️", parts: "🔧", laptop: "💻", "laptop-parts": "🔩",
  phone: "📱", tablet: "📲", monitor: "🖥️", audio: "🔊", camera: "📷", accessory: "🎧"
};
function iconFor(iconKey) { return SELL_ICONS[iconKey] ?? "📦"; }

const STEP_SPEC = "spec";
const STEP_DECISION = "decision";
const STEP_REQUEST = "request";
const VALID_STEPS = new Set([STEP_SPEC, STEP_DECISION, STEP_REQUEST]);
const MAX_PHOTOS = 8;

function moneyRange(range) {
  if (!range || range.lowValue == null || range.highValue == null) return null;
  const fmt = (n) => `৳${Number(n).toLocaleString("en-BD")}`;
  return `${fmt(range.lowValue)} – ${fmt(range.highValue)}`;
}

function disclaimer() {
  return "Estimated market range, not a final offer. The final offer is determined only after physical inspection.";
}

function Banner({ notice, onClose }) { if (!notice) return null; return <div className={`banner ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.message}</span><button type="button" onClick={onClose} aria-label="Dismiss message">×</button></div>; }

// Build selections are persisted in a single `components` query param as
// `role=modelId` pairs so the exact in-progress flow survives a page reload or a
// sign-in redirect back to this page.
function encodeComponents(selections) {
  return Object.entries(selections)
    .filter(([, value]) => value)
    .map(([role, value]) => `${role}=${value}`)
    .join(",");
}

function decodeComponents(value) {
  const out = {};
  if (!value) return out;
  for (const part of value.split(",")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    const role = part.slice(0, index);
    const modelId = part.slice(index + 1);
    if (role && modelId) out[role] = modelId;
  }
  return out;
}

export default function SellPage() {
  return (
    <Suspense fallback={<main><div className="wrap"><p className="state" role="status">Loading…</p></div></main>}>
      <SellFlow />
    </Suspense>
  );
}

function SellFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawStep = searchParams.get("step");
  const step = VALID_STEPS.has(rawStep) ? rawStep : STEP_SPEC;
  const entryParam = searchParams.get("entry");
  const partCategoryId = searchParams.get("cat") ?? "";
  const partModelId = searchParams.get("model") ?? "";

  const [identity, setIdentity] = useState(null);
  const [checking, setChecking] = useState(true);
  const [taxonomy, setTaxonomy] = useState([]);
  const [taxonomyLoading, setTaxonomyLoading] = useState(true);
  const [taxonomyError, setTaxonomyError] = useState(null);
  const [partModels, setPartModels] = useState([]);
  const [buildModels, setBuildModels] = useState({});
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
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);

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
    setTaxonomyLoading(true);
    storefrontApi.sellTaxonomy()
      .then((r) => { if (active) { setTaxonomy(r.data ?? []); setTaxonomyError(null); } })
      .catch((e) => { if (active) setTaxonomyError(e.message); })
      .finally(() => { if (active) setTaxonomyLoading(false); });
    return () => { active = false; };
  }, []);

  // The active entry (and its build/part shape) is derived from the server
  // taxonomy. The URL `entry` param must match a live active entry, so an
  // inactive or removed entry falls back to the chooser instead of a broken flow.
  // `build`/`partEntry` are memoized so the effect dependencies that consume them
  // stay referentially stable across renders (a fresh object on every render
  // would re-fire the model-loading effects in a tight loop).
  const entryConfig = entryParam ? taxonomy.find((e) => e.entryKey === entryParam) ?? null : null;
  const entry = entryConfig ? entryConfig.entryKey : null;
  const build = useMemo(() => entryConfig && entryConfig.kind === "BUILD"
    ? {
        title: entryConfig.category?.name ?? entryConfig.entryKey,
        systemCategoryId: entryConfig.category?.id,
        roles: (entryConfig.components ?? []).map((component) => ({ role: component.role, categoryId: component.category?.id, label: component.category?.name ?? component.role, required: component.required }))
      }
    : null, [entryConfig]);
  const partEntry = useMemo(() => entryConfig && entryConfig.kind === "PARTS"
    ? { title: entryConfig.category?.name ?? entryConfig.entryKey, children: entryConfig.children ?? [] }
    : null, [entryConfig]);

  // Selections are derived from the URL so the flow is deep-linkable and a
  // post-login redirect returns the user to the exact same state.
  const rawComponents = useMemo(() => decodeComponents(searchParams.get("components") ?? ""), [searchParams]);
  const selections = useMemo(() => {
    const out = {};
    if (build) for (const role of build.roles) if (rawComponents[role.role]) out[role.role] = rawComponents[role.role];
    return out;
  }, [build, rawComponents]);

  // The addressable current path, used as the `redirect` target when a guest
  // must sign in before submitting.
  const currentPath = useMemo(() => {
    const qs = searchParams.toString();
    return `/sell${qs ? `?${qs}` : ""}`;
  }, [searchParams]);
  const loginHref = `/login?redirect=${encodeURIComponent(currentPath)}`;

  function go(patch) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value == null || value === "") next.delete(key);
      else next.set(key, value);
    }
    const qs = next.toString();
    router.replace(`/sell${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  // Load models for full-system build roles.
  useEffect(() => {
    if (!build) { setBuildModels({}); return; }
    let active = true;
    (async () => {
      const models = {};
      await Promise.all(build.roles.map(async (role) => {
        if (!role.categoryId) return;
        try {
          const r = await storefrontApi.productModels({ categoryId: role.categoryId, limit: 50, sort: "name_asc" });
          models[role.role] = r.data ?? [];
        } catch { models[role.role] = []; }
      }));
      if (active) setBuildModels(models);
    })();
    return () => { active = false; };
  }, [entry, build]);

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
            .map((r) => selections[r.role])
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
  }, [entry, partEntry, build, partModelId, partCategoryId, selections]);

  function chooseEntry(key) {
    go({ entry: key, step: STEP_SPEC, components: null, cat: null, model: null });
    setError(null);
  }

  function setBuildSelection(role, modelId) {
    const next = { ...selections };
    if (modelId) next[role] = modelId; else delete next[role];
    go({ components: Object.keys(next).length ? encodeComponents(next) : null });
  }

  const specComplete = useMemo(() => {
    if (!entry) return false;
    if (build) return build.roles.filter((r) => r.required).every((r) => selections[r.role]);
    if (partEntry) return !!(partCategoryId && partModelId);
    return false;
  }, [entry, build, partEntry, selections, partCategoryId, partModelId]);

  function contactReused() {
    return {
      name: identity?.fullName ?? fallbackName,
      phone: identity?.phone ?? fallbackPhone,
      email: identity?.email ?? fallbackEmail
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!identity) { window.location.href = loginHref; return; }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const contact = contactReused();
      if (contact.email) {
        const emailCheck = validateEmail(contact.email);
        if (!emailCheck.ok) {
          setError(emailCheck.reason);
          setBusy(false);
          return;
        }
      }
      if (contact.phone) {
        const phoneCheck = validatePhone(contact.phone);
        if (!phoneCheck.ok) {
          setError(phoneCheck.reason);
          setBusy(false);
          return;
        }
      }
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
        if (!build.systemCategoryId) throw new Error("Catalog is not ready. Please try again later.");
        payload = {
          ...common,
          categoryId: build.systemCategoryId,
          productModelId: undefined,
          sellEntry: entry,
          buildComponents: build.roles
            .filter((r) => selections[r.role])
            .map((r) => ({ role: r.role, productModelId: selections[r.role] }))
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
      const requestId = created.data?.id;
      // Persist any fallback name/phone the seller typed so they don't have to
      // re-enter it on every sell request (the server reuses identity values).
      if (typeof identity.fullName !== "string" && fallbackName.trim()) {
        try { await storefrontApi.updateProfile({ fullName: fallbackName.trim() }); } catch { /* best-effort */ }
      }
      if (typeof identity.phone !== "string" && fallbackPhone.trim()) {
        try { await storefrontApi.updateProfile({ phone: fallbackPhone.trim() }); } catch { /* best-effort */ }
      }
      if (requestId) {
        if (photos.length > 0) {
          setUploading(true);
          try {
            for (const file of photos) {
              await storefrontApi.uploadSellRequestMedia(requestId, file);
            }
          } finally {
            setUploading(false);
          }
        }
        // "Submit sell request" now genuinely submits: DRAFT -> SUBMITTED so the
        // request moves into the admin review queue (spec §12).
        const submitted = await storefrontApi.submitSellRequest(requestId);
        setResult(submitted.data ?? created.data);
      } else {
        setResult(created.data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (checking) return <main><div className="wrap"><p className="state" role="status">Checking your session…</p></div></main>;

  const title = build ? build.title : partEntry ? partEntry.title : "";
  const rangeLabel = moneyRange(quote.range);

  return (
    <main>
      <StorefrontNav />
      <div className="wrap">
        <a className="back" href="/storefront">← Back to storefront</a>
        <div className="sell">
          <h1>Sell to PCX</h1>
          {result ? (
            <div className="card">
              <h2>Request submitted to PCX</h2>
              <p className="meta">Sell request <b>#{result.publicRequestNo ?? result.id}</b> has been submitted. PCX will now review it.</p>
              {result.estimatedRange && (
                <div className="estimate">
                  <div className="eprice">{moneyRange({ lowValue: result.estimatedRange.low, highValue: result.estimatedRange.high })}</div>
                  <p className="disclaimer">{result.estimatedRange.disclaimer}</p>
                </div>
              )}
              <div className="actions">
                <a className="primary" href="/sell-requests">Track my sell request</a>
                <a className="learn-more" href="/sell">Create another request</a>
              </div>
            </div>
          ) : (
            <Banner notice={error ? { kind: "error", message: error } : null} onClose={() => setError(null)} />
          )}
        </div>

        {!result && !entry && (
          <>
            <div className="hero sellHero">
              <p className="eyebrow">SELL-TO-PCX</p>
              <h1>What are you selling?</h1>
              <p>Choose an entry to continue. Your quote is an estimated range — the final offer is made only after physical inspection.</p>
            </div>
            <div className="sellEntries">
              {taxonomyLoading ? (
                <p className="state" role="status">Loading sell options…</p>
              ) : taxonomyError ? (
                <p className="state" role="alert">Could not load sell options. Please try again later.</p>
              ) : taxonomy.length === 0 ? (
                <p className="state">No sell options are available right now. Please check back later.</p>
              ) : (
                taxonomy.map((e) => (
                  <button key={e.entryKey} type="button" className="sellEntryCard" onClick={() => chooseEntry(e.entryKey)}>
                    <span className="sellEntryIcon">{e.iconMediaId ? <img src={mediaUrl(e.iconMediaId)} alt="" /> : iconFor(e.iconKey)}</span>
                    <strong>{e.category?.name ?? e.entryKey}</strong>
                    <small>{e.hint}</small>
                  </button>
                ))
              )}
            </div>
          </>
        )}

        {!result && entry && step === STEP_SPEC && (
          <div className="sellForm">
            <button type="button" className="learn-more" onClick={() => chooseEntry(null)}>← Choose a different entry</button>
            <div className="entryHeading"><h2>{title}</h2><p className="meta">{disclaimer()}</p></div>

            {build && build.roles.map((role) => (
              <label key={role.role}><span>{role.label}{role.required ? " *" : ""}</span>
                <select value={selections[role.role] ?? ""} onChange={(e) => setBuildSelection(role.role, e.target.value)} required={role.required}>
                  <option value="">Select {role.label}</option>
                  {(buildModels[role.role] ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </label>
            ))}

            {partEntry && (
              <>
                <label><span>Part category *</span>
                  <select value={partCategoryId} onChange={(e) => go({ cat: e.target.value, model: null })} required>
                    <option value="">Select part category</option>
                    {partEntry.children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label><span>Part model *</span>
                  <select value={partModelId} onChange={(e) => go({ model: e.target.value })} required>
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

            <button className="primary" type="button" disabled={!specComplete} onClick={() => go({ step: STEP_DECISION })}>
              Review selling options →
            </button>
            {!specComplete && <p className="meta">Complete the required selections above to see your selling options.</p>}
          </div>
        )}

        {!result && entry && step === STEP_DECISION && (
          <div className="sell">
            <div className="entryHeading"><h2>How would you like to sell?</h2><p className="meta">{disclaimer()}</p></div>
            {quote.range && (
              <div className="estimate">
                <div className="eprice">{rangeLabel}</div>
                <p className="disclaimer">{disclaimer()}</p>
              </div>
            )}
            <div className="sellEntries">
              <button type="button" className="sellEntryCard" onClick={() => go({ step: STEP_REQUEST })}>
                <span className="sellEntryIcon">🤝</span>
                <strong>Sell to PCX</strong>
                <small>Get a final offer after physical inspection, then PCX pays you.</small>
              </button>
              <button type="button" className="sellEntryCard" onClick={() => setShowMarketplace(true)}>
                <span className="sellEntryIcon">🛍️</span>
                <strong>Advertise on marketplace</strong>
                <small>List your item for buyers to purchase directly.</small>
              </button>
            </div>
            {showMarketplace && (
              <div className="card">
                <h2>Marketplace is coming soon</h2>
                <p className="meta">Verified third-party marketplace listings — with seller KYC, commissions, and payouts — are planned for a future phase. For now, you can sell directly to PCX.</p>
                <button type="button" className="learn-more" onClick={() => setShowMarketplace(false)}>← Back to options</button>
              </div>
            )}
            <button type="button" className="learn-more" onClick={() => go({ step: STEP_SPEC })}>← Back to details</button>
          </div>
        )}

        {!result && entry && step === STEP_REQUEST && (
          <form className="sellForm" onSubmit={handleSubmit}>
            <button type="button" className="learn-more" onClick={() => go({ step: STEP_DECISION })}>← Back to options</button>
            <div className="entryHeading"><h2>{title}</h2>
              {quote.range && <p className="meta">Estimated range: {rangeLabel} — {disclaimer()}</p>}
            </div>

            <div className="entryHeading"><h2>Contact & fulfilment</h2></div>
            {identity ? (
              <>
                {identity.fullName
                  ? <p className="meta">Name: {identity.fullName}</p>
                  : <label><span>Your name *</span><input type="text" value={fallbackName} onChange={(e) => setFallbackName(e.target.value)} required /></label>}
                {identity.phone
                  ? <p className="meta">Phone: {identity.phone}</p>
                  : <IntlPhoneInput label="Phone" value={fallbackPhone} onChange={setFallbackPhone} required />}
                {identity.email
                  ? <p className="meta">Email: {identity.email}</p>
                  : <label><span>Email (optional)</span><input type="email" value={fallbackEmail} onChange={(e) => setFallbackEmail(e.target.value)} /></label>}
              </>
            ) : (
              <div className="card">
                <p className="meta">You can view your estimated quote without an account, but signing in is required to submit.</p>
                <a className="primary" href={loginHref}>Sign in to continue</a>
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

            <div className="entryHeading"><h2>Item photos</h2></div>
            <label className="check"><span>Add photos (JPEG, PNG, WebP — up to {MAX_PHOTOS})</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={photos.length >= MAX_PHOTOS} onChange={(e) => setPhotos(Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS))} />
            </label>
            <p className="meta">{photos.length}/{MAX_PHOTOS} photos selected</p>
            {photos.length > 0 && (
              <div className="mediaGrid">
                {photos.map((file, i) => (
                  <img key={i} src={URL.createObjectURL(file)} alt={`Selected ${i + 1}`} />
                ))}
              </div>
            )}

            {identity ? (
              <button className="primary" type="submit" disabled={busy || uploading}>{busy || uploading ? "Submitting…" : "Submit sell request"}</button>
            ) : (
              <a className="primary" href={loginHref}>Sign in to submit</a>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
