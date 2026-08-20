import Link from "next/link";

const SHOP_LINKS = [
  { href: "/storefront", label: "Storefront" },
  { href: "/sell", label: "Sell to PCX" },
  { href: "/verify", label: "Verify your contact" }
];

const ACCOUNT_LINKS = [
  { href: "/login", label: "Sign in" },
  { href: "/register", label: "Register" }
];

export default function StorefrontFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="siteFooter">
      <div className="siteFooterInner">
        <div className="footerGrid">
          <div className="footerCol footerBrand">
            <a className="brand" href="/" aria-label="PCX home">
              <b>PCX</b>
              <small>CERTIFIED PRE-OWNED</small>
            </a>
            <p className="footerTagline">A certified pre-owned marketplace for inspected, graded hardware.</p>
            <p className="footerTrust">Certified inspection · Honest grading · Transparent quote</p>
          </div>

          <nav className="footerCol" aria-label="Shop">
            <h2 className="footerHeading">Shop</h2>
            <ul className="footerLinks">
              {SHOP_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="footerCol" aria-label="Account">
            <h2 className="footerHeading">Account</h2>
            <ul className="footerLinks">
              {ACCOUNT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="footerBottom">
          <p className="footerCopyright">© {year} PCX · Certified pre-owned marketplace</p>
          <p className="footerTrust">Certified inspection · Honest grading · Transparent quote</p>
        </div>
      </div>
    </footer>
  );
}
