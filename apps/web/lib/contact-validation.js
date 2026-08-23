// Client-side contact validation for the storefront. Mirrors the server rules in
// apps/api/src/modules/identity/contact-normalization.mjs so invalid input is
// blocked before submit; the server remains the authority.

const EMAIL_MAX = 254;
const EMAIL_LOCAL_MAX = 64;
const EMAIL_PATTERN = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

function invalid(reason) { return { ok: false, reason }; }

export function validateEmail(value) {
  if (typeof value !== "string") return invalid("email must be a string");
  const trimmed = value.trim();
  if (trimmed.length === 0) return invalid("Email is required.");
  if (trimmed.length > EMAIL_MAX) return invalid("Email is too long.");
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return invalid("Email contains invalid characters.");
  if (trimmed.includes("<") || trimmed.includes(">") || trimmed.includes('"') || trimmed.includes("script")) return invalid("Email is invalid.");
  const normalized = trimmed.toLowerCase();
  if (!EMAIL_PATTERN.test(normalized)) return invalid("Enter a valid email address.");
  const at = normalized.indexOf("@");
  if (at < 1 || at > EMAIL_LOCAL_MAX) return invalid("Email is invalid.");
  if (normalized.slice(at + 1).indexOf(".") < 1) return invalid("Email domain is invalid.");
  return { ok: true, value: normalized };
}

// A phone is valid when it has a country dial code and at least 6 digits after
// it, matching the server's E.164 country+national acceptance window.
export function validatePhone(value) {
  if (typeof value !== "string") return invalid("phone must be a string");
  const trimmed = value.trim();
  if (trimmed.length === 0) return invalid("Phone is required.");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return invalid("Enter a valid phone number.");
  return { ok: true, value: `+${digits}` };
}

export function validateContact(value) {
  if (typeof value !== "string") return invalid("Contact is required.");
  const trimmed = value.trim();
  if (trimmed.length === 0) return invalid("Email or phone is required.");
  if (trimmed.includes("@")) return validateEmail(trimmed);
  return validatePhone(trimmed);
}
