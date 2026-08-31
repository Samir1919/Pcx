import test from "node:test";
import assert from "node:assert/strict";
import { listingApi } from "../lib/listing-api.js";

test("listing admin list uses the admin read endpoint", async () => {
  const priorFetch = global.fetch;
  let path;
  global.fetch = async (url) => { path = url; return { ok: true, status: 200, async json() { return { data: [], meta: { nextCursor: null } }; } }; };
  try {
    await listingApi.list();
    assert.equal(path, "/api/v1/admin/listings");
  } finally {
    global.fetch = priorFetch;
  }
});

test("listing writes encode ids and never send client-owned status", async () => {
  const priorDocument = global.document, priorFetch = global.fetch;
  global.document = { cookie: "pcx_admin_csrf=secure" };
  let call;
  global.fetch = async (...args) => { call = args; return { ok: true, status: 200, async json() { return { data: {} }; } }; };
  try {
    await listingApi.createDraft({ inventoryItemId: "inv/1", publicSlug: "pcx-gpu" });
    assert.equal(call[0], "/api/v1/admin/listings");
    assert.equal(call[1].credentials, "include");
    assert.equal(call[1].headers["x-csrf-token"], "secure");
    assert.equal(JSON.parse(call[1].body).status, undefined);

    await listingApi.publish("l/1", { publicSlug: "pcx-gpu" });
    assert.equal(call[0], "/api/v1/admin/listings/l%2F1/publish");

    await listingApi.setPrice({ listingId: "l1", price: 15000 });
    assert.equal(call[0], "/api/v1/admin/listings/prices");
  } finally {
    global.document = priorDocument;
    global.fetch = priorFetch;
  }
});
