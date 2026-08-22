import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";

// Media lives on local disk (or a later TrueNAS NFS mount pointed at by
// MEDIA_ROOT). Only the server generates storage keys; client filenames and
// paths are never trusted. This module is the single place that owns the
// media root so a future storage change only needs a new env value.
export const DEFAULT_MEDIA_ROOT = path.resolve(process.cwd(), "apps/api/uploads");

// Allow-listed image MIME types (spec §9). No executable/HTML/SVG content.
export const ALLOWED_MIME_TYPES = Object.freeze(new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]));

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MiB per image

export class MediaStorageError extends Error {
  constructor(code) { super(code); this.name = "MediaStorageError"; this.code = code; }
}

function assertKey(storageKey) {
  // Server-generated keys are UUID-shaped and separated by a single directory
  // level; anything path-like is rejected outright.
  if (typeof storageKey !== "string" || !/^[0-9a-f-]{36}$/.test(storageKey)) {
    throw new MediaStorageError("invalid_key");
  }
  return storageKey;
}

export function createLocalMediaStorage({ root = DEFAULT_MEDIA_ROOT } = {}) {
  if (typeof root !== "string" || root.trim().length === 0) throw new TypeError("media root is required");

  return Object.freeze({
    async save(buffer, { visibility }) {
      if (!Buffer.isBuffer(buffer)) throw new MediaStorageError("invalid_input");
      if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) throw new MediaStorageError("invalid_input");
      // Detect MIME from magic bytes: JPEG, PNG, WebP signatures.
      const mimeType = detectImageMime(buffer);
      if (!ALLOWED_MIME_TYPES.has(mimeType)) throw new MediaStorageError("unsupported_type");
      const key = randomUUID();
      const dir = path.join(root, visibility === "PRIVATE" ? "private" : "public");
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, key), buffer, { flag: "wx" });
      return { storageKey: key, mimeType, sizeBytes: buffer.length };
    },

    async read(storageKey, { visibility }) {
      const key = assertKey(storageKey);
      const dir = path.join(root, visibility === "PRIVATE" ? "private" : "public");
      try {
        return await readFile(path.join(dir, key));
      } catch {
        throw new MediaStorageError("not_found");
      }
    },

    path() {
      return root;
    }
  });
}

function detectImageMime(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.length >= 12 && buffer.slice(0, 4).toString("ascii") === "RIFF" && buffer.slice(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}
