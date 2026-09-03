// Sell-to-PCX entry points and full-system build components.
//
// sellEntry describes which of the four public entry flows the seller used:
// DESKTOP_PC / PC_PARTS / LAPTOP / LAPTOP_PARTS. buildComponents captures the
// explicit component selections for full-system builds (desktop or laptop).
// Each component is a seller declaration only; roles are server-validated and
// a role may appear at most once. Component selections never set price, grade,
// or health — those remain inspection-owned.

export const SellEntry = Object.freeze({
  DESKTOP_PC: "DESKTOP_PC",
  PC_PARTS: "PC_PARTS",
  LAPTOP: "LAPTOP",
  LAPTOP_PARTS: "LAPTOP_PARTS"
});

export const BuildComponentRole = Object.freeze({
  CPU: "cpu",
  GPU: "gpu",
  MOTHERBOARD: "motherboard",
  RAM: "ram",
  STORAGE: "storage",
  PSU: "psu",
  BATTERY: "battery",
  SCREEN: "screen",
  KEYBOARD: "keyboard",
  CHARGER: "charger"
});

const componentRoles = new Set(Object.values(BuildComponentRole));
// Sell entries are configured at runtime (admin Catalog -> Sell flow), so a
// sell request may reference any canonical UPPER_SNAKE_CASE entry key derived
// from a category slug — not only the four seed values. `SellEntry` above stays
// as the documented set of canonical seed keys.
const sellEntryPattern = /^[A-Z][A-Z0-9_]*$/;

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${name} is required`);
  return value.trim();
}

export function parseSellEntry(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !sellEntryPattern.test(value)) throw new TypeError("sellEntry is invalid");
  return value;
}

export function createBuildComponent({ role, productModelId }) {
  if (typeof role !== "string" || !componentRoles.has(role)) throw new TypeError("build component role is invalid");
  return Object.freeze({
    role,
    productModelId: requiredString(productModelId, "productModelId")
  });
}

export function validateBuildComponents(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value)) throw new TypeError("buildComponents must be an array");
  const roles = new Set();
  const components = value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new TypeError("buildComponents entries must be objects");
    const component = createBuildComponent({ role: entry.role, productModelId: entry.productModelId });
    if (roles.has(component.role)) throw new TypeError("build component roles must be unique");
    roles.add(component.role);
    return component;
  });
  return Object.freeze(components);
}
