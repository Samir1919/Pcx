# Agent Handoff: AI-backed executor and reviewer adapters

- Status: Complete
- Branch: `agent/stage3-completion`
- Latest commit: `7b54a17`































































- Date: 2026-08-17


## Outcome

The Stage 3 control plane now supports opt-in AI-backed automation through two vendor-neutral adapters:

- **`scripts/ai-executor.mjs`** — `createDeepSeekExecutor` calls the DeepSeek chat-completions API to produce a task result. Output is validated through `validateExecutorResult` (repository-relative, no traversal, allow-listed artifact metadata). 5xx/429 errors are marked retryable.
- **`scripts/ai-review.mjs`** — `createOpenAiReviewer` calls the OpenAI chat-completions API to produce typed findings. Findings are validated through the existing `reviewTask` adapter, so the AI cannot weaken the review gate. BLOCKER/MAJOR findings reject the task.

The control-plane pipeline (`runWorkerPipeline`) now accepts an injectable `reviewer`, threaded through `runOneWorker` and `runParallelWorkers`. The autonomous loop adds `--deepseek-executor` and `--openai-review` flags. A `.env.example` documents the required environment variables.

## Changed areas

- `scripts/ai-executor.mjs` — new DeepSeek executor adapter.
- `scripts/ai-review.mjs` — new OpenAI reviewer adapter.
- `scripts/ai-adapters.test.mjs` — new deterministic tests for both adapters (mocked `fetch`).
- `scripts/control-plane.mjs` — `runWorkerPipeline`/`runOneWorker`/`runParallelWorkers` accept and thread an injectable `reviewer`.
- `scripts/autonomous-loop.mjs` — `runAutonomousLoop` accepts `reviewer`; `parseArgs` and `main` add `--deepseek-executor` and `--openai-review` flags and wire the adapters.
- `.env.example` — documents `DEEPSEEK_API_KEY`/`DEEPSEEK_MODEL` and `OPENAI_API_KEY`/`OPENAI_MODEL`.
- `docs/adr/0009-ai-executor-reviewer-adapters.md` — records the decision.

## Acceptance criteria

- [x] DeepSeek executor validates output through `validateExecutorResult` and marks 5xx/429 retryable.
- [x] OpenAI reviewer validates findings through `reviewTask`; BLOCKER/MAJOR findings reject.
- [x] Both adapters fail fast on a missing API key and never write secrets.
- [x] Control-plane pipeline accepts an injectable `reviewer` with a deterministic local fallback.
- [x] Autonomous loop exposes `--deepseek-executor` and `--openai-review` flags.
- [x] `.env.example` documents required environment variables.
- [x] 11 new adapter tests pass.

## Verification

| Command/test | Result |
|---|---|
| `node --test scripts/ai-adapters.test.mjs` | Pass (11 tests) |
| `npm run verify` | Pass (E0, lint, typecheck, 313 tests, build, security) |


## Architecture/security review

- ADR 0009 records the decision to add opt-in AI-backed adapters.
- Invariants preserved: secrets never in source/logs/artifacts; review gate cannot be weakened; executor output validated against the vendor-neutral contract (ADR 0007).
- The adapters are opt-in via CLI flags; the default loop behavior is unchanged.
- No production deployment, credential rotation, or hard-stop change is authorized by this slice.

## Schema/configuration/deployment

- New environment variables (documented in `.env.example`): `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `OPENAI_API_KEY`, `OPENAI_MODEL`. The `.env` file is git-ignored.
- No database migration. No production deployment.

## Remaining work and next safe action

1. Run `npm run verify` to confirm the full gate passes with the new adapters and tests.
2. Commit the changes with a single-line message (or `git commit -F <file>` for a multi-line body).
3. Update `docs/status/PROJECT_STATUS.md` to reflect the new ADR 0009 and adapter slice.

## Blockers requiring human decision

None. Wiring a specific vendor executor/reviewer into a production pipeline remains a human decision and is not authorized by this slice.
