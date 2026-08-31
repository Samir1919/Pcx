import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createLocalMediaStorage, MediaStorageError } from "../src/modules/media/local-media-storage.mjs";
import { createMediaService } from "../src/modules/media/media-service.mjs";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

test("local storage compresses to WebP, ≤2 MiB, and writes a thumbnail", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pcx-media-"));
  const storage = createLocalMediaStorage({ root });
  try {
    const saved = await storage.save(PNG, { visibility: "PUBLIC" });
    assert.match(saved.storageKey, /^[0-9a-f-]{36}$/);
    assert.equal(saved.mimeType, "image/webp");
    assert.ok(saved.sizeBytes <= 2 * 1024 * 1024);
    const readBack = await storage.read(saved.storageKey, { visibility: "PUBLIC" });
    assert.ok(Buffer.isBuffer(readBack) && readBack.length > 0);
    const thumb = await storage.readThumb(saved.storageKey, { visibility: "PUBLIC" });
    assert.ok(Buffer.isBuffer(thumb) && thumb.length > 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("local storage rejects non-image content", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pcx-media-"));
  const storage = createLocalMediaStorage({ root });
  try {
    await assert.rejects(storage.save(Buffer.from("<script>alert(1)</script>"), { visibility: "PUBLIC" }), (e) => e instanceof MediaStorageError && e.code === "unsupported_type");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("media service lists sell-request media for admin and denies non-admin", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pcx-media-"));
  const storage = createLocalMediaStorage({ root });
  const repository = {
    async create(record) { return record; },
    async findById(id) { return { id, storageKey: "key", mimeType: "image/jpeg", sizeBytes: 10, visibility: "PRIVATE" }; },
    async findSellRequestOwner(id) { return id === "sr1" ? "customer-1" : null; },
    async linkSellRequest() { },
    async linkInspection() { },
    async linkListing() { },
    async listSellRequestMedia() { return [{ id: "m1" }]; },
    async listListingMedia() { return []; }
  };
  try {
    const admin = createMediaService({
      authService: { async authenticateAccess() { return { userId: "admin-1", status: "ACTIVE", roles: ["ADMIN"] }; } },
      repository,
      storage
    });
    assert.deepEqual(await admin.listSellRequestMediaForAdmin("access", "sr1"), [{ id: "m1" }]);

    const customer = createMediaService({
      authService: { async authenticateAccess() { return { userId: "customer-1", status: "ACTIVE", roles: ["CUSTOMER"] }; } },
      repository,
      storage
    });
    await assert.rejects(customer.listSellRequestMediaForAdmin("access", "sr1"), (e) => e.code === "forbidden");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("media service rejects a 9th photo with limit_reached", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pcx-media-"));
  const storage = createLocalMediaStorage({ root });
  const repository = {
    async create(record) { return record; },
    async findById(id) { return { id, storageKey: "key", mimeType: "image/webp", sizeBytes: 10, visibility: "PRIVATE" }; },
    async findSellRequestOwner(id) { return id === "sr1" ? "customer-1" : null; },
    async linkSellRequest() { },
    async linkInspection() { },
    async linkListing() { },
    async listSellRequestMedia() { return new Array(8).fill({ id: "m" }); },
    async listListingMedia() { return []; }
  };
  const service = createMediaService({
    authService: { async authenticateAccess() { return { userId: "customer-1", status: "ACTIVE", roles: ["CUSTOMER"] }; } },
    repository,
    storage
  });
  try {
    await assert.rejects(service.addSellRequestMedia("access", "sr1", PNG, "PHOTO"), (e) => e.code === "limit_reached");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("media service enforces seller ownership on upload and private read", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pcx-media-"));
  const storage = createLocalMediaStorage({ root });
  const repository = {
    async create(record) { return record; },
    async findById(id) { return { id, storageKey: "key", mimeType: "image/jpeg", sizeBytes: 10, visibility: "PRIVATE" }; },
    async findSellRequestOwner(id) { return id === "sr1" ? "customer-1" : null; },
    async linkSellRequest() { },
    async linkInspection() { },
    async linkListing() { },
    async listSellRequestMedia() { return []; },
    async listListingMedia() { return []; }
  };
  const service = createMediaService({
    authService: { async authenticateAccess() { return { userId: "customer-1", status: "ACTIVE", roles: ["CUSTOMER"] }; } },
    repository,
    storage
  });
  try {
    const media = await service.addSellRequestMedia("access", "sr1", PNG, "PHOTO");
    assert.equal(media.visibility, "PRIVATE");
    await assert.rejects(service.addSellRequestMedia("access", "sr2", PNG, "PHOTO"), (e) => e.code === "not_found");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("media service promotes a seller photo to a public listing copy and validates the chain", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pcx-media-"));
  const storage = createLocalMediaStorage({ root });
  const saved = await storage.save(PNG, { visibility: "PRIVATE" });
  const links = [];
  const repository = {
    async create(record) { return record; },
    async findById(id) { return { id, storageKey: saved.storageKey, mimeType: "image/webp", sizeBytes: saved.sizeBytes, visibility: "PRIVATE" }; },
    async findSellRequestOwner() { return "customer-1"; },
    async linkSellRequest() { },
    async linkInspection() { },
    async linkListing(linkId, listingId, mediaId) { links.push({ linkId, listingId, mediaId }); },
    async updateVisibility(mediaId, visibility) { return { id: mediaId, storageKey: saved.storageKey, mimeType: "image/webp", sizeBytes: saved.sizeBytes, visibility }; },
    async findListingSellRequestId(listingId) { return listingId === "l1" ? "sr1" : null; },
    async listSellRequestMedia() { return [{ id: "m1", storageKey: saved.storageKey, mimeType: "image/webp", sizeBytes: saved.sizeBytes, purpose: "PHOTO" }]; },
    async listListingMedia() { return []; }
  };
  const service = createMediaService({
    authService: { async authenticateAccess() { return { userId: "admin-1", status: "ACTIVE", roles: ["ADMIN"] }; } },
    repository,
    storage
  });
  try {
    const promoted = await service.promoteSellerPhoto("access", "l1", "m1");
    assert.equal(promoted.visibility, "PUBLIC");
    assert.equal(promoted.storageKey, saved.storageKey);
    assert.equal(links.length, 1);
    assert.equal(links[0].listingId, "l1");
    assert.equal(links[0].mediaId, "m1");
    const publicBytes = await storage.read(saved.storageKey, { visibility: "PUBLIC" });
    assert.ok(Buffer.isBuffer(publicBytes) && publicBytes.length > 0);
    await assert.rejects(service.promoteSellerPhoto("access", "l1", "other"), (e) => e.code === "forbidden");
    await assert.rejects(service.promoteSellerPhoto("access", "missing", "m1"), (e) => e.code === "not_found");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("media service marks seller picker items as promoted by media id", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pcx-media-"));
  const storage = createLocalMediaStorage({ root });
  const saved = await storage.save(PNG, { visibility: "PRIVATE" });
  const repository = {
    async create(record) { return record; },
    async findById(id) { return { id, storageKey: saved.storageKey, mimeType: "image/webp", sizeBytes: saved.sizeBytes, visibility: "PRIVATE" }; },
    async findSellRequestOwner() { return "customer-1"; },
    async linkSellRequest() { },
    async linkInspection() { },
    async linkListing() { },
    async updateVisibility(mediaId, visibility) { return { id: mediaId, visibility }; },
    async findListingSellRequestId(listingId) { return listingId === "l1" ? "sr1" : null; },
    async listSellRequestMedia() { return [{ id: "m1", storageKey: saved.storageKey, mimeType: "image/webp", sizeBytes: saved.sizeBytes }]; },
    async listListingMedia() { return [{ id: "m1", storageKey: saved.storageKey }]; }
  };
  const service = createMediaService({
    authService: { async authenticateAccess() { return { userId: "admin-1", status: "ACTIVE", roles: ["ADMIN"] }; } },
    repository,
    storage
  });
  try {
    const rows = await service.listSellerMediaForListing("access", "l1");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].promoted, true);
    assert.deepEqual(await service.listSellerMediaForListing("access", "missing"), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
