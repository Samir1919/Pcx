"use client";

import { useState } from "react";
import { notificationApi } from "../../../lib/notification-api.js";

function Banner({ notice, onClose }) { if (!notice) return null; return <div className={`banner ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.message}</span><button type="button" onClick={onClose} aria-label="Dismiss message">×</button></div>; }
function Field({ label, name, ...props }) { return <label><span>{label}</span><input name={name} {...props} /></label>; }

export default function NotificationsPage() {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

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
      </header>
      <Banner notice={notice} onClose={() => setNotice(null)} />
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
    </>
  );
}
