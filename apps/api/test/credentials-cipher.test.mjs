import assert from "node:assert/strict";
import test from "node:test";
import { createCredentialsCipher } from "../src/modules/payment/credentials-cipher.mjs";

const DEV_ONLY_KEY = "0000000000000000000000000000000000000000000000000000000000000000";

test("cipher encrypts and decrypts with a real key", () => {
  const cipher = createCredentialsCipher({ key: "a".repeat(64) });
  const encrypted = cipher.encrypt("secret-value");
  assert.ok(encrypted.includes(":"));
  assert.notEqual(encrypted, "secret-value");
  assert.equal(cipher.decrypt(encrypted), "secret-value");
});

test("cipher rejects a malformed key", () => {
  assert.throws(() => createCredentialsCipher({ key: "nope" }), /64-character hex string/);
});

test("cipher allows the dev-only fallback outside production", () => {
  const cipher = createCredentialsCipher({ env: "development" });
  const encrypted = cipher.encrypt("local");
  assert.equal(cipher.decrypt(encrypted), "local");
});

test("cipher fails closed in production when the key is absent", () => {
  assert.throws(
    () => createCredentialsCipher({ env: "production" }),
    /PAYMENT_CREDENTIALS_KEY must be set to a real 32-byte hex key in production/
  );
});

test("cipher fails closed in production when the key is the dev-only zero key", () => {
  assert.throws(
    () => createCredentialsCipher({ key: DEV_ONLY_KEY, env: "production" }),
    /PAYMENT_CREDENTIALS_KEY must be set to a real 32-byte hex key in production/
  );
});

test("cipher works in production with a real key", () => {
  const cipher = createCredentialsCipher({ key: "b".repeat(64), env: "production" });
  const encrypted = cipher.encrypt("prod-value");
  assert.equal(cipher.decrypt(encrypted), "prod-value");
});
