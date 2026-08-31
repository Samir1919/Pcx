# Handoff: acquisition -> inventory intake + cost allocation

- Branch: main (unmerged at time of writing)
- Scope: after mark-paid, register the acquired item into inventory (RECEIVED)
  from the acquisition detail modal, linking acquisitionId and allocating the
  agreed price as server-derived acquisition cost (migration 0036).
- Acceptance: npm run verify passes (557 tests, 0 fail); headed e2e 16/16
  including per-step status + register-item + PCX ID checks.
- Changed: inventory domain/repository/service (acquisitionCost + resolver),
  acquisition repository/service (findAcquisitionById/getAcquisitionAgreedPrice),
  auth-runtime wiring, migration 0036, admin sell-request-modal (register form),
  e2e script, tests.
- Decisions: cost is server-derived from the linked acquisition; intake links
  acquisitionId so the inventory item is traceable to its acquisition.
- Risks: none material. Cost allocation stays best-effort (null if resolver fails).
- No blockers.
