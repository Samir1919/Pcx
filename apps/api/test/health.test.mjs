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
    headers: { "content-type": "application/json; charset=utf-8" },
    status: 200,
    body: { status: "ok" }
  });
  assert.equal((await invoke("/health/ready")).status, 200);
  assert.equal((await invoke("/health/ready", { readiness: () => ({ ok: false }) })).status, 503);
});
