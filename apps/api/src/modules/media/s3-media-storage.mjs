// S3/MinIO object-storage media adapter (E19).
//
// Drop-in replacement for `local-media-storage.mjs` behind the same
// `save/read/readThumb/promote` interface, so the media service and HTTP layers
// are unchanged. Activate by setting the `OBJECT_STORAGE_*` environment
// variables (see `.env.example`); when `OBJECT_STORAGE_ENDPOINT` is absent the
// runtime falls back to local disk storage.
import { randomUUID } from "node:crypto";
import { Client } from "minio";
import { prepareImage, MediaStorageError } from "./image-processing.mjs";

function assertKey(storageKey) {
  if (typeof storageKey !== "string" || !/^[0-9a-f-]{36}$/.test(storageKey)) {
    throw new MediaStorageError("invalid_key");
  }
  return storageKey;
}

function objectName(visibility, key, thumb = false) {
  const prefix = visibility === "PRIVATE" ? "private" : "public";
  return `${prefix}/${key}${thumb ? "_thumb" : ""}`;
}

async function collect(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export function createS3MediaStorage({ client, bucket }) {
  if (!client || typeof client.putObject !== "function" || typeof client.getObject !== "function") throw new TypeError("S3 client is required");
  if (typeof bucket !== "string" || bucket.trim().length === 0) throw new TypeError("bucket is required");

  // Bucket creation is idempotent and memoized: the first save (or promote)
  // ensures the bucket exists, then subsequent calls reuse the settled promise.
  let ensurePromise = null;
  function ensureBucket() {
    if (!ensurePromise) {
      ensurePromise = (async () => {
        const exists = await client.bucketExists(bucket);
        if (!exists) await client.makeBucket(bucket, "us-east-1");
      })();
    }
    return ensurePromise;
  }

  return Object.freeze({
    async save(buffer, { visibility }) {
      const { compressed, thumbnail } = await prepareImage(buffer);
      const key = randomUUID();
      await ensureBucket();
      await client.putObject(bucket, objectName(visibility, key), compressed, compressed.length, { "content-type": "image/webp" });
      await client.putObject(bucket, objectName(visibility, key, true), thumbnail, thumbnail.length, { "content-type": "image/webp" });
      return { storageKey: key, mimeType: "image/webp", sizeBytes: compressed.length };
    },

    async read(storageKey, { visibility }) {
      const key = assertKey(storageKey);
      try {
        return await collect(await client.getObject(bucket, objectName(visibility, key)));
      } catch {
        throw new MediaStorageError("not_found");
      }
    },

    async readThumb(storageKey, { visibility }) {
      const key = assertKey(storageKey);
      try {
        return await collect(await client.getObject(bucket, objectName(visibility, key, true)));
      } catch {
        // Legacy uploads predate thumbnails; fall back to the full-size image.
        try {
          return await collect(await client.getObject(bucket, objectName(visibility, key)));
        } catch {
          throw new MediaStorageError("not_found");
        }
      }
    },

    // Promote a private object (and thumbnail) into the public prefix via a
    // server-side copy — no data re-upload and no change to the storage key, so
    // the DB unique(storage_key) constraint is never violated.
    async promote(storageKey) {
      const key = assertKey(storageKey);
      await ensureBucket();
      const missing = (error) => error?.code === "NoSuchKey" || error?.code === "NotFound";
      try {
        await client.copyObject(bucket, objectName("PUBLIC", key), `/${bucket}/${objectName("PRIVATE", key)}`);
      } catch (error) {
        if (!missing(error)) throw error;
      }
      try {
        await client.copyObject(bucket, objectName("PUBLIC", key, true), `/${bucket}/${objectName("PRIVATE", key, true)}`);
      } catch (error) {
        if (!missing(error)) throw error; // legacy uploads may lack a thumbnail
      }
    },

    path() {
      return `s3://${bucket}`;
    }
  });
}

function parseBool(value) {
  if (value == null) return false;
  return ["true", "1", "yes", "on"].includes(String(value).trim().toLowerCase());
}

// Build the S3 storage from the `OBJECT_STORAGE_*` environment variables.
// `OBJECT_STORAGE_ENABLED=true` selects MinIO; anything else (false/unset/empty)
// returns null so the caller falls back to local disk.
export function createS3MediaStorageFromEnv(env = process.env) {
  if (!parseBool(env.OBJECT_STORAGE_ENABLED)) return null;
  const endpoint = env.OBJECT_STORAGE_ENDPOINT;
  const bucket = env.OBJECT_STORAGE_BUCKET;
  const accessKey = env.OBJECT_STORAGE_ACCESS_KEY;
  const secretKey = env.OBJECT_STORAGE_SECRET_KEY;
  if (!endpoint || !bucket || !accessKey || !secretKey) {
    throw new TypeError("OBJECT_STORAGE_ENABLED is set but OBJECT_STORAGE_ENDPOINT/BUCKET/ACCESS_KEY/SECRET_KEY are missing");
  }
  const parsed = new URL(endpoint);
  const useSSL = parsed.protocol === "https:";
  const port = parsed.port ? Number(parsed.port) : (useSSL ? 443 : 80);
  const client = new Client({
    endPoint: parsed.hostname,
    port,
    useSSL,
    accessKey,
    secretKey,
    region: env.OBJECT_STORAGE_REGION ?? "us-east-1",
    pathStyle: true
  });
  return createS3MediaStorage({ client, bucket });
}