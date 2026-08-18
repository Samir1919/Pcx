"use client";
import { useEffect, useRef, useState } from "react";

function Trigger({ as, label, className, onOpen }) {
  if (as === "span") {
    return (
      <span
        role="button"
        tabIndex={0}
        className={className}
        onClick={(event) => { event.preventDefault(); event.stopPropagation(); onOpen(); }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            onOpen();
          }
        }}
      >
        {label}
      </span>
    );
  }
  return (
    <button type="button" className={className} onClick={onOpen}>
      {label}
    </button>
  );
}

export default function PassportInfoModal({ triggerLabel = "Learn more", triggerAs = "button", triggerClassName = "learn-more" }) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <Trigger as={triggerAs} label={triggerLabel} className={triggerClassName} onOpen={() => setOpen(true)} />

      {open ? (
        <div className="modalOverlay" onClick={() => setOpen(false)}>
          <div
            className="modalDialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="passport-info-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button ref={closeRef} type="button" className="modalClose" aria-label="Close" onClick={() => setOpen(false)}>
              ×
            </button>

            <h2 id="passport-info-title">What is a public passport?</h2>

            <p>Every listing is inspected and graded by PCX — never by the seller.</p>

            <p>
              A <strong>public passport</strong> is a verified condition report that travels with each item. It shows
              the item's grade, health score, and the checks it passed.
            </p>

            <p>
              To protect sellers, public passports never reveal full serial numbers, the amount PCX paid to acquire
              the item, or private evidence.
            </p>

            <p>
              <strong>Prices are set by PCX.</strong> Sellers never set the final price.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
