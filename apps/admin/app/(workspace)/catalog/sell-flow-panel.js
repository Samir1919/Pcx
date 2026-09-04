"use client";

import { useCallback, useEffect, useState } from "react";
import { sellTaxonomyApi } from "../../../lib/sell-taxonomy-api.js";

const ICON_KEYS = [
  { key: "desktop", label: "🖥️ Desktop" },
  { key: "parts", label: "🔧 Desktop parts" },
  { key: "laptop", label: "💻 Laptop" },
  { key: "laptop-parts", label: "🔩 Laptop parts" },
  { key: "phone", label: "📱 Phone" },
  { key: "tablet", label: "📲 Tablet" },
  { key: "monitor", label: "🖥️ Monitor" },
  { key: "audio", label: "🔊 Audio" },
  { key: "camera", label: "📷 Camera" },
  { key: "accessory", label: "🎧 Accessory" }
];

function Banner({ notice, onClose }) { if (!notice) return null; return <div className={`banner ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.message}</span><button type="button" onClick={onClose} aria-label="Dismiss message">×</button></div>; }

export default function SellFlowPanel({ categories }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [editingRole, setEditingRole] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await sellTaxonomyApi.list();
      setEntries(payload.data ?? []);
      setNotice(null);
    } catch (error) {
      setNotice({ kind: "error", message: error.status === 401 ? "Sign in to manage the sell flow." : error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function patchEntry(entryKey, patch) {
    setBusy(true);
    setNotice(null);
    try {
      await sellTaxonomyApi.updateEntry(entryKey, patch);
      setNotice({ kind: "success", message: "Sell entry updated." });
      await load();
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function patchComponent(entryKey, role, patch) {
    setBusy(true);
    setNotice(null);
    try {
      await sellTaxonomyApi.updateComponent(entryKey, role, patch);
      setNotice({ kind: "success", message: "Build component updated." });
      await load();
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function createEntry(event) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    setBusy(true);
    setNotice(null);
    try {
      await sellTaxonomyApi.createEntry({
        categoryId: form.get("categoryId"),
        kind: form.get("kind"),
        iconKey: form.get("iconKey"),
        hint: form.get("hint"),
        sortOrder: Number(form.get("sortOrder") || 0),
        isActive: form.get("isActive") === "on"
      });
      setNotice({ kind: "success", message: "Sell entry added." });
      formEl.reset();
      await load();
    } catch (error) {
      setNotice({ kind: "error", message: error.status === 409 ? "This category is already a sell entry." : error.message });
    } finally {
      setBusy(false);
    }
  }

  async function deleteEntry(entryKey) {
    if (!window.confirm(`Remove this sell entry (${entryKey})? Its build components are removed too.`)) return;
    setBusy(true);
    setNotice(null);
    try {
      await sellTaxonomyApi.deleteEntry(entryKey);
      setNotice({ kind: "success", message: "Sell entry removed." });
      await load();
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function createComponent(event, entryKey) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    setBusy(true);
    setNotice(null);
    try {
      await sellTaxonomyApi.createComponent(entryKey, {
        role: form.get("role"),
        categoryId: form.get("categoryId"),
        required: form.get("required") === "on",
        sortOrder: Number(form.get("sortOrder") || 0)
      });
      setNotice({ kind: "success", message: "Build component added." });
      formEl.reset();
      await load();
    } catch (error) {
      setNotice({ kind: "error", message: error.status === 409 ? "That role already exists for this entry." : error.message });
    } finally {
      setBusy(false);
    }
  }

  async function deleteComponent(entryKey, role) {
    setBusy(true);
    setNotice(null);
    try {
      await sellTaxonomyApi.deleteComponent(entryKey, role);
      setNotice({ kind: "success", message: "Build component removed." });
      await load();
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className="panelIntro" role="status">
        Configure the public sell entries. Categories stay the single catalog source of truth; this only maps which category is a sell entry and how builds resolve component roles.
      </p>
      <Banner notice={notice} onClose={() => setNotice(null)} />
      <section className="panel formPanel">
        <p className="eyebrow">ADD SELL ENTRY</p>
        <h2>Promote a category to a sell entry</h2>
        <p>The entry key and lifecycle status are derived by the server from the category slug.</p>
        <form onSubmit={createEntry}>
          <label><span>Category</span>
            <select name="categoryId" required>
              <option value="">Select category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label><span>Kind</span>
            <select name="kind" required>
              <option value="PARTS">PARTS — single parts (maps subcategories)</option>
              <option value="BUILD">BUILD — full-system build</option>
            </select>
          </label>
          <label><span>Icon</span>
            <select name="iconKey" defaultValue="desktop" required>
              {ICON_KEYS.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}
            </select>
          </label>
          <label><span>Hint</span><input name="hint" required maxLength="160" placeholder="Sell a …" /></label>
          <label><span>Sort order</span><input name="sortOrder" type="number" min="0" defaultValue="50" /></label>
          <label className="check"><input name="isActive" type="checkbox" defaultChecked /><span>Active (visible to customers)</span></label>
          <button className="primary" disabled={busy || loading}>{busy ? "Saving…" : "Add sell entry"}</button>
        </form>
      </section>
      {loading ? <p className="state" role="status">Loading sell flow…</p> : (
        <div className="cardGrid">
          {entries.map((entry) => (
            <section key={entry.entryKey} className={`panel${entry.kind === "BUILD" ? " panelWide" : ""}`}>
              <div className="panelTitle">
                <div>
                  <p className="eyebrow">SELL ENTRY · {entry.kind}</p>
                  <h2>{entry.category?.name ?? entry.entryKey}</h2>
                  <small className="entryRef">{entry.entryKey} → {entry.category?.slug ?? entry.category?.id}</small>
                </div>
                <div className="actions">
                  <label className="check"><input type="checkbox" checked={entry.isActive} disabled={busy} onChange={(e) => patchEntry(entry.entryKey, { isActive: e.target.checked })} /><span>Active</span></label>
                  <button type="button" className="danger" disabled={busy} onClick={() => deleteEntry(entry.entryKey)}>Remove</button>
                </div>
              </div>

              <div className="entryMeta">
                <label><span>Icon</span>
                  <select value={entry.iconKey} disabled={busy} onChange={(e) => patchEntry(entry.entryKey, { iconKey: e.target.value })}>
                    {ICON_KEYS.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}
                  </select>
                </label>
                <label><span>Hint</span><input type="text" defaultValue={entry.hint} disabled={busy} onBlur={(e) => { const value = e.target.value.trim(); if (value && value !== entry.hint) patchEntry(entry.entryKey, { hint: value }); }} /></label>
                <label><span>Sort order</span><input type="number" min="0" defaultValue={entry.sortOrder} disabled={busy} onBlur={(e) => { const value = Number(e.target.value); if (Number.isSafeInteger(value) && value !== entry.sortOrder) patchEntry(entry.entryKey, { sortOrder: value }); }} /></label>
              </div>

              {entry.kind === "PARTS" && (
                <div className="partsList entryTable">
                  {entry.children.length === 0
                    ? <span className="state">No active part subcategories.</span>
                    : entry.children.map((child) => <span key={child.id} className="partChip">{child.name}</span>)}
                </div>
              )}

              {entry.kind === "BUILD" && (
                <>
                  <div className="tableWrap entryTable">
                    <table>
                      <thead><tr><th>Role</th><th>Component category</th><th>Required</th><th>Order</th><th aria-label="Actions"></th></tr></thead>
                      <tbody>
                        {entry.components.length === 0
                          ? <tr><td colSpan="5"><span className="state">No build roles yet. Add one below.</span></td></tr>
                          : entry.components.map((component) => (
                            <tr key={component.role}>
                              <td><code>{component.role}</code></td>
                              <td>
                                {editingRole === component.role ? (
                                  <select value={component.category.id} disabled={busy} autoFocus onBlur={() => setEditingRole(null)} onChange={(e) => { patchComponent(entry.entryKey, component.role, { categoryId: e.target.value }); setEditingRole(null); }}>
                                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                  </select>
                                ) : (
                                  <button type="button" className="categoryLink" disabled={busy} onClick={() => setEditingRole(component.role)}>{component.category?.name ?? "Choose category"}</button>
                                )}
                              </td>
                              <td><label className="check"><input type="checkbox" checked={component.required} disabled={busy} onChange={(e) => patchComponent(entry.entryKey, component.role, { required: e.target.checked })} /></label></td>
                              <td>
                                <input type="number" min="0" defaultValue={component.sortOrder} className="numInput" disabled={busy} onBlur={(e) => { const value = Number(e.target.value); if (Number.isSafeInteger(value) && value !== component.sortOrder) patchComponent(entry.entryKey, component.role, { sortOrder: value }); }} />
                              </td>
                              <td><button type="button" className="danger" disabled={busy} onClick={() => deleteComponent(entry.entryKey, component.role)}>Remove</button></td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  <form className="subPanel" onSubmit={(e) => createComponent(e, entry.entryKey)}>
                    <p className="eyebrow">ADD BUILD ROLE</p>
                    <label><span>Role</span><input name="role" required pattern="[a-z][a-z0-9-]*" maxLength="40" placeholder="e.g. panel" /></label>
                    <label><span>Component category</span><select name="categoryId" required><option value="">Select category</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                    <label><span>Sort order</span><input name="sortOrder" type="number" min="0" defaultValue="0" /></label>
                    <label className="check"><input name="required" type="checkbox" /><span>Required</span></label>
                    <button className="primary" disabled={busy}>Add role</button>
                  </form>
                </>
              )}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
