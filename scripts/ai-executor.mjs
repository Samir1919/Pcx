/**
 * Provider-neutral AI executor adapters.
 *
 * `createProviderExecutor` implements the vendor-neutral executor contract
 * (ADR 0007) for any registered provider (DeepSeek, OpenAI, Anthropic, Kimi).
 * It sends a bounded task description to the provider and maps the model's
 * structured response into allow-listed artifacts validated by
 * `validateExecutorResult`.
 *
 * Reasoning-capable providers (e.g. `deepseek-v4-pro` with `thinking` enabled)
 * can leak their native tool-call tokens instead of emitting the requested JSON.
 * The executor detects that once and retries a single time with thinking
 * disabled (deterministic `reply_format: json_object`), so the provider remains
 * usable without looping. It never exceeds one fallback attempt.
 *
 * `createDeepSeekExecutor` is kept as a thin, backward-compatible wrapper over
 * `createProviderExecutor`, preserving its historical option names
 * (`apiKey`/`model`/`endpoint`/`thinkingEnabled`/`reasoningEffort`) for existing
 * callers and tests.
 *
 * All credentials/models/endpoints are read from environment variables by the
 * provider registry (`ai-providers.mjs`) unless explicitly overridden; secrets
 * never appear in source, logs, or artifacts. When a required key is missing the
 * factory throws, so a real run fails fast instead of silently degrading.
 *
 * This adapter never performs a hard-stop action and only emits allow-listed
 * artifacts, so it is safe to run locally or in CI (with a mocked fetch).
 */
import { buildChatRequest, extractContent, parseProviderJson, resolveProvider } from "./ai-providers.mjs";
import { validateExecutorResult } from "./control-plane.mjs";

const asNonEmptyString = (value, field) => {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} must be a non-empty string`);
  return value.trim();
};

const DEFAULT_ENDPOINT = "https://api.deepseek.com/chat/completions";
const REASONING_EFFORTS = new Set(["low", "medium", "high"]);

/**
 * Builds a provider-backed executor. `provider` may be a pre-resolved config
 * (for tests); otherwise it is resolved from the environment by `name`.
 */
export const createProviderExecutor = ({
  name = "deepseek",
  provider,
  fetchImpl = fetch,
  timeoutMs = 120_000
} = {}) => {
  const resolved = provider ?? resolveProvider({ name });
  if (!resolved || typeof resolved !== "object") throw new Error("provider must be a resolved provider config");
  if (typeof fetchImpl !== "function") throw new Error("fetchImpl must be a function");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000) throw new Error("timeoutMs must be a positive integer");
  if (resolved.reasoningEffort != null && !REASONING_EFFORTS.has(resolved.reasoningEffort)) throw new Error("reasoningEffort must be low, medium, or high");

  // Perform a single completion with a given provider config and return the
  // extracted assistant text.
  const complete = async (config, user, controller) => {
    const { body, headers } = buildChatRequest(config, {
      system: "You are a coding agent working on the PCX repository.",
      user
    });
    const response = await fetchImpl(config.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!response.ok) {
      const error = new Error(`${config.name} API error: ${response.status}`);
      error.retryable = response.status >= 500 || response.status === 429;
      throw error;
    }
    const payload = await response.json();
    return extractContent(payload);
  };

  return async ({ task, actions = [], attempt = 1, signal } = {}) => {
    if (!task || typeof task !== "object") throw new Error("task must be an object");
    const user = [
      `Task id: ${task.id}`,
      `Owner: ${task.owner}`,
      `Scope: ${(task.scope ?? []).join(", ")}`,
      `Affected paths: ${(task.affectedPaths ?? []).join(", ")}`,
      `Tests: ${(task.tests ?? []).join(", ")}`,
      `Allowed actions: ${actions.join(", ")}`,
      "Respond with a single JSON object: {\"summary\": \"<one line>\", \"artifactPath\": \"<repository-relative path>\"}."
    ].join("\n");

    const controller = new AbortController();
    let timer;
    const onAbort = () => controller.abort(signal?.reason ?? "aborted");
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      timer = setTimeout(() => controller.abort("timeout"), timeoutMs);

      let parsed;
      const content = await complete(resolved, user, controller);
      try {
        parsed = parseProviderJson(content);
      } catch (error) {
        // Self-heal once: reasoning models may emit tool-call syntax or other
        // non-JSON reasoning text. Retry a single time with reasoning disabled
        // (deterministic `response_format: json_object`). Never exceeds one
        // fallback attempt, so a genuinely broken provider still fails fast.
        if (resolved.thinkingEnabled) {
          const fallback = Object.freeze({ ...resolved, thinkingEnabled: false, reasoningEffort: null });
          parsed = parseProviderJson(await complete(fallback, user, controller));
        } else {
          throw error;
        }
      }

      const artifactPath = asNonEmptyString(parsed.artifactPath, "artifactPath");
      const result = { artifacts: [{ type: "commit", path: artifactPath, status: "ok" }] };
      // Enforce the vendor-neutral executor contract (ADR 0007): secret-free,
      // repository-relative, verifiable output.
      return validateExecutorResult(result, { requireArtifacts: true });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  };
};

/**
 * Backward-compatible DeepSeek executor factory. Accepts the historical option
 * names and delegates to `createProviderExecutor`.
 */
export const createDeepSeekExecutor = (options = {}) => {
  const {
    apiKey,
    model,
    endpoint,
    thinkingEnabled,
    reasoningEffort,
    fetchImpl = fetch,
    timeoutMs = 120_000
  } = options;
  // Preserve the original fail-fast contract: an explicitly-supplied empty key
  // must throw at construction time.
  if (apiKey !== undefined) asNonEmptyString(apiKey, "DEEPSEEK_API_KEY");

  let base;
  try {
    base = resolveProvider({ name: "deepseek" });
  } catch {
    base = {
      name: "deepseek",
      auth: "bearer",
      apiKey: apiKey ?? process.env.DEEPSEEK_API_KEY,
      model: model ?? process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
      endpoint: endpoint ?? process.env.DEEPSEEK_ENDPOINT ?? DEFAULT_ENDPOINT,
      thinkingEnabled: thinkingEnabled ?? process.env.DEEPSEEK_THINKING === "enabled",
      reasoningEffort: reasoningEffort ?? process.env.DEEPSEEK_REASONING_EFFORT ?? null
    };
  }

  const provider = Object.freeze({
    ...base,
    ...(apiKey !== undefined ? { apiKey } : {}),
    ...(model !== undefined ? { model } : {}),
    ...(endpoint !== undefined ? { endpoint } : {}),
    ...(thinkingEnabled !== undefined ? { thinkingEnabled } : {}),
    ...(reasoningEffort !== undefined ? { reasoningEffort } : {})
  });

  // Preserve the original fail-fast contract even when the registry is bypassed
  // (e.g. no DEEPSEEK_API_KEY in the environment): a missing key must throw now.
  asNonEmptyString(provider.apiKey, "DEEPSEEK_API_KEY");

  return createProviderExecutor({ provider, fetchImpl, timeoutMs });
};
