"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { opsApi } from "../../../lib/ops-api";
import { catalogApi } from "../../../lib/catalog-api";

export default function InspectionModal({ item, onClose }) {
  const [templateId, setTemplateId] = useState("");
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [inspection, setInspection] = useState(null);
  const [results, setResults] = useState(null);
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  // Auto-detect the category-scoped inspection templates for this item's model
  // so the technician never copies a raw template UUID. The template is only a
  // convenience default; the server still validates the selected template and
  // enforces the inspection lifecycle.
  useEffect(() => {
    let cancelled = false;
    async function detectTemplates() {
      setTemplatesLoading(true);
      try {
        const modelPayload = await catalogApi.model(item.productModelId);
        const model = modelPayload.data;
        const categoryId = model?.categoryId;
        if (!categoryId) { setTemplates([]); return; }
        const templatesPayload = await opsApi.templates(categoryId);
        const list = templatesPayload.data ?? [];
        if (cancelled) return;
        setTemplates(list);
        if (list.length > 0) setTemplateId((prev) => prev || list[0].id);
      } catch {
        if (!cancelled) setTemplates([]);
      } finally {
        if (!cancelled) setTemplatesLoading(false);
      }
    }
    if (item?.productModelId) detectTemplates();
    return () => { cancelled = true; };
  }, [item?.productModelId]);

  async function start(event) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const created = await opsApi.startInspection({ inventoryItemId: item.id, inspectionTemplateId: templateId });
      setInspection(created.data);
    } catch (err) {
      setNotice({ kind: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function refreshResults() {
    if (!inspection) return;
    try {
      const payload = await opsApi.inspectionResults(inspection.id);
      setResults(payload.data);
      const map = {};
      for (const r of payload.data.results ?? []) {
        map[r.inspectionTemplateItemId] = r.resultStatus;
      }
      setAnswers(map);
    } catch (err) {
      setNotice({ kind: "error", message: err.message });
    }
  }

  useEffect(() => { if (inspection) refreshResults(); }, [inspection?.id]);

  async function saveResult(itemId, value) {
    setAnswers((prev) => ({ ...prev, [itemId]: value }));
    setBusy(true);
    setNotice(null);
    try {
      await opsApi.putInspectionResult(inspection.id, { inspectionTemplateItemId: itemId, resultStatus: value });
    } catch (err) {
      setNotice({ kind: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setNotice(null);
    try {
      const payload = await opsApi.submitInspection(inspection.id);
      setInspection((prev) => ({ ...prev, status: payload.data.status }));
      await refreshResults();
    } catch (err) {
      setNotice({ kind: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    setBusy(true);
    try { await opsApi.approveInspection(inspection.id); onClose(); } catch (err) { setNotice({ kind: "error", message: err.message }); } finally { setBusy(false); }
  }

  async function reject() {
    setBusy(true);
    try { await opsApi.rejectInspection(inspection.id); onClose(); } catch (err) { setNotice({ kind: "error", message: err.message }); } finally { setBusy(false); }
  }

  async function uploadEvidence(event) {
    setBusy(true);
    setNotice(null);
    try {
      for (const file of Array.from(event.target.files ?? [])) {
        await opsApi.uploadInspectionMedia(inspection.id, file);
      }
      event.target.value = "";
      setNotice({ kind: "success", message: "Evidence uploaded." });
    } catch (err) {
      setNotice({ kind: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  }

  const templateItems = results?.items ?? [];

  return createPortal(
    <div className="modalOverlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modalDialog" role="dialog" aria-modal="true" aria-labelledby="inspection-title">
        <button type="button" className="modalClose" aria-label="Close" onClick={onClose}>×</button>
        <h2 id="inspection-title">Inspect item {item.pcxItemId ?? item.id.slice(0, 8)}</h2>
        {notice ? <div className={`banner ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.message}</span></div> : null}

        {!inspection ? (
          <form onSubmit={start}>
            <p>Start a DRAFT inspection against a category-scoped template. Templates are auto-detected from the item model.</p>
            <label>
              <span>Inspection template</span>
              <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} required disabled={templatesLoading}>
                <option value="">{templatesLoading ? "Detecting…" : "Select a template"}</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name} (v{t.version})</option>)}
              </select>
            </label>
            {!templatesLoading && templates.length === 0 && (
              <label><span>Or enter template ID</span><input value={templateId} onChange={(e) => setTemplateId(e.target.value)} required /></label>
            )}
            <button className="primary" disabled={busy || templatesLoading || !templateId}>{busy ? "Starting…" : "Start inspection"}</button>
          </form>
        ) : (
          <div>
            <div className="detailList">
              <div><dt>Status</dt><dd><span className="pill">{inspection.status}</span></dd></div>
              {results?.healthScore ? <div><dt>Health score</dt><dd>{results.healthScore.score}/100</dd></div> : null}
            </div>

            <div className="detailList" style={{ marginTop: 12 }}>
              <div><dt>Evidence</dt><dd><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={uploadEvidence} /></dd></div>
            </div>

            {(templateItems.length > 0) && (
              <div className="tableWrap" style={{ marginTop: 12 }}>
                <table>
                  <thead><tr><th>Test item</th><th>Result</th></tr></thead>
                  <tbody>
                    {templateItems.map((t) => (
                      <tr key={t.id}>
                        <td><strong>{t.label}</strong><small>{t.code}{t.isMandatory ? " · mandatory" : ""}{t.isCritical ? " · critical" : ""}</small></td>
                        <td>
                          <select value={answers[t.id] ?? ""} disabled={inspection.status !== "DRAFT"} onChange={(e) => saveResult(t.id, e.target.value)}>
                            <option value="">Select…</option>
                            <option value="PASS">Pass</option>
                            <option value="FAIL">Fail</option>
                            <option value="NA">N/A</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="modalActions">
              {inspection.status === "DRAFT" && <button type="button" className="primary" disabled={busy} onClick={submit}>{busy ? "Submitting…" : "Submit"}</button>}
              {(inspection.status === "SUBMITTED" || inspection.status === "ESCALATED") && (
                <>
                  <button type="button" className="primary" disabled={busy} onClick={approve}>Approve</button>
                  <button type="button" disabled={busy} onClick={reject}>Reject</button>
                </>
              )}
              <button type="button" onClick={onClose}>Close</button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
