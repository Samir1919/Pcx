"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { catalogApi } from "../../../lib/catalog-api";

function slugify(value) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

// Manage reusable attribute sets (part templates): create a set, add/remove
// global attribute definitions with per-assignment required/sort order, and
// assign the set to one or more categories. Mirrors Magento's attribute-set
// manager (an attribute set is a named group of attributes assigned to a
// category/product type).
export default function AttributeSetsPanel({ categories, definitions, onChanged }) {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [managing, setManaging] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const result = await catalogApi.attributeSets();
      setSets(result.data);
      setNotice(null);
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const categoryName = (id) => categories.find((c) => c.id === id)?.name ?? "Unknown category";
  const definitionLabel = (id) => definitions.find((d) => d.id === id)?.label ?? id;

  async function createSet(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    try {
      await catalogApi.createAttributeSet({ key: form.get("key").trim() || slugify(form.get("label")), label: form.get("label") });
      formElement.reset();
      setNotice({ kind: "success", message: "Attribute set saved." });
      await load();
      if (onChanged) onChanged();
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function refreshManaging(setId) {
    const fresh = await catalogApi.attributeSets();
    setSets(fresh.data);
    setManaging(fresh.data.find((s) => s.id === setId) ?? null);
  }

  async function addItem(event, setId) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await catalogApi.addAttributeSetItem(setId, {
        definitionId: form.get("definitionId"),
        required: form.get("required") === "on",
        sortOrder: Number(form.get("sortOrder") || 0)
      });
      setNotice({ kind: "success", message: "Attribute added to the set." });
      await refreshManaging(setId);
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(setId, definitionId) {
    if (!window.confirm(`Remove ${definitionLabel(definitionId)} from this set?`)) return;
    setBusy(true);
    try {
      await catalogApi.removeAttributeSetItem(setId, definitionId);
      setNotice({ kind: "success", message: "Attribute removed from the set." });
      await refreshManaging(setId);
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function assignCategory(setId, categoryId) {
    setBusy(true);
    try {
      await catalogApi.assignAttributeSetToCategory(setId, categoryId);
      setNotice({ kind: "success", message: "Set assigned to the category." });
      await refreshManaging(setId);
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function unassignCategory(setId, categoryId) {
    setBusy(true);
    try {
      await catalogApi.unassignAttributeSetFromCategory(setId, categoryId);
      setNotice({ kind: "success", message: "Set unassigned from the category." });
      await refreshManaging(setId);
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function archiveSet(setId, label) {
    if (!window.confirm(`Archive the "${label}" attribute set? Historical references will be preserved.`)) return;
    setBusy(true);
    try {
      await catalogApi.archiveAttributeSet(setId);
      setNotice({ kind: "success", message: "Attribute set archived." });
      setManaging(null);
      await load();
      if (onChanged) onChanged();
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  const manage = managing && sets.find((s) => s.id === managing.id);
  const availableDefinitions = manage ? definitions.filter((d) => !manage.items.some((i) => i.definitionId === d.id)) : [];
  const availableCategories = manage ? categories.filter((c) => !manage.categoryIds.includes(c.id)) : [];

  return (
    <div className="grid">
      <section className="panel">
        <div className="panelTitle">
          <div>
            <p className="eyebrow">REUSABLE ATTRIBUTE SETS</p>
            <h2>Attribute sets</h2>
          </div>
        </div>
        {notice && <div className={`banner ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>{notice.message}<button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message">×</button></div>}
        {loading ? (
          <p className="state" role="status">Loading attribute sets…</p>
        ) : sets.length === 0 ? (
          <p className="state">No attribute sets defined yet.</p>
        ) : (
          <div className="tableWrap">
            <table>
              <thead><tr><th>Name</th><th>Key</th><th>Attributes</th><th>Categories</th><th><span className="sr">Actions</span></th></tr></thead>
              <tbody>
                {sets.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.label}</strong></td>
                    <td><small>{s.key}</small></td>
                    <td>{s.items.length}</td>
                    <td>{s.categoryIds.length}</td>
                    <td><div className="actions"><button type="button" disabled={busy} onClick={() => setManaging(s)}>Manage</button><button className="danger" type="button" disabled={busy} onClick={() => archiveSet(s.id, s.label)}>Archive</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="panel formPanel">
        <p className="eyebrow">CREATE SET</p>
        <h2>New attribute set</h2>
        <p>An attribute set groups global attributes and is assigned to one or more categories.</p>
        <form onSubmit={createSet}>
          <label><span>Set name</span><input name="label" required maxLength="120" /></label>
          <label><span>Key</span><input name="key" placeholder="Auto-generated from name" pattern="[a-z][a-z0-9_-]*" maxLength="120" /></label>
          <button className="primary" disabled={busy || loading}>{busy ? "Saving…" : "Save set"}</button>
        </form>
      </section>

      {manage && createPortal(
        <div className="modalOverlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setManaging(null); }}>
          <div className="modalDialog wide" role="dialog" aria-modal="true" aria-label={`Manage ${manage.label}`}>
            <button type="button" className="modalClose" aria-label="Close" onClick={() => setManaging(null)}>×</button>
            <h2>Manage {manage.label}</h2>
            <p className="eyebrow">KEY · {manage.key}</p>

            <h3>Attributes</h3>
            {manage.items.length === 0 ? (
              <p className="state">This set has no attributes yet.</p>
            ) : (
              <ul className="setItemList">
                {manage.items.map((item) => (
                  <li key={item.definitionId}>
                    <div>
                      <strong>{item.label}</strong>
                      <small>{item.key} · {item.dataType}{item.unit ? ` · ${item.unit}` : ""}{item.required ? " · required" : ""}</small>
                    </div>
                    <button type="button" className="danger" disabled={busy} onClick={() => removeItem(manage.id, item.definitionId)}>Remove</button>
                  </li>
                ))}
              </ul>
            )}

            <form className="inlineForm" onSubmit={(e) => addItem(e, manage.id)}>
              <label><span>Attribute</span>
                <select name="definitionId" required disabled={availableDefinitions.length === 0}>
                  <option value="">{availableDefinitions.length === 0 ? "All attributes already added" : "Select attribute"}</option>
                  {availableDefinitions.map((d) => <option key={d.id} value={d.id}>{d.label} ({d.key})</option>)}
                </select>
              </label>
              <label><span>Sort order</span><input name="sortOrder" type="number" min="0" defaultValue="0" /></label>
              <label className="check"><input type="checkbox" name="required" /><span>Required</span></label>
              <button className="primary" disabled={busy || availableDefinitions.length === 0}>{busy ? "Saving…" : "Add attribute"}</button>
            </form>

            <h3>Categories</h3>
            {manage.categoryIds.length === 0 ? (
              <p className="state">Not assigned to any category.</p>
            ) : (
              <ul className="setItemList">
                {manage.categoryIds.map((id) => (
                  <li key={id}>
                    <div><strong>{categoryName(id)}</strong></div>
                    <button type="button" className="danger" disabled={busy} onClick={() => unassignCategory(manage.id, id)}>Unassign</button>
                  </li>
                ))}
              </ul>
            )}

            <form className="inlineForm" onSubmit={(e) => { e.preventDefault(); const v = new FormData(e.currentTarget).get("categoryId"); if (v) assignCategory(manage.id, v); }}>
              <label><span>Assign category</span>
                <select name="categoryId" required disabled={availableCategories.length === 0}>
                  <option value="">{availableCategories.length === 0 ? "Assigned to every category" : "Select category"}</option>
                  {availableCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <button className="primary" disabled={busy || availableCategories.length === 0}>{busy ? "Saving…" : "Assign"}</button>
            </form>

            <div className="modalActions">
              <button type="button" className="danger" onClick={() => setManaging(null)} disabled={busy}>Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}


