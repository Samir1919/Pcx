"use client";
import { useCallback, useEffect, useState } from "react";
import { paymentApi } from "../../../lib/payment-api";

const provider = "bkash";
const SANDBOX_ENDPOINT = "https://tokenized.sandbox.bka.sh/v1.2.0-beta";
const modes = [
  { key: "SANDBOX", label: "Sandbox", hint: "Test credentials for development and staging. Never processes real money." },
  { key: "REAL", label: "Live", hint: "Production credentials. Only activate when you are ready to accept real payments." }
];
const fields = [
  { key: "appKey", label: "App key", type: "password" },
  { key: "appSecret", label: "App secret", type: "password" },
  { key: "username", label: "Username", type: "text" },
  { key: "password", label: "Password", type: "password" },
  { key: "merchantNumber", label: "Merchant number", type: "text" }
];

function Banner({ notice, onClose }) {
  if (!notice) return null;
  return <div className={`banner ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.message}</span><button type="button" onClick={onClose} aria-label="Dismiss message">×</button></div>;
}

export default function PaymentsWorkspace() {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [mode, setMode] = useState("SANDBOX");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await paymentApi.configs(provider);
      setConfigs(result.data);
      setNotice(null);
    } catch (error) {
      setNotice({ kind: "error", message: error.status === 401 ? "Sign in with an authorized admin account to manage payment providers." : error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeConfig = configs.find((c) => c.active === true);
  const current = configs.find((c) => c.mode === mode);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const credentials = {};
    for (const field of fields) {
      const value = form.get(field.key);
      if (value) credentials[field.key] = value;
    }
    try {
      await paymentApi.saveConfig(provider, { mode, credentials });
      formElement.reset();
      setNotice({ kind: "success", message: `${mode === "SANDBOX" ? "Sandbox" : "Live"} credentials saved and encrypted.` });
      await load();
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function activate(target) {
    if (!window.confirm(`Activate ${target === "SANDBOX" ? "sandbox" : "live"} bKash credentials? This switches which credentials the payment service uses.`)) return;
    setBusy(true);
    try {
      await paymentApi.activate(provider, { mode: target });
      setNotice({ kind: "success", message: `${target === "SANDBOX" ? "Sandbox" : "Live"} mode is now active.` });
      await load();
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete ${mode === "SANDBOX" ? "sandbox" : "live"} bKash credentials? If active, payments will fail closed until you configure another mode.`)) return;
    setBusy(true);
    try {
      await paymentApi.remove(provider, mode);
      setNotice({ kind: "success", message: `${mode === "SANDBOX" ? "Sandbox" : "Live"} credentials removed.` });
      await load();
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header>
        <div>
          <p className="eyebrow">OPERATIONS / PAYMENTS</p>
          <h1>Payment providers</h1>
          <p>Store and switch between sandbox and live bKash credentials. Secrets are encrypted at rest and never shown back to you.</p>
        </div>
        <button className="refresh" type="button" onClick={load} disabled={loading}>↻ Refresh</button>
      </header>
      <Banner notice={notice} onClose={() => setNotice(null)} />
      <div className="tabs" role="tablist" aria-label="Payment environment">
        {modes.map((m) => (
          <button key={m.key} role="tab" aria-selected={mode === m.key} onClick={() => setMode(m.key)}>
            {m.label}{activeConfig?.mode === m.key && <span>Active</span>}
          </button>
        ))}
      </div>
      <div className="grid">
        <section className="panel">
          <div className="panelTitle">
            <div>
              <p className="eyebrow">CURRENT CONFIGURATION</p>
              <h2>{mode === "SANDBOX" ? "Sandbox" : "Live"} bKash</h2>
            </div>
            {activeConfig && <span className="pill">{activeConfig.mode === "SANDBOX" ? "Sandbox active" : "Live active"}</span>}
          </div>
          {mode === "SANDBOX" && (
            <p className="meta" style={{ margin: "0 0 12px" }}>
              Sandbox endpoint: <code>{SANDBOX_ENDPOINT}</code>. Charges route to the bKash sandbox (never real money). Live mode requires explicit human approval.
            </p>
          )}
          {loading ? (
            <p className="state" role="status">Loading payment configuration…</p>
          ) : current ? (
            <div className="tableWrap">
              <table>
                <thead><tr><th>Field</th><th>Value</th></tr></thead>
                <tbody>{fields.map((f) => <tr key={f.key}><td>{f.label}</td><td>{current.credentials?.[f.key] ?? "Not set"}</td></tr>)}</tbody>
              </table>
            </div>
          ) : (
            <p className="state">No {mode === "SANDBOX" ? "sandbox" : "live"} credentials configured yet.</p>
          )}
          <div className="formPanel" style={{ borderTop: "1px solid var(--line)" }}>
            <p className="eyebrow">ACTIVATE</p>
            <p>{modes.find((m) => m.key === mode).hint}</p>
            <button className="primary" type="button" disabled={busy || !current} onClick={() => activate(mode)}>
              {activeConfig?.mode === mode ? "Already active" : "Activate this mode"}
            </button>
            {current && <button className="danger" type="button" disabled={busy} onClick={remove}>Delete credentials</button>}
          </div>
        </section>
        <section className="panel formPanel">
          <p className="eyebrow">SAVE CREDENTIALS</p>
          <h2>{mode === "SANDBOX" ? "Sandbox" : "Live"} credentials</h2>
          <p>Credentials are encrypted at rest with the server key. Leave a field blank to keep its current value.</p>
          <form onSubmit={save}>
            {fields.map((f) => <label key={f.key}><span>{f.label}</span><input name={f.key} type={f.type} autoComplete="off" /></label>)}
            <button className="primary" disabled={busy || loading}>{busy ? "Saving…" : "Save credentials"}</button>
          </form>
        </section>
      </div>
    </>
  );
}
