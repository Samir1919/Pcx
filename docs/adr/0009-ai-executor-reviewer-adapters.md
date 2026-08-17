# ADR 0009: AI-backed executor and reviewer adapters

- Status: Accepted
- Date: 2026-08-17

## Context

The Stage 3 control plane (ADR 0008) provides a vendor-neutral executor contract (ADR 0007) and a deterministic local review adapter. To exercise the control plane with real AI-backed automation, we need concrete adapters that call external model APIs while preserving the invariants: secrets never appear in source/logs/artifacts, the review gate cannot be weakened, and the executor output is validated against the vendor-neutral contract.

## Decision

Introduce optional, opt-in AI adapters wired into the autonomous loop via CLI flags, behind a common provider registry.

**Provider registry** (`scripts/ai-providers.mjs`): `deepseek`, `openai`, `anthropic` (Claude Messages API), and `kimi` (Moonshot, OpenAI-compatible). Each provider is configured by `<PREFIX>_*` environment variables (`_API_KEY`, `_MODEL`, `_ENDPOINT`, `_ENABLED`, `_THINKING`, `_REASONING_EFFORT`) with the documented defaults. Setting `<PREFIX>_ENABLED=false` **holds** a provider — its config stays but selecting it fails fast, so operators can swap/hold providers without deleting credentials.

**Executor** (`scripts/ai-executor.mjs`):
- `createProviderExecutor({ name | provider })` implements the vendor-neutral executor contract (ADR 0007) for any registry provider. It emits a `system` + `user` message pair, adapts the request body/auth to the provider dialect (OpenAI-compatible bearer vs Anthropic `x-api-key`), maps the structured response to an `artifactPath`, and validates it through `validateExecutorResult` (repository-relative, no traversal, allow-listed metadata). API errors are marked retryable for 5xx/429. Responses containing leaked tool-call syntax (fullwidth-bar special tokens or `invoke`/`tool_calls` wrappers) fail fast with a specific, non-retryable error instead of looping. Native reasoning models (DeepSeek) can enable `thinking`/`reasoning_effort` via the shared env contract; when thinking is on, `response_format: json_object` is omitted because it conflicts on some serving paths.
- `createDeepSeekExecutor` is retained as a backward-compatible wrapper over `createProviderExecutor`.

**Reviewer** (`scripts/ai-review.mjs`):
- `createProviderReviewer({ name | provider })` reuses the same registry and returns a `reviewTask`-shaped result; findings are validated by the existing `reviewTask` adapter, so the AI cannot weaken the gate or inject malformed/secret-bearing findings. BLOCKER/MAJOR findings reject the task.
- `createOpenAiReviewer` is retained with its OpenAI-specific `previous_response_not_found` retry path.

All adapters accept an injectable `fetchImpl` for deterministic testing (default: global `fetch`), fail fast on a missing API key, and never write secrets to source, logs, or artifacts.

The autonomous loop (`scripts/autonomous-loop.mjs`) keeps the legacy opt-in flags and adds provider selection:
- `--deepseek-executor` / `--openai-review` (legacy)
- `--executor-provider <name>` / `--reviewer-provider <name>` (`deepseek | openai | anthropic | kimi`)

A `.env.example` documents the full provider matrix. The `.env` file is git-ignored. The autonomous loop driver loads `.env` itself (existing shell variables are never overwritten), so adapter settings are picked up without being exported by the caller.

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
