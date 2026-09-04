"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { catalogApi } from "../../../../../../lib/catalog-api";

function display(value, type) {
  if (value == null) return "";
  return type === "JSON" ? JSON.stringify(value, null, 2) : String(value);
}

function parse(value, type) {
  if (type === "NUMBER") { const number = Number(value); if (!Number.isFinite(number)) throw new Error("Enter a finite number."); return number; }
  if (type === "BOOLEAN") return value === "true";
  if (type === "JSON") { try { return JSON.parse(value); } catch { throw new Error("Enter a valid JSON object or array."); } }
  return value;
}

function Input({ definition, value }) {
  if (definition.dataType === "BOOLEAN") return <select name={`value:${definition.id}`} defaultValue={display(value, "BOOLEAN")}><option value="">Select value</option><option value="true">True</option><option value="false">False</option></select>;
  if (definition.dataType === "JSON") return <textarea name={`value:${definition.id}`} defaultValue={display(value, "JSON")} placeholder='{"key":"value"}' />;
  return <input name={`value:${definition.id}`} type={definition.dataType === "NUMBER" ? "number" : "text"} step={definition.dataType === "NUMBER" ? "any" : undefined} defaultValue={display(value, definition.dataType)} />;
}

export default function ModelSpecifications({ modelId }) {
  const [model, setModel] = useState(null);
  const [definitions, setDefinitions] = useState([]);
  const [values, setValues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const modelResult = await catalogApi.model(modelId);
      const [definitionResult, valueResult] = await Promise.all([
        catalogApi.definitions(modelResult.data.categoryId),
        catalogApi.modelValues(modelId)
      ]);
      setModel(modelResult.data);
      setDefinitions(definitionResult.data);
      setValues(valueResult.data);
      setNotice(null);
    } catch (error) {
      setNotice({ kind: "error", message: error.status === 401 ? "Sign in with an authorized admin account." : error.message });
    } finally {
      setLoading(false);
    }
  }, [modelId]);

  useEffect(() => { load(); }, [load]);

  const byDefinition = useMemo(() => Object.fromEntries(values.map((item) => [item.specificationDefinitionId, item])), [values]);
  const requiredCount = definitions.filter((d) => d.required).length;
  const setRequiredCount = definitions.filter((d) => d.required && byDefinition[d.id]?.value != null && byDefinition[d.id]?.value !== "").length;

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const form = new FormData(event.currentTarget);
      const payload = definitions
        .map((definition) => {
          const raw = form.get(`value:${definition.id}`);
          if (raw == null || raw === "") return null;
          return { definitionId: definition.id, value: parse(raw, definition.dataType) };
        })
        .filter(Boolean);
      const result = await catalogApi.setModelValues(modelId, payload);
      setValues(result.data.map((item) => ({ ...item, label: item.label ?? byDefinition[item.specificationDefinitionId]?.label, key: item.key ?? byDefinition[item.specificationDefinitionId]?.key, unit: item.unit ?? byDefinition[item.specificationDefinitionId]?.unit })));
      setNotice({ kind: "success", message: "Model specifications saved." });
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="detailPage">
      <section className="detailContent">
        <a className="back" href="/catalog">← Catalog workspace</a>
        <header>
          <div>
            <p className="eyebrow">PRODUCT MODEL / SPECIFICATIONS</p>
            <h1>{model?.name ?? "Model specifications"}</h1>
            <p>Assign category-approved typed values. The server rejects mismatched categories and data types.</p>
          </div>
          <button className="refresh" onClick={load} disabled={loading}>↻ Refresh</button>
        </header>
        {notice && <div className={`banner ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>{notice.message}<button onClick={() => setNotice(null)} aria-label="Dismiss message">×</button></div>}
        {loading ? <div className="panel state" role="status">Loading model attributes…</div>
          : definitions.length === 0 ? <div className="panel state">No active attribute definitions exist for this category.</div>
            : <form className="specForm" onSubmit={save}>
              {requiredCount > 0 && (
                <p className={`completeness ${setRequiredCount === requiredCount ? "complete" : "incomplete"}`} role="status">
                  {setRequiredCount} of {requiredCount} required attributes set.
                </p>
              )}
              <section className="specGrid" aria-label="Model attributes">
                {definitions.map((definition) => {
                  const current = byDefinition[definition.id];
                  return (
                    <div className="panel specCard" key={definition.id}>
                      <div>
                        <div className="specHeading">
                          <h2>{definition.label}</h2>
                          {definition.required && <span className="required">Required</span>}
                        </div>
                        <code>{definition.key}</code>
                        <p>{definition.dataType}{definition.unit ? ` · ${definition.unit}` : ""}{definition.filterable ? " · Storefront filter" : ""}</p>
                      </div>
                      <label><span>Value{definition.unit ? ` (${definition.unit})` : ""}</span><Input definition={definition} value={current?.value} /></label>
                      <div className="specFooter">
                        <small>{current ? `Updated ${new Date(current.updatedAt).toLocaleString()}` : "Not set"}</small>
                      </div>
                    </div>
                  );
                })}
              </section>
              <div className="specSaveBar">
                <button className="primary" disabled={saving}>{saving ? "Saving…" : "Save all specifications"}</button>
              </div>
            </form>}
      </section>
    </div>
  );
}
