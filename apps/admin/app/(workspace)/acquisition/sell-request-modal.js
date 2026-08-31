"use client";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { acquisitionApi } from "../../../lib/acquisition-api.js";

function Banner({ notice, onClose }) {
  if (!notice) return null;
  return (
    <div className={`banner ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>
      <span>{notice.message}</span>
      <button type="button" onClick={onClose} aria-label="Dismiss message">×</button>
    </div>
  );
}

function Field({ label, name, defaultValue, ...props }) {
  return (
    <label>
      <span>{label}</span>
      <input name={name} defaultValue={defaultValue ?? ""} {...props} />
    </label>
  );
}

// Server-owned transition graph (mirrors SellRequestTransitions for UI actions).
const TRANSITIONS = {
  SUBMITTED: ["REVIEWING", "CANCELLED"],
  REVIEWING: ["INFO_REQUIRED", "INSPECTION_REQUIRED", "REJECTED", "CANCELLED"],
  INFO_REQUIRED: ["REVIEWING"],
  INSPECTION_REQUIRED: ["INSPECTING"],
  INSPECTING: ["OFFERED", "REJECTED"],
  OFFERED: ["ACCEPTED", "REJECTED_BY_SELLER", "EXPIRED"],
  ACCEPTED: ["ACQUISITION_PENDING"],
  ACQUISITION_PENDING: ["PAID"],
  PAID: ["CLOSED"]
};

function defaultOfferExpiry() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

export default function SellRequestModal({ request, onClose, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [media, setMedia] = useState([]);
  const [zoom, setZoom] = useState(null);
  const [offers, setOffers] = useState([]);
  const [acquisition, setAcquisition] = useState(null);

  const load = useCallback(async () => {
    try {
      const payload = await acquisitionApi.sellRequest(request.id);
      setDetail(payload.data);
      try {
        const mediaPayload = await acquisitionApi.listMedia(request.id);
        setMedia(mediaPayload.data ?? []);
      } catch {
        setMedia([]);
      }
      try {
        const offersPayload = await acquisitionApi.listOffers(request.id);
        setOffers(offersPayload.data ?? []);
      } catch {
        setOffers([]);
      }
      try {
        const acqPayload = await acquisitionApi.getAcquisition(request.id);
        setAcquisition(acqPayload.data ?? null);
      } catch {
        setAcquisition(null);
      }
    } catch (error) {
      setDetail(null);
      setMedia([]);
      setNotice({ kind: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  }, [request.id]);

  useEffect(() => { load(); }, [load]);

  async function run(action) {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      setNotice({ kind: "success", message: "Action completed." });
      await load();
      if (onChanged) onChanged();
    } catch (error) {
      setNotice({ kind: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  function formBody(event) {
    return new FormData(event.currentTarget);
  }

  async function createOffer(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = formBody(event);
    await run(() => acquisitionApi.createOffer({
      sellRequestId: form.get("sellRequestId"),
      amount: Number(form.get("amount")),
      expiresAt: form.get("expiresAt")
    }));
    formElement.reset();
  }

  async function acceptOfferAdmin(offerId) {
    await run(() => acquisitionApi.acceptOffer(offerId));
  }

  async function createAcquisitionForOffer(offer) {
    await run(() => acquisitionApi.createAcquisition({
      sellRequestId: detail.id,
      acceptedOfferId: offer.id,
      sellerUserId: detail.userId ?? null,
      sourceType: "SELL_TO_PCX",
      idempotencyKey: `acq-${offer.id}`
    }));
  }

  async function markAcquisitionPaid(acquisitionId) {
    await run(() => acquisitionApi.markAcquisitionPaid(acquisitionId));
  }

  async function transition(toStatus) {
    await run(() => acquisitionApi.transitionSellRequest(detail.id, toStatus));
  }

  return (
    <>
      {createPortal(
        <div className="modalOverlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
          <div className="modalDialog wide" role="dialog" aria-modal="true" aria-labelledby="sell-request-detail-title">
        <button type="button" className="modalClose" aria-label="Close" onClick={onClose}>×</button>

        <p className="eyebrow">SELL REQUEST DETAIL</p>
        <h2 id="sell-request-detail-title">
          {detail ? (detail.publicRequestNo ?? detail.id.slice(0, 8)) : "Loading…"}
        </h2>

        <Banner notice={notice} onClose={() => setNotice(null)} />

        {loading ? (
          <p className="state">Loading sell request…</p>
        ) : !detail ? (
          <p className="state">The sell request could not be loaded.</p>
        ) : (
          <>
            <dl className="detailList">
              <div><dt>Status</dt><dd><span className="pill">{detail.status}</span></dd></div>
              <div><dt>Entry</dt><dd>{detail.sellEntry ?? "—"}</dd></div>
              <div><dt>Product model</dt><dd>{detail.productModelName ?? detail.productModelId ?? "—"}</dd></div>
              <div><dt>Name</dt><dd>{detail.contactName ?? "—"}</dd></div>
              <div><dt>Phone</dt><dd>{detail.contactPhone ?? "—"}</dd></div>
              <div><dt>Email</dt><dd>{detail.contactEmail ?? "—"}</dd></div>
              <div><dt>Fulfilment</dt><dd>{detail.fulfilmentPreference ?? "—"}</dd></div>
              <div><dt>Submitted</dt><dd>{detail.submittedAt ? new Date(detail.submittedAt).toLocaleString() : "—"}</dd></div>
            </dl>

            {(TRANSITIONS[detail.status] ?? []).length > 0 && (
              <div className="modalActions" style={{ justifyContent: "flex-start", marginTop: 12 }}>
                {(TRANSITIONS[detail.status] ?? []).map((target) => (
                  <button key={target} type="button" disabled={busy} onClick={() => transition(target)}>→ {target}</button>
                ))}
              </div>
            )}

            {detail.declaration ? (
              <>
                <p className="eyebrow" style={{ marginTop: 16 }}>SELLER DECLARATION</p>
                <dl className="detailList">
                  <div><dt>Age</dt><dd>{detail.declaration.ageEstimate ?? "—"}</dd></div>
                  <div><dt>Warranty</dt><dd>{detail.declaration.warrantyRemaining ?? "—"}</dd></div>
                  <div><dt>Repair</dt><dd>{detail.declaration.repairDeclared ? (detail.declaration.repairNotes ?? "Yes") : "No"}</dd></div>
                  <div><dt>Box / Invoice</dt><dd>{detail.declaration.boxAvailable ? "Box" : ""}{detail.declaration.boxAvailable && detail.declaration.invoiceAvailable ? " · " : ""}{detail.declaration.invoiceAvailable ? "Invoice" : ""}{(!detail.declaration.boxAvailable && !detail.declaration.invoiceAvailable) ? "—" : ""}</dd></div>
                  <div><dt>Ownership</dt><dd>{detail.declaration.ownershipDeclared ? "Confirmed" : "—"}</dd></div>
                </dl>
              </>
            ) : null}

            {media.length > 0 && (
              <>
                <p className="eyebrow" style={{ marginTop: 16 }}>ITEM PHOTOS</p>
                <div className="mediaGrid">
                  {media.map((m) => (
                    <img key={m.id} src={`${acquisitionApi.mediaUrl(m.id)}?size=thumb`} alt={`Photo ${m.id}`} onClick={() => setZoom(m.id)} style={{ cursor: "zoom-in" }} />
                  ))}
                </div>
              </>
            )}

            {detail.buildComponents?.length ? (
              <>
                <p className="eyebrow" style={{ marginTop: 16 }}>BUILD COMPONENTS</p>
                <div className="tableWrap">
                  <table>
                    <thead><tr><th>Role</th><th>Model</th></tr></thead>
                    <tbody>
                      {detail.buildComponents.map((c) => (
                        <tr key={c.role}><td>{c.role}</td><td>{c.productModelName ?? c.productModelId}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}

            <div className="grid" style={{ marginTop: 20, gridTemplateColumns: "1fr" }}>
              <section className="panel formPanel">
                <p className="eyebrow">OFFER</p>
                <h2>Create offer</h2>
                <form onSubmit={createOffer}>
                  <Field label="Sell request ID" name="sellRequestId" defaultValue={detail.id} readOnly required />
                  <Field label="Amount" name="amount" type="number" min="0" step="0.01" required />
                  <Field label="Expires at (ISO)" name="expiresAt" defaultValue={defaultOfferExpiry()} required />
                  <button className="primary" disabled={busy}>Create offer</button>
                </form>
              </section>

              <section className="panel formPanel">
                <p className="eyebrow">OFFERS</p>
                <h2>Offer history &amp; seller decision</h2>
                {offers.length === 0 ? (
                  <p className="state">No offers yet. Create the first offer above.</p>
                ) : (
                  <div className="tableWrap">
                    <table>
                      <thead><tr><th>Amount</th><th>Status</th><th>Expires</th><th>Accepted</th><th><span className="sr">Actions</span></th></tr></thead>
                      <tbody>
                        {offers.map((o) => (
                          <tr key={o.id}>
                            <td><strong>৳{Number(o.amount).toLocaleString("en-BD")}</strong></td>
                            <td><span className="pill">{o.status}</span></td>
                            <td>{o.expiresAt ? new Date(o.expiresAt).toLocaleString() : "—"}</td>
                            <td>{o.acceptedAt ? new Date(o.acceptedAt).toLocaleString() : "—"}</td>
                            <td>
                              <div className="actions">
                                {o.status === "ACTIVE" ? (
                                  <button type="button" disabled={busy} onClick={() => acceptOfferAdmin(o.id)}>Seller agreed</button>
                                ) : null}
                                {o.status === "ACCEPTED" && !acquisition ? (
                                  <button type="button" className="primary" disabled={busy} onClick={() => createAcquisitionForOffer(o)}>Create acquisition</button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="panel formPanel">
                <p className="eyebrow">ACQUISITION</p>
                <h2>Acquisition &amp; payment</h2>
                {acquisition ? (
                  <>
                    <dl className="detailList">
                      <div><dt>Status</dt><dd><span className="pill">{acquisition.paymentStatus}</span></dd></div>
                      <div><dt>Agreed price</dt><dd>৳{Number(acquisition.agreedPrice).toLocaleString("en-BD")}</dd></div>
                      <div><dt>Source</dt><dd>{acquisition.sourceType}</dd></div>
                      <div><dt>Acquired</dt><dd>{acquisition.acquiredAt ? new Date(acquisition.acquiredAt).toLocaleString() : "—"}</dd></div>
                    </dl>
                    {acquisition.paymentStatus === "PENDING" ? (
                      <button className="primary" disabled={busy} onClick={() => markAcquisitionPaid(acquisition.id)}>Mark paid</button>
                    ) : null}
                  </>
                ) : (
                  <p className="state">No acquisition yet. Once an offer is accepted (seller decision), create the acquisition here.</p>
                )}
              </section>
            </div>

            <div className="modalActions">
              <button type="button" onClick={onClose}>Close</button>
            </div>
          </>
        )}
          </div>
        </div>,
        document.body
      )}
      {zoom ? createPortal(
        <div className="lightboxOverlay" onClick={() => setZoom(null)} role="dialog" aria-modal="true" aria-label="Photo preview">
          <img src={acquisitionApi.mediaUrl(zoom)} alt="Full-size photo" onClick={(event) => event.stopPropagation()} />
          <button type="button" className="lightboxClose" aria-label="Close photo" onClick={() => setZoom(null)}>×</button>
        </div>,
        document.body
      ) : null}
    </>
  );
}
