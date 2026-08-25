import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createLocalMediaStorage, MediaStorageError } from "../src/modules/media/local-media-storage.mjs";
import { createMediaService } from "../src/modules/media/media-service.mjs";

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("jpegdata")]);

test("local storage saves only allow-listed images with server-generated key", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pcx-media-"));
  const storage = createLocalMediaStorage({ root });
  try {
    const saved = await storage.save(JPEG, { visibility: "PUBLIC" });
    assert.match(saved.storageKey, /^[0-9a-f-]{36}$/);
    assert.equal(saved.mimeType, "image/jpeg");
    const readBack = await storage.read(saved.storageKey, { visibility: "PUBLIC" });
    assert.deepEqual(readBack, JPEG);
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
    const media = await service.addSellRequestMedia("access", "sr1", JPEG, "PHOTO");
    assert.equal(media.visibility, "PRIVATE");
    await assert.rejects(service.addSellRequestMedia("access", "sr2", JPEG, "PHOTO"), (e) => e.code === "not_found");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
