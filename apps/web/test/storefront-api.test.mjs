import test from "node:test";
import assert from "node:assert/strict";
import { storefrontApi, StorefrontApiError } from "../lib/storefront-api.js";

test("storefront reads hit the public read-only endpoints", async () => {
  const priorFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, async text() { return JSON.stringify({ data: [] }); } };
  };
  try {
    await storefrontApi.categories();
    await storefrontApi.brands();
    await storefrontApi.footer();
    await storefrontApi.listings({ categoryId: "c1", sort: "price_asc", limit: 12 });
    await storefrontApi.passport("pcx/one");
    assert.deepEqual(calls.map((c) => c.url), [
      "/api/v1/categories",
      "/api/v1/brands",
      "/api/v1/footer",
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
  global.fetch = async (u) => { url = u; return { ok: true, status: 200, async text() { return JSON.stringify({ data: [], meta: { nextCursor: null } }); } }; };
  try {
    await storefrontApi.listings({ categoryId: "", brandId: null, q: "", sort: "newest", limit: 20 });
    assert.equal(url, "/api/v1/listings?sort=newest&limit=20");
    assert.ok(!url.includes("price=") && !url.includes("status=") && !url.includes("serial"));
  } finally {
    global.fetch = priorFetch;
  }
});

test("storefront listings encode layered-navigation spec filters", async () => {
  const priorFetch = global.fetch;
  let url;
  global.fetch = async (u) => { url = u; return { ok: true, status: 200, async text() { return JSON.stringify({ data: [], meta: { nextCursor: null } }); } }; };
  try {
    await storefrontApi.listings({ specs: [{ key: "vram_gb", value: "12" }, { key: "chipset", value: "B550" }] });
    assert.equal(url, "/api/v1/listings?spec%5Bvram_gb%5D=12&spec%5Bchipset%5D=B550");
  } finally {
    global.fetch = priorFetch;
  }
});

test("storefront listingFacets hits the facets endpoint", async () => {
  const priorFetch = global.fetch;
  let url;
  global.fetch = async (u) => { url = u; return { ok: true, status: 200, async text() { return JSON.stringify({ data: [] }); } }; };
  try {
    await storefrontApi.listingFacets({ categoryId: "c1" });
    assert.equal(url, "/api/v1/listings/facets?categoryId=c1");
  } finally {
    global.fetch = priorFetch;
  }
});

test("storefront profile endpoints hit the self-service write paths", async () => {
  const priorFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, async text() { return JSON.stringify({ data: {} }); } };
  };
  try {
    await storefrontApi.updateProfile({ fullName: "New", phone: "018" });
    await storefrontApi.changePassword("old", "new-password-123");
    assert.deepEqual(calls.map((c) => c.url), ["/api/v1/me", "/api/v1/me/password"]);
    assert.equal(calls[0].options.method, "PATCH");
    assert.equal(calls[1].options.method, "POST");
    assert.deepEqual(JSON.parse(calls[1].options.body), { currentPassword: "old", newPassword: "new-password-123" });
  } finally {
    global.fetch = priorFetch;
  }
});

test("storefront seller endpoints hit owner-scoped sell-request paths", async () => {
  const priorFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, async text() { return JSON.stringify({ data: [] }); } };
  };
  try {
    await storefrontApi.mySellRequests();
    await storefrontApi.sellRequest("sr-1");
    await storefrontApi.sellRequestOffers("sr-1");
    await storefrontApi.submitSellRequest("sr-1");
    assert.deepEqual(calls.map((c) => c.url), [
      "/api/v1/sell-requests",
      "/api/v1/sell-requests/sr-1",
      "/api/v1/sell-requests/sr-1/offers",
      "/api/v1/sell-requests/sr-1/submit"
    ]);
    assert.equal(calls[3].options.method, "POST");
  } finally {
    global.fetch = priorFetch;
  }
});

