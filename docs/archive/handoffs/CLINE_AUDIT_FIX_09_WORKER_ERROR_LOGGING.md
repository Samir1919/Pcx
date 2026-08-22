# Agent Handoff: CLINE_AUDIT_FIX_09 — Worker tick errors are never swallowed

- Status: Complete
- Branch: `agent/stage3-completion`
- Latest commit: cac1462
- Date: 2026-08-17

## Outcome

Worker tick exceptions are no longer silently discarded: `startWorker` now
defaults `onError` to `console.error`, and `main.mjs` passes it explicitly.

## Changed areas

- `apps/worker/src/worker.mjs`: default `onError = console.error`.
- `apps/worker/src/main.mjs`: explicit `onError: console.error`.
- `apps/worker/test/worker.test.mjs`: added a test proving the default logs
  instead of swallowing.

## Acceptance criteria

- [x] Default onError logs tick errors.
- [x] Explicit onError still honored.

## Verification

| Command/test | Result |
|---|---|
| `node --test apps/worker/test/worker.test.mjs` | 6/6 pass |
| `npm test` | 337 pass, 22 skip, 0 fail |

## Architecture/security review

Observability improvement only.

## Schema/configuration/deployment

None.

## Remaining work and next safe action

- Item #10: worker reaches directly into apps/api internals.

## Blockers requiring human decision

Item #8 (dispatcher wiring) remains blocked pending a human choice.

Item #10 may involve a human decision if moving shared code into a package is
preferred over an alternative smoke test.
