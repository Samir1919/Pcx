import { randomUUID } from "node:crypto";
import { generateOpaqueCredential, hashOpaqueCredential } from "./credentials.mjs";
import { assertPassword, hashPassword } from "./password.mjs";
import { normalizeEmail, normalizePhone } from "./contact-normalization.mjs";

export class IdentityActionError extends Error {
  constructor(code) { super(code); this.name = "IdentityActionError"; this.code = code; }
}

const lifetimes = Object.freeze({ CONTACT_VERIFICATION: 24 * 60 * 60 * 1000, PASSWORD_RESET: 60 * 60 * 1000 });

export function createIdentityActionService({ identityRepository, actionRepository, delivery, abuseControl, audit, contactVerifier, clock = () => new Date(), id = randomUUID, credential = generateOpaqueCredential, passwords = { assert: assertPassword, hash: hashPassword } }) {
  for (const [object, method, name] of [[identityRepository, "findPasswordIdentityByContact", "identityRepository"], [identityRepository, "activateByContact", "identityRepository"], [actionRepository, "issue", "actionRepository"], [actionRepository, "verifyContact", "actionRepository"], [actionRepository, "resetPassword", "actionRepository"], [delivery, "send", "delivery"], [abuseControl, "check", "abuseControl"], [audit, "record", "audit"]]) {
    if (!object || typeof object[method] !== "function") throw new TypeError(`${name}.${method} is required`);
  }

  async function controlled(action, context, contact = null) {
    const result = await abuseControl.check({ action, ipHash: context?.ipHash ?? null, requestId: context?.requestId ?? "unavailable", contact });
    if (result?.allowed !== true) {
      await audit.record({ action, outcome: "rate_limited", subjectId: null, requestId: context?.requestId ?? "unavailable", occurredAt: clock().toISOString() });
      throw new IdentityActionError("rate_limited");
    }
  }

  async function record(action, outcome, context, subjectId = null) {
    await audit.record({ action, outcome, subjectId, requestId: context?.requestId ?? "unavailable", occurredAt: clock().toISOString() });
  }

  async function request(purpose, contact, context) {
    const action = purpose === "CONTACT_VERIFICATION" ? "verify_contact_request" : "password_reset_request";
    let normalizedContact = null;
    if (typeof contact === "string" && contact.trim()) {
      const email = normalizeEmail(contact);
      const phone = (!email.ok) ? normalizePhone(contact) : { ok: false };
      normalizedContact = email.ok ? email.value : (phone.ok ? phone.value : null);
    }
    await controlled(action, context, normalizedContact);
    const identity = typeof contact === "string" && contact.trim() ? await identityRepository.findPasswordIdentityByContact(contact.trim()) : null;
    const eligible = purpose === "CONTACT_VERIFICATION" ? identity?.status === "PENDING_VERIFICATION" : identity?.status === "ACTIVE";
    if (eligible) {
      const raw = credential();
      const now = clock();
      const expiresAt = new Date(now.getTime() + lifetimes[purpose]).toISOString();
      await actionRepository.issue({ id: id(), userId: identity.id, purpose, credentialHash: hashOpaqueCredential(raw), expiresAt, createdAt: now.toISOString() });
      await delivery.send({ purpose, contact: identity.email ?? identity.phone, credential: raw, expiresAt });
    }
    await record(action, "accepted", context, identity?.id ?? null);
    return Object.freeze({ status: "accepted" });
  }

  return Object.freeze({
    requestContactVerification({ contact }, context = {}) { return request("CONTACT_VERIFICATION", contact, context); },
    requestPasswordReset({ contact }, context = {}) { return request("PASSWORD_RESET", contact, context); },
    async verifyContact({ credential: raw }, context = {}) {
      await controlled("verify_contact", context);
      if (typeof raw !== "string" || !raw) throw new IdentityActionError("invalid_token");
      const result = await actionRepository.verifyContact({ credentialHash: hashOpaqueCredential(raw), now: clock().toISOString() });
      await record("verify_contact", result.status, context, result.userId ?? null);
      if (result.status !== "verified") throw new IdentityActionError("invalid_token");
      return Object.freeze({ status: "verified" });
    },

    // Development-only demo-code verification: verifies the supplied code
    // against the injected verifier and activates the PENDING_VERIFICATION
    // account directly. Production omits `contactVerifier`, so this fails
    // closed with invalid_token until a real delivery provider is wired.
    async verifyContactByCode({ contact, credential: raw }, context = {}) {
      await controlled("verify_contact", context);
      if (typeof contact !== "string" || !contact.trim()) throw new IdentityActionError("invalid_token");
      if (!contactVerifier || typeof contactVerifier.verify !== "function") throw new IdentityActionError("invalid_token");
      const result = contactVerifier.verify({ credential: raw });
      if (result?.verified !== true) {
        await record("verify_contact", "denied", context);
        throw new IdentityActionError("invalid_token");
      }
      const userId = await identityRepository.activateByContact(contact.trim(), clock().toISOString());
      if (!userId) {
        await record("verify_contact", "invalid_state", context);
        throw new IdentityActionError("invalid_token");
      }
      await record("verify_contact", "verified", context, userId);
      return Object.freeze({ status: "verified" });
    },
    async resetPassword({ credential: raw, password }, context = {}) {
      await controlled("password_reset", context);
      if (typeof raw !== "string" || !raw) throw new IdentityActionError("invalid_token");
      passwords.assert(password);
      const result = await actionRepository.resetPassword({ credentialHash: hashOpaqueCredential(raw), passwordHash: await passwords.hash(password), now: clock().toISOString() });
      await record("password_reset", result.status, context, result.userId ?? null);
      if (result.status !== "reset") throw new IdentityActionError("invalid_token");
      return Object.freeze({ status: "reset" });
    }
  });
}
