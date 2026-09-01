import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "minio";
import { createS3MediaStorage } from "../../src/modules/media/s3-media-storage.mjs";

const endpoint = process.env.TEST_S3_ENDPOINT ?? "http://localhost:9000";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

test("s3 media storage round-trips through MinIO (save/read/thumb/promote)", async (t) => {
  const parsed = new URL(endpoint);
  const client = new Client({
    endPoint: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 9000,
    useSSL: parsed.protocol === "https:",
    accessKey: "pcx_local",
    secretKey: "change_me_local_only",
    pathStyle: true
  });
  const bucket = "pcx-media-integration-test";

  let reachable = false;
  try {
    await client.bucketExists(bucket);
    reachable = true;
  } catch {
    reachable = false;
  }
  if (!reachable) {
    t.skip("MinIO not reachable at " + endpoint);
    return;
  }

  const storage = createS3MediaStorage({ client, bucket });
  try {
    const saved = await storage.save(PNG, { visibility: "PRIVATE" });
    assert.match(saved.storageKey, /^[0-9a-f-]{36}$/);

    const full = await storage.read(saved.storageKey, { visibility: "PRIVATE" });
    assert.ok(Buffer.isBuffer(full) && full.length > 0);

    const thumb = await storage.readThumb(saved.storageKey, { visibility: "PRIVATE" });
    assert.ok(Buffer.isBuffer(thumb) && thumb.length > 0);

    await storage.promote(saved.storageKey);
    const promoted = await storage.read(saved.storageKey, { visibility: "PUBLIC" });
    assert.ok(Buffer.isBuffer(promoted) && promoted.length > 0);
  } finally {
    // Best-effort cleanup of the test bucket.
    try {
      const stream = client.listObjectsV2(bucket, "", true);
      for await (const obj of stream) await client.removeObject(bucket, obj.name);
      await client.removeBucket(bucket);
    } catch { /* cleanup best-effort */ }
  }
});