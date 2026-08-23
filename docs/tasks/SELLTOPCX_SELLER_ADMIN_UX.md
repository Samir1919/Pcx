# Task: Sell-to-PCX seller/admin UX completion (A→D)

- Status: In progress
- Owner/agent: Cline
- Branch: `agent/selltopcx-seller-admin-ux`
- Risk: Medium (RBAC, ownership, profile/password)

## Objective

Fix the Sell-to-PCX seller/admin flow to match approved specs:

- A: real submit (DRAFT→SUBMITTED); admin queue excludes DRAFT; admin cannot submit drafts.
- B: seller can see own requests + offer amount + accept/reject.
- C: admin can view a sell request's full detail.
- D: profile page (customer/seller/merchant) with CRUD + password change; sell-form name/phone persisted to profile.

## Source-of-truth

- `BUSINESS_PRODUCT_REQUIREMENTS.md` §4.2, §12
- `API_SPECIFICATION_STATE_MACHINES.md` §16
- `USER_FLOW_SCREEN_MAP.md` §14 (S10–S14)
- ADR 0011

## Acceptance criteria

- [ ] seller submit → SUBMITTED; admin queue shows it, no DRAFT
- [ ] admin cannot submit someone's draft
- [ ] admin views sell-request detail
- [ ] seller sees own requests + offer + accept/reject
- [ ] seller name/phone saved to profile; profile page CRUD + password change
