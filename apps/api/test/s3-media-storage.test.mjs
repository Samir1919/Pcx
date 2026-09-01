import assert from "node:assert/strict";
import test from "node:test";
import { Readable } from "node:stream";
import { createS3MediaStorage, createS3MediaStorageFromEnv } from "../src/modules/media/s3-media-storage.mjs";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

function mockClient() {
  const calls = { puts: [], copies: [], madeBucket: false };
  const store = new Map();
  const client = {
    async bucketExists() { return calls.madeBucket; },
    async makeBucket() { calls.madeBucket = true; },
    async putObject(bucket, objectName, buffer) { calls.puts.push({ bucket, objectName }); store.set(objectName, buffer); },
    async getObject(bucket, objectName) {
      const value = store.get(objectName);
      if (value == null) { const error = new Error("not found"); error.code = "NoSuchKey"; throw error; }
      return Readable.from([value]);
    },
    async copyObject(bucket, targetObject, sourcePath) { calls.copies.push({ bucket, targetObject, sourcePath }); store.set(targetObject, store.get(sourcePath.split("/").slice(2).join("/"))); }
  };
  return { client, calls, store };
}

test("s3 storage saves the full + thumbnail objects under the visibility prefix", async () => {
  const { client, calls } = mockClient();
  const storage = createS3MediaStorage({ client, bucket: "pcx-media" });

  const saved = await storage.save(PNG, { visibility: "PUBLIC" });
  assert.match(saved.storageKey, /^[0-9a-f-]{36}$/);
  assert.equal(saved.mimeType, "image/webp");
  assert.equal(calls.madeBucket, true);
  assert.equal(calls.puts.length, 2);
  assert.match(calls.puts[0].objectName, /^public\/[0-9a-f-]{36}$/);
  assert.match(calls.puts[1].objectName, /^public\/[0-9a-f-]{36}_thumb$/);
});

test("s3 storage reads the object and its thumbnail with a not_found fallback", async () => {
  const { client } = mockClient();
  const storage = createS3MediaStorage({ client, bucket: "pcx-media" });
  const saved = await storage.save(PNG, { visibility: "PRIVATE" });

  const full = await storage.read(saved.storageKey, { visibility: "PRIVATE" });
  assert.ok(Buffer.isBuffer(full) && full.length > 0);

  const thumb = await storage.readThumb(saved.storageKey, { visibility: "PRIVATE" });
  assert.ok(Buffer.isBuffer(thumb) && thumb.length > 0);

  await assert.rejects(storage.read("00000000-0000-4000-8000-000000000000", { visibility: "PUBLIC" }), (e) => e.code === "not_found");
});

test("s3 storage promote copies private -> public via server-side copy", async () => {
  const { client, calls } = mockClient();
  const storage = createS3MediaStorage({ client, bucket: "pcx-media" });
  const saved = await storage.save(PNG, { visibility: "PRIVATE" });

  await storage.promote(saved.storageKey);
  assert.equal(calls.copies.length, 2);
  assert.match(calls.copies[0].targetObject, /^public\/[0-9a-f-]{36}$/);
  assert.match(calls.copies[0].sourcePath, /^\/pcx-media\/private\/[0-9a-f-]{36}$/);
});

test("s3 env factory is gated by OBJECT_STORAGE_ENABLED", () => {
  const full = {
    OBJECT_STORAGE_ENDPOINT: "http://localhost:9000",
    OBJECT_STORAGE_BUCKET: "pcx-local",
    OBJECT_STORAGE_ACCESS_KEY: "pcx_local",
    OBJECT_STORAGE_SECRET_KEY: "change_me_local_only"
  };

  // No OBJECT_STORAGE_ENABLED → local fallback (null), even with the endpoint set.
  assert.equal(createS3MediaStorageFromEnv({}), null);
  assert.equal(createS3MediaStorageFromEnv({ ...full }), null);
  assert.equal(createS3MediaStorageFromEnv({ OBJECT_STORAGE_ENABLED: "false", ...full }), null);

  // OBJECT_STORAGE_ENABLED=true → MinIO storage.
  const storage = createS3MediaStorageFromEnv({ OBJECT_STORAGE_ENABLED: "true", ...full });
  assert.ok(storage);
  assert.equal(storage.path(), "s3://pcx-local");

  // enabled=true but missing bucket → loud config error.
  assert.throws(() => createS3MediaStorageFromEnv({
    OBJECT_STORAGE_ENABLED: "true",
    OBJECT_STORAGE_ENDPOINT: "http://localhost:9000"
  }), /are missing/);
});