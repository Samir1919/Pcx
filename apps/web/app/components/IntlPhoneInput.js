"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { COUNTRIES, countryByCode, findCountryByDigits, dialDigits } from "../../lib/countries";
import { validatePhone } from "../../lib/contact-validation";

// A reusable international phone input. Defaults to Bangladesh (+880), supports
// every country via a searchable dropdown, and keeps the parent state as a full
// E.164 string (`+8801XXXXXXXXX`) while editing the national number locally.
export default function IntlPhoneInput({ value = "", onChange, label = "Phone", placeholder, disabled = false, required = false }) {
  const [country, setCountry] = useState(null);
  const [national, setNational] = useState("");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const previous = useRef(value);

  // Lazy-capture an existing E.164 value into country + national parts.
  useEffect(() => {
    previous.current = value;
    if (value) {
      const digits = String(value).replace(/\D/g, "");
      const match = findCountryByDigits(digits);
      if (match) {
        setCountry(match.country);
        setNational(match.national);
      } else if (country) {
        // Unparseable but we have a country — keep everything after its prefix.
        const prefix = dialDigits(country);
        setNational(digits.startsWith(prefix) ? digits.slice(prefix.length) : digits);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Initialize the country from the incoming value or default Bangladesh.
  useEffect(() => {
    if (country) return;
    const digits = value ? String(value).replace(/\D/g, "") : "";
    const match = value ? findCountryByDigits(digits) : null;
    setCountry(match?.country ?? countryByCode("BD"));
  }, [value, country]);

  // Close the dropdown on outside click / Escape.
  useEffect(() => {
    function onPointer(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    }
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [query]);

  const validation = useMemo(() => {
    if (!country || !value) return { ok: true };
    return validatePhone(value);
  }, [country, value]);

  function emit(nextNational, nextCountry) {
    const c = nextCountry ?? country;
    if (!c) return;
    const digits = nextNational.replace(/\D/g, "");
    const e164 = `+${dialDigits(c)}${digits}`;
    if (onChange) onChange(e164);
  }

  function selectCountry(next) {
    setCountry(next);
    setOpen(false);
    setQuery("");
    emit(national, next);
  }

  function handleNationalChange(event) {
    const next = event.target.value;
    setNational(next);
    emit(next, country);
  }

  return (
    <div className="phoneInput" ref={rootRef}>
      <span className="phoneInputLabel">{label}{required ? " *" : ""}</span>
      <div className="phoneInputRow">
        <button
          type="button"
          className="phoneInputCountry"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Select country code"
          disabled={disabled}
        >
          <span aria-hidden="true">{country ? country.flag : "🏳️"}</span>
          <span className="phoneInputDial">{country ? `+${country.dial}` : "+880"}</span>
          <span className="phoneInputCaret" aria-hidden="true">▾</span>
        </button>
        <input
          className="phoneInputField"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={national}
          onChange={handleNationalChange}
          placeholder={placeholder ?? "(1) 7123-4567"}
          disabled={disabled}
          required={required}
          aria-invalid={validation.ok ? undefined : "true"}
        />
      </div>
      {open ? (
        <div className="phoneInputList" role="listbox">
          <input
            className="phoneInputSearch"
            type="search"
            placeholder="Search country…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <div className="phoneInputOptions">
            {filtered.map((c) => (
              <button
                key={c.code}
                type="button"
                className={`phoneInputOption${country && country.code === c.code ? " selected" : ""}`}
                role="option"
                aria-selected={country && country.code === c.code}
                onClick={() => selectCountry(c)}
              >
                <span aria-hidden="true">{c.flag}</span>
                <span className="phoneInputOptionName">{c.name}</span>
                <span className="phoneInputOptionDial">+{c.dial}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {!validation.ok && value ? <p className="phoneInputError" role="alert">{validation.reason}</p> : null}
    </div>
  );
}
