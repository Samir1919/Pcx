"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "../auth-provider";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const email = form.get("email");
    const phone = form.get("phone");
    const password = form.get("password");
    try {
      await register({ email: email || null, phone: phone || null, password });
      setDone(true);
      router.replace("/login");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="authShell">
      <section className="authCard">
        <Link className="brand" href="/" aria-label="PCX Admin home"><b>PCX</b><small>CONTROL ROOM</small></Link>
        <p className="eyebrow">PRIVILEGED WORKSPACE</p>
        <h1>Create account</h1>
        <p>A new account starts as an unverified customer. Privileged roles are granted by administrators, never by registration.</p>
        {done ? <div className="banner success" role="status"><span>Account created. Sign in to continue.</span></div> : null}
        {error ? <div className="banner error" role="alert"><span>{error}</span></div> : null}
        <form onSubmit={submit}>
          <label><span>Email</span><input name="email" type="email" autoComplete="email" /></label>
          <label><span>Phone (optional)</span><input name="phone" autoComplete="tel" /></label>
          <label><span>Password</span><input name="password" type="password" required minLength={12} autoComplete="new-password" /></label>
          <button className="primary" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
        </form>
        <p className="authAlt">Already have an account? <Link href="/login">Sign in</Link></p>
      </section>
    </main>
  );
}
