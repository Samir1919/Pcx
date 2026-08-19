"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "../auth-provider";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState(null);
  const [rememberDevice, setRememberDevice] = useState(false);

  // Demo credentials are a development convenience only. Never surface them in
  // staging or production builds.
  const isDev = process.env.NODE_ENV === "development";

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const result = await login({ contact: form.get("contact"), password: form.get("password") });
      if (result.mfaRequired) setChallenge(result);
      else router.replace("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await challenge.verify(form.get("credential"), rememberDevice);
      router.replace("/");
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
        <h1>{challenge ? "Verify sign-in" : "Sign in"}</h1>
        <p>
          {challenge
            ? isDev
              ? "Enter the one-time code for the demo admin account. In development the default code is 123456."
              : "Enter the one-time code from your authenticator."
            : isDev
              ? "Use the demo admin account (email demo-admin@example.com / password DemoAdmin123!), or sign in with any authorized account."
              : "Sign in with an authorized account."}
        </p>
        {error ? <div className="banner error" role="alert"><span>{error}</span></div> : null}
        {challenge ? (
          <form onSubmit={verify}>
            <label><span>One-time code</span><input name="credential" required autoComplete="one-time-code" /></label>
            <label className="check"><input type="checkbox" checked={rememberDevice} onChange={(e) => setRememberDevice(e.target.checked)} /><span>Remember this device for 30 days</span></label>
            <button className="primary" disabled={busy}>{busy ? "Verifying…" : "Verify"}</button>
          </form>
        ) : (
          <form onSubmit={submit}>
            <label><span>Email or phone</span><input name="contact" required autoComplete="username" /></label>
            <label><span>Password</span><input name="password" type="password" required autoComplete="current-password" /></label>
            <button className="primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          </form>
        )}
        <p className="authAlt">No account? <Link href="/register">Register</Link></p>
      </section>
    </main>
  );
}
