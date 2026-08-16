# Task: E1 Identity Action HTTP Boundary

- Status: Complete
- Owner/agent: Codex orchestrator
- Branch: `agent/e1-identity-action-http`
- Risk: Security-sensitive
- Related epic: E1
- Related ADRs: ADR 0003

## Objective

Expose contact verification and password reset actions through the versioned auth HTTP boundary with enumeration-safe responses and stable security errors.

## Scope

- POST verify-contact, forgot-password, and reset-password.
- Exact origin, bounded JSON, field allow-lists, stable errors, cookie clearing after reset.
- Inject identity-action service separately from login/session auth service.

## Non-scope

- Provider credentials/delivery implementation, MFA, production configuration.

## Acceptance criteria

- [x] Requests accept only documented bounded fields.
- [x] Forgot-password always returns 202 accepted for processed requests.
- [x] Invalid action tokens map to one non-leaking error.
- [x] Successful reset clears all browser auth cookies.
- [x] Missing action service fails closed with 503.

## Security and test plan

Exact origin checks; no tokens/passwords in responses; targeted HTTP tests plus `npm run verify`.

## Migration and rollback

None.

## Prohibited changes / hard stops

No production provider/configuration, credential exposure, or security-control weakening.
