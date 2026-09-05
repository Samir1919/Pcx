"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { catalogApi } from "../../../lib/catalog-api";
import SellFlowPanel from "./sell-flow-panel";
import QuoteConfigPanel from "./quote-config-panel";
import ImportCsvPanel from "./import-csv-panel";

const resources = [{ key: "categories", label: "Categories" }, { key: "brands", label: "Brands" }, { key: "models", label: "Product models" }, { key: "definitions", label: "Attributes" }];
const plural = { categories: "categories", brands: "brands", models: "product-models", definitions: "attribute-definitions" };
const singular = { categories: "category", brands: "brand", models: "product model", definitions: "attribute definition" };
function slug(value) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function Banner({ notice, onClose }) { if (!notice) return null; return <div className={`banner ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.message}</span><button type="button" onClick={onClose} aria-label="Dismiss message">×</button></div>; }
function Field({ label, name, ...props }) { return <label><span>{label}</span><input name={name} {...props} /></label>; }

// Typed attribute-value helpers (mirror the model-specifications page so the
// create/edit forms parse and render every data type identically).
function parseSpecValue(raw, type) {
  if (raw == null || raw === "") return undefined;
  if (type === "NUMBER") { const number = Number(raw); return Number.isFinite(number) ? number : undefined; }
  if (type === "BOOLEAN") { if (raw === "true") return true; if (raw === "false") return false; return undefined; }
  if (type === "JSON") { try { return JSON.parse(raw); } catch { return undefined; } }
  return raw;
}
function specDisplay(value, type) {
  if (value == null) return "";
  return type === "JSON" ? JSON.stringify(value) : String(value);
}
// Build the { definitionId, value } payload from a values map, dropping empty/
// undefined entries. The server still enforces required completeness atomically.
function buildSpecPayload(definitions, values) {
  return definitions
    .map((definition) => (values[definition.id] == null || values[definition.id] === "" ? null : { definitionId: definition.id, value: values[definition.id] }))
    .filter(Boolean);
}

function SpecValueFields({ definitions, values, onChange, disabled }) {
  if (!definitions || definitions.length === 0) return null;
  return (
    <fieldset className="specFields" disabled={disabled}>
      <legend>Attributes</legend>
      {definitions.map((definition) => {
        const value = values?.[definition.id];
        return (
          <label key={definition.id}>
            <span>{definition.label}{definition.unit ? ` (${definition.unit})` : ""}{definition.required ? " · required" : ""}</span>
            {definition.dataType === "BOOLEAN" ? (
              <select value={value == null ? "" : String(value)} onChange={(e) => onChange(definition.id, e.target.value === "" ? undefined : e.target.value === "true")}>
                <option value="">Select value</option>
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            ) : definition.dataType === "JSON" ? (
              <textarea name={`spec:${definition.id}`} value={specDisplay(value, "JSON")} onChange={(e) => onChange(definition.id, parseSpecValue(e.target.value, "JSON"))} placeholder='{"key":"value"}' />
            ) : (
              <input name={`spec:${definition.id}`} type={definition.dataType === "NUMBER" ? "number" : "text"} step={definition.dataType === "NUMBER" ? "any" : undefined} value={specDisplay(value, definition.dataType)} onChange={(e) => onChange(definition.id, parseSpecValue(e.target.value, definition.dataType))} />
            )}
          </label>
        );
      })}
    </fieldset>
  );
}

function CatalogEditModal({ active, record, categories, brands, busy, onClose, onSave }) {
  const [form, setForm] = useState(() => initialForm(active, record));
  const [error, setError] = useState(null);
  const [specDefs, setSpecDefs] = useState([]);
  const [specValues, setSpecValues] = useState({});
  const [specWarning, setSpecWarning] = useState(null);
  const specDirty = useRef(false);

  function set(key, value) { setForm((prev) => ({ ...prev, [key]: value })); }

  // Load the selected category's attribute definitions (and, for an unchanged
  // category, the model's existing values). Changing category clears values and
  // warns, because attribute definitions are category-scoped.
  useEffect(() => {
    if (active !== "models" || !form.categoryId) { setSpecDefs([]); setSpecValues({}); return; }
    let cancelled = false;
    setSpecDefs([]);
    (async () => {
      try {
        const definitionResult = await catalogApi.definitions(form.categoryId);
        if (cancelled) return;
        setSpecDefs(definitionResult.data);
        if (form.categoryId === record.categoryId) {
          const valueResult = await catalogApi.modelValues(record.id);
          if (cancelled) return;
          setSpecValues(Object.fromEntries(valueResult.data.map((item) => [item.specificationDefinitionId, item.value])));
          specDirty.current = false;
          setSpecWarning(null);
        } else {
          setSpecValues({});
          specDirty.current = true;
          setSpecWarning("Category changed — existing attribute values were cleared.");
        }
      } catch { /* definitions fetch can fail; form still works without attributes */ }
    })();
    return () => { cancelled = true; };
  }, [active, form.categoryId, record.categoryId, record.id]);

  function setSpecValue(definitionId, value) {
    specDirty.current = true;
    setSpecValues((prev) => ({ ...prev, [definitionId]: value }));
  }

  function submit(event) {
    event.preventDefault();
    const changes = buildChanges(active, form);
    const statusChanged = (active === "categories" || active === "models") && (form.status ?? "ACTIVE") !== (record.status ?? "ACTIVE") ? form.status : null;
    const specPayload = active === "models" && specDirty.current ? buildSpecPayload(specDefs, specValues) : null;
    if (active === "models" && specDirty.current) {
      const missing = specDefs.filter((d) => d.required && (specValues[d.id] == null || specValues[d.id] === ""));
      if (missing.length > 0) { setError(`Missing required attributes: ${missing.map((d) => d.label).join(", ")}.`); return; }
    }
    if (Object.keys(changes).length === 0 && !statusChanged && !specPayload) { setError("No changes to save."); return; }
    setError(null);
    onSave(changes, statusChanged, specPayload);
  }

  return createPortal(
    <div className="modalOverlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="modalDialog" role="dialog" aria-modal="true" aria-labelledby="catalog-edit-title" onSubmit={submit}>
        <button type="button" className="modalClose" aria-label="Close" onClick={onClose}>×</button>
        <h2 id="catalog-edit-title">Edit {singular[active]}</h2>
        <p>IDs, lifecycle status and audit actor are assigned by the server.</p>

        {active === "categories" && (
          <>
            <Field label="Category name" name="name" defaultValue={form.name} onChange={(e) => set("name", e.target.value)} required maxLength="120" />
            <Field label="Slug" name="slug" defaultValue={form.slug} onChange={(e) => set("slug", e.target.value)} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength="120" />
            <Field label="Sort order" name="sortOrder" type="number" min="0" defaultValue={form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} />
            <label><span>Parent category (optional)</span>
              <select name="parentId" value={form.parentId ?? ""} onChange={(e) => set("parentId", e.target.value || null)}>
                <option value="">Catalog root</option>
                {categories.filter((c) => c.id !== record.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label><span>Status</span>
              <select name="status" value={form.status ?? "ACTIVE"} onChange={(e) => set("status", e.target.value)}>
                <option value="ACTIVE">Active — visible on the storefront</option>
                <option value="INACTIVE">Inactive — hidden from the storefront</option>
              </select>
            </label>
          </>
        )}

        {active === "brands" && (
          <>
            <Field label="Brand name" name="name" defaultValue={form.name} onChange={(e) => set("name", e.target.value)} required maxLength="120" />
            <Field label="Slug" name="slug" defaultValue={form.slug} onChange={(e) => set("slug", e.target.value)} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength="120" />
          </>
        )}

        {active === "models" && (
          <>
            <Field label="Model name" name="name" defaultValue={form.name} onChange={(e) => set("name", e.target.value)} required maxLength="160" />
            <Field label="Slug" name="slug" defaultValue={form.slug} onChange={(e) => set("slug", e.target.value)} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength="160" />
            <label><span>Category</span><select name="categoryId" value={form.categoryId ?? ""} onChange={(e) => set("categoryId", e.target.value)} required><option value="">Select category</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label><span>Brand</span><select name="brandId" value={form.brandId ?? ""} onChange={(e) => set("brandId", e.target.value)} required><option value="">Select brand</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
            <Field label="Model code (optional)" name="modelCode" defaultValue={form.modelCode ?? ""} onChange={(e) => set("modelCode", e.target.value)} />
            <Field label="Search aliases (comma separated)" name="aliases" defaultValue={(form.searchAliases ?? []).join(", ")} onChange={(e) => set("searchAliases", e.target.value)} />
            <label><span>Status</span>
              <select name="status" value={form.status ?? "ACTIVE"} onChange={(e) => set("status", e.target.value)}>
                <option value="ACTIVE">Active — visible on the storefront</option>
                <option value="INACTIVE">Inactive — hidden from the storefront</option>
              </select>
            </label>
            {specWarning && <p className="specWarning" role="status">{specWarning}</p>}
            {specDefs.length === 0 && form.categoryId && <p className="specHint">No active attributes are defined for this category.</p>}
            <SpecValueFields definitions={specDefs} values={specValues} onChange={setSpecValue} disabled={busy} />
          </>
        )}

        {active === "definitions" && (
          <>
            <label className="readonlyField"><span>Canonical key (immutable)</span><code>{form.key}</code></label>
            <label className="readonlyField"><span>Data type (immutable)</span><code>{form.dataType}</code></label>
            <Field label="Display label" name="label" defaultValue={form.label} onChange={(e) => set("label", e.target.value)} required />
            <Field label="Unit (optional)" name="unit" defaultValue={form.unit ?? ""} onChange={(e) => set("unit", e.target.value)} />
            <Field label="Sort order" name="sortOrder" type="number" min="0" defaultValue={form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} />
            <label className="check"><input type="checkbox" name="filterable" defaultChecked={form.filterable} onChange={(e) => set("filterable", e.target.checked)} /><span>Available as a catalog filter</span></label>
            <label className="check"><input type="checkbox" name="required" defaultChecked={form.required} onChange={(e) => set("required", e.target.checked)} /><span>Required for models in this category</span></label>
          </>
        )}

        {error && <p className="dialogError" role="alert">{error}</p>}
        <div className="modalActions">
          <button type="button" className="danger" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="primary" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
        </div>
      </form>
    </div>,
    document.body
  );
}

function initialForm(active, record) {
  if (active === "definitions") {
    return {
      key: record.key,
      dataType: record.dataType,
      label: record.label ?? "",
      unit: record.unit ?? "",
      sortOrder: record.sortOrder ?? 0,
      filterable: record.filterable === true,
      required: record.required === true
    };
  }
  return {
    name: record.name ?? "",
    slug: record.slug ?? "",
    sortOrder: record.sortOrder ?? 0,
    status: record.status ?? "ACTIVE",
    parentId: record.parentId ?? null,
    categoryId: record.categoryId ?? null,
    brandId: record.brandId ?? null,
    modelCode: record.modelCode ?? null,
    searchAliases: record.searchAliases ?? []
  };
}

function buildChanges(active, form) {
  if (active === "categories") {
    return { name: form.name, slug: form.slug, sortOrder: Number(form.sortOrder) || 0, parentId: form.parentId || null };
  }
  if (active === "brands") return { name: form.name, slug: form.slug };
  if (active === "models") {
    return {
      name: form.name,
      slug: form.slug,
      categoryId: form.categoryId,
      brandId: form.brandId,
      modelCode: form.modelCode ? String(form.modelCode) : null,
      searchAliases: String(form.searchAliases ?? "").split(",").map((v) => v.trim()).filter(Boolean)
    };
  }
  // definitions
  return {
    label: form.label,
    unit: form.unit ? String(form.unit) : null,
    filterable: form.filterable === true,
    required: form.required === true,
    sortOrder: Number(form.sortOrder) || 0
  };
}

export default function CatalogWorkspace() {
  const [active, setActive] = useState("categories");
  const [data, setData] = useState({ categories: [], brands: [], models: [], definitions: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [modelsCursor, setModelsCursor] = useState(null);
  const [modelsNextCursor, setModelsNextCursor] = useState(null);
  const [editRecord, setEditRecord] = useState(null);
  const [adminCategories, setAdminCategories] = useState([]);
  const [createCategoryId, setCreateCategoryId] = useState("");
  const [createDefs, setCreateDefs] = useState([]);
  const [createSpecValues, setCreateSpecValues] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [categories, brands, models, definitions] = await Promise.all([
        catalogApi.categories(),
        catalogApi.brands(),
        catalogApi.adminModels(),
        catalogApi.definitions(categoryFilter)
      ]);
      setData({ categories: categories.data, brands: brands.data, models: models.data, definitions: definitions.data });
      setAdminCategories((await catalogApi.adminCategories()).data);
      setModelsCursor(null);
      setModelsNextCursor(models.meta?.nextCursor ?? null);
      setNotice(null);
    } catch (error) {
      setNotice({ kind: "error", message: error.status === 401 ? "Sign in with an authorized admin account to manage the catalog." : error.message });
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  const loadModelsPage = useCallback(async (cursor) => {
    setLoading(true);
    try {
      const result = await catalogApi.adminModels({ cursor });
      setData((prev) => ({ ...prev, models: result.data }));
      setModelsCursor(cursor ?? null);
      setModelsNextCursor(result.meta?.nextCursor ?? null);
      setNotice(null);
    } catch (error) {
      setNotice({ kind: "error", message: error.status === 401 ? "Sign in with an authorized admin account to manage the catalog." : error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const names = useMemo(() => ({
    category: Object.fromEntries(data.categories.map((r) => [r.id, r.name])),
    brand: Object.fromEntries(data.brands.map((r) => [r.id, r.name]))
  }), [data]);

  async function handleCreateCategoryChange(categoryId) {
    setCreateCategoryId(categoryId);
    setCreateSpecValues({});
    if (!categoryId) { setCreateDefs([]); return; }
    try {
      const result = await catalogApi.definitions(categoryId);
      setCreateDefs(result.data);
    } catch {
      setCreateDefs([]);
    }
  }

  async function create(event) {
    event.preventDefault();
    setBusy(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      if (active === "models") {
        const missing = createDefs.filter((d) => d.required && (createSpecValues[d.id] == null || createSpecValues[d.id] === ""));
        if (missing.length > 0) {
          setNotice({ kind: "error", message: `Missing required attributes: ${missing.map((d) => d.label).join(", ")}.` });
          return;
        }
        const model = await catalogApi.createModel({ name: form.get("name"), slug: form.get("slug")?.trim() || slug(form.get("name")), categoryId: form.get("categoryId"), brandId: form.get("brandId"), modelCode: form.get("modelCode") || null, searchAliases: form.get("aliases").split(",").map((v) => v.trim()).filter(Boolean) });
        const specPayload = buildSpecPayload(createDefs, createSpecValues);
        if (specPayload.length > 0) {
          try {
            await catalogApi.setModelValues(model.data.id, specPayload);
          } catch (error) {
            setNotice({ kind: "error", message: "Model created, but its attributes could not be saved: " + error.message });
            await load();
            return;
          }
        }
        formElement.reset();
        setCreateSpecValues({});
        setCreateDefs([]);
        setCreateCategoryId("");
        setNotice({ kind: "success", message: "Product model saved with its attributes." });
        await load();
        return;
      }
      if (active === "categories") await catalogApi.createCategory({ name: form.get("name"), slug: form.get("slug")?.trim() || slug(form.get("name")), sortOrder: Number(form.get("sortOrder") || 0) });
      if (active === "brands") await catalogApi.createBrand({ name: form.get("name"), slug: form.get("slug")?.trim() || slug(form.get("name")) });
      if (active === "definitions") await catalogApi.createDefinition({ categoryId: form.get("categoryId"), key: form.get("key"), label: form.get("label"), dataType: form.get("dataType"), unit: form.get("unit") || null, filterable: form.get("filterable") === "on", required: form.get("required") === "on", sortOrder: Number(form.get("sortOrder") || 0) });
      formElement.reset();
      setNotice({ kind: "success", message: "Catalog record saved." });
      await load();
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function archive(record) {
    if (!window.confirm(`Archive ${record.name ?? record.label}? Historical references will be preserved.`)) return;
    setBusy(true);
    try {
      await catalogApi.archive(plural[active], record.id);
      setNotice({ kind: "success", message: "Record archived. Historical references remain intact." });
      await load();
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function remove(record) {
    if (!window.confirm(`Permanently delete ${record.name ?? record.label}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await catalogApi.remove(plural[active], record.id);
      setNotice({ kind: "success", message: "Record permanently deleted." });
      await load();
    } catch (error) {
      setNotice({ kind: "error", message: error.status === 409 ? "This record is still referenced. Use Archive instead." : error.message });
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(changes, status, specPayload) {
    if (!editRecord) return;
    setBusy(true);
    setNotice(null);
    try {
      if (Object.keys(changes).length > 0) {
        await catalogApi.update(plural[active], editRecord.id, changes);
      }
      if (status) {
        await catalogApi.setStatus(plural[active], editRecord.id, status);
      }
      if (specPayload && specPayload.length > 0) {
        await catalogApi.setModelValues(editRecord.id, specPayload);
      }
      setEditRecord(null);
      setNotice({ kind: "success", message: "Record updated." });
      await load();
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  const rows = active === "categories" ? adminCategories : data[active];

  return (
    <>
      <header>
        <div>
          <p className="eyebrow">OPERATIONS / CATALOG</p>
          <h1>Catalog workspace</h1>
          <p>Manage generic product identity and category-specific attributes. Physical serials, cost and health never belong here.</p>
        </div>
        <button className="refresh" type="button" onClick={load} disabled={loading}>↻ Refresh</button>
      </header>
      <Banner notice={notice} onClose={() => setNotice(null)} />
      <div className="tabs" role="tablist" aria-label="Catalog resources">
        {resources.map((r) => (
          <button key={r.key} role="tab" aria-selected={active === r.key} onClick={() => setActive(r.key)}>
            {r.label}<span>{data[r.key].length}</span>
          </button>
        ))}
        <button role="tab" aria-selected={active === "sellflow"} onClick={() => setActive("sellflow")}>
          Sell flow
        </button>
        <button role="tab" aria-selected={active === "quotes"} onClick={() => setActive("quotes")}>
          Quotes
        </button>
        <button role="tab" aria-selected={active === "import"} onClick={() => setActive("import")}>
          Import CSV
        </button>
      </div>
      {active === "import" ? (
        <ImportCsvPanel onImported={load} />
      ) : active === "quotes" ? (
        <QuoteConfigPanel />
      ) : active === "sellflow" ? (
        <SellFlowPanel categories={data.categories} />
      ) : (
        <div className="grid">
          <section className="panel">
            <div className="panelTitle">
              <div>
                <p className="eyebrow">ACTIVE RECORDS</p>
                <h2>{resources.find((r) => r.key === active).label}</h2>
              </div>
              {active === "definitions" && (
                <label className="filter">
                  <span>Category</span>
                  <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                    <option value="">All categories</option>
                    {data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              )}
            </div>
            {loading ? (
              <p className="state" role="status">Loading catalog…</p>
            ) : rows.length === 0 ? (
              <p className="state">No active records found.</p>
            ) : (
              <>
                <div className="tableWrap">
                  <table>
                    <thead><tr><th>Name</th><th>Context</th><th>Status</th><th><span className="sr">Actions</span></th></tr></thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <strong>
                              {active === "models"
                                ? <a className="modelLink" href={`/catalog/models/${encodeURIComponent(r.id)}/specifications`}>{r.name}</a>
                                : r.name ?? r.label}
                            </strong>
                            <small>{r.slug ?? r.key}</small>
                          </td>
                          <td>
                            {active === "models"
                              ? `${names.brand[r.brandId] ?? "Unknown brand"} · ${names.category[r.categoryId] ?? "Unknown category"}`
                              : active === "definitions"
                                ? `${names.category[r.categoryId] ?? "Unknown category"} · ${r.dataType}${r.unit ? ` · ${r.unit}` : ""}`
                                : r.parentId ? "Nested category" : "Catalog root"}
                          </td>
                          <td>
                            {(active === "categories" || active === "models")
                              ? (r.status === "INACTIVE"
                                ? <span className="pill muted">Inactive</span>
                                : <span className="pill">Active</span>)
                              : <span className="pill">Active</span>}
                          </td>
                          <td>
                            <div className="actions">
                              <button type="button" disabled={busy} onClick={() => setEditRecord(r)}>Edit</button>
                              {active !== "definitions" && <button className="danger" type="button" disabled={busy} onClick={() => remove(r)}>Delete</button>}
                              <button type="button" disabled={busy} onClick={() => archive(r)}>Archive</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {active === "models" && (
                  <div className="pager">
                    <button type="button" disabled={!modelsCursor || loading} onClick={() => loadModelsPage(null)}>← First</button>
                    <button type="button" disabled={!modelsNextCursor || loading} onClick={() => loadModelsPage(modelsNextCursor)}>Next →</button>
                  </div>
                )}
              </>
            )}
          </section>
          <section className="panel formPanel">
            <p className="eyebrow">CREATE RECORD</p>
            <h2>New {singular[active]}</h2>
            <p>IDs, lifecycle status and audit actor are assigned by the server.</p>
            <form onSubmit={create}>
              {active === "categories" && (<><Field label="Category name" name="name" required maxLength="120" /><Field label="Slug" name="slug" placeholder="Auto-generated from name" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength="120" /><Field label="Sort order" name="sortOrder" type="number" min="0" defaultValue="0" /></>)}
              {active === "brands" && (<><Field label="Brand name" name="name" required maxLength="120" /><Field label="Slug" name="slug" placeholder="Auto-generated from name" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength="120" /></>)}
              {active === "models" && (
                <>
                  <Field label="Model name" name="name" required maxLength="160" />
                  <Field label="Slug" name="slug" placeholder="Auto-generated from name" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength="160" />
                  <label><span>Category</span><select name="categoryId" required onChange={(e) => handleCreateCategoryChange(e.target.value)}><option value="">Select category</option>{data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                  <label><span>Brand</span><select name="brandId" required><option value="">Select brand</option>{data.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
                  <Field label="Model code (optional)" name="modelCode" />
                  <Field label="Search aliases (comma separated)" name="aliases" />
                  {createCategoryId && createDefs.length === 0 && <p className="specHint">No active attributes are defined for this category.</p>}
                  <SpecValueFields definitions={createDefs} values={createSpecValues} onChange={(definitionId, value) => setCreateSpecValues((prev) => ({ ...prev, [definitionId]: value }))} disabled={busy} />
                </>
              )}
              {active === "definitions" && (
                <>
                  <label><span>Category</span><select name="categoryId" required><option value="">Select category</option>{data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                  <Field label="Canonical key" name="key" pattern="[a-z][a-z0-9_]*" placeholder="memory_gb" required />
                  <Field label="Display label" name="label" required />
                  <label><span>Data type</span><select name="dataType" required><option>TEXT</option><option>NUMBER</option><option>BOOLEAN</option><option>JSON</option></select></label>
                  <Field label="Unit (optional)" name="unit" />
                  <Field label="Sort order" name="sortOrder" type="number" min="0" defaultValue="0" />
                  <label className="check"><input type="checkbox" name="filterable" /><span>Available as a catalog filter</span></label>
                  <label className="check"><input type="checkbox" name="required" /><span>Required for models in this category</span></label>
                </>
              )}
              <button className="primary" disabled={busy || loading}>{busy ? "Saving…" : "Save record"}</button>
            </form>
          </section>
        </div>
      )}
      {editRecord && (
        <CatalogEditModal
          active={active}
          record={editRecord}
          categories={data.categories}
          brands={data.brands}
          busy={busy}
          onClose={() => setEditRecord(null)}
          onSave={saveEdit}
        />
      )}
    </>
  );
}
