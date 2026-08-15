import { Role, UserStatus } from "./constants.mjs";

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${name} is required`);
  return value.trim();
}

function optionalContact(value, name) {
  if (value == null || value === "") return null;
  const normalized = requiredString(value, name);
  return name === "email" ? normalized.toLowerCase() : normalized;
}

function isoTimestamp(value, name) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${name} must be a valid timestamp`);
  return date.toISOString();
}

export function createCustomerRegistrationCandidate({ id, email, phone, createdAt = new Date() }) {
  const normalizedEmail = optionalContact(email, "email");
  const normalizedPhone = optionalContact(phone, "phone");
  if (!normalizedEmail && !normalizedPhone) throw new TypeError("email or phone is required");

  const timestamp = isoTimestamp(createdAt, "createdAt");
  return Object.freeze({
    id: requiredString(id, "id"),
    email: normalizedEmail,
    phone: normalizedPhone,
    status: UserStatus.PENDING_VERIFICATION,
    roles: Object.freeze([Role.CUSTOMER]),
    contactVerified: false,
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

export function createOwnAddress(identity, {
  id,
  label,
  recipientName,
  phone,
  addressLine1,
  addressLine2,
  area,
  city,
  postalCode,
  isDefault = false,
  createdAt = new Date()
}) {
  const isActiveCustomer = identity?.status === UserStatus.ACTIVE
    && Array.isArray(identity.roles)
    && identity.roles.includes(Role.CUSTOMER);
  if (!isActiveCustomer) throw new TypeError("active customer identity is required");

  return Object.freeze({
    id: requiredString(id, "id"),
    userId: requiredString(identity.userId, "identity.userId"),
    label: requiredString(label, "label"),
    recipientName: requiredString(recipientName, "recipientName"),
    phone: requiredString(phone, "phone"),
    addressLine1: requiredString(addressLine1, "addressLine1"),
    addressLine2: optionalContact(addressLine2, "addressLine2"),
    area: requiredString(area, "area"),
    city: requiredString(city, "city"),
    postalCode: optionalContact(postalCode, "postalCode"),
    isDefault: isDefault === true,
    createdAt: isoTimestamp(createdAt, "createdAt")
  });
}
