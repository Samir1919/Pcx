# Handoff: E6 Acquisition Payment (server-owned PENDING → PAID)

- Status: Complete
- Agent: Cline orchestrator
- Branch: `main`
- Task spec: `docs/tasks/E6_ACQUISITION_PAYMENT.md`
- Related handoff: `docs/handoffs/E6_ACQUISITION_OFFER.md`

## Objective

Add the server-owned acquisition payment transition: an acquisition created as `PENDING` can be marked `PAID` by an authorized operator. Mirrors the order-payment `confirmPayment` pattern and keeps payment state server-owned (client never sets it).

## Acceptance criteria (all met)

- [x] `markAcquisitionPaid` domain transition only allows PENDING → PAID.
- [x] Repository `markPaid` update is atomic (transactional, guarded by `payment_status = 'PENDING'`) and returns the updated record.
- [x] Service `markAcquisitionPaid` is permission-gated (PRICING_MANAGE / ACQUISITION_PAYMENT_MANAGE).
- [x] HTTP route `POST /api/v1/admin/acquisitions/:id/pay` is CSRF/origin protected and returns 201 with the updated record.
- [x] `npm run verify:e0` and `npm test` pass.

## Changed files

- `packages/domain/src/acquisition/valuation-offer.mjs` — added `markAcquisitionPaid` transition.
- `packages/domain/src/index.mjs` — exported `markAcquisitionPaid`.
- `apps/api/src/modules/acquisition/postgres-acquisition-repository.mjs` — added `markPaid(acquisitionId, now)`.
- `apps/api/src/modules/acquisition/acquisition-service.mjs` — added `markAcquisitionPaid(accessCredential, acquisitionId)` and required `markPaid` on the repository.
- `apps/api/src/modules/acquisition/acquisition-http.mjs` — added route `POST /api/v1/admin/acquisitions/:id/pay`.
- `packages/domain/test/valuation-offer.test.mjs` — domain test.
- `apps/api/test/acquisition-service.test.mjs` — service test.
- `apps/api/test/acquisition-http.test.mjs` — HTTP test.
- `docs/tasks/E6_ACQUISITION_PAYMENT.md` — task spec.
- `docs/status/PROJECT_STATUS.md` — E6 epic row + verification baseline updated.

## Tests / results

- Domain: `markAcquisitionPaid` PENDING→PAID ok; PAID→PAID rejected; null rejected. Pass.
- Service: permission gate, not-payable state, success. Pass.
- HTTP: route match, CSRF enforcement, invalid-state mapping. Pass.
- `npm run verify:e0`: 36 required artifacts verified.
- `npm test`: 213 tests, 191 pass, 0 fail, 22 skipped (PostgreSQL integration, no `TEST_DATABASE_URL`).

## Decisions / ADRs

- No new ADR. Follows ADR 0001 (modular monolith), ADR 0002 (PostgreSQL source of truth), ADR 0003 (server-side auth boundary).
- Payment state is server-owned; the client never supplies `paymentStatus` or amount.

## Risks / blockers

- None. Real payment gateway integration remains a hard stop (out of scope).

## Next dependency-ready work

- E6 cost allocation ledger.
- E6 seller accept/reject endpoints.
- Real payment gateway (hard stop).

## Branch / commit

- Branch: `main`
- Latest commit: to be recorded after merge.
