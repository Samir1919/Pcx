"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./auth-provider";

const NAV = [
  { href: "/", label: "Overview", short: "O" },
  { href: "/catalog", label: "Catalog", short: "C" },
  { href: "/inventory", label: "Inventory", short: "I" },
  { href: "/verification", label: "Verification", short: "V" },
  { href: "/payments", label: "Payments", short: "P" },
  { href: "/audit", label: "Audit logs", short: "A" }
];

export default function UserShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { identity, loading, logout } = useAuth();

  const role = identity?.roles?.[0]?.toLowerCase() ?? "signed out";

  // Central auth gate: never render privileged chrome/content before identity
  // resolution, and redirect unauthenticated visitors to /login instead of
  // per-page 401 banners.
  useEffect(() => {
    if (!loading && !identity) router.replace("/login");
  }, [loading, identity, router]);

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

  return (
    <main>
      <aside>
        <Link className="brand" href="/" aria-label="PCX Admin home">
          <b>PCX</b>
          <small>CONTROL ROOM</small>
        </Link>

        <div className="who">
          {identity
            ? <><span className="whoLabel">Signed in as</span><strong className="whoId">{identity.userId.slice(0, 8)}…</strong><span className="whoRole">{role}</span></>
            : <><span className="whoLabel">Signed out</span><Link className="whoRole" href="/login">Sign in</Link></>}
        </div>

        <nav aria-label="Primary">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} data-short={item.short} className={pathname === item.href ? "selected" : ""}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="secure">
          {identity ? (
            <button className="logout" type="button" onClick={() => logout()}>Sign out</button>
          ) : null}
          <div>Server-authorized<br /><strong>Privileged workspace</strong></div>
        </div>
      </aside>

      <section className="content">{children}</section>
    </main>
  );
}
