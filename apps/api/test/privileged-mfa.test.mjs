import assert from "node:assert/strict";
import test from "node:test";
import { requiresPrivilegedMfa, safeMfaChallenge } from "../src/modules/identity/privileged-mfa.mjs";

test("privileged MFA role policy is server-owned and challenge metadata is bounded", () => {
  for (const role of ["SUPERVISOR", "FINANCE", "ADMIN", "SUPER_ADMIN"]) assert.equal(requiresPrivilegedMfa([role]), true);
  for (const role of ["CUSTOMER", "SUPPORT", "TECHNICIAN", "INVENTORY"]) assert.equal(requiresPrivilegedMfa([role]), false);
  assert.deepEqual(safeMfaChallenge({ id: "challenge-1", expiresAt: "2026-08-16T00:05:00.000Z", secret: "hidden" }), { id: "challenge-1", expiresAt: "2026-08-16T00:05:00.000Z" });
  assert.throws(() => safeMfaChallenge({ id: "", expiresAt: "never" }), /challenge/);
});
