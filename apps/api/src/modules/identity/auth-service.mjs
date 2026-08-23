import { randomUUID } from "node:crypto";
import { createCustomerRegistrationCandidate } from "@pcx/domain";
import { generateOpaqueCredential, hashOpaqueCredential, sessionExpiries } from "./credentials.mjs";
import { assertPassword, hashPassword, verifyPassword } from "./password.mjs";
import { requiresPrivilegedMfa, safeMfaChallenge, safeMfaUserId } from "./privileged-mfa.mjs";
import { normalizeEmail, normalizePhone } from "./contact-normalization.mjs";

const dummyPasswordHash = "$argon2id$v=19$m=19456,p=1,t=2$O2/E313oRvHGzD2bSIIZVw$bR3lzbWFjtRahsze5LJ/mLBbUrEPNerDV6PiojyYe6A";

// Trusted-device window size (ADR 0010). Mirrors the 30-day refresh lifetime.
const trustedDeviceLifetimeMs = 30 * 24 * 60 * 60 * 1000;

export class AuthenticationError extends Error {
  constructor(code) {
    super(code);
    this.name = "AuthenticationError";
    this.code = code;
  }
}

function requiredDependency(value, method, name) {
  if (!value || typeof value[method] !== "function") throw new TypeError(`${name}.${method} is required`);
}

function safeContext(context = {}) {
  return Object.freeze({ requestId: context.requestId ?? "unavailable", ipHash: context.ipHash ?? null, userAgent: context.userAgent ?? null });
}

