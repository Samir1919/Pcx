import test from "node:test";
import assert from "node:assert/strict";
import { authApi } from "../lib/auth-api.js";
import { ApiError } from "../lib/api-client.js";

test("login and register run before a CSRF cookie exists and do not require it", async () => {
  const priorDocument = global.document;
  const priorFetch = global.fetch;
  global.document = { cookie: "" };
  const calls = [];
  global.fetch = async (...args) => { calls.push(args); return { ok: true, status: 200, async json() { return { data: {} }; } }; };
  try {
    await authApi.login({ contact: "a@example.com", password: "password" });
    await authApi.register({ email: "a@example.com", password: "long-enough-password" });
  } finally {
    global.document = priorDocument;
    global.fetch = priorFetch;
  }
  assert.equal(calls.length, 2);
  // Neither pre-session request may hard-require a CSRF double-submit token.
  assert.equal(calls[0][1].headers["x-csrf-token"], undefined);
  assert.equal(calls[1][1].headers["x-csrf-token"], undefined);
});

test("verify-mfa and logout still fail closed without a CSRF cookie", async () => {
  const priorDocument = global.document;
  const priorFetch = global.fetch;
  global.document = { cookie: "" };
  global.fetch = async () => { throw new Error("fetch should not be reached"); };
  try {
    await assert.rejects(() => authApi.verifyMfa({ challengeId: "c1", credential: "123456" }), (e) => e instanceof ApiError && e.code === "CSRF_MISSING");
    await assert.rejects(() => authApi.logout(), (e) => e instanceof ApiError && e.code === "CSRF_MISSING");
  } finally {
    global.document = priorDocument;
    global.fetch = priorFetch;
  }
});
