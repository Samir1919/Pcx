"use client";

import { useCallback, useEffect, useState } from "react";
import { notificationApi } from "../../../lib/notification-api.js";
import NotificationProvidersPanel from "./providers-panel";

function Banner({ notice, onClose }) { if (!notice) return null; return <div className={`banner ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.message}</span><button type="button" onClick={onClose} aria-label="Dismiss message">×</button></div>; }
function Field({ label, name, ...props }) { return <label><span>{label}</span><input name={name} {...props} /></label>; }

export default function NotificationsPage() {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await notificationApi.list();
      setNotifications(payload.data ?? []);
      setNotice(null);
    } catch (error) {
      setNotice({ kind: "error", message: error.status === 401 ? "Sign in to view notifications." : error.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    const form = new FormData(event.currentTarget);
    try {
      await notificationApi.create({
        userId: form.get("userId") || null,
        channel: form.get("channel"),
        notificationType: form.get("notificationType"),
        referenceType: form.get("referenceType") || null,
        referenceId: form.get("referenceId") || null,
        payloadSnapshot: {},
        scheduledAt: null
      });
      event.currentTarget.reset();
      setNotice({ kind: "success", message: "Notification created (PENDING)." });
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
          <p className="eyebrow">OPERATIONS / NOTIFICATIONS</p>
          <h1>Notifications</h1>
          <p>Create a PENDING notification. Delivery is dispatched by the worker, never from this form.</p>
        </div>
        <button className="refresh" type="button" onClick={load} disabled={loading}>↻ Refresh</button>
      </header>
      <Banner notice={notice} onClose={() => setNotice(null)} />
      <NotificationProvidersPanel />
      <div className="grid" style={{ marginTop: 18 }}>
        <section className="panel">
          <div className="panelTitle">
            <div>
              <p className="eyebrow">NOTIFICATIONS</p>
              <h2>Recent notifications</h2>
            </div>
          </div>
          {loading ? <p className="state" role="status">Loading notifications…</p> : notifications.length === 0 ? <p className="state">No notifications yet.</p> : (
            <div className="tableWrap">
              <table>
                <thead><tr><th>User</th><th>Channel</th><th>Type</th><th>Status</th></tr></thead>
                <tbody>
                  {notifications.map((n) => (
                    <tr key={n.id}>
                      <td><strong>{n.userId ? n.userId.slice(0, 8) + "…" : "Broadcast"}</strong></td>
                      <td>{n.channel}</td>
                      <td>{n.notificationType}</td>
                      <td><span className="pill">{n.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="panel formPanel">
          <p className="eyebrow">CREATE</p>
          <h2>New notification</h2>
          <form onSubmit={create}>
            <Field label="User ID (optional)" name="userId" />
            <label><span>Channel</span><select name="channel" required><option>EMAIL</option><option>SMS</option><option>PUSH</option></select></label>
            <Field label="Notification type" name="notificationType" required />
            <Field label="Reference type (optional)" name="referenceType" />
            <Field label="Reference ID (optional)" name="referenceId" />
            <button className="primary" disabled={busy}>{busy ? "Creating…" : "Create notification"}</button>
          </form>
        </section>
      </div>
    </>
  );
}
