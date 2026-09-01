// bKash HTTP gateway: adapts the real bKash adapter to the provider-neutral
// `charge`/`refund` contract used by the commerce and returns modules.
//
// `charge` = grant token + create payment (URL-based checkout, mode "0011"). It
// returns the bKash paymentID as the server-authoritative provider transaction
// id with an INITIATED status (the payment completes later via execute/query
// after the customer completes the redirect). The bkashURL is surfaced so the
// caller can redirect the customer.
//
// All methods are sandbox-only by construction (the adapter rejects a live host).

function mapPaymentStatus(value) {
  const status = String(value ?? "").toUpperCase();
  if (status === "INITIATED") return "INITIATED";
  if (status === "COMPLETED") return "CONFIRMED";
  return "FAILED";
}

export function createBkashHttpGateway({ adapter, callbackURL = "http://localhost:3000/api/v1/payments/bkash/callback" }) {
  if (!adapter || typeof adapter.createPayment !== "function" || typeof adapter.executePayment !== "function" || typeof adapter.refund !== "function") {
    throw new TypeError("bKash adapter (createPayment/executePayment/refund) is required");
  }
  if (typeof callbackURL !== "string" || callbackURL.trim().length === 0) throw new TypeError("callbackURL is required");

  return Object.freeze({
    // Provider-neutral charge: creates the bKash payment and returns the
    // paymentID (INITIATED) plus the redirect bkashURL. The caller records the
    // provider transaction id; completion happens via execute().
    async charge({ amount, currency = "BDT", reference } = {}) {
      const created = await adapter.createPayment({
        amount,
        currency,
        merchantInvoiceNumber: reference,
        payerReference: "",
        callbackURL
      });
      return Object.freeze({
        providerTransactionId: created.paymentID,
        status: mapPaymentStatus(created.transactionStatus),
        bkashURL: created.bkashURL,
        amount,
        currency,
        reference
      });
    },

    // Finalize a created payment after the customer completes the bKash redirect.
    async execute({ paymentId } = {}) {
      const executed = await adapter.executePayment(paymentId);
      return Object.freeze({
        providerTransactionId: executed.trxID ?? executed.paymentID,
        status: mapPaymentStatus(executed.transactionStatus),
        paymentId: executed.paymentID,
        trxID: executed.trxID
      });
    },

    async query({ paymentId } = {}) {
      const queried = await adapter.queryPayment(paymentId);
      return Object.freeze({
        providerTransactionId: queried.trxID ?? queried.paymentID,
        status: mapPaymentStatus(queried.transactionStatus)
      });
    },

    // Provider-neutral refund: reverses a completed bKash transaction.
    async refund({ amount, currency = "BDT", reference, paymentId, trxId } = {}) {
      const outcome = await adapter.refund({
        paymentId,
        trxId,
        amount,
        sku: reference ?? "",
        reason: "Refund"
      });
      return Object.freeze({
        providerTransactionId: outcome.refundTrxID,
        status: mapPaymentStatus(outcome.transactionStatus),
        amount,
        currency,
        reference
      });
    }
  });
}
