# PCX UI Style Guide

Authoritative design rules for the PCX web surfaces. Applies to the customer
storefront (`apps/web`) now and is the required standard for the admin app
(`apps/admin`) as it is future-built. Any AI agent or human engineer adding
UI must follow these rules; review diffs against this file.

This is the **how-and-why**. The only styling implementation source of truth
for the customer web is `apps/web/app/globals.css` (no Tailwind, no UI kit).

---

## 1. Styling approach

- **Plain, hand-written CSS** with CSS custom properties (design tokens).
- **No Tailwind, no UI library** unless an ADR explicitly approves one.
- **One stylesheet per app** as the source of truth (`apps/web/app/globals.css`).
- Do **not** scatter `style={{...}}` inline except for genuinely one-off values.

## 2. Design tokens (always via variables)

Colors, spacing, radii, and shadows live in `:root`. Use `var(--…)` — never
hard-code a palette value again. Current tokens:

| Token | Purpose |
|-------|---------|
| `--ink`, `--muted`, `--paper`, `--panel`, `--line` | text / surfaces / borders |
| `--green`, `--green-strong`, `--mint`, `--mint-strong` | brand + hover states |
| `--accent`, `--accent-soft` | interactive accent + focus/hover halo |
| `--danger-text`, `--danger-bg` | destructive actions |
| `--space-1…--space-5` | fluid spacing scale (use these, not raw px) |
| `--radius-sm/md/lg` | corner radii |
| `--shadow` | elevation |
| `--touch-target` | minimum interactive size (2.75rem = 44px) |

If a value is missing, add a token first, then use it — do not fork the palette.

## 3. Fluid, not pixel-locked

- **Layout:** `max-width` + `%` + CSS Grid `minmax(auto-fit/auto-fill, minmax(...))`.
  Never `width: 1234px` on a container.
- **Type & spacing:** `clamp()` for font-size and spacing that scales with the
  viewport (mobile → tablet → desktop in one formula).
- **Cards/grids:** `repeat(auto-fill, minmax(min(15rem, 100%), 1fr))` style, so
  columns flow naturally at every width.
- **Tables:** wrap in `.tableWrap` (`overflow-x:auto`) — never force a table
  past the viewport.
- **Overflow:** verify `document.documentElement.scrollWidth === clientWidth`
  at 320/375/768/1024px. No page may scroll horizontally.

## 4. Mobile-first + breakpoints

- Write base rules for the **smallest** viewport first, then add `@media` only
  to *enhance* larger screens.
- Breakpoints are in `rem`, not device pixels:
  - `< 40rem` (~640px): phones — header shows brand + auth CTA + hamburger; full menu lives in the slide-in drawer.
  - `≥ 40rem`: tablet — inline desktop nav; banner art beside copy; two-column "how it works".
  - `≥ 48rem` (~768px): desktop — filter "Apply" aligns beside the dropdowns.
- Modal is bottom-sheet on mobile, centered on `≥ 40rem`.

## 5. Accessibility (non-negotiable)

- **Touch target:** every `a`, `button`, `input`, `select` must be
  `min-height: var(--touch-target)` (44px). Data-dense inline links are the
  only exception and must still have adequate padding.
- **Focus:** keep `:focus-visible { outline: 2px solid var(--accent); }` — add
  it if missing; never remove it.
- **Reduced motion:** preserve the `@media (prefers-reduced-motion: reduce)`
  block.
- **Labels:** every form control gets a visible `label` text.
- **Contrast:** body text on light surfaces must use `--ink`/`--muted`; do not
  introduce light-on-light or grey-on-grey pairings.

## 6. Component patterns

- **Buttons / CTAs:** `display:inline-flex; align-items:center;
  justify-content:center; min-height:var(--touch-target); font-weight:750;`
  Primary = `--green`, Secondary = bordered `--panel`, Danger = `--danger-bg`.
- **Banner:** error/status/success use `.banner` + `.error`/`.success` with a
  `role="alert"` or `role="status"`.
- **Card:** `.card` (token background, border, radius, shadow, flex column).
- **Filter/Search:** `.filters` is a grid; **search is first** (full-width,
  `.filterSearch`), dropdowns live in `.filterRow`, and "Apply" is the primary
  full-width (mobile) / side-aligned (desktop) action.
- **Table:** always wrap with `.tableWrap`; use base `table/th/td` + `.actions`.
- **Modal:** reuse `.modalOverlay`/`.modalDialog`/`.modalClose`.
- **Helper text:** `.meta` (global). **Destructive button:** `.danger`.
- **Navbar (mobile):** keep the header minimal — brand + primary auth CTA
  (`.authCta`) + hamburger (`.navToggle`); move the rest into `.navDrawer`
  (right slide-in + scrim). Desktop uses the inline `.desktopNav`. Always set
  `aria-expanded`/`aria-controls`, lock body scroll while open, and close on
  Escape/scrim click.

## 7. Visual verification is mandatory

Before declaring any UI work done, open the running dev server in a real
browser (Playwright or Chrome DevTools) and **look at the rendered result** —
do not rely only on `evaluate()` numbers. Verify, at a minimum, across
320 / 375 / 768 / 1024 px viewports:

- Real screenshots/rendering of every touched page (not just JSON probes).
- No horizontal overflow, no clipped or overlapping elements.
- Headings, body text, and helper text are readable (≥ 0.75rem for micro-labels).
- Spacing, alignment, and component boundaries look intentional.
- Navigation state (mobile drawer vs desktop inline) matches expectations.
- Focus ring and touch targets are visible and usable.

Numbers like `scrollWidth === clientWidth` are necessary but not sufficient —
they cannot catch visual defects (tiny text, poor alignment, awkward spacing).

## 8. Definition-of-done checklist (run before commit)

1. Visual verification (section 7) done in an actual browser.
2. No horizontal overflow at 320 / 375 / 768 / 1024 px.
3. All interactive elements ≥ 44px tall (or an intentional exception is noted).
4. No class used in JSX without a matching rule in the app's stylesheet.
5. No hardcoded palette hex/rgb outside `:root` (focus/hover included).
6. `:focus-visible` and `prefers-reduced-motion` still present.
7. `npm run web:check`, `npm run typecheck`, `npm run lint`, `npm run build` pass.

## 9. Admin app reuse

The admin app (`apps/admin`) has a different shell and layout, but it must
reuse the same tokens, spacing scale, touch-target floor, focus/reduced-motion
rules, visual-verification, and a11y checklist. If admin needs extra tokens,
promote them into a shared source rather than duplicating divergent values.
