"use client";

// Returns a safe, local-only return path for post-login redirects. Only
// same-origin paths are accepted: a value must start with "/" but must not be a
// protocol-relative URL ("//evil.example") or an absolute URL. Everything else
// falls back to the storefront home. This is a frontend convenience only; the
// server enforces its own authentication/authorization rules.
export function safeReturnPath(value) {
  if (typeof value !== "string") return "/storefront";
  const trimmed = value.trim();
  if (trimmed.length === 0) return "/storefront";
  if (!trimmed.startsWith("/")) return "/storefront";
  if (trimmed.startsWith("//")) return "/storefront";
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return "/storefront";
  return trimmed;
}
