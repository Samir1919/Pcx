import test from "node:test";
import assert from "node:assert/strict";
import { validateEmail, validatePhone, validateContact } from "../lib/contact-validation.js";

test("validateEmail accepts valid addresses and lowercases them", () => {
  assert.deepEqual(validateEmail("User@Example.COM"), { ok: true, value: "user@example.com" });
  assert.deepEqual(validateEmail("a@b.co"), { ok: true, value: "a@b.co" });
});

test("validateEmail rejects malformed and dangerous input", () => {
  assert.equal(validateEmail("not-an-email").ok, false);
  assert.equal(validateEmail("a@b").ok, false);
  assert.equal(validateEmail("a b@c.com").ok, false);
  assert.equal(validateEmail("<script>@x.com").ok, false);
  assert.equal(validateEmail("").ok, false);
  assert.equal(validateEmail("   ").ok, false);
});

test("validatePhone normalizes to E.164 and rejects short input", () => {
  assert.deepEqual(validatePhone("+880 1712-345678"), { ok: true, value: "+8801712345678" });
  assert.deepEqual(validatePhone("(123) 4567"), { ok: true, value: "+1234567" });
  assert.equal(validatePhone("123456").ok, false);
  assert.equal(validatePhone("").ok, false);
  assert.equal(validatePhone("   ").ok, false);
});

test("validateContact routes email vs phone", () => {
  assert.deepEqual(validateContact("User@Example.com"), { ok: true, value: "user@example.com" });
  assert.deepEqual(validateContact("$8801712345678").ok, true, "$8801712345678");
  assert.equal(validateContact("").ok, false);
});
