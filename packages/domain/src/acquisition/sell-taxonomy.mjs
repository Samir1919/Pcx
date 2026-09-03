// Sell-to-PCX entry config and build-component role mapping validation.
//
// categories remain the single catalog source of truth. This module only
// validates the thin sell-flow config that sits on top of a category: which
// category is a public sell entry, how it is presented (icon/hint/sort/active),
// and — for BUILD entries — which component roles map to which component
// categories and whether each role is required.
//
// entry_key, role, and icon_key are canonical forms (UPPER_SNAKE_CASE for entry
// keys, lowercase slugs for roles/icons) enforced here so malformed values can
// never enter the database or leak to clients.



export const SellEntryKind = Object.freeze({
  BUILD: "BUILD",
  PARTS: "PARTS"
});

export const SellEntryIcon = Object.freeze({
  DESKTOP: "desktop",
  PARTS: "parts",
  LAPTOP: "laptop",
  LAPTOP_PARTS: "laptop-parts"
});

const kinds = new Set(Object.values(SellEntryKind));
// entry_key / sell_entry are canonical UPPER_SNAKE_CASE identifiers derived from
// a category slug; icon_key and build component role are canonical lowercase
// slugs. New categories (and their build roles) can therefore be introduced at
// runtime instead of a closed enum.
const entryKeyPattern = /^[A-Z][A-Z0-9_]*$/;
const iconPattern = /^[a-z][a-z0-9-]*$/;
const componentRolePattern = /^[a-z][a-z0-9-]*$/;

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${name} is required`);
  return value.trim();
}

function nonNegativeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`);
  return value;
}

function boolean(value, name) {
  if (typeof value !== "boolean") throw new TypeError(`${name} must be a boolean`);
  return value;
}

export function parseSellEntryKey(value) {
  const key = requiredString(value, "entryKey");
  if (!entryKeyPattern.test(key)) throw new TypeError("entryKey is invalid");
  return key;
}

// Derive the canonical entry key from a category slug (e.g. "desktop-pc" ->
// "DESKTOP_PC"). The server owns this derivation so a sell entry key is always
// a stable, predictable function of its source category.
export function sellEntryKeyFromSlug(slug) {
  const canonical = requiredString(slug, "slug");
  const key = canonical.replace(/-/g, "_").toUpperCase();
  if (!entryKeyPattern.test(key)) throw new TypeError("slug cannot derive a canonical entryKey");
  return key;
}

export function parseSellEntryKind(value) {
  if (!kinds.has(value)) throw new TypeError("sell entry kind is invalid");
  return value;
}

export function parseSellEntryIcon(value) {
  const icon = requiredString(value, "iconKey");
  if (!iconPattern.test(icon)) throw new TypeError("iconKey is invalid");
  return icon;
}

export function parseBuildComponentRole(value) {
  const role = requiredString(value, "role");
  if (!componentRolePattern.test(role)) throw new TypeError("build component role is invalid");
  return role;
}

export function createSellEntryConfig({ id, entryKey, categoryId, kind, iconKey, hint, sortOrder = 0, isActive = true, createdAt = new Date() }) {
  return Object.freeze({
    id: requiredString(id, "id"),
    entryKey: parseSellEntryKey(entryKey),
    categoryId: requiredString(categoryId, "categoryId"),
    kind: parseSellEntryKind(kind),
    iconKey: parseSellEntryIcon(iconKey),
    hint: requiredString(hint, "hint"),
    sortOrder: nonNegativeInteger(sortOrder, "sortOrder"),
    isActive: boolean(isActive, "isActive"),
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : requiredString(createdAt, "createdAt"),
    updatedAt: createdAt instanceof Date ? createdAt.toISOString() : requiredString(createdAt, "createdAt")
  });
}

export function createSellBuildComponent({ id, entryKey, role, categoryId, required = false, sortOrder = 0, createdAt = new Date() }) {
  const now = createdAt instanceof Date ? createdAt.toISOString() : requiredString(createdAt, "createdAt");
  return Object.freeze({
    id: requiredString(id, "id"),
    entryKey: parseSellEntryKey(entryKey),
    role: parseBuildComponentRole(role),
    categoryId: requiredString(categoryId, "categoryId"),
    required: boolean(required, "required"),
    sortOrder: nonNegativeInteger(sortOrder, "sortOrder"),
    createdAt: now,
    updatedAt: now
  });
}

