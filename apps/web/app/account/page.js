"use client";
import { useCallback, useEffect, useState } from "react";
import { storefrontApi } from "../../lib/storefront-api";
import StorefrontNav from "../StorefrontNav";

export default function AccountPage() {
  const [identity, setIdentity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const me = await storefrontApi.me();
      setIdentity(me.data);
      setFullName(me.data?.fullName ?? "");
      setPhone(me.data?.phone ?? "");
    } catch {
      setIdentity(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveProfile(event) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const me = await storefrontApi.updateProfile({ fullName: fullName || null, phone: phone || null });
      setIdentity(me.data);
      setNotice({ kind: "success", message: "Profile updated." });
    } catch (err) {
      setNotice({ kind: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      await storefrontApi.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setNotice({ kind: "success", message: "Password changed. Please sign in again." });
      setTimeout(() => { window.location.href = "/login"; }, 1200);
    } catch (err) {
      setNotice({ kind: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <main><StorefrontNav /><div className="wrap"><p className="state" role="status">Loading your account…</p></div></main>;
  }

  if (!identity) {
    return (
      <main>
        <StorefrontNav />
        <div className="wrap">
          <div className="sell" style={{ maxWidth: 460, margin: "0 auto" }}>
            <h1>Your account</h1>
            <p className="meta">Sign in to view and edit your profile.</p>
            <a className="primary" href="/login?redirect=/account">Sign in</a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <StorefrontNav />
      <div className="wrap">
        <div className="sell">
          <h1>Your account</h1>
          <p className="meta">Manage your profile and password.</p>
          {notice ? <div className={`banner ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.message}</span></div> : null}

          <div className="card" style={{ marginTop: 12 }}>
            <h2>Profile</h2>
            <p className="meta">Email (read-only): {identity.email ?? "—"}</p>
            <form className="sellForm" onSubmit={saveProfile}>
              <label><span>Full name</span><input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" /></label>
              <label><span>Phone</span><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" /></label>
              <button className="primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
            </form>
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <h2>Change password</h2>
            <form className="sellForm" onSubmit={changePassword}>
              <label><span>Current password</span><input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" /></label>
              <label><span>New password</span><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={12} required autoComplete="new-password" /></label>
              <button className="primary" type="submit" disabled={busy}>{busy ? "Changing…" : "Change password"}</button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
