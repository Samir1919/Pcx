"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import StorefrontNav from "../StorefrontNav";
import { storefrontApi } from "../../lib/storefront-api";
import { validateContact } from "../../lib/contact-validation";

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [contact, setContact] = useState(searchParams?.get("contact") ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const contactCheck = validateContact(contact);
    if (!contactCheck.ok) {
      setError(contactCheck.reason);
      setBusy(false);
      return;
    }
    try {
      await storefrontApi.verifyContactCode(contact, code);
      router.replace("/login");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sell" style={{ maxWidth: 460, margin: "0 auto" }}>
      <a className="back" href="/storefront">← Back to storefront</a>
      <h1>Verify your contact</h1>
      <p className="meta">Enter the verification code sent to your email or phone.</p>
      {error ? <div className="banner error" role="alert"><span>{error}</span></div> : null}
      <form className="buyBox" onSubmit={submit}>
        <label><span>Email or phone</span><input type="text" value={contact} onChange={(e) => setContact(e.target.value)} required autoComplete="username" placeholder="you@example.com or +8801XXXXXXXXX" /></label>
        <label><span>Verification code</span><input type="text" value={code} onChange={(e) => setCode(e.target.value)} required autoComplete="one-time-code" /></label>
        <button className="primary" type="submit" disabled={busy}>{busy ? "Verifying…" : "Verify"}</button>
      </form>
      <p className="meta">Already verified? <a href="/login">Sign in</a></p>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <main>
      <StorefrontNav />
      <div className="wrap">
        <Suspense fallback={<p className="meta">Loading…</p>}>
          <VerifyForm />
        </Suspense>
      </div>
    </main>
  );
}
