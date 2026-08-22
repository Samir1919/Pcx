"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { storefrontApi } from "../lib/storefront-api";

const DEFAULT_COLUMNS = [
  {
    title: "Shop",
    links: [
      { label: "Storefront", href: "/storefront" },
      { label: "Sell to PCX", href: "/sell" },
      { label: "Verify your contact", href: "/verify" }
    ]
  },
  {
    title: "Account",
    links: [
      { label: "Sign in", href: "/login" },
      { label: "Register", href: "/register" }
    ]
  }
];

const TRUST_LINE = "Certified inspection · Honest grading · Transparent quote";

export default function StorefrontFooter() {
  const [footer, setFooter] = useState(null);
  const year = new Date().getFullYear();

  useEffect(() => {
    let active = true;
    storefrontApi.footer()
      .then((result) => { if (active) setFooter(result.data ?? null); })
      .catch(() => { if (active) setFooter(null); });
    return () => { active = false; };
  }, []);

  const data = footer ?? {};
  const columns = Array.isArray(data.linkColumns) && data.linkColumns.length > 0
    ? data.linkColumns
    : DEFAULT_COLUMNS;
  const socialLinks = Array.isArray(data.socialLinks) ? data.socialLinks : [];
  const hasContact = data.contactEmail || data.contactPhone || data.address || data.tradeLicense || data.bin;

  return (
    <footer className="siteFooter">
      <div className="siteFooterInner">
        <div className="footerGrid">
          <div className="footerCol footerBrand">
            <a className="brand" href="/" aria-label="PCX home">
              <b>PCX</b>
              <small>CERTIFIED PRE-OWNED</small>
            </a>
            <p className="footerTagline">{data.tagline || "A certified pre-owned marketplace for inspected, graded hardware."}</p>
            <p className="footerTrust">{TRUST_LINE}</p>

            {hasContact ? (
              <div className="footerContact">
                {data.contactEmail ? <a className="footerContactRow" href={`mailto:${data.contactEmail}`}>{data.contactEmail}</a> : null}
                {data.contactPhone ? <a className="footerContactRow" href={`tel:${data.contactPhone.replace(/[^\d+]/g, "")}`}>{data.contactPhone}</a> : null}
                {data.address ? <p className="footerContactRow">{data.address}</p> : null}
                {data.tradeLicense ? <p className="footerContactRow">Trade license: {data.tradeLicense}</p> : null}
                {data.bin ? <p className="footerContactRow">BIN: {data.bin}</p> : null}
              </div>
            ) : null}

            {socialLinks.length > 0 ? (
              <div className="footerSocial">
                {socialLinks.map((social) => (
                  <a key={`${social.platform}-${social.href}`} href={social.href} target="_blank" rel="noopener noreferrer">
                    {social.platform}
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          {columns.map((column) => (
            <nav className="footerCol" aria-label={column.title} key={column.title}>
              <h2 className="footerHeading">{column.title}</h2>
              <ul className="footerLinks">
                {column.links.map((link) => (
                  <li key={`${link.label}-${link.href}`}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="footerBottom">
          <p className="footerCopyright">© {year} {data.copyright || "PCX · Certified pre-owned marketplace"}</p>
          <p className="footerTrust">{TRUST_LINE}</p>
        </div>
      </div>
    </footer>
  );
}
