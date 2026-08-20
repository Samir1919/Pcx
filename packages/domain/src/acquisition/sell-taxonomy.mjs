// Sell-to-PCX entry config and build-component role mapping validation.
//
// categories remain the single catalog source of truth. This module only
// validates the thin sell-flow config that sits on top of a category: which
// category is a public sell entry, how it is presented (icon/hint/sort/active),
// and — for BUILD entries — which component roles map to which component
// categories and whether each role is required.
//
// entryKey mirrors the canonical SellEntry enum and role mirrors
// BuildComponentRole; both are enforced here so unknown values can never enter
// the database or leak to clients.

import { BuildComponentRole, SellEntry } from "./sell-entry.mjs";

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

const entryKeys = new Set(Object.values(SellEntry));
const kinds = new Set(Object.values(SellEntryKind));
const icons = new Set(Object.values(SellEntryIcon));
const componentRoles = new Set(Object.values(BuildComponentRole));

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
  if (!entryKeys.has(key)) throw new TypeError("entryKey is invalid");
  return key;
}

export function parseSellEntryKind(value) {
  if (!kinds.has(value)) throw new TypeError("sell entry kind is invalid");
  return value;
}

export function parseSellEntryIcon(value) {
  const icon = requiredString(value, "iconKey");
  if (!icons.has(icon)) throw new TypeError("iconKey is invalid");
  return icon;
}

export function parseBuildComponentRole(value) {
  const role = requiredString(value, "role");
  if (!componentRoles.has(role)) throw new TypeError("build component role is invalid");
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

