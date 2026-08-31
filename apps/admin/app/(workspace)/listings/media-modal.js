"use client";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { listingApi } from "../../../lib/listing-api.js";

export default function ListingMediaModal({ listing, onClose, onUploaded }) {
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [media, setMedia] = useState([]);
  const [sellerMedia, setSellerMedia] = useState([]);

  const loadMedia = useCallback(async () => {
    try {
      const payload = await listingApi.listMedia(listing.id);
      setMedia(payload.data ?? []);
    } catch { /* best-effort */ }
    try {
      const sellerPayload = await listingApi.listSellerMedia(listing.id);
      setSellerMedia(sellerPayload.data ?? []);
    } catch { /* best-effort */ }
  }, [listing.id]);

  useEffect(() => { loadMedia(); }, [loadMedia]);

  async function promote(sellerPhoto) {
    setBusy(true);
    setError(null);
    try {
      await listingApi.promoteMedia(listing.id, sellerPhoto.id);
      await loadMedia();
      if (onUploaded) onUploaded();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function onSelect(event) {
    setFiles(Array.from(event.target.files ?? []));
    setError(null);
  }

  async function uploadAll() {
    setBusy(true);
    setError(null);
    try {
      for (const file of files) {
        await listingApi.uploadMedia(listing.id, file, "PHOTO");
      }
      setFiles([]);
      await loadMedia();
      if (onUploaded) onUploaded();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="modalOverlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modalDialog" role="dialog" aria-modal="true" aria-labelledby="listing-media-title">
        <button type="button" className="modalClose" aria-label="Close" onClick={onClose}>×</button>
        <h2 id="listing-media-title">Listing photos</h2>
        <p>Upload actual item photos (JPEG, PNG, or WebP, up to 5 MB each). They are public on the storefront.</p>
        {error && <div className="banner error" role="alert"><span>{error}</span></div>}

        <label className="check" style={{ marginTop: 12 }}>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={onSelect}
          />
        </label>

        {files.length > 0 && (
          <div className="mediaGrid">
            {files.map((file, i) => (
              <img key={i} src={URL.createObjectURL(file)} alt={`Selected ${i + 1}`} />
            ))}
          </div>
        )}

        {sellerMedia.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p className="eyebrow">SELLER PHOTOS</p>
            <p>Promote the seller&apos;s original photos to the public listing — pick only the ones to show buyers.</p>
            <div className="mediaGrid" style={{ marginTop: 8 }}>
              {sellerMedia.map((m) => (
                <div key={m.id}>
                  <img src={`${listingApi.mediaUrl(m.id)}?size=thumb`} alt="Seller photo" />
                  <button type="button" disabled={busy || m.promoted} onClick={() => promote(m)} style={{ display: "block", width: "100%", marginTop: 4 }}>
                    {m.promoted ? "Added ✓" : "Use for listing"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {media.length > 0 && (
          <div className="mediaGrid" style={{ marginTop: 12 }}>
            {media.map((m) => (
              <img key={m.id} src={listingApi.mediaUrl(m.id)} alt={`Media ${m.id}`} />
            ))}
          </div>
        )}

        <div className="modalActions">
          <button type="button" className="danger" onClick={onClose} disabled={busy}>Close</button>
          <button type="button" className="primary" onClick={uploadAll} disabled={busy || files.length === 0}>
            {busy ? "Uploading…" : `Upload ${files.length || ""}`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
