const ADMIN_PREFIX = "pcx_admin_";
const STOREFRONT_PREFIX = "pcx_";
const SESSION_COOKIES = ["access", "refresh", "csrf", "device"];

// Storefront keeps the canonical `pcx_*` names; the admin surface prefixes them
// with `pcx_admin_` so a customer session and an admin session can coexist in
// one browser (cookies are host-scoped and ignore the port). See ADR 0013.
export function cookieName(name, isAdmin) {
  return `${isAdmin ? ADMIN_PREFIX : STOREFRONT_PREFIX}${name}`;
}

export function isAdminOrigin(origin, adminOrigins) {
  return typeof origin === "string" && typeof adminOrigins?.has === "function" && adminOrigins.has(origin);
}

// Which surface does a request belong to? The admin client sends an explicit
// `x-pcx-surface: admin` header on every request (GET requests carry no Origin
// header, so Origin alone is insufficient). Falls back to Origin for clients
// that do not send the header.
export function surfaceIsAdmin(request, adminOrigins) {
  const surface = request?.headers?.["x-pcx-surface"];
  if (surface === "admin") return true;
  if (surface === "storefront") return false;
  return isAdminOrigin(request?.headers?.origin, adminOrigins);
}

// Rewrite the inbound Cookie header so every downstream HTTP module keeps
// reading the canonical `pcx_*` names regardless of which surface the browser
// is on. Session cookies belonging to the *other* surface are dropped so a
// single browser can hold both a customer and an admin session simultaneously.
export function normalizeCookieHeader(request, adminOrigins) {
  const header = request?.headers?.cookie;
  if (typeof header !== "string") return;
  const isAdmin = surfaceIsAdmin(request, adminOrigins);
  const isSession = (name) => SESSION_COOKIES.includes(name);
  const kept = [];
  for (const raw of header.split(";")) {
    const part = raw.trim();
    if (!part) continue;
    const eq = part.indexOf("=");
    if (eq < 1) { kept.push(part); continue; }
    const name = part.slice(0, eq);
    const value = part.slice(eq + 1);
    const storefrontName = name.startsWith(STOREFRONT_PREFIX) ? name.slice(STOREFRONT_PREFIX.length) : null;
    const adminName = name.startsWith(ADMIN_PREFIX) ? name.slice(ADMIN_PREFIX.length) : null;
    if (isAdmin) {
      if (isSession(adminName)) { kept.push(`${STOREFRONT_PREFIX}${adminName}=${value}`); continue; }
      if (isSession(storefrontName)) continue;
      kept.push(part);
    } else {
      if (isSession(adminName)) continue;
      kept.push(part);
    }
  }
  request.headers.cookie = kept.join("; ");
}
