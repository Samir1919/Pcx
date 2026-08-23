// International-standard contact normalization and validation.
//
// Server-owned rules only: normalizes the user-supplied contact into a stable,
// comparable form used for storage lookup, rate limiting, and delivery routing.
// The client never sets any authoritative contact form; these rules are the
// single source of truth for what is an acceptable email or phone.

const EMAIL_MAX = 254;
const EMAIL_LOCAL_MAX = 64;
// Deliberately strict, no whitespace, exactly one @, a dotted domain, and no
// dangerous characters that imply HTML/script or malformed input.
const EMAIL_PATTERN = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

function invalid(reason) { return { ok: false, reason }; }

export function normalizeEmail(value) {
  if (typeof value !== "string") return invalid("email must be a string");
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > EMAIL_MAX) return invalid("email length is invalid");
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return invalid("email contains control characters");
  if (trimmed.includes("<") || trimmed.includes(">") || trimmed.includes('"') || trimmed.includes("script")) return invalid("email is invalid");
  const normalized = trimmed.toLowerCase();
  if (!EMAIL_PATTERN.test(normalized)) return invalid("email is invalid");
  // Sanity: a single @ and a domain with a dot.
  const at = normalized.indexOf("@");
  if (at < 1 || at > EMAIL_LOCAL_MAX) return invalid("email local part is invalid");
  if (normalized.slice(at + 1).indexOf(".") < 1) return invalid("email domain is invalid");
  return { ok: true, value: normalized };
}

function digitsOnly(value) {
  return value.replace(/[^0-9]/g, "");
}

export function normalizePhone(value) {
  if (typeof value !== "string") return invalid("phone must be a string");
  const trimmed = value.trim();
  if (trimmed.length === 0) return invalid("phone is required");
  // Strip common separators and whitespace.
  let normalized = trimmed.replace(/[\s().-]/g, "");
  const digits = digitsOnly(normalized);
  if (digits.length === 0) return invalid("phone digits are required");

  let e164;
  if (normalized.startsWith("+")) {
    e164 = `+${digits}`;
  } else if (normalized.startsWith("00")) {
    e164 = `+${digits.slice(2)}`;
  } else if (normalized.startsWith("0") && digits.length >= 10 && digits.length <= 11) {
    // Bangladeshi national format (01XXXXXXXXX) → E.164 +880XXXXXXXXXX.
    e164 = `+880${digits.slice(1)}`;
  } else {
    // Bare digits assumed to already include a country code.
    e164 = `+${digits}`;
  }

  const countryDigits = e164.slice(1);
  if (!/^[1-9][0-9]{6,14}$/.test(countryDigits)) return invalid("phone number is invalid");
  return { ok: true, value: e164 };
}

// Classify a raw contact as EMAIL or SMS, returning the normalized value and the
// channel the delivery layer should use. Unknown/mixed input fails closed.
export function classifyContact(value) {
  if (typeof value !== "string") return invalid("contact must be a string");
  const trimmed = value.trim();
  if (trimmed.includes("@")) {
    const normalized = normalizeEmail(trimmed);
    if (!normalized.ok) return normalized;
    return { ok: true, channel: "EMAIL", value: normalized.value };
  }
  const normalized = normalizePhone(trimmed);
  if (!normalized.ok) return normalized;
  return { ok: true, channel: "SMS", value: normalized.value };
}
