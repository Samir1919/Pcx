// Contact delivery service for immediate (synchronous) contact-verification,
// password-reset, and similar one-time-code messages. It routes by contact
// (EMAIL → Resend, SMS → bdBulksms) using the active provider config.
//
// This is intentionally separate from the asynchronous notification outbox: a
// user waiting for an OTP must receive it immediately, not on the worker's next
// poll. Delivery is best-effort and never rolls back the caller's transaction.

import { createResendEmailDispatcher } from "./resend-email-dispatcher.mjs";
import { createBdBulksmsDispatcher } from "./bd-bulksms-dispatcher.mjs";
import { classifyContact } from "../identity/contact-normalization.mjs";

const SUBJECTS = Object.freeze({
  CONTACT_VERIFICATION: "Verify your PCX contact",
  PASSWORD_RESET: "Reset your PCX password"
});

export function createContactDeliveryService({ providerConfig, fetchImpl = globalThis.fetch } = {}) {
  if (!providerConfig || typeof providerConfig.getActiveCredentials !== "function") throw new TypeError("providerConfig.getActiveCredentials is required");
  if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl must be a function");

  async function sendEmail(contact, subject, text) {
    const active = await providerConfig.getActiveCredentials("EMAIL");
    if (!active) throw new Error("no active email provider configured");
    const dispatcher = createResendEmailDispatcher({
      apiKey: active.credentials.apiKey,
      from: active.credentials.from,
      fetchImpl
    });
    await dispatcher.send({ to: contact, subject, text });
  }

  async function sendSms(contact, text) {
    const active = await providerConfig.getActiveCredentials("SMS");
    if (!active) throw new Error("no active sms provider configured");
    const dispatcher = createBdBulksmsDispatcher({ token: active.credentials.token, fetchImpl });
    await dispatcher.send({ to: contact, text });
  }

  return Object.freeze({
    // Matches the delivery.send({ purpose, contact, credential, expiresAt })
    // contract used by identityActionService.
    async send({ purpose, contact, credential, expiresAt }) {
      const classified = classifyContact(contact);
      if (!classified.ok) throw new TypeError("contact is invalid");
      if (typeof credential !== "string" || credential.length === 0) throw new TypeError("credential is required");

      const text = purpose === "CONTACT_VERIFICATION"
        ? `Your PCX verification code is ${credential}. It expires at ${expiresAt}.`
        : `Your PCX password reset code is ${credential}. It expires at ${expiresAt}.`;
      const name = purpose === "CONTACT_VERIFICATION" ? "CONTACT_VERIFICATION" : "PASSWORD_RESET";

      if (classified.channel === "EMAIL") {
        await sendEmail(classified.value, SUBJECTS[name], text);
      } else {
        await sendSms(classified.value, text);
      }
      return Object.freeze({ delivered: true, channel: classified.channel });
    }
  });
}
