import assert from "node:assert/strict";
import test from "node:test";
import {
  createCustomerRegistrationCandidate,
  createOwnAddress,
  Role,
  UserStatus
} from "../src/index.mjs";

test("customer registration normalizes contact and owns privileged defaults", () => {
  const record = createCustomerRegistrationCandidate({
    id: " user-1 ",
    email: " Buyer@Example.COM ",
    status: UserStatus.ACTIVE,
    roles: [Role.SUPER_ADMIN],
    contactVerified: true,
    createdAt: "2026-08-16T01:00:00.000Z"
  });

  assert.deepEqual(record, {
    id: "user-1",
    email: "buyer@example.com",
    phone: null,
    fullName: null,
    status: UserStatus.PENDING_VERIFICATION,
    roles: [Role.CUSTOMER],
    contactVerified: false,
    createdAt: "2026-08-16T01:00:00.000Z",
    updatedAt: "2026-08-16T01:00:00.000Z"
  });
  assert.equal(Object.isFrozen(record), true);
  assert.equal(Object.isFrozen(record.roles), true);
});

test("customer registration requires at least one contact and valid identity metadata", () => {
  assert.throws(() => createCustomerRegistrationCandidate({ id: "user-1" }), /email or phone/);
  assert.throws(() => createCustomerRegistrationCandidate({ id: "", email: "a@example.com" }), /id is required/);
  assert.throws(() => createCustomerRegistrationCandidate({ id: "user-1", phone: " ", createdAt: "invalid" }), /phone is required/);
});

test("active customers create immutable addresses owned by their authenticated identity", () => {
  const address = createOwnAddress(
    { userId: "customer-1", status: UserStatus.ACTIVE, roles: [Role.CUSTOMER] },
    {
      id: "address-1",
      userId: "attacker-selected-owner",
      label: "Home",
      recipientName: "PCX Buyer",
      phone: "+8801700000000",
      addressLine1: "Road 1",
      area: "Dhanmondi",
      city: "Dhaka",
      isDefault: true,
      createdAt: "2026-08-16T01:00:00.000Z"
    }
  );

  assert.equal(address.userId, "customer-1");
  assert.equal(address.addressLine2, null);
  assert.equal(address.postalCode, null);
  assert.equal(address.isDefault, true);
  assert.equal(Object.isFrozen(address), true);
});

test("address creation denies inactive and non-customer identities", () => {
  const input = {
    id: "address-1",
    label: "Home",
    recipientName: "Buyer",
    phone: "01700000000",
    addressLine1: "Road 1",
    area: "Dhanmondi",
    city: "Dhaka"
  };
  assert.throws(() => createOwnAddress({ userId: "user-1", status: UserStatus.SUSPENDED, roles: [Role.CUSTOMER] }, input), /active customer/);
  assert.throws(() => createOwnAddress({ userId: "user-1", status: UserStatus.ACTIVE, roles: [Role.ADMIN] }, input), /active customer/);
  assert.throws(() => createOwnAddress({ userId: "user-1", status: UserStatus.ACTIVE, roles: [Role.CUSTOMER] }, { ...input, city: "" }), /city is required/);
});
