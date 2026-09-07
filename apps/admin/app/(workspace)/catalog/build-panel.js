"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { catalogApi } from "../../../lib/catalog-api";
import { sellTaxonomyApi } from "../../../lib/sell-taxonomy-api";

function Banner({ notice, onClose }) {
  if (!notice) return null;
  return (
    <div className={`banner ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>
      <span>{notice.message}</span>
      <button type="button" onClick={onClose} aria-label="Dismiss message">×</button>
    </div>
  );
}

function Field({ label, name, ...props }) {
  return <label><span>{label}</span><input name={name} {...props} /></label>;
}

function parseSpecValue(raw, type) {
  if (raw == null || raw === "") return undefined;
  if (type === "NUMBER") { const number = Number(raw); return Number.isFinite(number) ? number : undefined; }
  if (type === "BOOLEAN") { if (raw === "true") return true; if (raw === "false") return false; return undefined; }
  if (type === "JSON") { try { return JSON.parse(raw); } catch { return undefined; } }
  return raw;
}

// A full PC build is a composite ProductModel: each component slot either
// selects an existing part ProductModel or creates a new one inline (saved
// atomically as a part + linked into the build). Mirrors the PCPartPicker /
// NZXT BLD slot-based configurator pattern.
export default function BuildPanel({ brands, onChanged }) {
  const [entries, setEntries] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [models, setModels] = useState({});
  const [defs, setDefs] = useState({});
  const [modes, setModes] = useState({});
  const [referenceValues, setReferenceValues] = useState([]);
  const [rules, setRules] = useState([]);
  const [pickedSpecs, setPickedSpecs] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [payload, refs, ruleList] = await Promise.all([sellTaxonomyApi.list(), catalogApi.referenceValues(), catalogApi.compatibilityRules()]);
      setEntries((payload.data ?? []).filter((entry) => entry.kind === "BUILD"));
      setReferenceValues(refs.data ?? []);
      setRules(ruleList.data ?? []);
      setNotice(null);
    } catch (error) {
      setNotice({ kind: "error", message: error.status === 401 ? "Sign in to manage builds." : error.message });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const entry = useMemo(() => entries.find((e) => e.category?.id === categoryId) ?? null, [entries, categoryId]);

  const referenceValuesByKey = useMemo(() => {
    const map = {};
    for (const value of referenceValues) { if (!map[value.key]) map[value.key] = []; map[value.key].push(value); }
    return map;
  }, [referenceValues]);

  // Generic (data-driven) compatibility check over the already-picked specs.
  const violations = useMemo(() => {
    const out = [];
    for (const rule of rules) {
      const source = pickedSpecs[rule.sourceCategoryId];
      const target = pickedSpecs[rule.targetCategoryId];
      if (!source || !target) continue;
      const sourceValue = source[rule.sourceKey];
      const targetValue = target[rule.targetKey];
      if (sourceValue == null || sourceValue === "" || targetValue == null || targetValue === "") continue;
      if (sourceValue !== targetValue) out.push({ ...rule, sourceValue, targetValue });
    }
    return out;
  }, [rules, pickedSpecs]);

  function handleExistingSelect(categoryId, modelId) {
    if (!modelId) { setPickedSpecs((prev) => { const next = { ...prev }; delete next[categoryId]; return next; }); return; }
    catalogApi.model(modelId).then((result) => {
      const specMap = Object.fromEntries((result?.data?.specifications ?? []).filter((s) => s.value != null).map((s) => [s.key, s.value]));
      setPickedSpecs((prev) => ({ ...prev, [categoryId]: specMap }));
    }).catch(() => {});
  }

  function handleNewSpecChange(categoryId, key, value) {
    setPickedSpecs((prev) => {
      const specs = { ...(prev[categoryId] ?? {}) };
      if (value == null || value === "") delete specs[key]; else specs[key] = value;
      return { ...prev, [categoryId]: specs };
    });
  }

  async function ensureModels(categoryId) {
    if (!categoryId || models[categoryId]) return;
    try {
      const result = await catalogApi.models({ categoryId });
      setModels((prev) => ({ ...prev, [categoryId]: result.data ?? [] }));
    } catch { /* degrade gracefully */ }
  }
  async function ensureDefs(categoryId) {
    if (!categoryId || defs[categoryId]) return;
    try {
      const result = await catalogApi.definitions(categoryId);
      setDefs((prev) => ({ ...prev, [categoryId]: result.data ?? [] }));
    } catch { /* degrade gracefully */ }
  }

  useEffect(() => {
    if (!entry) return;
    for (const component of entry.components ?? []) {
      ensureModels(component.category?.id);
      ensureDefs(component.category?.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry]);

  function setMode(role, mode) { setModes((prev) => ({ ...prev, [role]: mode })); }

  async function submit(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const components = (entry.components ?? []).map((component) => {
      const role = component.role;
      const base = { role, quantity: Number(form.get(`quantity:${role}`) || 1) };
      const mode = modes[role] ?? "existing";
      if (mode === "new") {
        const specs = (defs[component.category?.id] ?? [])
          .map((definition) => {
            const raw = form.get(`spec:${role}:${definition.id}`);
            if (raw == null || raw === "") return null;
            const value = parseSpecValue(raw, definition.dataType);
            return value === undefined ? null : { definitionId: definition.id, value };
          })
          .filter(Boolean);
        return { ...base, mode: "new", name: form.get(`name:${role}`), brandId: form.get(`brand:${role}`), specs };
      }
      const productModelId = form.get(`model:${role}`);
      if (!productModelId) return null; // optional slot left empty -> skip
      return { ...base, mode: "existing", productModelId };
    }).filter(Boolean);

    setBusy(true);
    setNotice(null);
    try {
      await catalogApi.createBuild({ name: form.get("name"), brandId: form.get("brandId"), categoryId, components });
      setNotice({ kind: "success", message: "Build saved. Its components are now catalog parts." });
      formElement.reset();
      setModes({});
      if (onChanged) onChanged();
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid">
      <section className="panel">
        <div className="panelTitle">
          <div>
            <p className="eyebrow">PC BUILDS</p>
            <h2>Full PC builds</h2>
          </div>
        </div>
        <p className="panelIntro">A full PC build is a composite product made of component parts. Each slot selects an existing part or creates a new one inline; the server saves everything atomically.</p>
      </section>

      <section className="panel formPanel">
        <Banner notice={notice} onClose={() => setNotice(null)} />
        <p className="eyebrow">CREATE BUILD</p>
        <h2>New full PC build</h2>
        {loading ? (
          <p className="state" role="status">Loading build template…</p>
        ) : entries.length === 0 ? (
          <p className="state">No build categories are configured yet. Add one from Acquisition → Sell flow.</p>
        ) : (
          <form onSubmit={submit}>
            <Field label="Build name" name="name" required maxLength="160" />
            <label><span>Brand</span><select name="brandId" required><option value="">Select brand</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
            <label><span>Build type</span><select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required><option value="">Select build type</option>{entries.map((e) => <option key={e.entryKey} value={e.category.id}>{e.category.name}</option>)}</select></label>

            {violations.length > 0 && (
              <div className="banner error" role="alert">
                <span>Incompatible components — {violations.map((v) => v.reason).join(" · ")}</span>
              </div>
            )}

            {entry && (
              <div className="buildSlots">
                {entry.components.map((component) => {
                  const role = component.role;
                  const mode = modes[role] ?? "existing";
                  const categoryName = component.category?.name ?? role;
                  return (
                    <fieldset key={role} className="specFields buildSlot" disabled={busy}>
                      <legend>{categoryName}{component.required ? " · required" : ""}</legend>
                      <div className="slotMode" role="radiogroup" aria-label={`${categoryName} source`}>
                        <label><input type="radio" name={`mode:${role}`} checked={mode === "existing"} onChange={() => setMode(role, "existing")} />Select existing</label>
                        <label><input type="radio" name={`mode:${role}`} checked={mode === "new"} onChange={() => setMode(role, "new")} />Add new part</label>
                      </div>
                      {mode === "existing" ? (
                        <label><span>Part model</span><select name={`model:${role}`} required={component.required} onChange={(e) => handleExistingSelect(component.category?.id, e.target.value)}><option value="">Select part</option>{(models[component.category?.id] ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
                      ) : (
                        <>
                          <Field label="Part name" name={`name:${role}`} required maxLength="160" />
                          <label><span>Part brand</span><select name={`brand:${role}`} required><option value="">Select brand</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
                          {(defs[component.category?.id] ?? []).map((definition) => (
                            <label key={definition.id}>
                              <span>{definition.label}{definition.unit ? ` (${definition.unit})` : ""}{definition.required ? " · required" : ""}</span>
                              {definition.dataType === "BOOLEAN" ? (
                                <select name={`spec:${role}:${definition.id}`} onChange={(e) => handleNewSpecChange(component.category?.id, definition.key, e.target.value === "" ? undefined : e.target.value === "true")}><option value="">—</option><option value="true">True</option><option value="false">False</option></select>
                              ) : definition.dataType === "SELECT" ? (
                                <select name={`spec:${role}:${definition.id}`} required={definition.required} onChange={(e) => handleNewSpecChange(component.category?.id, definition.key, e.target.value || undefined)}><option value="">Select {definition.label.toLowerCase()}</option>{(referenceValuesByKey[definition.referenceKey] ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
                              ) : definition.dataType === "JSON" ? (
                                <textarea name={`spec:${role}:${definition.id}`} placeholder='{"key":"value"}' onChange={(e) => handleNewSpecChange(component.category?.id, definition.key, e.target.value || undefined)} />
                              ) : (
                                <input name={`spec:${role}:${definition.id}`} type={definition.dataType === "NUMBER" ? "number" : "text"} step={definition.dataType === "NUMBER" ? "any" : undefined} onChange={(e) => handleNewSpecChange(component.category?.id, definition.key, e.target.value || undefined)} />
                              )}
                            </label>
                          ))}
                        </>
                      )}
                      <Field label="Quantity" name={`quantity:${role}`} type="number" min="1" defaultValue="1" />
                    </fieldset>
                  );
                })}
              </div>
            )}

            <button className="primary" disabled={busy || loading || !entry}>{busy ? "Saving…" : "Save build"}</button>
          </form>
        )}
      </section>
    </div>
  );
}
