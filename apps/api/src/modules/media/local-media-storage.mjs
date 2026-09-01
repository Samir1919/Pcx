import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, copyFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { prepareImage, MediaStorageError, MAX_UPLOAD_BYTES, ALLOWED_MIME_TYPES } from "./image-processing.mjs";

// Media lives on local disk (or a later TrueNAS NFS mount pointed at by
// MEDIA_ROOT). Only the server generates storage keys; client filenames and
// paths are never trusted. This module is the single place that owns the
// media root so a future storage change only needs a new env value.
export const DEFAULT_MEDIA_ROOT = path.resolve(process.cwd(), "apps/api/uploads");

// Re-export shared upload policy/errors for existing importers.
export { MediaStorageError, MAX_UPLOAD_BYTES, ALLOWED_MIME_TYPES };

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
      const { compressed, thumbnail } = await prepareImage(buffer);

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

    // Move a private image (and its thumbnail) into the public directory so a
    // promoted listing photo is served without the private access gate. The
    // storage key is unchanged; only the directory + media visibility flip, so
    // the DB unique(storage_key) constraint is never violated.
    async promote(storageKey) {
      const key = assertKey(storageKey);
      const publicDir = path.join(root, "public");
      const privateDir = path.join(root, "private");
      await mkdir(publicDir, { recursive: true });
      try {
        await copyFile(path.join(privateDir, key), path.join(publicDir, key), constants.COPYFILE_EXCL);
      } catch (error) {
        if (error?.code !== "EEXIST") throw error; // already promoted
      }
      try {
        await copyFile(path.join(privateDir, `${key}_thumb`), path.join(publicDir, `${key}_thumb`), constants.COPYFILE_EXCL);
      } catch (error) {
        if (error?.code !== "EEXIST" && error?.code !== "ENOENT") throw error; // legacy uploads may lack a thumbnail
      }
    },

    path() {
      return root;
    }
  });
}
