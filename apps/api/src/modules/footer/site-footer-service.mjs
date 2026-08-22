import { randomUUID } from "node:crypto";
import { hasPermission, Permission } from "@pcx/domain";

export class SiteFooterError extends Error {
  constructor(code) { super(code); this.name = "SiteFooterError"; this.code = code; }
}

const socialPlatforms = new Set(["facebook", "instagram", "youtube", "linkedin", "x", "whatsapp"]);

const limits = Object.freeze({
  tagline: 240,
  copyright: 240,
  email: 200,
  phone: 40,
  address: 500,
  tradeLicense: 120,
  bin: 120,
  platform: 40,
  href: 600,
  title: 80,
  label: 80
});

const maxSocialLinks = 12;
const maxLinkColumns = 6;
const maxLinksPerColumn = 40;

function cleanString(value, max, { allowEmpty = true } = {}) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new SiteFooterError("invalid_input");
  const trimmed = value.trim();
  if (!allowEmpty && trimmed.length === 0) throw new SiteFooterError("invalid_input");
  if (trimmed.length > max) throw new SiteFooterError("invalid_input");
  return trimmed;
}

function absoluteHttpUrl(value) {
  if (typeof value !== "string") throw new SiteFooterError("invalid_input");
  let url;
  try { url = new URL(value); } catch { throw new SiteFooterError("invalid_input"); }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new SiteFooterError("invalid_input");
  if (value.length > limits.href) throw new SiteFooterError("invalid_input");
  return url.href;
}

function rootRelativeHref(value) {
  const href = cleanString(value, limits.href, { allowEmpty: false });
  if (!href.startsWith("/") || href.includes("//")) throw new SiteFooterError("invalid_input");
  return href;
}

function normalizeSocialLinks(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > maxSocialLinks) throw new SiteFooterError("invalid_input");
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new SiteFooterError("invalid_input");
    const platform = cleanString(item.platform, limits.platform, { allowEmpty: false });
    if (!socialPlatforms.has(platform)) throw new SiteFooterError("invalid_input");
    const href = absoluteHttpUrl(item.href);
    return Object.freeze({ platform, href });
  });
}

function normalizeLinkColumns(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > maxLinkColumns) throw new SiteFooterError("invalid_input");
  return value.map((column) => {
    if (!column || typeof column !== "object" || Array.isArray(column)) throw new SiteFooterError("invalid_input");
    const title = cleanString(column.title, limits.title, { allowEmpty: false });
    const rawLinks = (column.links === undefined || column.links === null) ? [] : column.links;
    if (!Array.isArray(rawLinks) || rawLinks.length > maxLinksPerColumn) throw new SiteFooterError("invalid_input");
    const links = rawLinks.map((link) => {
      if (!link || typeof link !== "object" || Array.isArray(link)) throw new SiteFooterError("invalid_input");
      return Object.freeze({ label: cleanString(link.label, limits.label, { allowEmpty: false }), href: rootRelativeHref(link.href) });
    });
    return Object.freeze({ title, links });
  });
}

const allowedFields = new Set(["tagline", "copyright", "contactEmail", "contactPhone", "address", "tradeLicense", "bin", "socialLinks", "linkColumns"]);

function normalizeFooter(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new SiteFooterError("invalid_input");
  for (const key of Object.keys(input)) if (!allowedFields.has(key)) throw new SiteFooterError("invalid_input");
  return Object.freeze({
    tagline: cleanString(input.tagline, limits.tagline),
    copyright: cleanString(input.copyright, limits.copyright),
    contactEmail: cleanString(input.contactEmail, limits.email),
    contactPhone: cleanString(input.contactPhone, limits.phone),
    address: cleanString(input.address, limits.address),
    tradeLicense: cleanString(input.tradeLicense, limits.tradeLicense),
    bin: cleanString(input.bin, limits.bin),
    socialLinks: normalizeSocialLinks(input.socialLinks),
    linkColumns: normalizeLinkColumns(input.linkColumns)
  });
}

export function createSiteFooterService({ authService, repository, id = randomUUID, clock = () => new Date() }) {
  if (!authService || typeof authService.authenticateAccess !== "function") throw new TypeError("authService.authenticateAccess is required");
  if (!repository || typeof repository.get !== "function" || typeof repository.getActive !== "function" || typeof repository.save !== "function") throw new TypeError("site footer repository is required");

  async function actor(accessCredential) {
    const identity = await authService.authenticateAccess({ accessCredential });
    if (!hasPermission(identity, Permission.SYSTEM_CONFIGURE)) throw new SiteFooterError("forbidden");
    return identity;
  }

  function event(identity, requestId, changes, occurredAt) {
    return { id: id(), actorId: identity.userId, action: "SITE_FOOTER_UPDATED", targetType: "SITE_FOOTER", targetId: "footer", requestId: requestId ?? "unavailable", changes, occurredAt };
  }

  return Object.freeze({
    // Public read-only: active footer content for the storefront. Never
    // exposes ids or internal lifecycle fields.
    async publicFooter() {
      return Object.freeze({ data: Object.freeze(await repository.getActive()) });
    },

    // Admin read: full record including active flag and updated timestamp.
    async adminFooter(accessCredential) {
      await actor(accessCredential);
      return Object.freeze({ data: Object.freeze(await repository.get()) });
    },

    async save(accessCredential, input, context = {}) {
      const identity = await actor(accessCredential);
      const footer = normalizeFooter(input);
      const now = clock().toISOString();
      const saved = await repository.save(footer, now, event(identity, context.requestId, { ...footer }, now));
      return Object.freeze({ data: Object.freeze(saved) });
    }
  });
}
