"use client";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { listingApi } from "../../../lib/listing-api.js";

export default function ListingMediaModal({ listing, onClose, onUploaded }) {
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [media, setMedia] = useState([]);

  const loadMedia = useCallback(async () => {
    try {
      const payload = await listingApi.listMedia(listing.id);
      setMedia(payload.data ?? []);
    } catch { /* best-effort */ }
  }, [listing.id]);

  useEffect(() => { loadMedia(); }, [loadMedia]);

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
