# UI and UX

Implement approved customer, seller, admin, technician, and supervisor flows including loading, empty, error, conflict, and recovery states. UI must not display fake success for unavailable backend behavior. Operational interfaces optimize traceability; customer interfaces optimize clarity and trust.

Design system and mobile-first/a11y rules: `../guidelines/UI_STYLE_GUIDE.md`. The customer web stylesheet (`apps/web/app/globals.css`) is the single styling source of truth; admin UI must reuse the same tokens and rules.

Visual verification in a real browser is mandatory before any UI work is done — do not rely on `evaluate()` numbers alone; look at the rendered result across 320/375/768/1024px.

A business rule must be implemented consistently across server, admin, and web (full-stack logic continuation); multi-field input always uses a form. For any "verify like a human" request, run the consolidated checklist in `AGENTS.md` (Human-like verification checklist).

Full source: `../specifications/USER_FLOW_SCREEN_MAP.md`.
