import assert from "node:assert/strict";
import test from "node:test";
import { createRequestHandler } from "../src/server.mjs";

async function invoke(url, options) {
  const result = { headers: {} };
  const response = {
    setHeader(name, value) { result.headers[name] = value; },
    writeHead(status) { result.status = status; return response; },
    end(body) { result.body = JSON.parse(body); return response; }
  };
  await createRequestHandler(options)({ url }, response);
  return result;
}

test("liveness and readiness endpoints are explicit", async () => {
  assert.deepEqual(await invoke("/health/live"), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "no-referrer",
      "content-security-policy": "default-src 'none'; frame-ancestors 'none'"
    },
    status: 200,
    body: { status: "ok" }
  });
  assert.equal((await invoke("/health/ready")).status, 200);
  assert.equal((await invoke("/health/ready", { readiness: () => ({ ok: false }) })).status, 503);
});

test("readiness awaits an async readiness probe (regression)", async () => {
  // Production readiness is an async function returning a Promise; the handler
  // must await it rather than reading `.ok` off the unresolved Promise.
  assert.equal((await invoke("/health/ready", { readiness: async () => ({ ok: true }) })).status, 200);
  assert.equal((await invoke("/health/ready", { readiness: async () => ({ ok: false }) })).status, 503);
});
