/**
 * DeepSeek executor adapter.
 *
 * Implements the vendor-neutral executor contract (ADR 0007) using the DeepSeek
 * chat-completions API. The executor sends a bounded task description to
 * DeepSeek and maps the model's structured response into allow-listed artifacts.
 *
 * The API key, model, and endpoint are read from environment variables
 * (`DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `DEEPSEEK_ENDPOINT`) so secrets never
 * appear in source, logs, or artifacts. `DEEPSEEK_ENDPOINT` is optional and
 * defaults to the official DeepSeek chat-completions URL; set it to an
 * OpenAI-compatible aggregator endpoint when routing a model variant such as
 * `deepseek-v4-pro` that the official endpoint does not serve. A `fetchImpl` may
 * be injected for deterministic testing; the default uses the global `fetch`.
 * When no API key is present the factory throws, so a real run fails fast
 * instead of silently degrading.
 *
 * This adapter never performs a hard-stop action and only emits allow-listed
 * artifacts, so it is safe to run locally or in CI (with a mocked fetch).
 */
import { validateExecutorResult } from "./control-plane.mjs";

const asNonEmptyString = (value, field) => {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} must be a non-empty string`);
  return value.trim();
};

const DEFAULT_ENDPOINT = "https://api.deepseek.com/chat/completions";

// Some deepseek model-serving paths leak their reserved tool-call template
// tokens back as plain assistant text (the `｜` fullwidth bars plus
// `<invoke>`/`<tool_calls>` wrappers). The repo's executor is prompt-based and
// expects a single JSON object, so that text is a smoking gun for a broken
// tool-calling/harness configuration. Rather than looping on an unparseable
// response, fail fast with a specific, non-retryable error naming the cause.
const assertNoLeakedToolCalls = (content) => {
  if (content.includes("\uFF5C") || /<\s*(?:invoke|tool_calls|tool)\b/i.test(content)) {
    const error = new Error("DeepSeek returned leaked tool-call syntax instead of JSON; the model endpoint is emitting its reserved special tokens (fullwidth bars / <invoke>/<tool_calls>). Point DEEPSEEK_ENDPOINT at an endpoint that implements native tool calling, or use a model variant that does not emit these tokens.");
    error.retryable = false;
    throw error;
  }
};

/**
 * Builds the DeepSeek executor. Reads credentials from the environment unless
 * explicitly overridden (for tests). Returns an async function matching the
 * executor contract: `({ task, actions, attempt, signal }) => { artifacts }`.
 */
export const createDeepSeekExecutor = ({
  apiKey = process.env.DEEPSEEK_API_KEY,
  model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
  endpoint = process.env.DEEPSEEK_ENDPOINT ?? DEFAULT_ENDPOINT,
  fetchImpl = fetch,
  timeoutMs = 120_000
} = {}) => {
  const key = asNonEmptyString(apiKey, "DEEPSEEK_API_KEY");
  const safeModel = asNonEmptyString(model, "DEEPSEEK_MODEL");
  if (typeof fetchImpl !== "function") throw new Error("fetchImpl must be a function");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000) throw new Error("timeoutMs must be a positive integer");

  return async ({ task, actions = [], attempt = 1, signal } = {}) => {
    if (!task || typeof task !== "object") throw new Error("task must be an object");
    const prompt = [
      "You are a coding agent working on the PCX repository.",
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
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`
        },
        body: JSON.stringify({
          model: safeModel,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
          response_format: { type: "json_object" }
        }),
        signal: controller.signal
      });
      if (!response.ok) {
        const error = new Error(`DeepSeek API error: ${response.status}`);
        error.retryable = response.status >= 500 || response.status === 429;
        throw error;
      }
      const payload = await response.json();
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || content.trim() === "") throw new Error("DeepSeek returned no content");
      assertNoLeakedToolCalls(content);
      const parsed = JSON.parse(content);
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
