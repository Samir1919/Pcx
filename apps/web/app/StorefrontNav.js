"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { storefrontApi } from "../lib/storefront-api";
import { isMerchant } from "../lib/access.js";

export default function StorefrontNav() {
  const pathname = usePathname();
  const [identity, setIdentity] = useState(null);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeRef = useRef(null);

  useEffect(() => {
    let active = true;
    storefrontApi.me()
      .then((r) => { if (active) setIdentity(r.data); })
      .catch(() => { if (active) setIdentity(null); });
    return () => { active = false; };
  }, []);

  // Close the drawer on Escape and lock body scroll while open.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event) => { if (event.key === "Escape") setMenuOpen(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const merchant = isMerchant(identity);

  async function signOut() {
    setBusy(true);
    setMenuOpen(false);
    try { await storefrontApi.logout(); } catch { /* best-effort */ }
    setIdentity(null);
    setBusy(false);
    window.location.href = "/";
  }

  const navLink = (href, label) => (
    <a
      className={pathname === href ? "selected" : ""}
      href={href}
      onClick={() => setMenuOpen(false)}
    >
      {label}
    </a>
  );

  return (
    <div className="topbar">
      <div className="topbarInner">
        <a className="brand" href="/" aria-label="PCX home"><b>PCX</b><small>CERTIFIED PRE-OWNED</small></a>

        {/* Desktop inline nav */}
        <nav className="desktopNav" aria-label="Primary">
          {navLink("/", "Home")}
          {navLink("/storefront", "Storefront")}
          {navLink("/sell", "Sell")}
          {merchant && navLink("/merchant", "Merchant")}
          {identity ? (
            <>
              {navLink("/sell-requests", "Sell requests")}
              {navLink("/storefront", "Account")}
              <button type="button" className="navLink" onClick={signOut} disabled={busy}>Sign out</button>
            </>
          ) : (
            <>
              {navLink("/login", "Sign in")}
              {navLink("/register", "Register")}
              {navLink("/verify", "Verify")}
            </>
          )}
        </nav>

        {/* Mobile: primary auth action + hamburger */}
        <div className="mobileActions">
          {identity ? (
            <a className="authCta ghost" href="/storefront">Account</a>
          ) : (
            <a className="authCta" href="/login">Sign in</a>
          )}
          <button
            type="button"
            className="navToggle"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-drawer"
            onClick={() => setMenuOpen(true)}
          >
            <span aria-hidden="true">☰</span>
          </button>
        </div>
      </div>

      {/* Mobile drawer — rendered to document.body so it is never clipped by
          the sticky topbar's backdrop-filter containing block. */}
      {menuOpen && createPortal(
        <div className="navDrawerOverlay" onClick={() => setMenuOpen(false)}>
          <div
            id="mobile-nav-drawer"
            className="navDrawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="navDrawerHead">
              <a className="brand" href="/" aria-label="PCX home" onClick={() => setMenuOpen(false)}><b>PCX</b><small>CERTIFIED PRE-OWNED</small></a>
              <button ref={closeRef} type="button" className="navDrawerClose" aria-label="Close menu" onClick={() => setMenuOpen(false)}>×</button>
            </div>

            <nav className="navDrawerLinks" aria-label="Mobile primary">
              {navLink("/", "Home")}
              {navLink("/storefront", "Storefront")}
              {navLink("/sell", "Sell")}
              {merchant && navLink("/merchant", "Merchant")}
            </nav>

            <div className="navDrawerAuth">
              {identity ? (
                <>
                  <a className="drawerLink" href="/sell-requests" onClick={() => setMenuOpen(false)}>Sell requests</a>
                  <a className="drawerBtn primary" href="/storefront" onClick={() => setMenuOpen(false)}>Account</a>
                  <button type="button" className="drawerBtn secondary" onClick={signOut} disabled={busy}>Sign out</button>
                </>
              ) : (
                <>
                  <a className="drawerBtn primary" href="/login" onClick={() => setMenuOpen(false)}>Sign in</a>
                  <a className="drawerBtn secondary" href="/register" onClick={() => setMenuOpen(false)}>Register</a>
                  <a className="drawerLink" href="/verify" onClick={() => setMenuOpen(false)}>Verify your contact</a>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
