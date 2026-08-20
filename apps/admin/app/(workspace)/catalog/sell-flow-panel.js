"use client";

import { useCallback, useEffect, useState } from "react";
import { sellTaxonomyApi } from "../../../lib/sell-taxonomy-api.js";

const ICON_KEYS = [
  { key: "desktop", label: "🖥️ Desktop" },
  { key: "parts", label: "🔧 Desktop parts" },
  { key: "laptop", label: "💻 Laptop" },
  { key: "laptop-parts", label: "🔩 Laptop parts" }
];

function Banner({ notice, onClose }) { if (!notice) return null; return <div className={`banner ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.message}</span><button type="button" onClick={onClose} aria-label="Dismiss message">×</button></div>; }

export default function SellFlowPanel({ categories }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

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

  return (
    <>
      <p className="state" role="status" style={{ padding: "12px 0" }}>
        Configure the public sell entries. Categories stay the single catalog source of truth; this only maps which category is a sell entry and how builds resolve component roles.
      </p>
      <Banner notice={notice} onClose={() => setNotice(null)} />
      {loading ? <p className="state" role="status">Loading sell flow…</p> : (
        <div className="grid" style={{ marginTop: 0, marginBottom: 18 }}>
          {entries.map((entry) => (
            <section key={entry.entryKey} className="panel">
              <div className="panelTitle">
                <div>
                  <p className="eyebrow">SELL ENTRY · {entry.kind}</p>
                  <h2>{entry.category?.name ?? entry.entryKey}</h2>
                  <small style={{ color: "var(--muted, #667)" }}>{entry.entryKey} → {entry.category?.slug ?? entry.category?.id}</small>
                </div>
                <label className="check"><input type="checkbox" checked={entry.isActive} disabled={busy} onChange={(e) => patchEntry(entry.entryKey, { isActive: e.target.checked })} /><span>Active</span></label>
              </div>

              <label><span>Icon</span>
                <select value={entry.iconKey} disabled={busy} onChange={(e) => patchEntry(entry.entryKey, { iconKey: e.target.value })}>
                  {ICON_KEYS.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}
                </select>
              </label>
              <label><span>Hint</span><input type="text" defaultValue={entry.hint} disabled={busy} onBlur={(e) => { const value = e.target.value.trim(); if (value && value !== entry.hint) patchEntry(entry.entryKey, { hint: value }); }} /></label>
              <label><span>Sort order</span><input type="number" min="0" defaultValue={entry.sortOrder} disabled={busy} onBlur={(e) => { const value = Number(e.target.value); if (Number.isSafeInteger(value) && value !== entry.sortOrder) patchEntry(entry.entryKey, { sortOrder: value }); }} /></label>

              {entry.kind === "PARTS" && (
                <div className="tableWrap" style={{ marginTop: 10 }}>
                  <table>
                    <thead><tr><th>Part subcategories</th></tr></thead>
                    <tbody>
                      {entry.children.length === 0
                        ? <tr><td><span className="state">No active part subcategories.</span></td></tr>
                        : entry.children.map((child) => <tr key={child.id}><td>{child.name}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              )}

              {entry.kind === "BUILD" && (
                <div className="tableWrap" style={{ marginTop: 10 }}>
                  <table>
                    <thead><tr><th>Role</th><th>Component category</th><th>Required</th><th>Order</th></tr></thead>
                    <tbody>
                      {entry.components.map((component) => (
                        <tr key={component.role}>
                          <td><code>{component.role}</code></td>
                          <td>
                            <select value={component.category.id} disabled={busy} onChange={(e) => patchComponent(entry.entryKey, component.role, { categoryId: e.target.value })}>
                              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </td>
                          <td><input type="checkbox" checked={component.required} disabled={busy} onChange={(e) => patchComponent(entry.entryKey, component.role, { required: e.target.checked })} /></td>
                          <td>
                            <input type="number" min="0" defaultValue={component.sortOrder} style={{ width: 80 }} disabled={busy} onBlur={(e) => { const value = Number(e.target.value); if (Number.isSafeInteger(value) && value !== component.sortOrder) patchComponent(entry.entryKey, component.role, { sortOrder: value }); }} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
