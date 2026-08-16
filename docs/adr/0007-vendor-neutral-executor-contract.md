# ADR 0007: Vendor-neutral external-agent executor contract

- Status: Accepted
- Date: 2026-08-17

## Context

The Stage 3 control plane (`scripts/control-plane.mjs`) runs bounded tasks through an injected executor. Today the default executor in `scripts/autonomous-loop.mjs` is a synthetic no-op that only emits an allow-listed synthetic commit artifact. The roadmap and handoffs identify wiring a real external agent (e.g. Cline or DeepSeek) as the next slice, but no vendor-neutral contract exists yet. Without an explicit contract, a vendor-specific executor could:

- return artifacts or metadata that leak secrets, credentials, customer data, or private evidence;
- attempt actions outside the default-deny policy;
- report success without producing verifiable artifacts;
- depend on hidden vendor state, breaking the portable, repository-native truth model.

The repository principle is vendor-neutral: no implementation may depend on hidden model memory or a vendor-only planning artifact. The executor contract must therefore be defined and validated independently of any specific vendor.

## Decision

Adopt a vendor-neutral external-agent executor contract. Any external agent executor (Cline, DeepSeek, or future automation) must conform to this contract to be wired into the control plane.

### Executor invocation

An executor is an async function invoked by the bounded runner as:

```js
executor({ task, actions, attempt, signal })
```

- `task` — the validated task object (id, owner, scope, affectedPaths, tests, risk, prohibitedActions, maxAttempts, timeoutMs, budgetUnits).
- `actions` — the allow-listed, policy-checked action names the runner permits for this attempt.
- `attempt` — the 1-based attempt number.
- `signal` — an `AbortSignal` that the runner aborts on timeout or cancellation.

### Executor result

The executor must resolve to an object:

```js
{ artifacts: [{ type, path, status }] }
```

- `artifacts` — an array of at most 100 entries.
- Each artifact has exactly three fields:
  - `type` — a non-empty string (e.g. `commit`, `test`, `handoff`).
  - `path` — a repository-relative path without traversal (`..`) or absolute paths.
  - `status` — a non-empty string (e.g. `ok`, `failed`).

### Contract rules

1. **Default-deny preserved.** The runner evaluates every requested action against the default-deny policy and hard-stop patterns before invoking the executor. The executor itself must not perform any action outside the declared `actions`.
2. **Secret-free output.** Artifacts may contain only `type`, `path`, and `status`. Any other field is rejected. No credentials, secrets, raw prompts, customer data, or private evidence may be returned.
3. **Repository-relative paths.** Artifact paths must be repository-relative and reject absolute paths and `..` traversal.
4. **No authority broadening.** The executor cannot approve production policy, deploy, change credentials/payment destinations, run destructive migrations, delete customer/production data, weaken tests/security, or change core invariants. Those remain hard stops.
5. **Verifiable output.** A PASSED task must produce at least one artifact. An executor that returns no artifacts for a PASSED task is a contract violation.
6. **Deterministic validation.** A `validateExecutorResult` helper validates the executor's output against this contract and throws on violation, so any vendor executor can be checked before its output is trusted.

### Validation helper

`scripts/control-plane.mjs` exposes `validateExecutorResult(result)` which:

- requires `result` to be an object;
- requires `result.artifacts` to be an array of at most 100 entries;
- requires each artifact to have exactly `type`, `path`, `status` (rejecting any other field);
- requires `type` and `status` to be non-empty strings;
- requires `path` to be repository-relative without traversal;
- requires at least one artifact for a PASSED task (caller passes `{ requireArtifacts: true }`).

## Alternatives considered

### Wire a specific vendor (Cline/DeepSeek) directly

Rejected. It would couple the control plane to a vendor CLI/API, contradict the vendor-neutral principle, and make durable truth depend on hidden vendor state. The contract must be defined first.

### Keep the executor unvalidated

Rejected. An unvalidated executor could leak secrets or report success without verifiable artifacts, undermining auditability and the default-deny model.

### Define the contract only in prose

Rejected. A machine-checkable validation helper is required so the contract is enforced, not merely documented.

## Consequences

### Positive

- Any vendor executor can be wired safely behind a validated, vendor-neutral contract.
- Secret-free, repository-relative, verifiable output is enforced deterministically.
- Default-deny policy and hard stops remain machine-enforceable.
- Portable, repository-native truth is preserved.

### Negative

- Vendor executors must conform to the contract, which may require a thin adapter for a vendor whose native output differs.
- The validation helper adds a small amount of tooling to maintain and test.

## Rollout and rollback

Roll out by adding the validation helper and tests, then wiring the default executor to use it. A future vendor executor must pass `validateExecutorResult` before its output is accepted. Rollback: remove the helper and revert to the unvalidated default executor.

## Success metrics

- 100% of executor results are validated against the contract.
- 0 secret-bearing or non-repository-relative artifacts accepted.
- 0 PASSED tasks without at least one artifact.
- Deterministic tests cover valid, invalid, secret-bearing, and traversal outputs.

## Controls that remain manual

Production deployment, production credentials/secrets, payment destinations, destructive migrations, customer-data deletion, core invariant/source-of-truth changes, and material security-policy changes remain human approval gates under `AGENTS.md`.

## Approval

Accepted for bounded local/CI implementation by the human instruction to proceed autonomously. Acceptance authorizes the vendor-neutral executor contract and validation helper, but does not authorize wiring any specific vendor or any existing hard stop.
