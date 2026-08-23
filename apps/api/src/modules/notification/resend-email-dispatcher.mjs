// Resend email dispatcher.
//
// Implements a provider-neutral `send` contract. Credentials (apiKey + from)
// come from the active EMAIL provider config; nothing is requested from the
// client. Resend's REST endpoint is POST https://api.resend.com/emails with a
// bearer apiKey and an optional Idempotency-Key so a retry never double-sends.

export function createResendEmailDispatcher({ apiKey, from, fetchImpl = globalThis.fetch, baseUrl = "https://api.resend.com" } = {}) {
  if (typeof apiKey !== "string" || apiKey.trim() === "") throw new TypeError("Resend apiKey is required");
  if (typeof from !== "string" || from.trim() === "") throw new TypeError("Resend from address is required");
  if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl must be a function");

  return Object.freeze({
    channel: "EMAIL",
    async send({ to, subject, text, html, idempotencyKey } = {}) {
      if (typeof to !== "string" || to.trim() === "") throw new TypeError("email recipient is required");
      if (typeof subject !== "string" || subject.trim() === "") throw new TypeError("email subject is required");
      const url = `${baseUrl}/emails`;
      const headers = {
        "authorization": `Bearer ${apiKey}`,
        "content-type": "application/json"
      };
      if (typeof idempotencyKey === "string" && idempotencyKey !== "") headers["idempotency-key"] = idempotencyKey;
      const body = { from, to: [to.trim()], subject: subject.trim() };
      if (typeof html === "string" && html !== "") body.html = html;
      else if (typeof text === "string" && text !== "") body.text = text;
      else body.text = subject.trim();

      const response = await fetchImpl(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      });
      let payload = null;
      try { payload = await response.json(); } catch { /* non-JSON response */ }
      if (!response.ok) {
        const message = payload?.message ?? (typeof payload === "string" ? payload : `Resend HTTP ${response.status}`);
        throw new Error(`Resend email failed: ${message}`);
      }
      return Object.freeze({ id: payload?.id ?? null, delivered: true });
    }
  });
}
