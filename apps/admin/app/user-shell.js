"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./auth-provider";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/catalog", label: "Catalog" },
  { href: "/inventory", label: "Inventory" },
  { href: "/verification", label: "Verification" },
  { href: "/payments", label: "Payments" },
  { href: "/audit", label: "Audit logs" }
];

export default function UserShell({ children }) {
  const pathname = usePathname();
  const { identity, logout } = useAuth();

  const role = identity?.roles?.[0]?.toLowerCase() ?? "signed out";

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
            <Link key={item.href} href={item.href} className={pathname === item.href ? "selected" : ""}>
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
