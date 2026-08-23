import assert from "node:assert/strict";
import test from "node:test";
import { normalizeEmail, normalizePhone, classifyContact } from "../src/modules/identity/contact-normalization.mjs";
import { createInMemoryAuthAbuseControl } from "../src/modules/identity/auth-abuse-control.mjs";

test("normalizeEmail trims, lowercases, and rejects invalid input", () => {
  assert.deepEqual(normalizeEmail("  Demo@EXAMPLE.com "), { ok: true, value: "demo@example.com" });
  for (const bad of ["", "not-an-email", "two@@example.com", "a@", "@b.com", "a <script>@x.com", "a b@c.com", "a".repeat(300) + "@x.com"]) {
    assert.equal(normalizeEmail(bad).ok, false, `should reject: ${bad}`);
  }
});

test("normalizePhone produces E.164 and rejects invalid input", () => {
  assert.deepEqual(normalizePhone("01712345678"), { ok: true, value: "+8801712345678" });
  assert.deepEqual(normalizePhone("+880 1712-345678"), { ok: true, value: "+8801712345678" });
  assert.deepEqual(normalizePhone("8801712345678"), { ok: true, value: "+8801712345678" });
  for (const bad of ["", "123", "not-a-phone", "+"]) {
    assert.equal(normalizePhone(bad).ok, false, `should reject: ${bad}`);
  }
});

test("classifyContact routes email vs sms", () => {
  assert.deepEqual(classifyContact("Demo@EXAMPLE.com"), { ok: true, channel: "EMAIL", value: "demo@example.com" });
  assert.deepEqual(classifyContact("01712345678"), { ok: true, channel: "SMS", value: "+8801712345678" });
  assert.equal(classifyContact("<script>alert(1)</script>").ok, false);
});

test("extended abuse control enforces per-contact limits", async () => {
  let now = 1000;
  const limiter = createInMemoryAuthAbuseControl({
    clock: () => now,
    windowMs: 1000,
    limits: { login: 10 },
    contactLimits: { login: 2 },
    maximumKeys: 100
  });
  const ip = Buffer.alloc(32, 9);
  // Two distinct contacts from the same IP: per-IP is generous, per-contact is strict.
  assert.equal((await limiter.check({ action: "login", ipHash: ip, contact: "a@example.com" })).allowed, true);
  assert.equal((await limiter.check({ action: "login", ipHash: ip, contact: "a@example.com" })).allowed, true);
  const blocked = await limiter.check({ action: "login", ipHash: ip, contact: "a@example.com" });
  assert.equal(blocked.allowed, false);
  // A different contact from the same IP still passes the contact dimension.
  assert.equal((await limiter.check({ action: "login", ipHash: ip, contact: "b@example.com" })).allowed, true);
});
