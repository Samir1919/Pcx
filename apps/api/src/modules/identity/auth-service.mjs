import { randomUUID } from "node:crypto";
import { createCustomerRegistrationCandidate } from "../../../../../packages/domain/src/identity/identity-record.mjs";
import { generateOpaqueCredential, hashOpaqueCredential, sessionExpiries } from "./credentials.mjs";
import { assertPassword, hashPassword, verifyPassword } from "./password.mjs";

const dummyPasswordHash = "$argon2id$v=19$m=19456,p=1,t=2$O2/E313oRvHGzD2bSIIZVw$bR3lzbWFjtRahsze5LJ/mLBbUrEPNerDV6PiojyYe6A";

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
  passwords = { assert: assertPassword, hash: hashPassword, verify: verifyPassword }
}) {
  for (const method of ["createCustomer", "findPasswordIdentityByContact", "createSession", "rotateRefresh", "revokeFamilyByRefreshHash"]) {
    requiredDependency(repository, method, "repository");
  }
  requiredDependency(abuseControl, "check", "abuseControl");
  requiredDependency(audit, "record", "audit");

  async function control(action, context) {
    const outcome = await abuseControl.check({ action, ...safeContext(context) });
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
    async register({ email, phone, password }, context = {}) {
      await control("register", context);
      passwords.assert(password);
      const now = clock();
      const candidate = createCustomerRegistrationCandidate({ id: id(), email, phone, createdAt: now });
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

    async login({ contact, password }, context = {}) {
      await control("login", context);
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
      const session = await issueSession(identity.id, context);
      await record("login", "succeeded", context, identity.id);
      return Object.freeze({ status: "authenticated", identity: Object.freeze({ userId: identity.id, roles: Object.freeze([...(identity.roles ?? [])]) }), session });
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
    }
  });
}
