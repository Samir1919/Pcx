"use client";

import { useCallback, useEffect, useState } from "react";
import { catalogApi } from "../../../lib/catalog-api";
import { opsApi } from "../../../lib/ops-api";

const resultTypes = ["PASS_FAIL", "NUMBER", "TEXT", "SELECT", "BOOLEAN"];

function newItem() {
  return { code: "", label: "", resultType: "PASS_FAIL", isMandatory: false, isCritical: false, sortOrder: 0 };
}

export default function VerificationPage() {
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [name, setName] = useState("");
  const [version, setVersion] = useState("1.0");
  const [items, setItems] = useState([newItem()]);

  useEffect(() => {
    let cancelled = false;
    catalogApi.categories()
      .then((payload) => {
        if (cancelled) return;
        const list = payload.data ?? [];
        setCategories(list);
        if (list.length > 0) {
          setCategoryId(list[0].id);
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setError("Unable to load verification categories.");
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const load = useCallback(async () => {
    if (!categoryId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const payload = await opsApi.templates(categoryId);
      setTemplates(payload.data);
      // Suggest the next version from the active templates for this category so
      // the operator does not re-type a version each time. This is a convenience
      // default only; the server stores the version and rejects invalid input.
      const versions = (payload.data ?? []).map((t) => Number.parseFloat(t.version)).filter((n) => Number.isFinite(n));
      if (versions.length > 0) {
        const max = Math.floor(Math.max(...versions));
        setVersion((prev) => {
          const current = Number.parseFloat(prev);
          return Number.isFinite(current) && Math.floor(current) > max ? prev : `${max + 1}.0`;
        });
      }
    } catch (err) {
      setError(err.code === "UNAUTHENTICATED" ? "Sign in to view verification templates." : err.message);
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  useEffect(() => { load(); }, [load]);

  function updateItem(index, patch) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  async function createTemplate(event) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      await opsApi.createTemplate({
        categoryId,
        name,
        version,
        items: items.map((item) => ({
          code: item.code,
          label: item.label,
          resultType: item.resultType,
          unit: null,
          isMandatory: item.isMandatory,
          isCritical: item.isCritical,
          sortOrder: Number(item.sortOrder) || 0
        }))
      });
      setName("");
      setVersion("1.0");
      setItems([newItem()]);
      setNotice({ kind: "success", message: "Inspection template created." });
      await load();
    } catch (err) {
      setNotice({ kind: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header>
        <div>
          <p className="eyebrow">OPERATIONS / VERIFICATION</p>
          <h1>Verification templates</h1>
          <p>Category-scoped inspection templates with typed, canonical check items.</p>
        </div>
        <button className="refresh" type="button" onClick={load} disabled={loading}>↻ Refresh</button>
      </header>
      {error ? <div className="banner error" role="alert"><span>{error}</span></div> : null}
      {notice ? <div className={`banner ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.message}</span></div> : null}
      <section className="panel">
        <div className="panelTitle">
          <div>
            <p className="eyebrow">ACTIVE TEMPLATES</p>
            <h2>Inspection templates</h2>
          </div>
          <label className="filter">
            <span>Category</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
        {loading ? <p className="state" role="status">Loading templates…</p> : templates.length === 0 ? <p className="state">No active templates for this category.</p> : (
          <div className="tableWrap">
            <table>
              <thead><tr><th>Template</th><th>Version</th><th>Status</th><th>Created</th></tr></thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id}>
                    <td><strong>{t.name}</strong><small>{t.id.slice(0, 8)}…</small></td>
                    <td>{t.version}</td>
                    <td><span className="pill">{t.status}</span></td>
                    <td>{new Date(t.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="panel formPanel">
        <p className="eyebrow">CREATE TEMPLATE</p>
        <h2>New inspection template</h2>
        <p>Templates are versioned and active. Item codes are canonical lowercase snake_case and unique.</p>
        <form onSubmit={createTemplate}>
          <label><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} required /></label>
          <label><span>Version</span><input value={version} onChange={(e) => setVersion(e.target.value)} required /></label>
          <div>
            <p className="eyebrow">CHECK ITEMS</p>
            {items.map((item, index) => (
              <div key={index} className="itemRow" style={{ border: "1px solid var(--line)", borderRadius: "8px", padding: "10px", marginBottom: "10px" }}>
                <label><span>Code</span><input value={item.code} onChange={(e) => updateItem(index, { code: e.target.value })} pattern="[a-z][a-z0-9_]*" required /></label>
                <label><span>Label</span><input value={item.label} onChange={(e) => updateItem(index, { label: e.target.value })} required /></label>
                <label><span>Result type</span>
                  <select value={item.resultType} onChange={(e) => updateItem(index, { resultType: e.target.value })}>
                    {resultTypes.map((rt) => <option key={rt} value={rt}>{rt}</option>)}
                  </select>
                </label>
                <label className="check"><input type="checkbox" checked={item.isMandatory} onChange={(e) => updateItem(index, { isMandatory: e.target.checked })} /><span>Mandatory</span></label>
                <label className="check"><input type="checkbox" checked={item.isCritical} onChange={(e) => updateItem(index, { isCritical: e.target.checked })} /><span>Critical</span></label>
                <button type="button" disabled={items.length <= 1} onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}>Remove</button>
              </div>
            ))}
            <button type="button" onClick={() => setItems((prev) => [...prev, newItem()])}>Add item</button>
          </div>
          <button className="primary" disabled={busy || loading}>{busy ? "Creating…" : "Create template"}</button>
        </form>
      </section>
    </>
  );
}
