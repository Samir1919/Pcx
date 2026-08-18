"use client";
import { useCallback, useEffect, useState } from "react";
import { usersApi } from "../../../lib/users-api";
import { ROLE, USER_STATUS } from "../../../lib/access.js";

const ALL_ROLES = Object.values(ROLE);
const ALL_STATUSES = Object.values(USER_STATUS);

function Banner({ notice, onClose }) {
  if (!notice) return null;
  return <div className={`banner ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.message}</span><button type="button" onClick={onClose} aria-label="Dismiss message">×</button></div>;
}

export default function UsersWorkspace() {
  const [users, setUsers] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");

  const load = useCallback(async (cursor = null) => {
    setLoading(true);
    try {
      const result = await usersApi.list({ q, status, role, cursor, limit: 50 });
      setUsers(result.data ?? []);
      setNextCursor(result.meta?.nextCursor ?? null);
      setNotice(null);
    } catch (error) {
      setNotice({ kind: "error", message: error.status === 401 ? "Sign in with a privileged admin account to manage users." : error.message });
    } finally {
      setLoading(false);
    }
  }, [q, status, role]);

  useEffect(() => { load(null); }, [load]);

  function applyFilters(event) {
    event.preventDefault();
    load(null);
  }

  async function setUserStatus(userId, nextStatus) {
    if (!window.confirm(`Change this user's status to ${nextStatus}?`)) return;
    setBusy(true);
    try {
      await usersApi.updateStatus(userId, nextStatus);
      setNotice({ kind: "success", message: "User status updated." });
      await load(null);
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function toggleRole(user, targetRole) {
    const next = user.roles.includes(targetRole)
      ? user.roles.filter((r) => r !== targetRole)
      : [...user.roles, targetRole];
    setBusy(true);
    try {
      await usersApi.replaceRoles(user.id, next);
      setNotice({ kind: "success", message: "User roles updated." });
      await load(null);
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
          <p className="eyebrow">OPERATIONS / USERS</p>
          <h1>Users</h1>
          <p>Manage identities, status, and roles. Role and status changes are server-owned, privileged, and audited.</p>
        </div>
        <button className="refresh" type="button" onClick={() => load(null)} disabled={loading}>↻ Refresh</button>
      </header>
      <Banner notice={notice} onClose={() => setNotice(null)} />
      <form className="filters" onSubmit={applyFilters}>
        <label><span>Search</span><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="email or phone…" maxLength="100" /></label>
        <label><span>Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label><span>Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option>
            {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <button className="primary" type="submit" disabled={loading}>Apply</button>
      </form>

      {loading ? <p className="state" role="status">Loading users…</p> : users.length === 0 ? <p className="state">No users match your filters.</p> : (
        <div className="tableWrap">
          <table>
            <thead>
              <tr><th>Identity</th><th>Status</th><th>Roles</th><th>Created</th><th><span className="sr">Actions</span></th></tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.email ?? user.phone ?? user.id}</strong>
                    <small>{user.id}</small>
                  </td>
                  <td>
                    <select value={user.status} disabled={busy} onChange={(e) => setUserStatus(user.id, e.target.value)}>
                      {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td>
                    <div className="roleChips">
                      {user.roles.map((r) => (
                        <button key={r} type="button" className="pill pill-link" disabled={busy} onClick={() => toggleRole(user, r)} title={`Remove ${r}`}>{r} ✕</button>
                      ))}
                      <select value="" disabled={busy} onChange={(e) => { if (e.target.value) toggleRole(user, e.target.value); }}>
                        <option value="">+ add role</option>
                        {ALL_ROLES.filter((r) => !user.roles.includes(r)).map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </td>
                  <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}</td>
                  <td><span className="pill">{user.contactVerified ? "Verified" : "Unverified"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="pager">
        <button type="button" disabled={!nextCursor || loading} onClick={() => load(nextCursor)}>Next →</button>
      </div>
    </>
  );
}
