# Handoff: sell-request status auto-advance + minimal status UI

- Branch: main (unmerged at time of writing)
- Scope: auto-advance the sell-request status on every offer/acquisition event
  (create offer -> OFFERED, accept -> ACCEPTED, seller decline -> REJECTED_BY_SELLER,
  create acquisition -> ACQUISITION_PENDING, mark paid -> PAID) atomically in the
  acquisition repository; collapse the web seller statuses to a short set; add
  an admin human-readable status label + a status stepper in the detail modal.
- Acceptance: npm run verify passes (582 tests, 0 fail); headed e2e
  (scripts/acquisition-flow-e2e-check.mjs) 14/14 including per-step status checks.
- Changed: postgres-acquisition-repository.mjs (transitionSellRequest + event hooks),
  acquisition-service.mjs (rejectOffer now), sell-requests page (minimal labels),
  admin sell-request-status.js (new helper), acquisition page + sell-request-modal
  (label + stepper), e2e script, tests.
- Decisions: sell-request status is a server-owned projection auto-advanced
  optimistically (only from the exact expected source state) inside the same
  transaction as the offer/acquisition mutation.
- Risks: none material; auto-advance is best-effort so an admin manual transition
  is never overwritten.
- No blockers.
