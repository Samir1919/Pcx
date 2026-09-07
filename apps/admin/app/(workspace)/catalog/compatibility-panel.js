"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { catalogApi } from "../../../lib/catalog-api";

function Banner({ notice, onClose }) {
  if (!notice) return null;
  return <div className={`banner ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.message}</span><button type="button" onClick={onClose} aria-label="Dismiss message">×</button></div>;
}

function groupByKey(values) {
  const groups = [];
  const byKey = new Map();
  for (const value of values) {
    if (!byKey.has(value.key)) { byKey.set(value.key, { key: value.key, values: [] }); groups.push(byKey.get(value.key)); }
    byKey.get(value.key).values.push(value);
  }
  for (const group of groups) group.values.sort((a, b) => a.sortOrder - b.sortOrder || a.value.localeCompare(b.value));
  return groups;
}

// Manage the component-compatibility data: shared reference values (socket,
// memory_type, …) and the EQUALS rules between two category spec attributes.
// Everything here is admin-managed data, so a new socket / RAM type is added as
// a reference value with no code or UI change.
export default function CompatibilityPanel({ categories, definitions, onChanged }) {
  const [referenceValues, setReferenceValues] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [ruleSourceCategory, setRuleSourceCategory] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [refs, ruleList] = await Promise.all([catalogApi.referenceValues(), catalogApi.compatibilityRules()]);
      setReferenceValues(refs.data ?? []);
      setRules(ruleList.data ?? []);
      setNotice(null);
    } catch (error) {
      setNotice({ kind: "error", message: error.status === 401 ? "Sign in to manage compatibility." : error.message });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => groupByKey(referenceValues), [referenceValues]);
  const categoryName = (id) => categories.find((c) => c.id === id)?.name ?? id;
  const keysByCategory = useMemo(() => {
    const map = {};
    for (const definition of definitions) { if (!map[definition.categoryId]) map[definition.categoryId] = []; map[definition.categoryId].push(definition.key); }
    return map;
  }, [definitions]);

  async function createReferenceValue(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setNotice(null);
    try {
      await catalogApi.createReferenceValue({ key: form.get("key"), value: form.get("value"), label: form.get("label") || form.get("value"), sortOrder: Number(form.get("sortOrder") || 0) });
      setNotice({ kind: "success", message: "Reference value saved." });
      formElement.reset();
      await load();
      if (onChanged) onChanged();
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function archiveReferenceValue(id) {
    if (!window.confirm("Archive this reference value?")) return;
    setBusy(true);
    try {
      await catalogApi.archiveReferenceValue(id);
      setNotice({ kind: "success", message: "Reference value archived." });
      await load();
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function createRule(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setNotice(null);
    try {
      await catalogApi.createCompatibilityRule({
        sourceCategoryId: form.get("sourceCategoryId"),
        sourceKey: form.get("sourceKey"),
        operator: "EQUALS",
        targetCategoryId: form.get("targetCategoryId"),
        targetKey: form.get("targetKey"),
        required: form.get("required") === "on",
        reason: form.get("reason"),
        sortOrder: Number(form.get("sortOrder") || 0)
      });
      setNotice({ kind: "success", message: "Compatibility rule saved." });
      formElement.reset();
      setRuleSourceCategory("");
      await load();
      if (onChanged) onChanged();
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function archiveRule(id) {
    if (!window.confirm("Archive this compatibility rule?")) return;
    setBusy(true);
    try {
      await catalogApi.archiveCompatibilityRule(id);
      setNotice({ kind: "success", message: "Compatibility rule archived." });
      await load();
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
            <p className="eyebrow">COMPATIBILITY</p>
            <h2>Component compatibility</h2>
          </div>
        </div>
        <p className="panelIntro">Reference values are the shared controlled vocabulary (socket, memory type…). Rules map one category attribute to another (EQUALS). Both are data — add a new socket or RAM type here without any code change.</p>
      </section>

      <section className="panel formPanel">
        <Banner notice={notice} onClose={() => setNotice(null)} />
        <p className="eyebrow">REFERENCE VALUES</p>
        <h2>Add a value</h2>
        <form onSubmit={createReferenceValue}>
          <label><span>Key</span><input name="key" pattern="[a-z][a-z0-9_]*" placeholder="socket" required /></label>
          <label><span>Value</span><input name="value" placeholder="AM6" required /></label>
          <label><span>Label (optional)</span><input name="label" placeholder="AM6" /></label>
          <label><span>Sort order</span><input name="sortOrder" type="number" min="0" defaultValue="0" /></label>
          <button className="primary" disabled={busy}>Add value</button>
        </form>

        {loading ? <p className="state" role="status">Loading…</p> : (
          <div className="tableWrap">
            <table>
              <thead><tr><th>Key</th><th>Values</th><th aria-label="Actions"></th></tr></thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.key}>
                    <td><code>{group.key}</code></td>
                    <td>{group.values.map((v) => <span key={v.id} className="pill muted" style={{ marginRight: "var(--space-1)" }}>{v.value}</span>)}</td>
                    <td>{group.values.map((v) => <button key={v.id} type="button" className="danger" disabled={busy} onClick={() => archiveReferenceValue(v.id)}>Remove {v.value}</button>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel formPanel">
        <p className="eyebrow">COMPATIBILITY RULES</p>
        <h2>Add a rule</h2>
        <form onSubmit={createRule}>
          <label><span>Source category</span><select name="sourceCategoryId" value={ruleSourceCategory} onChange={(e) => setRuleSourceCategory(e.target.value)} required><option value="">Select category</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label><span>Source attribute</span><select name="sourceKey" required disabled={!ruleSourceCategory}><option value="">Select attribute</option>{(keysByCategory[ruleSourceCategory] ?? []).map((key) => <option key={key} value={key}>{key}</option>)}</select></label>
          <label><span>Operator</span><select name="operator" defaultValue="EQUALS"><option value="EQUALS">EQUALS (must match)</option></select></label>
          <label><span>Target category</span><select name="targetCategoryId" required><option value="">Select category</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label><span>Target attribute</span><input name="targetKey" pattern="[a-z][a-z0-9_]*" placeholder="socket" required /></label>
          <label><span>Reason</span><input name="reason" placeholder="CPU socket must match the motherboard socket" required /></label>
          <label><span>Sort order</span><input name="sortOrder" type="number" min="0" defaultValue="0" /></label>
          <label className="check"><input name="required" type="checkbox" defaultChecked /><span>Block save when violated</span></label>
          <button className="primary" disabled={busy}>Add rule</button>
        </form>

        <div className="tableWrap">
          <table>
            <thead><tr><th>Source</th><th>Target</th><th>Required</th><th>Reason</th><th aria-label="Actions"></th></tr></thead>
            <tbody>
              {rules.length === 0 ? <tr><td colSpan="5" className="state">No rules yet.</td></tr> : rules.map((rule) => (
                <tr key={rule.id}>
                  <td><code>{categoryName(rule.sourceCategoryId)}.{rule.sourceKey}</code></td>
                  <td><code>{rule.operator} {categoryName(rule.targetCategoryId)}.{rule.targetKey}</code></td>
                  <td>{rule.required ? "Yes" : "No"}</td>
                  <td>{rule.reason}</td>
                  <td><button type="button" className="danger" disabled={busy} onClick={() => archiveRule(rule.id)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
