"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { storefrontApi } from "../../lib/storefront-api";
import StorefrontNav from "../StorefrontNav";

const STATUS_LABELS = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  REVIEWING: "Reviewing",
  INFO_REQUIRED: "Info required",
  INSPECTION_REQUIRED: "Inspection required",
  INSPECTING: "Inspecting",
  OFFERED: "Offer received",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  REJECTED_BY_SELLER: "Offer declined",
  EXPIRED: "Expired",
  ACQUISITION_PENDING: "Acquisition pending",
  PAID: "Paid",
  CLOSED: "Closed",
  CANCELLED: "Cancelled"
};

function statusLabel(s) { return STATUS_LABELS[s] ?? s; }

async function loadOffersList(items) {
  // Attach the latest offer per request so the seller can see and act on it.
  return Promise.all(items.map(async (request) => {
    try {
      const offers = await storefrontApi.sellRequestOffers(request.id);
      return { ...request, offers: offers.data ?? [] };
    } catch {
      return { ...request, offers: [] };
    }
  }));
}

export default function SellRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [identity, setIdentity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [me, list] = await Promise.all([
        storefrontApi.me().catch(() => ({ data: null })),
        storefrontApi.mySellRequests()
      ]);
      setIdentity(me.data);
      const enriched = await loadOffersList(list.data ?? []);
      setRequests(enriched);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function act(offerId, action) {
    setBusy(true);
    setNotice(null);
    try {
      if (action === "accept") await storefrontApi.acceptOffer(offerId);
      else await storefrontApi.rejectOffer(offerId);
      setNotice({ kind: "success", message: `Offer ${action === "accept" ? "accepted" : "declined"}.` });
      await load();
    } catch (err) {
      setNotice({ kind: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <main><StorefrontNav /><div className="wrap"><p className="state" role="status">Loading your sell requests…</p></div></main>;
  }

  if (!identity) {
    return (
      <main>
        <StorefrontNav />
        <div className="wrap">
          <div className="sell" style={{ maxWidth: 460, margin: "0 auto" }}>
            <h1>Your sell requests</h1>
            <p className="meta">Sign in to see the requests you have sent to PCX.</p>
            <Link className="primary" href="/login?redirect=/sell-requests">Sign in</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <StorefrontNav />
      <div className="wrap">
        <div className="sell">
          <h1>Your sell requests</h1>
          <p className="meta">Track the status of items you have submitted to PCX, and respond to offers when they arrive.</p>
          {error ? <div className="banner error" role="alert"><span>{error}</span></div> : null}
          {notice ? <div className={`banner ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.message}</span></div> : null}
          {requests.length === 0 ? (
            <p className="state">You haven't submitted any sell requests yet.</p>
          ) : (
            <div className="tableWrap">
              <table>
                <thead><tr><th>Request</th><th>Status</th><th>Offer</th><th>Submitted</th><th>Actions</th></tr></thead>
                <tbody>
                  {requests.map((r) => {
                    const activeOffer = r.offers.find((o) => o.status === "ACTIVE");
                    const latestOffer = r.offers[0];
                    return (
                      <tr key={r.id}>
                        <td><strong>{r.publicRequestNo ?? r.id.slice(0, 8)}</strong></td>
                        <td><span className="pill">{statusLabel(r.status)}</span></td>
                        <td>{latestOffer && latestOffer.status === "ACTIVE" ? `৳${Number(latestOffer.amount).toLocaleString("en-BD")}` : "—"}</td>
                        <td>{r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : "—"}</td>
                        <td>
                          {activeOffer ? (
                            <div className="actions">
                              <button type="button" className="primary" disabled={busy} onClick={() => act(activeOffer.id, "accept")}>Accept offer</button>
                              <button type="button" disabled={busy} onClick={() => act(activeOffer.id, "reject")}>Decline</button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
