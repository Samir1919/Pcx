import argon2 from "argon2";

export const passwordPolicy = Object.freeze({
  minimumCharacters: 12,
  maximumUtf8Bytes: 128,
  memoryCostKiB: 19456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32
});

export function assertPassword(password) {
  if (typeof password !== "string") throw new TypeError("password is required");
  if ([...password].length < passwordPolicy.minimumCharacters) throw new TypeError("password is too short");
  if (Buffer.byteLength(password, "utf8") > passwordPolicy.maximumUtf8Bytes) throw new TypeError("password is too long");
  return password;
}

export async function hashPassword(password) {
  assertPassword(password);
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: passwordPolicy.memoryCostKiB,
    timeCost: passwordPolicy.timeCost,
    parallelism: passwordPolicy.parallelism,
    hashLength: passwordPolicy.hashLength
  });
}

export async function verifyPassword(hash, password) {
  if (typeof hash !== "string" || typeof password !== "string") return false;
  try {
    return await argon2.verify(hash, password, { type: argon2.argon2id });
  } catch {
    return false;
  }
}

export function passwordNeedsRehash(hash) {
  if (typeof hash !== "string") return true;
  try {
    return argon2.needsRehash(hash, {
      type: argon2.argon2id,
      memoryCost: passwordPolicy.memoryCostKiB,
      timeCost: passwordPolicy.timeCost,
      parallelism: passwordPolicy.parallelism,
      hashLength: passwordPolicy.hashLength
    });
  } catch {
    return true;
  }
}
