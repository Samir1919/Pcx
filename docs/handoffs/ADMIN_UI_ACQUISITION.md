# Agent Handoff: Admin UI — Acquisition Workflow

- Status: Complete
- Branch: agent/admin-ui-listing
- Latest commit: 306daef
- Date: 2026-08-18

## Outcome

Admin panel-এ Acquisition workspace যুক্ত হয়েছে। Admin এখন PRICING_MANAGE /
ACQUISITION_PAYMENT_MANAGE অনুমতি নিয়ে valuation, offer, accept, acquisition
create, এবং mark-acquisition-paid endpoint-গুলো invoke করতে পারে।

## Changed areas

- `apps/admin/lib/acquisition-api.js` — five client functions।
- `apps/admin/app/(workspace)/acquisition/page.js` — five forms।
- `apps/admin/app/user-shell.js` — "Acquisition" nav entry + icon।
- `apps/admin/test/acquisition-api.test.mjs` — path/CSRF/no-client-owned-agreed-price test।

## Acceptance criteria

- [x] Admin can invoke all five endpoints from UI।
- [x] Client never sets agreedPrice/status (test asserts both undefined)।
- [x] Server errors surface in UI notice (shared run() catches ApiError)।

## Verification

| Command | Result |
|---|---|
| `node --test apps/admin/test/acquisition-api.test.mjs` | Pass (1/1) |
| `npm run verify` | Pass (377 pass, 0 fail, 22 skipped) |

## Architecture/security review

- All POST use Origin + CSRF double-submit gate।
- PRICING_MANAGE/ACQUISITION_PAYMENT_MANAGE server-enforced।
- Agreed price derives from accepted offer server-side; client sends only offer
  amount on offer creation (an invite input, not an authoritative financial fact)।

## Schema/configuration/deployment

None।

## Remaining work and next safe action

Slices 5–8 (shipment, return, warranty, notifications)।

## Blockers requiring human decision

None।
