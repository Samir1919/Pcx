import test from "node:test";
import assert from "node:assert/strict";
import { storefrontApi, StorefrontApiError } from "../lib/storefront-api.js";

test("storefront reads hit the public read-only endpoints", async () => {
  const priorFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, async json() { return { data: [] }; } };
  };
  try {
    await storefrontApi.categories();
    await storefrontApi.brands();
    await storefrontApi.listings({ categoryId: "c1", sort: "price_asc", limit: 12 });
    await storefrontApi.passport("pcx/one");
    assert.deepEqual(calls.map((c) => c.url), [
      "/api/v1/categories",
      "/api/v1/brands",
      "/api/v1/listings?categoryId=c1&sort=price_asc&limit=12",
      "/api/v1/passport/pcx%2Fone"
    ]);
    for (const call of calls) {
      assert.equal(call.options.method, "GET");
      assert.equal(call.options.credentials, "include");
      assert.equal(call.options.body, undefined);
    }
  } finally {
    global.fetch = priorFetch;
  }
});

test("storefront query builder omits empty filters and never sends client-owned fields", async () => {
  const priorFetch = global.fetch;
  let url;
  global.fetch = async (u) => { url = u; return { ok: true, status: 200, async json() { return { data: [], meta: { nextCursor: null } }; } }; };
  try {
    await storefrontApi.listings({ categoryId: "", brandId: null, q: "", sort: "newest", limit: 20 });
    assert.equal(url, "/api/v1/listings?sort=newest&limit=20");
    assert.ok(!url.includes("price=") && !url.includes("status=") && !url.includes("serial"));
  } finally {
    global.fetch = priorFetch;
  }
});

test("storefront surfaces stable server errors", async () => {
  const priorFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 404, async json() { return { error: { code: "PASSPORT_NOT_FOUND", message: "Passport not found" } }; } });
  try {
    await assert.rejects(() => storefrontApi.passport("missing"), (e) => e instanceof StorefrontApiError && e.code === "PASSPORT_NOT_FOUND" && e.status === 404);
  } finally {
    global.fetch = priorFetch;
  }
});
