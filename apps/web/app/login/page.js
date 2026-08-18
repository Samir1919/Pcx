"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { storefrontApi } from "../../lib/storefront-api";
import StorefrontNav from "../StorefrontNav";

export default function LoginPage() {
  const router = useRouter();
  const [contact, setContact] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await storefrontApi.login(contact, password);
      if (result.data?.status === "mfa_required") {
        setError("This account requires a multi-factor challenge that is not available on the storefront. Please use the admin workspace.");
        return;
      }
      router.replace("/storefront");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <StorefrontNav />
      <div className="wrap">
        <div className="sell" style={{ maxWidth: 460, margin: "0 auto" }}>
          <a className="back" href="/storefront">← Back to storefront</a>
          <h1>Sign in</h1>
          <p className="meta">Sign in to browse, buy, and submit sell requests.</p>
          {error ? <div className="banner error" role="alert"><span>{error}</span></div> : null}
          <form className="buyBox" onSubmit={submit}>
            <label><span>Email or phone</span><input type="text" value={contact} onChange={(e) => setContact(e.target.value)} required autoComplete="username" /></label>
            <label><span>Password</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></label>
            <button className="primary" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          </form>
          <p className="meta">No account? <a href="/register">Register</a></p>
        </div>
      </div>
    </main>
  );
}
