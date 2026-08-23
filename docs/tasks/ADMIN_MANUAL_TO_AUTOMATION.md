# Task: Admin Web App — Manual vs Automatable/Dynamic Actions Audit (A→Z)

- Status: Complete (read-only audit; no code changes)
- Owner/agent: Cline
- Branch: `main`
- Mode: Investigation + report only
- Related specs: `docs/brain/state-machines.md`, `docs/brain/domain-rules.md`, `docs/specifications/API_SPECIFICATION_STATE_MACHINES.md`

## Objective

Open the admin web app (`apps/admin`) in a headed (visible) browser, walk every
tab/section/modal A→Z, and report — for each manual or static step — which ones
are candidates for automation or dynamic/contextual behavior, and which must
remain manual (privileged judgment, server-authoritative invariants, financial
hard stops).

This is a **report only**. No business logic, schema, or UI was changed.

## Method and evidence

- Working tree clean, branch `main`, HEAD `d6289ce`.
- Local dev stack already running: API `:4000`, web `:3000`, admin `:3001`;
  Postgres/Redis/Minio healthy. `npm run seed:demo` re-run (idempotent).
- Headed browser walk: `PCX_HEADED=1 node scripts/admin-e2e-check.mjs`
  → **18/18 passed** (login + MFA, all 14 nav tabs, and catalog edit modal,
  inventory inspect modal, listings photos modal).
- The Playwright MCP server was not connected in this session, so the repository's
  own headed (non-headless) Playwright path was used, per the portable workflow.
- Source cross-reference: every `apps/admin/app/(workspace)/**` page, every
  `apps/admin/lib/*.js` helper, and the domain invariants in `AGENTS.md`.

## Nav inventory (authoritative)

From `apps/admin/app/user-shell.js`:

| href | Label | Screen kind | Access gate |
|---|---|---|---|
| `/` | Overview | read-only dashboard | any ACTIVE admin role |
| `/catalog` | Catalog | interactive (tabs) | any ACTIVE admin role |
| `/inventory` | Inventory | interactive + modal | any ACTIVE admin role |
| `/listings` | Listings | interactive + modal | any ACTIVE admin role |
| `/acquisition` | Acquisition | interactive (state machine) | any ACTIVE admin role |
| `/shipment` | Shipment | interactive | any ACTIVE admin role |
| `/returns` | Returns | interactive | any ACTIVE admin role |
| `/warranty` | Warranty | interactive | any ACTIVE admin role |
| `/notifications` | Notifications | interactive | any ACTIVE admin role |
| `/verification` | Verification | interactive | any ACTIVE admin role |
| `/payments` | Payments | interactive (credential save) | any ACTIVE admin role |
| `/users` | Users | interactive (RBAC) | any ACTIVE admin role |
| `/footer` | Footer | interactive (CMS) | any ACTIVE admin role |
| `/audit` | Audit logs | read-only list | any ACTIVE admin role |

Note: the shell gate (`canAccessAdmin`) only checks ACTIVE + any admin role; the
real per-endpoint RBAC enforcement is server-side on every API route.

## Findings by screen

Legend: **[AUTO]** = reasonable candidate for automation/dynamic behavior;
**[MANUAL]** = must stay human (invariant / judgment / hard stop).

### 1. Overview (`/`)
- Loads `opsApi.dashboard()` → `GET /api/v1/admin/reports/operations`.
- Only action: `↻ Refresh`.
- **[AUTO]** Add polling/auto-refresh (or SWR/refetch-on-focus). Values are already
  server-derived; no client computation of totals/status.

### 2. Catalog (`/catalog`)
Tabs: Categories, Brands, Product models, Attributes, Sell flow, Quotes.

- Categories/Brands/Models/Definitions: create form + edit modal + archive.
  - **[AUTO]** `slug()` is already auto-generated client-side from name; move this
    to the server and remove the manual slug input from the edit modal.
  - **[AUTO]** Bulk import / CSV upload for models and attributes.
  - **[AUTO]** `sortOrder` default is already 0; auto-increment by list length.
