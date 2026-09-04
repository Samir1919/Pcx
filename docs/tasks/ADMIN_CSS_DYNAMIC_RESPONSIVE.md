# Admin CSS: Dynamic + Responsive conversion schedule

Status: COMPLETE 2026-09-04 — all phases executed and verified in a live
headed browser; remaining `px` literals are exclusively token definitions in
`:root` and intentional exclusions (letter-spacing, 1px structural borders,
`.sr` screen-reader utility, `clamp()`/`min()`/`max()`/`calc()` contents,
`blur()`, `translateY()`, focus `outline`, close-button positioning offsets).

Source of truth: `docs/guidelines/UI_STYLE_GUIDE.md` + AGENTS.md engineering rules
("every design value lives in a `:root` token and is consumed via `var(--…)`,
fluid type/spacing via `clamp()`, fluid grid via `auto-fit/minmax`, no hardcoded
magic numbers — no fixed pixel width, no hardcoded palette hex, no hardcoded
`44px`").

Target file: `apps/admin/app/globals.css` (1375 lines at schedule time).

## Phase 0 — colors (DONE)
- 0 hex / rgba outside `:root`. Verified via grep.

## Phase 1 — radii
Hardcoded `border-radius` values to tokenize into an expanded `:root` radius
scale, then consume via `var(--…)`:
- 7px → `--radius-xs`
- 8px → `--radius-sm`
- 9px, 10px, 11px → `--radius-md`
- 12px → `--radius-lg`
- 14px, 16px → `--radius-xl`
- 999px → `--radius-pill`
- 50% → `--radius-round`

## Phase 2 — spacing
Hardcoded `padding` / `margin` / `gap` px values mapped onto the fluid
`--space-1…--space-5` clamp scale (per the style guide: "use these, not raw px"):
- 4–7px → `--space-1`
- 8–13px → `--space-2`
- 14–18px → `--space-3`
- 20–26px → `--space-4`
- 28–50px → `--space-5`
Exclusions: `1px` borders, `letter-spacing`, `blur()`, `translateY()`, the
`.sr` screen-reader utility, and `clamp()`/`min()`/`max()`/`calc()` function
contents (already fluid).

## Phase 3 — fixed pixel sizes
- `.filter { min-width: 170px }` → fluid (reuse `--field-basis`).
- `.authCard { max-width: 420px }` → rem.
- `textarea { min-height: 100px }` → `--field-area-min` token.
- `.navIcon { width: 20px }`, `.tabs span { min-width/height: 20px }` → rem.
- `.check input { width/height: 17px }` → rem.
- `.lightboxClose` 42px, `.modalClose` 36px → `var(--touch-target)` (were <44px).
- `.drawerClose { left: 292px }` → derive from drawer width.
- `.modalDialog.wide { max-height: min(88vh, 900px) }` → rem.
- `font-size: 23px / 18px` → rem.
- `@media (max-width: 640px)` → rem breakpoint.

## Phase 4 — shadows/focus rings (tokenize repeated literals)
- `0 0 0 3px var(--accent-soft)` focus halo → `--focus-ring`.
- `inset 3px 0 0 var(--accent-bright)` → `--accent-bar`.
- `0 2px 8px var(--shadow-ink)` → `--tab-shadow`.
- Fix `.primary:hover` `box-shadow: 0 7px 18px var(--brand-shadow)` (nested,
  invalid) → `var(--brand-shadow)`.

## Verification (each phase)
- `npm run lint`, `npm run typecheck`, `npm run build`.
- Headed browser: no horizontal overflow at 320/375/768/1024px
  (`scrollWidth === clientWidth` on document, body, and every card/wrap).
- 0 console errors.
