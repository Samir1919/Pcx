"use client";
import { useRef, useState } from "react";
import { catalogApi } from "../../../lib/catalog-api";

const example = [
  "category,brand,name,model_code,low_value,high_value",
  "Desktop PC,PCX,PCX Gaming Tower,TOWER-1,40000,120000",
  "Laptop,PCX,PCX Ultrabook 14,UBOOK-14,55000,145000"
].join("\n");

export default function ImportCsvPanel({ onImported }) {
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  async function onFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setCsv(await file.text());
      setError(null);
      setResult(null);
    } catch {
      setError("Could not read that file.");
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (!csv.trim()) { setError("Paste a CSV or choose a file first."); return; }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const payload = await catalogApi.importCsv(csv);
      setResult(payload.data);
      if (onImported) onImported();
    } catch (err) {
      setError(err.status === 401 ? "Sign in with an authorized admin account to import the catalog." : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel formPanel importPanel">
      <p className="eyebrow">BULK IMPORT</p>
      <h2>Import catalog from CSV</h2>
      <p>
        One row per product model with its indicative quote range. Columns must be
        headed <code>category,brand,name,model_code,low_value,high_value</code>.
        Missing categories/brands are created; an already-imported model (by slug)
        is skipped, so re-running the same file is safe.
      </p>
      <form onSubmit={submit}>
        <label>
          <span>CSV file</span>
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} />
        </label>
        <label>
          <span>CSV text</span>
          <textarea
            name="csv"
            rows="10"
            value={csv}
            onChange={(e) => { setCsv(e.target.value); setResult(null); }}
            placeholder={example}
          />
        </label>
        <button className="primary" type="submit" disabled={busy}>{busy ? "Importing…" : "Import CSV"}</button>
      </form>
      {result && (
        <div className="banner success" role="status">
          <span>Imported {result.created} model{result.created === 1 ? "" : "s"}, skipped {result.skipped}.{result.errors?.length ? ` ${result.errors.length} row(s) failed.` : ""}</span>
        </div>
      )}
      {error && <p className="dialogError" role="alert">{error}</p>}
    </section>
  );
}