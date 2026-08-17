"use client";

import { useCallback, useEffect, useState } from "react";
import { catalogApi } from "../../../lib/catalog-api";
import { opsApi } from "../../../lib/ops-api";

export default function VerificationPage() {
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
          // No categories: land in a resolved (non-loading) state instead of
          // hanging on "Loading templates…" forever.
          setLoading(false);
        }
      })
      .catch(() => {
        if (cancelled) return;
        // Surface a stable error and clear loading so the page never hangs.
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
    } catch (err) {
      setError(err.code === "UNAUTHENTICATED" ? "Sign in to view verification templates." : err.message);
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  useEffect(() => { load(); }, [load]);

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
    </>
  );
}
