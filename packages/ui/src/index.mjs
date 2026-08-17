// Shared design-system primitives. ADR-0004 defers moving visual primitives into
// this package until reuse is evidenced, so this surface is intentionally minimal.
// The one dependency-free primitive below is safe to share immediately.
export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}