export function createAuthService({
  repository,
  abuseControl,
  audit,
  clock = () => new Date(),
  id = randomUUID,
  credential = generateOpaqueCredential,
  passwords = { assert: assertPassword, hash: hashPassword, verify: verifyPassword },
  mfa
}) {
  for (const method of ["createCustomer", "findPasswordIdentityByContact", "createSession", "rotateRefresh", "revokeFamilyByRefreshHash"]) {
    requiredDependency(repository, method, "repository");
  }
  requiredDependency(abuseControl, "check", "abuseControl");
  requiredDependency(audit, "record", "audit");
  // Alias the credential generator so `verifyMfa` can issue device credentials
  // without colliding with its `credential` parameter (the MFA one-time code).
  const generateDeviceCredential = credential;

  async function control(action, context, contact = null) {
    const outcome = await abuseControl.check({ action, ...safeContext(context), contact });
    if (outcome?.allowed !== true) {
      await audit.record({ action, outcome: "rate_limited", subjectId: null, requestId: safeContext(context).requestId, occurredAt: clock().toISOString() });
      throw new AuthenticationError("rate_limited");
    }
  }

  async function record(action, outcome, context, subjectId = null) {
    await audit.record({ action, outcome, subjectId, requestId: safeContext(context).requestId, occurredAt: clock().toISOString() });
  }

  async function issueSession(userId, context) {
    const now = clock();
    const accessCredential = credential();
    const refreshCredential = credential();
    const expiries = sessionExpiries(now);
    await repository.createSession({
      userId,
      familyId: id(),
      refreshId: id(),
      refreshHash: hashOpaqueCredential(refreshCredential),
      refreshExpiresAt: expiries.refreshExpiresAt,
      accessId: id(),
      accessHash: hashOpaqueCredential(accessCredential),
      accessExpiresAt: expiries.accessExpiresAt,
      createdAt: now.toISOString(),
      ipHash: context?.ipHash ?? null,
      userAgent: context?.userAgent ?? null
    });
    return Object.freeze({ accessCredential, refreshCredential, ...expiries });
  }

  return Object.freeze({
    async authenticateAccess({ accessCredential }) {
      if (typeof accessCredential !== "string" || accessCredential.length === 0) throw new AuthenticationError("invalid_access");
      const identity = await repository.findActiveIdentityByAccessHash(hashOpaqueCredential(accessCredential), clock().toISOString());
      if (!identity) throw new AuthenticationError("invalid_access");
      return Object.freeze({
        userId: identity.userId,
        email: identity.email ?? null,
        phone: identity.phone ?? null,
        fullName: identity.fullName ?? null,
        status: identity.status,
        contactVerified: identity.contactVerified === true,
        roles: Object.freeze([...(identity.roles ?? [])])
      });
    },

    async register({ email, phone, fullName, password }, context = {}) {
      let normalizedContact = null;
      if (email != null) {
        const normalized = normalizeEmail(email);
        if (!normalized.ok) throw new TypeError("email is invalid");
        email = normalized.value;
        normalizedContact = email;
      }
      if (phone != null) {
        const normalized = normalizePhone(phone);
        if (!normalized.ok) throw new TypeError("phone is invalid");
        phone = normalized.value;
        normalizedContact = normalizedContact ?? phone;
      }
      await control("register", context, normalizedContact);
      passwords.assert(password);
      const now = clock();
      const candidate = createCustomerRegistrationCandidate({ id: id(), email, phone, fullName, createdAt: now });
      try {
        const customer = await repository.createCustomer({ ...candidate, passwordHash: await passwords.hash(password) });
        await record("register", "succeeded", context, customer.id);
        return Object.freeze({ status: "registered", customer: Object.freeze({ id: customer.id, status: customer.status, contactVerified: customer.contact_verified ?? customer.contactVerified }) });
      } catch (error) {
        const duplicate = error?.code === "23505";
        await record("register", duplicate ? "conflict" : "failed", context);
        if (duplicate) throw new AuthenticationError("contact_unavailable");
        throw error;
      }
    },

    async login({ contact, password }, context = {}, { trustedDeviceCredential = null } = {}) {
      let normalizedContact = null;
      if (typeof contact === "string" && contact.trim().length > 0) {
        const email = normalizeEmail(contact);
        const phone = (!email.ok) ? normalizePhone(contact) : { ok: false };
        normalizedContact = email.ok ? email.value : (phone.ok ? phone.value : null);
      }
      await control("login", context, normalizedContact);
      if (typeof contact !== "string" || contact.trim().length === 0 || typeof password !== "string") {
        await record("login", "denied", context);
        throw new AuthenticationError("invalid_credentials");
      }
      const identity = await repository.findPasswordIdentityByContact(contact.trim());
      const valid = await passwords.verify(identity?.password_hash ?? dummyPasswordHash, password);
      if (!valid || identity?.status !== "ACTIVE") {
        await record("login", "denied", context, identity?.id ?? null);
        throw new AuthenticationError("invalid_credentials");
      }
      if (requiresPrivilegedMfa(identity.roles)) {
        const trustedUserId = typeof trustedDeviceCredential === "string" && typeof repository.findActiveTrustedDeviceUserId === "function"
          ? await repository.findActiveTrustedDeviceUserId(hashOpaqueCredential(trustedDeviceCredential), clock().toISOString())
          : null;
        if (trustedUserId === identity.id) {
          const session = await issueSession(identity.id, context);
          await record("login", "succeeded", context, identity.id);
          return Object.freeze({ status: "authenticated", identity: Object.freeze({ userId: identity.id, email: identity.email ?? null, phone: identity.phone ?? null, fullName: identity.fullName ?? null, roles: Object.freeze([...(identity.roles ?? [])]) }), session });
        }
        if (!mfa || typeof mfa.beginChallenge !== "function") {
          await record("login", "mfa_unavailable", context, identity.id);
          throw new AuthenticationError("mfa_unavailable");
        }
        let challenge;
        try {
          challenge = safeMfaChallenge(await mfa.beginChallenge({ userId: identity.id, requestId: safeContext(context).requestId }));
        } catch {
          // Provider MFA fails closed: no contact channel or no active EMAIL/SMS
          // provider means the challenge could not be delivered, which is
          // surfaced as mfa_unavailable rather than a server error.
          await record("login", "mfa_unavailable", context, identity.id);
          throw new AuthenticationError("mfa_unavailable");
        }
        await record("login", "mfa_required", context, identity.id);
        return Object.freeze({ status: "mfa_required", challenge });
      }
      const session = await issueSession(identity.id, context);
      await record("login", "succeeded", context, identity.id);
      return Object.freeze({ status: "authenticated", identity: Object.freeze({ userId: identity.id, email: identity.email ?? null, phone: identity.phone ?? null, fullName: identity.fullName ?? null, roles: Object.freeze([...(identity.roles ?? [])]) }), session });
    },

    async verifyMfa({ challengeId, credential, rememberDevice = false }, context = {}) {
      await control("mfa_verify", context);
      if (typeof challengeId !== "string" || challengeId.length === 0 || typeof credential !== "string" || credential.length === 0) {
        await record("mfa_verify", "denied", context);
        throw new AuthenticationError("invalid_mfa");
      }
      if (!mfa || typeof mfa.verifyChallenge !== "function") {
        await record("mfa_verify", "denied", context);
        throw new AuthenticationError("invalid_mfa");
      }
      let verification;
      try {
        verification = await mfa.verifyChallenge({ challengeId, credential, requestId: safeContext(context).requestId });
      } catch {
        verification = null;
      }
      if (verification?.status !== "verified" || typeof verification.userId !== "string" || verification.userId.length === 0) {
        await record("mfa_verify", "denied", context);
        throw new AuthenticationError("invalid_mfa");
      }
      const userId = safeMfaUserId(verification.userId);
      const session = await issueSession(userId, context);
      let device = null;
      if (rememberDevice === true && typeof repository.issueTrustedDevice === "function") {
        const raw = generateDeviceCredential();
        const now = clock();
        const expiresAt = new Date(now.getTime() + trustedDeviceLifetimeMs).toISOString();
        await repository.issueTrustedDevice({ id: id(), userId, credentialHash: hashOpaqueCredential(raw), expiresAt, createdAt: now.toISOString() });
        device = Object.freeze({ credential: raw, expiresAt });
      }
      await record("mfa_verify", "succeeded", context, userId);
      return Object.freeze({ status: "authenticated", identity: Object.freeze({ userId }), session, device });
    },

    async refresh({ refreshCredential }, context = {}) {
      await control("refresh", context);
      if (typeof refreshCredential !== "string" || refreshCredential.length === 0) {
        await record("refresh", "denied", context);
        throw new AuthenticationError("invalid_refresh");
      }
      const now = clock();
      const nextAccess = credential();
      const nextRefresh = credential();
      const expiries = sessionExpiries(now);
      const result = await repository.rotateRefresh({
        presentedHash: hashOpaqueCredential(refreshCredential),
        newRefreshId: id(), newRefreshHash: hashOpaqueCredential(nextRefresh), newRefreshExpiresAt: expiries.refreshExpiresAt,
        newAccessId: id(), newAccessHash: hashOpaqueCredential(nextAccess), newAccessExpiresAt: expiries.accessExpiresAt,
        now: now.toISOString(), ipHash: context?.ipHash ?? null, userAgent: context?.userAgent ?? null
      });
      if (result.status !== "rotated") {
        await record("refresh", result.status, context);
        throw new AuthenticationError("invalid_refresh");
      }
      await record("refresh", "succeeded", context, result.userId);
      return Object.freeze({ status: "refreshed", session: Object.freeze({ accessCredential: nextAccess, refreshCredential: nextRefresh, ...expiries }) });
    },

    async logout({ refreshCredential }, context = {}) {
      await control("logout", context);
      if (typeof refreshCredential === "string" && refreshCredential.length > 0) {
        await repository.revokeFamilyByRefreshHash(hashOpaqueCredential(refreshCredential), "logout", clock().toISOString());
      }
      await record("logout", "succeeded", context);
      return Object.freeze({ status: "logged_out" });
    },

    // Self-service profile update. Only fullName/phone are editable; email is
    // part of the identity/verification boundary. Returns the fresh identity.
    async updateProfile({ accessCredential, fullName, phone }, context = {}) {
      const identity = await this.authenticateAccess({ accessCredential });
      const now = clock();
      const row = await repository.updateProfile(identity.userId, {
        ...(fullName !== undefined ? { fullName: fullName == null ? null : fullName } : {}),
        ...(phone !== undefined ? { phone: phone == null ? null : phone } : {})
      }, now.toISOString());
      await record("profile_update", "succeeded", context, identity.userId);
      return Object.freeze({
        userId: identity.userId,
        email: row?.email ?? null,
        phone: row?.phone ?? null,
        fullName: row?.full_name ?? null,
        status: identity.status,
        contactVerified: identity.contactVerified === true,
        roles: Object.freeze([...(identity.roles ?? [])])
      });
    },

    // Self-service password change. Requires the current password; rotates the
    // hash and revokes all prior sessions.
    async changePassword({ accessCredential, currentPassword, newPassword }, context = {}) {
      await control("password_change", context);
      const identity = await this.authenticateAccess({ accessCredential });
      const existing = await repository.findPasswordIdentityByContact(identity.email ?? identity.phone ?? "");
      const valid = await passwords.verify(existing?.password_hash ?? dummyPasswordHash, currentPassword);
      if (!valid) {
        await record("password_change", "denied", context, identity.userId);
        throw new AuthenticationError("invalid_credentials");
      }
      passwords.assert(newPassword);
      await repository.updatePassword(identity.userId, await passwords.hash(newPassword), clock().toISOString());
      await record("password_change", "succeeded", context, identity.userId);
      return Object.freeze({ status: "changed" });
    }
  });
}