test("storefront surfaces stable server errors", async () => {
  const priorFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 404, async text() { return JSON.stringify({ error: { code: "PASSPORT_NOT_FOUND", message: "Passport not found" } }); } });
  try {
    await assert.rejects(() => storefrontApi.passport("missing"), (e) => e instanceof StorefrontApiError && e.code === "PASSPORT_NOT_FOUND" && e.status === 404);
  } finally {
    global.fetch = priorFetch;
  }
});

test("storefront auto-refreshes a 401 on a protected read and retries once", async () => {
  const priorFetch = global.fetch;
  const priorDocument = global.document;
  const calls = [];
  global.document = { cookie: "pcx_csrf=csrf-token-1" };
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url === "/api/v1/auth/refresh") {
      return { ok: true, status: 200, async json() { return { data: { status: "ok" } }; } };
    }
    if (calls.filter((c) => c.url === "/api/v1/me").length === 1) {
      return { ok: false, status: 401, async text() { return JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } }); } };
    }
    return { ok: true, status: 200, async text() { return JSON.stringify({ data: { email: "seller@example.com" } }); } };
  };
  try {
    const result = await storefrontApi.me();
    assert.equal(result.data.email, "seller@example.com");
    assert.deepEqual(calls.map((c) => c.url), ["/api/v1/me", "/api/v1/auth/refresh", "/api/v1/me"]);
    assert.equal(calls[1].options.method, "POST");
    assert.equal(calls[1].options.headers["x-csrf-token"], "csrf-token-1");
  } finally {
    global.fetch = priorFetch;
    global.document = priorDocument;
  }
});

test("storefront does not self-refresh on auth endpoints", async () => {
  const priorFetch = global.fetch;
  const priorDocument = global.document;
  const calls = [];
  global.document = { cookie: "pcx_csrf=csrf-token-1" };
  global.fetch = async (url) => {
    calls.push(url);
    return { ok: false, status: 401, async text() { return JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "Authentication failed" } }); } };
  };
  try {
    await assert.rejects(() => storefrontApi.login("a@b.c", "pw"), (e) => e.status === 401);
    assert.deepEqual(calls, ["/api/v1/auth/login"]);
  } finally {
    global.fetch = priorFetch;
    global.document = priorDocument;
  }
});

test("storefront does not refresh on non-401 errors", async () => {
  const priorFetch = global.fetch;
  const calls = [];
  global.fetch = async (url) => {
    calls.push(url);
    return { ok: false, status: 404, async text() { return JSON.stringify({ error: { code: "NOT_FOUND", message: "Nope" } }); } };
  };
  try {
    await assert.rejects(() => storefrontApi.passport("missing"), (e) => e.status === 404);
    assert.deepEqual(calls, ["/api/v1/passport/missing"]);
  } finally {
    global.fetch = priorFetch;
  }
});

test("storefront refreshes the CSRF token before retrying a write", async () => {
  const priorFetch = global.fetch;
  const priorDocument = global.document;
  const calls = [];
  global.document = { cookie: "pcx_csrf=old-token" };
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url === "/api/v1/auth/refresh") {
      global.document.cookie = "pcx_csrf=new-token"; // refresh rotates the CSRF cookie
      return { ok: true, status: 200, async json() { return { data: { status: "ok" } }; } };
    }
    if (calls.filter((c) => c.url === "/api/v1/me").length === 1) {
      return { ok: false, status: 401, async text() { return JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "x" } }); } };
    }
    return { ok: true, status: 200, async text() { return JSON.stringify({ data: {} }); } };
  };
  try {
    await storefrontApi.updateProfile({ fullName: "New" });
    const retry = calls[calls.length - 1];
    assert.equal(retry.url, "/api/v1/me");
    assert.equal(retry.options.method, "PATCH");
    assert.equal(retry.options.headers["x-csrf-token"], "new-token");
  } finally {
    global.fetch = priorFetch;
    global.document = priorDocument;
  }
});
