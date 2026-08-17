"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "./auth-provider";

const NAV = [
  { href: "/", label: "Overview", icon: "overview" },
  { href: "/catalog", label: "Catalog", icon: "catalog" },
  { href: "/inventory", label: "Inventory", icon: "inventory" },
  { href: "/verification", label: "Verification", icon: "verification" },
  { href: "/payments", label: "Payments", icon: "payments" },
  { href: "/audit", label: "Audit logs", icon: "audit" }
];

function Icon({ name }) {
  const props = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  switch (name) {
    case "overview":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "catalog":
      return (
        <svg {...props}>
          <path d="M4 7.5 12 3l8 4.5-8 4.5L4 7.5Z" />
          <path d="M4 12.5 12 17l8-4.5" />
          <path d="M4 16.5 12 21l8-4.5" />
          <path d="M12 21v-10" />
        </svg>
      );
    case "inventory":
      return (
        <svg {...props}>
          <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" />
          <path d="M3 7l9 5 9-5" />
          <path d="M12 12v10" />
        </svg>
      );
    case "verification":
      return (
        <svg {...props}>
          <path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Z" />
          <path d="m8.5 12 2.5 2.5 4.5-4.5" />
        </svg>
      );
    case "payments":
      return (
        <svg {...props}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
          <path d="M6 15h4" />
        </svg>
      );
    case "audit":
      return (
        <svg {...props}>
          <path d="M8 6h13" />
          <path d="M8 12h13" />
          <path d="M8 18h13" />
          <path d="M4 6h.01" />
          <path d="M4 12h.01" />
          <path d="M4 18h.01" />
        </svg>
      );
    case "logout":
      return (
        <svg {...props}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
      );
    default:
      return null;
  }
}

export default function UserShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { identity, loading, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const role = identity?.roles?.[0]?.toLowerCase() ?? "signed out";

  // Central auth gate: never render privileged chrome/content before identity
  // resolution, and redirect unauthenticated visitors to /login instead of
  // per-page 401 banners.
  useEffect(() => {
    if (!loading && !identity) router.replace("/login");
  }, [loading, identity, router]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  // Close the drawer on Escape and re-enable scroll on cleanup.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event) => { if (event.key === "Escape") setDrawerOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  if (loading) {
    return (
      <main>
        <section className="content">
          <p className="state" role="status">Loading workspace…</p>
        </section>
      </main>
    );
  }

  if (!identity) return null;

  const navLinks = (
    <nav className="primaryNav" aria-label="Primary">
      {NAV.map((item) => {
        const selected = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={selected ? "navItem selected" : "navItem"}
            aria-current={selected ? "page" : undefined}
            title={item.label}
          >
            <span className="navIcon"><Icon name={item.icon} /></span>
            <span className="navLabel">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const signOutControl = (
    <div className="userZone">
      <div className="userMeta">
        <span className="whoLabel">Signed in as</span>
        <strong className="whoId">{identity.userId.slice(0, 8)}…</strong>
        <span className="whoRole">{role}</span>
      </div>
      <button className="logout" type="button" onClick={() => logout()}>
        <span className="logoutIcon" aria-hidden="true"><Icon name="logout" /></span>
        <span className="logoutLabel">Sign out</span>
      </button>
    </div>
  );

  return (
    <div className="appShell">
      {/* Mobile top bar */}
      <header className="mobileBar">
        <Link className="brand mobileBrand" href="/" aria-label="PCX Admin home">
          <b>PCX</b>
          <small>CONTROL ROOM</small>
        </Link>
        <button
          className="menuButton"
          type="button"
          aria-label={drawerOpen ? "Close menu" : "Open menu"}
          aria-expanded={drawerOpen}
          aria-controls="admin-drawer"
          onClick={() => setDrawerOpen((open) => !open)}
        >
          <span aria-hidden="true">{drawerOpen ? "✕" : "☰"}</span>
        </button>
      </header>

      {/* Mobile drawer overlay */}
      <div
        className={`drawerOverlay ${drawerOpen ? "open" : ""}`}
        aria-hidden="true"
        onClick={() => setDrawerOpen(false)}
      />

      {/* Sidebar (desktop rail) + drawer (mobile) share this surface */}
      <aside id="admin-drawer" className={`sidebar ${drawerOpen ? "drawerOpen" : ""}`}>
        <Link className="brand" href="/" aria-label="PCX Admin home">
          <b>PCX</b>
          <small>CONTROL ROOM</small>
        </Link>
        {navLinks}
        {signOutControl}
      </aside>

      {/* Mobile drawer close button */}
      <button
        className={`drawerClose ${drawerOpen ? "open" : ""}`}
        type="button"
        aria-label="Close menu"
        onClick={() => setDrawerOpen(false)}
      >
        <span aria-hidden="true">✕</span>
      </button>

      <main className="workspace">
        <section className="content">{children}</section>
      </main>
    </div>
  );
}
