"use client";

import { useCallback, useEffect, useState } from "react";
import { opsApi } from "../../../lib/ops-api";

export default function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await opsApi.auditLogs();
      setLogs(payload.data ?? []);
    } catch (err) {
      setError(err.code === "UNAUTHENTICATED" ? "Sign in to view audit logs." : err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <header>
        <div>
          <p className="eyebrow">OPERATIONS / AUDIT</p>
          <h1>Audit logs</h1>
          <p>Append-only visibility into privileged and lifecycle actions. Never edited or deleted.</p>
        </div>
        <button className="refresh" type="button" onClick={load} disabled={loading}>↻ Refresh</button>
      </header>
      {error ? <div className="banner error" role="alert"><span>{error}</span></div> : null}
      <section className="panel">
        {loading ? <p className="state" role="status">Loading audit logs…</p> : logs.length === 0 ? <p className="state">No audit entries found.</p> : (
          <div className="tableWrap">
            <table>
              <thead><tr><th>Actor</th><th>Action</th><th>Entity</th><th>Created</th></tr></thead>
              <tbody>
                {logs.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.actorUserId ? entry.actorUserId.slice(0, 8) + "…" : "—"}</td>
                    <td><span className="pill">{entry.action}</span></td>
                    <td><strong>{entry.entityType ?? "—"}</strong><small>{entry.entityId ? entry.entityId : ""}</small></td>
                    <td>{new Date(entry.createdAt).toLocaleString()}</td>
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
