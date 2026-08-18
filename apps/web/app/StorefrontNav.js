"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { storefrontApi } from "../lib/storefront-api";
import { isMerchant } from "../lib/access.js";

export default function StorefrontNav() {
  const pathname = usePathname();
  const [identity, setIdentity] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    storefrontApi.me()
      .then((r) => { if (active) setIdentity(r.data); })
      .catch(() => { if (active) setIdentity(null); });
    return () => { active = false; };
  }, []);

  const merchant = isMerchant(identity);

  async function signOut() {
    setBusy(true);
    try { await storefrontApi.logout(); } catch { /* best-effort */ }
    setIdentity(null);
    setBusy(false);
    window.location.href = "/storefront";
  }

  return (
    <div className="topbar">
      <div className="topbarInner">
        <a className="brand" href="/storefront" aria-label="PCX Storefront home"><b>PCX</b><small>CERTIFIED PRE-OWNED</small></a>
        <nav aria-label="Primary">
          <a className={pathname === "/storefront" ? "selected" : ""} href="/storefront">Storefront</a>
          <a className={pathname === "/sell" ? "selected" : ""} href="/sell">Sell</a>
          {merchant && <a className={pathname === "/merchant" ? "selected" : ""} href="/merchant">Merchant</a>}
          {identity ? (
            <>
              <a href="/storefront">Account</a>
              <button type="button" className="navLink" onClick={signOut} disabled={busy}>Sign out</button>
            </>
          ) : (
            <>
              <a href="/login">Sign in</a>
              <a href="/register">Register</a>
            </>
          )}
        </nav>
      </div>
    </div>
  );
}