- Quotes (QuoteConfigPanel): set indicative price low/high per product model.
  - **[MANUAL]** The price range itself is a business decision, but it is an
    *estimated range, never a final offer* (invariant), so it is acceptable as
    admin-configured data. **[AUTO]** Support bulk CSV upload and default ranges
    by category to remove per-model manual entry.
- Sell flow (SellFlowPanel): inline `onBlur` autosave PATCH for icon/hint/sortOrder;
  component category/required inline select edits.
  - Already dynamic **[AUTO]**; could add drag-to-reorder instead of numeric sort.

### 3. Inventory (`/inventory`)
- Register item form: `POST /api/v1/admin/inventory` (server derives PCX ID and
  RECEIVED status). `View` / `Inspect` actions.
  - **[MANUAL]** Physical serial entry is human input, but PCX ID + status are
    server-derived (correct). **[AUTO]** Serial normalization/validation is already
    server-side; could add barcode/QR scan.
- Inspect modal (inspection-modal.js):
  - `Inspection template ID` is a **manual free-text field**. **[AUTO]** Auto-select
    the template from the item's category (Verification already scopes templates by
    category) — removes a copy/paste step.
  - Result selects (Pass/Fail/N/A) per test item: **[MANUAL]** physical inspection
    judgment. Health score + suggested grade are already auto-derived server-side.
  - Submit → Approve/Reject: **[MANUAL]** supervisor decision; critical-fail override
    is privileged, reasoned, audited (invariant).

### 4. Listings (`/listings`)
- Create draft: `POST /api/v1/admin/listings` (starts DRAFT, server-owned).
  - `inventoryItemId` is manual free-text. **[AUTO]** Offer a dropdown of
    APPROVED items without an active listing.
- Publish: manual slug entry in dialog. **[AUTO]** Pre-fill/auto-generate slug from
  the model name via the existing `slug()` helper.
- Set price: manual amount. **[MANUAL]** Price is a business decision and must stay
  server-authoritative; **[AUTO]** could pre-fill a suggested value from the
  indicative price range (as guidance, not authoritative).
- Photos: media upload modal (multi-file).

### 5. Acquisition (`/acquisition`)
- Sell request queue: per-row `View` + dynamic `→ STATUS` transition buttons driven
  by a client `TRANSITIONS` map (mirrors server transitions). Good baseline.
  - The transition buttons are already **[AUTO]** (status-aware). Keep the server
    as the enforcement point.
- Detail view (declaration, build components): read-only. **[AUTO]** could inline
  the next allowed transition into the detail panel.
- Manual free-form forms: Create valuation, Create offer, Accept offer, Create
  acquisition, Mark paid — **every one requires pasting raw UUIDs**.
  - **[AUTO]** Convert these to contextual row/detail actions with pre-filled IDs
    (sellRequestId, valuationId, offerId, acquisitionId). This is the single
    largest manual-effort reduction in the admin app.
  - **[AUTO]** Pre-fill valuation low/high/recommended from the indicative price
    range; pre-fill offer amount from the valuation `recommendedValue`; pre-fill
    `expiresAt` (now + default window).
  - **[MANUAL]** Agreed price, valuation amounts, and offer acceptance are business
    decisions; server must remain authoritative for price/status. Final offer is
    *not* the estimated range. Mark-paid/accept-offer are financial and idempotent
    actions — keep human-gated.

### 6. Shipment (`/shipment`)
- Create shipment: manual `orderId`, courier, weight, COD amount, shipping charge.
  - **[AUTO]** COD amount and shipping charge should auto-derive from the order
    totals (server), not be typed. **[AUTO]** `orderId` from a dropdown of
    paid/unshipped orders.
- Mark shipped: manual address entry.
  - **[AUTO]** Pre-fill address from the order's shipping address; tracking id is
    already server-derived from courier.
- Mark delivered: manual.
  - **[AUTO]** The signed courier webhook already auto-advances DELIVERED/RETURNED;
    the manual button should be a rare override, not the primary path, and when
    present should be audited and clearly marked as an override.

### 7. Returns (`/returns`)
- Approve / Mark received / Settle refund forms with manual return ID + amount.
  - **[AUTO]** Convert to per-row action buttons (remove UUID copy/paste).
  - **[MANUAL]** Refund execution is a financial operation; amount must be
    server-derived from the sold order-item total, not freely typed by the client.
    Settlement stays privileged.

