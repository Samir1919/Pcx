# Agent Handoff: AI token-usage guards + max_tokens cap

- Status: Complete
- Branch: `agent/token-usage-guards` (merged into `main`, branch deleted)
- Merge commit on `main`: `661a87c` (push confirmed to `origin/main`)
- Date: 2026-08-23

## Objective

শেষ কয়েকদিনে excessive token/bill খরচের কারণ অনুসন্ধানের পর (আসল কারণ: cline + `deepseek-v4-pro` টুল-কল মিসম্যাচের stuck loop, যা রেপোর বাইরের app-level setting), রেপোর ভেতরে two mitigation যোগ করা হয়েছে:

1. প্রতি call-এ `max_tokens` output cap (runaway generation আটকানো)।
2. Provider-এর `usage.prompt_tokens/completion_tokens` secret-free ভাবে durable log/report-এ surface করা, যাতে ভবিষ্যতে token কোথায় যাচ্ছে দেখা যায়।

মাল্টি-এজেন্ট লুপ আসলেই কোথাও LLM-backed চালানো হয়নি (`.worktrees/` খালি, `.env`-এ DeepSeek key-ই নেই, বাকি ৩ provider `_ENABLED=false`) — তাই bill আসল cline থেকেই; এ slice শুধু repo-side observability ও guard যোগ করে।

## Changed areas

- `scripts/ai-providers.mjs` — `resolveProvider` এখন `<PREFIX>_MAX_TOKENS` (1..128000) env override পড়ে; `buildChatRequest` OpenAI-compatible path-এ `max_tokens` cap যোগ (default 4096, thinking-on হলে 8192), Anthropic path-এও override respects হয়; new `extractUsage(payload)` helper (snake_case + camelCase দুটোই পড়ে)।
- `scripts/ai-executor.mjs` — `complete()` একটা `usage` accumulator-এ token ব্যবহার জমা করে; executor result-এ `usage` ফেরত; self-heal fallback-এর token-ও যোগ হয়।
- `scripts/control-plane.mjs` — `asUsage` (secret-free, শুধু `promptTokens`/`completionTokens`, unknown field ও negative/invalid reject); `validateExecutorResult`/`result`/`runBoundedTask`-এ usage passthrough; `LOG_ALLOWED_KEYS`-এ `promptTokens`/`completionTokens`; `appendRunRecord` usage map; `summarizeRuns`-এ `totalPromptTokens`/`totalCompletionTokens` ও perTask token aggregation (log-entry + worker-record দুটো shape accept করে)।
- `scripts/autonomous-loop.mjs` — report summary-তে `Total prompt tokens`/`Total completion tokens` লাইন।
- `.env.example` — `<PREFIX>_MAX_TOKENS` কন্ট্রাক্ট ডকুমেন্ট।
- Tests: `scripts/ai-providers.test.mjs` (cap/override/extractUsage), `scripts/ai-adapters.test.mjs` (executor usage accumulation incl. self-heal), `scripts/control-plane.test.mjs` (validateExecutorResult usage, runBoundedTask usage, appendRunRecord token map, summarizeRuns token aggregation)।

## Acceptance criteria

- [x] OpenAI-compatible provider-এ output cap আছে (default 4096, thinking-on 8192), `<PREFIX>_MAX_TOKENS` দিয়ে override করা যায়।
- [x] Provider response-এর token usage secret-freeভাবে executor result → log record → run report পর্যন্ত পৌঁছায়।
- [x] খারাপ usage (negative, non-integer, unknown field) reject হয়।
- [x] Related tests পাস, `npm run verify` পাস, merge-gate OK।

## Verification

| Command/test | Result |
|---|---|
| `node --test scripts/ai-providers.test.mjs scripts/ai-adapters.test.mjs scripts/control-plane.test.mjs scripts/autonomous-loop.test.mjs` | 109 pass, 0 fail |
| `npm run lint` | pass |
| `npm run verify` | pass: 500 pass, 0 fail, 26 skipped (DB), build pass, security pass |
| `node scripts/merge-gate.mjs` | `OK: main is merged into origin/main` |

## Architecture/security review

- No production deployment, destructive migration, credential/payment change, secret rotation, test/security weakening, framework replacement, or core invariant change (no hard stop triggered).
- Token counts are plain integers and never carry secrets; `asUsage` allow-lists only `promptTokens`/`completionTokens` and rejects any other field.
- Executor output still passes through `validateExecutorResult` (ADR 0007, repository-relative, secret-free).
- `max_tokens` is a secondary guard — it caps per-call output but does NOT stop a repeated tool-call loop. The actual loop cause is cline app-level tool-calling mode.

## Schema/configuration/deployment

- No migrations, no deployment.
- New optional env var `<PREFIX>_MAX_TOKENS` (e.g. `DEEPSEEK_MAX_TOKENS`, `OPENAI_MAX_TOKENS`), default 4096 (8192 with thinking on). Documented in `.env.example`.

## Remaining work / next safe action

1. (Human, repo-বাইরে) cline-এ `deepseek-v4-pro`-এর জন্য টুল-কল mode/match ঠিক করুন অথবা মডেল `deepseek-chat`-এ নামান — এটিই stuck-loop ও token burn-এর আসল সমাধান।
2. (Human, repo-বাইরে) cline-এ Auto Approve বন্ধ করুন; provider console-এ spend limit (DeepSeek-এ prepaid balance ছোট রাখা, OpenAI-এ hard limit) set করুন।
3. ভবিষ্যতে মাল্টি-এজেন্ট লুপ real LLM দিয়ে চালাতে চাইলে local `.env`-এ একটি provider-এর `API_KEY` + `_ENABLED=true` set করতে হবে (এখন কোনো active provider নেই)।

## Blockers requiring human decision

- cline tool-calling mode ও `deepseek-v4-pro` endpoint — app-level config, রেপোর বাইরে।
