import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

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

// Industry-standard upload policy:
//  - Input accepts large phone photos (up to 15 MiB) so sellers are never
//    rejected for a high-res original.
//  - On save the image is resized (longest edge 1600px) and re-encoded to WebP,
//    then guaranteed to fit within MAX_SAVED_BYTES (2 MiB).
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MiB per upload
const MAX_SAVED_BYTES = 2 * 1024 * 1024; // 2 MiB per saved image
const MAX_DIMENSION = 1600; // longest edge, industry standard
const THUMB_DIMENSION = 400; // grid thumbnail

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

// Resize the longest edge to MAX_DIMENSION and re-encode to WebP, lowering the
// quality stepwise until the result fits within MAX_SAVED_BYTES.
async function compressToWebP(buffer) {
  let quality = 82;
  while (quality >= 50) {
    const out = await sharp(buffer)
      .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
    if (out.length <= MAX_SAVED_BYTES) return out;
    quality -= 8;
  }
  return sharp(buffer)
    .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 50 })
    .toBuffer();
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

      let compressed;
      let thumbnail;
      try {
        compressed = await compressToWebP(buffer);
        thumbnail = await sharp(compressed)
          .resize(THUMB_DIMENSION, THUMB_DIMENSION, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 75 })
          .toBuffer();
      } catch {
        // A file with valid magic bytes but an undecodable body is corrupt.
        throw new MediaStorageError("invalid_input");
      }

      const key = randomUUID();
      const dir = path.join(root, visibility === "PRIVATE" ? "private" : "public");
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, key), compressed, { flag: "wx" });
      await writeFile(path.join(dir, `${key}_thumb`), thumbnail, { flag: "wx" });
      return { storageKey: key, mimeType: "image/webp", sizeBytes: compressed.length };
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

    async readThumb(storageKey, { visibility }) {
      const key = assertKey(storageKey);
      const dir = path.join(root, visibility === "PRIVATE" ? "private" : "public");
      try {
        return await readFile(path.join(dir, `${key}_thumb`));
      } catch {
        // Legacy uploads predate thumbnails; fall back to the full-size image.
        try {
          return await readFile(path.join(dir, key));
        } catch {
          throw new MediaStorageError("not_found");
        }
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
