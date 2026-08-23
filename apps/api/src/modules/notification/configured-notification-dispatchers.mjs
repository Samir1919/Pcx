// Resolves admin-configured notification dispatchers at send-time.
//
// Returns a `dispatchers` map (EMAIL/SMS) matching the contract used by
// createNotificationService.dispatchDue. Each `send(notification)` resolves the
// active credentials for its channel, then delegates to the corresponding real
// adapter. When no active config exists it fails (the worker then marks the
// outbox row FAILED), which keeps the dispatch path honest instead of silently
// dropping messages.

import { createResendEmailDispatcher } from "./resend-email-dispatcher.mjs";
import { createBdBulksmsDispatcher } from "./bd-bulksms-dispatcher.mjs";

export function createConfiguredNotificationDispatchers({ providerConfig, fetchImpl = globalThis.fetch } = {}) {
  if (!providerConfig || typeof providerConfig.getActiveCredentials !== "function") throw new TypeError("providerConfig.getActiveCredentials is required");
  if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl must be a function");

  return Object.freeze({
    EMAIL: Object.freeze({
      channel: "EMAIL",
      async send(notification) {
        const active = await providerConfig.getActiveCredentials("EMAIL");
        if (!active) throw new Error("no active email provider configured");
        const subject = notification?.notificationType ?? "PCX notification";
        const text = notification?.payloadSnapshot?.message ?? subject;
        const dispatcher = createResendEmailDispatcher({
          apiKey: active.credentials.apiKey,
          from: active.credentials.from,
          fetchImpl
        });
        await dispatcher.send({
          to: notification?.payloadSnapshot?.email ?? notification?.userId ?? "",
          subject,
          text,
          idempotencyKey: `${notification?.notificationType ?? "notification"}/${notification?.id ?? "unknown"}`
        });
        return { delivered: true };
      }
    }),
    SMS: Object.freeze({
      channel: "SMS",
      async send(notification) {
        const active = await providerConfig.getActiveCredentials("SMS");
        if (!active) throw new Error("no active sms provider configured");
        const text = notification?.payloadSnapshot?.message ?? notification?.notificationType ?? "PCX notification";
        const dispatcher = createBdBulksmsDispatcher({ token: active.credentials.token, fetchImpl });
        await dispatcher.send({ to: notification?.payloadSnapshot?.phone ?? notification?.userId ?? "", text });
        return { delivered: true };
      }
    })
  });
}
