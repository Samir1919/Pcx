# ADR 0009: AI-backed executor and reviewer adapters

- Status: Accepted
- Date: 2026-08-17

## Context

The Stage 3 control plane (ADR 0008) provides a vendor-neutral executor contract (ADR 0007) and a deterministic local review adapter. To exercise the control plane with real AI-backed automation, we need concrete adapters that call external model APIs while preserving the invariants: secrets never appear in source/logs/artifacts, the review gate cannot be weakened, and the executor output is validated against the vendor-neutral contract.

## Decision

Introduce two optional, opt-in adapters wired into the autonomous loop via CLI flags:

- **`scripts/ai-executor.mjs`** — `createDeepSeekExecutor`: calls the DeepSeek chat-completions API to produce a task result. Reads `DEEPSEEK_API_KEY`/`DEEPSEEK_MODEL` from the environment (overridable for tests). The model's `artifactPath` is validated through `validateExecutorResult` (repository-relative, no traversal, allow-listed artifact metadata) before it is trusted. API errors are marked retryable for 5xx/429 so the bounded runner can retry.
- **`scripts/ai-review.mjs`** — `createOpenAiReviewer`: calls the OpenAI chat-completions API to produce typed findings. Reads `OPENAI_API_KEY`/`OPENAI_MODEL` from the environment (overridable for tests). The model's findings are validated through the existing `reviewTask` adapter, so the AI cannot weaken the gate or inject malformed/secret-bearing findings. BLOCKER/MAJOR findings reject the task.

Both adapters:
- Accept an injectable `fetchImpl` for deterministic testing; the default uses the global `fetch`.
- Fail fast when the required API key is missing (never silently degrade).
- Never write secrets to source, logs, or artifacts.

The control-plane pipeline (`runWorkerPipeline`) now accepts an injectable `reviewer`. When provided, it is awaited in place of the deterministic local `reviewTask`; otherwise the local adapter is used. The `reviewer` is threaded through `runOneWorker` and `runParallelWorkers`.

The autonomous loop (`scripts/autonomous-loop.mjs`) adds two opt-in flags:
- `--deepseek-executor` — use the DeepSeek executor.
- `--openai-review` — use the OpenAI reviewer.

A `.env.example` documents the required environment variables. The `.env` file is git-ignored.

## Cost and maintenance owner

- Owner: repository maintainers (human) with autonomous agents as contributors.
- Cost: the adapters are opt-in and only active when the corresponding flag is passed. They add no runtime dependency to the default loop. API usage is metered by the external provider and is the operator's responsibility.

## Rollout and rollback

- Rollout: adapters are opt-in via CLI flags; the default loop behavior is unchanged. Each adapter is covered by deterministic tests with a mocked `fetch`.
- Rollback: remove the flags or the environment variables; the loop falls back to the deterministic local executor/reviewer. No business data migration is required.

## Success metrics

- 100% of AI-backed runs validate executor output and review findings through the existing adapters.
- 0 secrets in source, logs, or artifacts.
- 0 review-gate weakenings: BLOCKER/MAJOR findings always reject.
- Missing API keys fail fast rather than silently degrading.

## Controls that remain manual

Production deployment, production credentials/secrets, payment destinations, destructive migrations, customer-data deletion, core invariant/source-of-truth changes, and material security-policy changes remain human approval gates under `AGENTS.md`. Wiring a specific vendor executor or reviewer into a production pipeline remains a human decision.

## Approval

Accepted for bounded local/CI implementation by the human instruction to proceed and continue. Acceptance authorizes the opt-in adapters as recorded here, but does not authorize production deployment, wiring a specific vendor executor into production, or any existing hard stop.
