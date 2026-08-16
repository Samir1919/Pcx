const privilegedRoles = new Set(["SUPERVISOR", "FINANCE", "ADMIN", "SUPER_ADMIN"]);

export function requiresPrivilegedMfa(roles) {
  return Array.isArray(roles) && roles.some((role) => privilegedRoles.has(role));
}

export function safeMfaChallenge(value) {
  if (!value || typeof value.id !== "string" || value.id.length < 1 || value.id.length > 128) throw new TypeError("MFA challenge ID is invalid");
  const expiresAt = new Date(value.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) throw new TypeError("MFA challenge expiry is invalid");
  return Object.freeze({ id: value.id, expiresAt: expiresAt.toISOString() });
}

// Verification/enrollment results carry a server-derived user ID only; the
// client is never trusted to supply the identity that owns the challenge.
export function safeMfaUserId(value) {
  if (typeof value !== "string" || value.length < 1 || value.length > 128) throw new TypeError("MFA user ID is invalid");
  return value;
}
