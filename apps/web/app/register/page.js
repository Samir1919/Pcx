"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { storefrontApi } from "../../lib/storefront-api";
import StorefrontNav from "../StorefrontNav";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    if (!email && !phone) {
      setError("Email or phone is required.");
      setBusy(false);
      return;
    }
    try {
      await storefrontApi.register(email || null, phone || null, password);
      setDone(true);
      // New accounts start PENDING_VERIFICATION; go verify the contact.
      const contact = email || phone;
      router.replace(`/verify?contact=${encodeURIComponent(contact)}`);
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
          <h1>Register</h1>
          <p className="meta">New accounts start as a customer. Merchant access is granted by an administrator.</p>
          {error ? <div className="banner error" role="alert"><span>{error}</span></div> : null}
          {done ? <div className="banner" role="status"><span>Registration submitted. You can now sign in.</span></div> : (
            <form className="buyBox" onSubmit={submit}>
              <label><span>Email (optional)</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
              <label><span>Phone (optional)</span><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" /></label>
              <label><span>Password</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={12} required autoComplete="new-password" /></label>
              <button className="primary" type="submit" disabled={busy}>{busy ? "Registering…" : "Register"}</button>
            </form>
          )}
          <p className="meta">Already have an account? <a href="/login">Sign in</a></p>
        </div>
      </div>
    </main>
  );
}
