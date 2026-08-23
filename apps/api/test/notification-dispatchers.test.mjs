import assert from "node:assert/strict";
import test from "node:test";
import { createResendEmailDispatcher } from "../src/modules/notification/resend-email-dispatcher.mjs";
import { createBdBulksmsDispatcher } from "../src/modules/notification/bd-bulksms-dispatcher.mjs";

test("Resend dispatcher posts authorized JSON and rejects failures", async () => {
  const calls = [];
  const dispatcher = createResendEmailDispatcher({
    apiKey: "re_test_123",
    from: "PCX <no-reply@pcx.com.bd>",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return { ok: true, json: async () => ({ id: "email-id" }) };
    }
  });
  const result = await dispatcher.send({ to: "a@b.com", subject: "Hello", text: "Body" });
  assert.equal(result.delivered, true);
  assert.equal(calls[0].url, "https://api.resend.com/emails");
  assert.equal(calls[0].init.headers.authorization, "Bearer re_test_123");
  assert.match(calls[0].init.body, /"to":\["a@b\.com"\]/);

  const failing = createResendEmailDispatcher({
    apiKey: "re_test_123", from: "x@y.com",
    fetchImpl: async () => ({ ok: false, json: async () => ({ message: "bad key" }) })
  });
  await assert.rejects(failing.send({ to: "a@b.com", subject: "x", text: "y" }), /bad key/);
});

test("bdBulksms dispatcher sends form-encoded and maps status", async () => {
  const calls = [];
  const dispatcher = createBdBulksmsDispatcher({
    token: "tok123",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return { ok: true, json: async () => [{ to: "8801712345678", message: "hi", status: 0 }] };
    }
  });
  const result = await dispatcher.send({ to: "+8801712345678", text: "hi" });
  assert.equal(result.delivered, true);
  assert.match(calls[0].url, /api\.bdbulksms\.net\/api\.php\?json/);
  assert.match(calls[0].init.body, /tok123/);
  assert.match(calls[0].init.body, /8801712345678/);

  const rejected = createBdBulksmsDispatcher({
    token: "tok123",
    fetchImpl: async () => ({ ok: true, json: async () => [{ status: 1, statusmsg: "Invalid Number" }] })
  });
  await assert.rejects(rejected.send({ to: "+8801712345678", text: "hi" }), /rejected/);
});
