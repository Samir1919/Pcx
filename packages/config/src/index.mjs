// Shared build/lint/typecheck configuration for the PCX monorepo.
// Centralize cross-app settings here as they are deduplicated; the only
// currently-shared setting is the Node engine constraint mirrored from the
// workspace `engines` field.
export const sharedConfig = Object.freeze({
  node: ">=22 <23"
});
