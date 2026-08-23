"use client";
import { useCallback, useEffect, useState } from "react";
import { notificationProviderApi } from "../../../lib/notification-provider-api";

const PROVIDERS = [
  { key: "EMAIL", label: "Email (Resend)", fields: [{ key: "apiKey", label: "API key", type: "password" }, { key: "from", label: "From address", type: "text" }] },
  { key: "SMS", label: "SMS (bdBulksms)", fields: [{ key: "token", label: "Token", type: "password" }] }
];
const MODES = [{ key: "SANDBOX", label: "Sandbox" }, { key: "REAL", label: "Live" }];

function Banner({ notice, onClose }) {
  if (!notice) return null;
  return <div className={`banner ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.message}</span><button type="button" onClick={onClose} aria-label="Dismiss message">×</button></div>;
}

export default function NotificationProvidersPanel() {
  const [providerKey, setProviderKey] = useState("EMAIL");
  const [mode, setMode] = useState("SANDBOX");
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const provider = PROVIDERS.find((p) => p.key === providerKey);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await notificationProviderApi.configs(providerKey);
      setConfigs(result.data ?? []);
      setNotice(null);
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  }, [providerKey]);

  useEffect(() => { load(); }, [load]);

  const activeConfig = configs.find((c) => c.active === true);
  const current = configs.find((c) => c.mode === mode);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const credentials = {};
    for (const field of provider.fields) {
      const value = form.get(field.key);
      if (value) credentials[field.key] = value;
    }
    try {
      await notificationProviderApi.saveConfig(providerKey, { mode, credentials });
      event.currentTarget.reset();
      setNotice({ kind: "success", message: `${mode === "SANDBOX" ? "Sandbox" : "Live"} credentials saved and encrypted.` });
      await load();
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function activate(target) {
    if (!window.confirm(`Activate ${target === "SANDBOX" ? "sandbox" : "live"} ${provider.label} credentials?`)) return;
    setBusy(true);
    try {
      await notificationProviderApi.activate(providerKey, { mode: target });
      setNotice({ kind: "success", message: `${target === "SANDBOX" ? "Sandbox" : "Live"} mode is now active.` });
      await load();
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <div className="panelTitle">
        <div>
          <p className="eyebrow">NOTIFICATION PROVIDERS</p>
          <h2>Email & SMS credentials</h2>
        </div>
      </div>
      <Banner notice={notice} onClose={() => setNotice(null)} />

      <div className="tabs" role="tablist" aria-label="Notification provider">
        {PROVIDERS.map((p) => (
          <button key={p.key} role="tab" aria-selected={providerKey === p.key} onClick={() => setProviderKey(p.key)}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="tabs" role="tablist" aria-label="Notification environment" style={{ marginTop: 8 }}>
        {MODES.map((m) => (
          <button key={m.key} role="tab" aria-selected={mode === m.key} onClick={() => setMode(m.key)}>
            {m.label}{activeConfig?.mode === m.key && <span>Active</span>}
          </button>
        ))}
      </div>

      <div className="grid" style={{ marginTop: 14 }}>
        <section className="panel">
          <div className="panelTitle">
            <div>
              <p className="eyebrow">CURRENT CONFIGURATION</p>
              <h2>{mode === "SANDBOX" ? "Sandbox" : "Live"} {provider.label}</h2>
            </div>
            {activeConfig && <span className="pill">{activeConfig.mode === "SANDBOX" ? "Sandbox active" : "Live active"}</span>}
          </div>
          {loading ? (
            <p className="state" role="status">Loading configuration…</p>
          ) : current ? (
            <div className="tableWrap">
              <table>
                <thead><tr><th>Field</th><th>Value</th></tr></thead>
                <tbody>{provider.fields.map((f) => <tr key={f.key}><td>{f.label}</td><td>{current.credentials?.[f.key] ?? "Not set"}</td></tr>)}</tbody>
              </table>
            </div>
          ) : (
            <p className="state">No {mode === "SANDBOX" ? "sandbox" : "live"} credentials configured yet.</p>
          )}
          <div className="formPanel" style={{ borderTop: "1px solid var(--line)" }}>
            <p className="eyebrow">ACTIVATE</p>
            <button className="primary" type="button" disabled={busy || !current} onClick={() => activate(mode)}>
              {activeConfig?.mode === mode ? "Already active" : "Activate this mode"}
            </button>
          </div>
        </section>

        <section className="panel formPanel">
          <p className="eyebrow">SAVE CREDENTIALS</p>
          <h2>{mode === "SANDBOX" ? "Sandbox" : "Live"} credentials</h2>
          <p>Credentials are encrypted at rest. Leave a field blank to keep its current value.</p>
          <form onSubmit={save}>
            {provider.fields.map((f) => <label key={f.key}><span>{f.label}</span><input name={f.key} type={f.type} autoComplete="off" /></label>)}
            <button className="primary" disabled={busy || loading}>{busy ? "Saving…" : "Save credentials"}</button>
          </form>
        </section>
      </div>
    </section>
  );
}