### 8. Warranty (`/warranty`)
- Create warranty: manual `startsAt` / `endsAt` datetime entry.
  - **[AUTO]** Derive the valid window from delivery date + warranty policy
    (server), instead of manual datetimes.
- Create claim / Resolve claim: manual IDs, resolution type, cost.
  - **[AUTO]** Row-action buttons with pre-filled IDs.
  - **[MANUAL]** Resolution type (REPAIR/REPLACE/REFUND/REJECT) is human judgment.

### 9. Notifications (`/notifications`)
- Create notification: manual type/ref/channel. List is read-only.
  - **[AUTO]** Business notifications (ORDER_CONFIRMED, OFFER_CREATED, etc.) should
    be auto-created from server state transitions (event-driven), not typed by hand.
    Keep manual creation only for ad-hoc broadcasts.
  - Dispatch is already **[AUTO]** — the worker dispatches PENDING→SENT/FAILED.

### 10. Verification (`/verification`)
- Create inspection template: name, version, typed items.
  - **[AUTO]** Version auto-increment (currently defaults to "1.0" each time).
  - **[AUTO]** Clone/copy an existing template to a new version.
  - **[MANUAL]** The checklist content itself is domain configuration.

### 11. Payments (`/payments`)
- Save credentials (sandbox/live), Activate mode.
  - **[MANUAL]** Real provider credentials and mode switching are a human hard stop
    (AGENTS.md: payment destination/provider credential changes). Sandbox activation
    can remain a manual click; live activation must stay human-gated.
  - Credentials are already encrypted at rest, never shown back (correct).

### 12. Users (`/users`)
- Filter, change status (dropdown), add/remove roles (chips).
  - **[MANUAL]** Role and status are server-authoritative, privileged, audited
    (invariant: client input never authoritatively sets role/status). Keep human-gated.
  - **[AUTO]** Bulk actions (with confirmation + audit) and role-based list filters
    are safe additions; no role/status is silently auto-set.

### 13. Footer (`/footer`)
- Full CMS editor: company details, social links, link columns.
  - This is inherently manual content entry. **[AUTO]** Live preview and validated
    internal-href enforcement (already noted). No business invariant involved.

### 14. Audit logs (`/audit`)
- Read-only list + `↻ Refresh`.
  - **[AUTO]** Auto-refresh, date/actor/action filters, CSV export.

## Cross-cutting automation opportunities (prioritized)

1. **Row-action buttons + contextual prefill instead of raw-UUID forms**
   (Acquisition, Shipment, Returns, Warranty). Biggest manual-effort win.
2. **Server-derived money/date values**: COD amount, shipping charge, refund amount,
   warranty window, offer expiry — derive on the server from authoritative sources;
   show as read-only/pre-filled, not typed.
3. **Auto-refresh/polling** for all read-only lists (Overview, Audit, and every
   "Recent …" table) instead of a manual Refresh button.
4. **Auto-select inspection template** from the item's category in the Inspect modal.
5. **Auto-generate listing slug** from model name (server-side), and pre-fill a
   suggested list price from the indicative range.
6. **Event-driven notifications** for business lifecycle events, keeping manual
   creation only for ad-hoc broadcasts.
7. **Bulk import/CSV** for catalog models/attributes and indicative quote ranges.
8. **Version auto-increment + template cloning** in Verification.

## Must remain manual (invariants + hard stops)

- Physical inspection result entry (Pass/Fail) and evidence capture.
- Supervisor approve/reject, especially reasoned critical-fail override.
- Price, totals, valuation, agreed offer amount, role, status, grade, warranty
  eligibility: server-authoritative, human privileged (client never authoritative).
- "Mark acquisition paid" and "Settle refund": idempotent financial ops, privileged.
- Real payment credentials / provider activation / destination changes: hard stop.
- RBAC role/status changes: privileged + audited.

## Result

- Admin headed browser A→Z walk: **18/18 checks passed**.
- No code changed; this is an audit/report task.
