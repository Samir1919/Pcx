"use client";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { shipmentApi } from "../../../lib/shipment-api.js";

export default function ShipmentMediaModal({ shipment, onClose }) {
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [media, setMedia] = useState([]);

  const loadMedia = useCallback(async () => {
    try {
      const payload = await shipmentApi.listMedia(shipment.id);
      setMedia(payload.data ?? []);
    } catch { /* best-effort */ }
  }, [shipment.id]);

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
        await shipmentApi.uploadMedia(shipment.id, file);
      }
      setFiles([]);
      await loadMedia();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="modalOverlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modalDialog" role="dialog" aria-modal="true" aria-labelledby="shipment-media-title">
        <button type="button" className="modalClose" aria-label="Close" onClick={onClose}>×</button>
        <h2 id="shipment-media-title">Packaging evidence</h2>
        <p>Upload private packaging evidence (box sealed, label, contents). These stay internal and never appear on the storefront.</p>
        {error && <div className="banner error" role="alert"><span>{error}</span></div>}

        <label className="check" style={{ marginTop: 12 }}>
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onSelect} />
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
              <img key={m.id} src={`${shipmentApi.mediaUrl(m.id)}?size=thumb`} alt={`Evidence ${m.id}`} />
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
