import assert from "node:assert/strict";
import test from "node:test";
import { createRequestHandler } from "../src/server.mjs";

test("API responses include baseline security headers", async () => {
  const headers = {};
  const response = {
    setHeader(name, value) { headers[name] = value; },
    writeHead(status) { headers.status = status; return response; },
    end() { return response; }
  };
  const request = {
    url: "/health/live",
    method: "GET",
    headers: { "x-request-id": "hdr" },
    socket: { remoteAddress: "192.0.2.1" },
    async *[Symbol.asyncIterator]() { }
  };
  await createRequestHandler({})(request, response);
  assert.equal(headers["x-content-type-options"], "nosniff");
  assert.equal(headers["x-frame-options"], "DENY");
  assert.equal(headers["referrer-policy"], "no-referrer");
  assert.equal(headers["content-security-policy"], "default-src 'none'; frame-ancestors 'none'");
  assert.equal(headers["strict-transport-security"], "max-age=31536000; includeSubDomains");
  assert.equal(headers["permissions-policy"], "camera=(), microphone=(), geolocation=()");
});
