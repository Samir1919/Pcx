// bdBulksms (greenweb) SMS dispatcher.
//
// Implements a provider-neutral `send` contract. Credentials (token) come from
// the active SMS provider config. The provider accepts POST form-encoded
// `token`, `to`, `message` to https://api.bdbulksms.net/api.php?json and returns
// an array of results where `status === 0` means success.

export function createBdBulksmsDispatcher({ token, fetchImpl = globalThis.fetch, baseUrl = "https://api.bdbulksms.net/api.php?json" } = {}) {
  if (typeof token !== "string" || token.trim() === "") throw new TypeError("bdBulksms token is required");
  if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl must be a function");

  function normalizeTo(to) {
    // bdBulksms accepts a comma-separated list of national or E.164 numbers.
    if (typeof to !== "string" || to.trim() === "") throw new TypeError("sms recipient is required");
    const numbers = to.split(",").map((value) => value.trim()).filter(Boolean);
    if (numbers.length === 0) throw new TypeError("sms recipient is required");
    return numbers.map((n) => n.startsWith("+") ? n.slice(1) : n).join(",");
  }

  return Object.freeze({
    channel: "SMS",
    async send({ to, text } = {}) {
      if (typeof text !== "string" || text.trim() === "") throw new TypeError("sms message is required");
      const recipient = normalizeTo(to);
      const body = new URLSearchParams();
      body.set("token", token.trim());
      body.set("to", recipient);
      body.set("message", text.trim());

      const response = await fetchImpl(baseUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: body.toString()
      });
      let payload = null;
      try { payload = await response.json(); } catch { /* non-JSON response */ }
      if (!response.ok) {
        throw new Error(`bdBulksms failed: HTTP ${response.status}`);
      }
      // API returns either a single object or an array of per-recipient results.
      const results = Array.isArray(payload) ? payload : [payload];
      const success = results.length > 0 && results.every((item) => item?.status === 0);
      if (!success) {
        throw new Error(`bdBulksms rejected the message: ${JSON.stringify(payload ?? {})}`);
      }
      return Object.freeze({ delivered: true });
    }
  });
}
