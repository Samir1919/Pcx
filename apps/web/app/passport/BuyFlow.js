"use client";
import { useEffect, useState } from "react";
import { storefrontApi } from "../../lib/storefront-api";
import { money } from "../../lib/format";

function message(kind, text) {
  return text ? <div className={`banner ${kind}`} role={kind === "error" ? "alert" : "status"}><span>{text}</span></div> : null;
}

export default function BuyFlow({ listing, onDone }) {
  const [identity, setIdentity] = useState(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [placedOrder, setPlacedOrder] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [contact, setContact] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    let active = true;
    storefrontApi.me()
      .then((result) => { if (active) setIdentity(result.data); })
      .catch(() => { if (active) setIdentity(null); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  async function handleLogin(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await storefrontApi.login(contact, password);
      if (result.data?.status === "mfa_required") {
        setError("This account requires an MFA challenge from the official login flow.");
        return;
      }
      setIdentity(result.data?.identity ?? {});
      setShowLogin(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleBuy() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      // 1. Reserve the physical item (double-sell guard on the server).
      await storefrontApi.reserve(listing.inventoryItemId);

      // 2. Create a server-priced order whose snapshot preserves the sold facts.
      const order = await storefrontApi.createOrder([{
        inventoryItemId: listing.inventoryItemId,
        listingId: listing.listingId,
        productModelId: listing.modelId,
        pcxItemId: listing.pcxItemId,
        productName: listing.name,
        grade: listing.grade ?? null,
        healthScore: listing.healthScore ?? null,
        unitPrice: listing.price,
        specs: listing.specifications ?? []
      }]);

      // 3. Initiate payment. COD has no external provider charge and stays
      //    INITIATED (pay on delivery); the server records it idempotently.
      await storefrontApi.createPayment({
        orderId: order.data.id,
        direction: "INBOUND",
        method: "COD",
        amount: order.data.totalAmount
      });
      setSuccess(`Order placed: ${order.data.orderNo ?? order.data.id}. Pay cash on delivery.`);
      setPlacedOrder(order.data);
      if (onDone) onDone(order.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (checking) return <p className="state" role="status">Checking your session…</p>;

  if (!identity) {
    if (!showLogin) {
      return (
        <div className="buyBox">
          <button className="primary" type="button" onClick={() => setShowLogin(true)}>Buy Now</button>
          <button className="secondary" type="button" onClick={() => setShowLogin(true)}>Sign in to check out</button>
        </div>
      );
    }
    return (
      <form className="buyBox" onSubmit={handleLogin}>
        <h2>Sign in to buy</h2>
        <p className="meta">You need a customer account to reserve and pay for this item.</p>
        {message("error", error)}
        <label><span>Email or phone</span><input type="text" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="you@example.com" /></label>
        <label><span>Password</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></label>
        <button className="primary" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    );
  }

  return (
    <div className="buyBox">
      <p className="meta">Signed in as <b>{identity.email ?? identity.phone ?? "customer"}</b></p>
      {message("error", error)}
      {message("", success)}
      {placedOrder && (
        <dl className="orderBreakdown">
          <div><dt>Subtotal</dt><dd>{money(placedOrder.subtotal)}</dd></div>
          <div><dt>Shipping</dt><dd>{money(placedOrder.shippingAmount)}</dd></div>
          <div><dt>Tax (VAT)</dt><dd>{money(placedOrder.taxAmount)}</dd></div>
          <div className="orderTotal"><dt>Total</dt><dd>{money(placedOrder.totalAmount)}</dd></div>
        </dl>
      )}
      {!success && (
        <button className="primary" type="button" disabled={busy} onClick={handleBuy}>
          {busy ? "Processing…" : `Buy Now · ${money(listing.price)}`}
        </button>
      )}
      {success && <a className="primary" href="/storefront">Continue shopping</a>}
    </div>
  );
}
