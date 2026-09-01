// Shared image processing for media storage adapters.
//
// Both the local-disk adapter and the S3/MinIO adapter must enforce the same
// upload policy and normalize every image to WebP (which also strips unsafe
// metadata and any polyglot payload). This module owns that single source of
// truth so a storage swap cannot accidentally loosen upload validation.
import sharp from "sharp";

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

export function detectImageMime(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.length >= 12 && buffer.slice(0, 4).toString("ascii") === "RIFF" && buffer.slice(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
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

// Validate + normalize an upload buffer. Returns the compressed full-size WebP
// and its grid thumbnail. Throws MediaStorageError on unsupported/corrupt input.
export async function prepareImage(buffer) {
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
  return { compressed, thumbnail };
}