/**
 * AI review adapters.
 *
 * `createOpenAiReviewer` implements an AI-backed review step using the OpenAI
 * chat-completions API and retains OpenAI-specific `previous_response_id` retry
 * handling. `createProviderReviewer` reuses the same review contract for any
 * registered provider (DeepSeek, OpenAI, Anthropic, Kimi) via `ai-providers.mjs`.
 *
 * Both map the model's structured response into typed findings that are
 * validated by the existing `reviewTask` adapter (BLOCKER/MAJOR findings reject
 * the task). Secrets never appear in source, logs, or artifacts, and the AI can
 * never weaken the gate or inject malformed/secret-bearing findings.
 */
import { buildChatRequest, extractContent, parseProviderJson, resolveActiveProviders, resolveProvider } from "./ai-providers.mjs";
import { reviewTask } from "./control-plane.mjs";

const asNonEmptyString = (value, field) => {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} must be a non-empty string`);
  return value.trim();
};

const DEFAULT_ENDPOINT = "https://api.openai.com/v1/chat/completions";

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const stripPreviousResponseReference = (payload) => {
  if (!payload || typeof payload !== "object") return payload;
  const next = { ...payload };
  delete next.previous_response_id;
  delete next.previousResponseId;
  return next;
};

const isPreviousResponseNotFound = async (response) => {
  if (!response || response.ok || response.status !== 400) return false;
  let details;
  try {
    details = await response.json();
  } catch {
    return false;
  }
  const root = details?.error ?? details?.details ?? details;
  const code = typeof root?.code === "string" ? root.code : "";
  const param = typeof root?.param === "string" ? root.param : "";
  const message = typeof root?.message === "string" ? root.message : "";
  return code === "previous_response_not_found" || param === "previous_response_id" || /previous response/i.test(message);
};

const reviewPrompt = (task, checks) => [
  "You are a senior code reviewer for the PCX repository.",
  `Task id: ${task.id}`,
  `Owner: ${task.owner}`,
  `Scope: ${(task.scope ?? []).join(", ")}`,
  `Affected paths: ${(task.affectedPaths ?? []).join(", ")}`,
  `Tests: ${(task.tests ?? []).join(", ")}`,
  `Checks to verify: ${(checks ?? []).join(", ")}`,
  "Review for requirement coverage, invariants, authorization/ownership, concurrency, idempotency, sensitive-data exposure, compatibility, and unnecessary complexity.",
  "Respond with a single JSON object: {\"findings\": [{\"severity\": \"BLOCKER|MAJOR|MINOR|NIT\", \"code\": \"<short code>\", \"message\": \"<one line>\"}]}."
].join("\n");

/**
 * Builds a provider-backed reviewer. `provider` may be a pre-resolved config
 * (for tests); otherwise it is resolved from the environment by `name`.
 */
export const createProviderReviewer = ({
  name = "openai",
  provider,
  fetchImpl = fetch,
  timeoutMs = 120_000
} = {}) => {
  const resolved = provider ?? resolveProvider({ name });
  if (!resolved || typeof resolved !== "object") throw new Error("provider must be a resolved provider config");
  if (typeof fetchImpl !== "function") throw new Error("fetchImpl must be a function");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000) throw new Error("timeoutMs must be a positive integer");

  return async ({ task, checks = [] } = {}) => {
    if (!task || typeof task !== "object") throw new Error("task must be an object");
    const { body, headers } = buildChatRequest(resolved, {
      system: "You are a senior code reviewer for the PCX repository.",
      user: reviewPrompt(task, checks),
      temperature: 0.2
    });

    const controller = new AbortController();
    let timer;
    try {
      timer = setTimeout(() => controller.abort("timeout"), timeoutMs);
      const response = await fetchImpl(resolved.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (!response.ok) {
        const error = new Error(`${resolved.name} API error: ${response.status}`);
        error.retryable = response.status >= 500 || response.status === 429;
        throw error;
      }
      const payload = await response.json();
      const content = extractContent(payload);
      const parsed = parseProviderJson(content);
      const findings = Array.isArray(parsed.findings) ? parsed.findings : [];
      // Validate findings through the existing review adapter so the AI cannot
      // weaken the gate or inject malformed/secret-bearing findings.
      return reviewTask({ task, checks, findings });
    } finally {
      clearTimeout(timer);
    }
  };
};

/**
 * Builds a reviewer pool that load-balances tasks across the enabled providers.
 * Each task is deterministically hashed to one provider, so parallel review
 * work runs against different models concurrently. A held provider is skipped.
 */
export const createProviderPoolReviewer = ({
  names = ["deepseek", "openai", "anthropic", "kimi"],
  providers,
  fetchImpl = fetch,
  timeoutMs = 120_000
} = {}) => {
  const pool = Array.isArray(providers) ? providers : resolveActiveProviders({ names });
  if (pool.length === 0) throw new Error("no active AI providers");
  const byTask = new Map();

  const reviewerFor = (task) => {
    const id = task?.id;
    if (typeof id !== "string" || id.length === 0) throw new Error("task must have a non-empty id");
    if (byTask.has(id)) return byTask.get(id);
    let hash = 0;
    for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
    const reviewer = createProviderReviewer({ provider: pool[hash % pool.length], fetchImpl, timeoutMs });
    byTask.set(id, reviewer);
    return reviewer;
  };

  return async (context = {}) => reviewerFor(context.task)(context);
};

/**
 * OpenAI reviewer. Preserves the original option names and the
 * `previous_response_not_found` retry path for existing callers and tests.
 */
export const createOpenAiReviewer = ({
  apiKey = process.env.OPENAI_API_KEY,
  model = process.env.OPENAI_MODEL ?? "gpt-4o",
  endpoint = DEFAULT_ENDPOINT,
  fetchImpl = fetch,
  timeoutMs = 120_000,
  requestBodyExtras = {}
} = {}) => {
  const key = asNonEmptyString(apiKey, "OPENAI_API_KEY");
  const safeModel = asNonEmptyString(model, "OPENAI_MODEL");
  if (typeof fetchImpl !== "function") throw new Error("fetchImpl must be a function");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000) throw new Error("timeoutMs must be a positive integer");

  return async ({ task, checks = [] } = {}) => {
    if (!task || typeof task !== "object") throw new Error("task must be an object");
    const prompt = reviewPrompt(task, checks);

    const controller = new AbortController();
    let timer;
    try {
      timer = setTimeout(() => controller.abort("timeout"), timeoutMs);
      const post = (payload) => fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      let requestPayload = {
        model: safeModel,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        response_format: { type: "json_object" },
        ...requestBodyExtras
      };
      let response = await post(requestPayload);
      if (await isPreviousResponseNotFound(response) && (hasOwn(requestPayload, "previous_response_id") || hasOwn(requestPayload, "previousResponseId"))) {
        requestPayload = stripPreviousResponseReference(requestPayload);
        response = await post(requestPayload);
      }
      if (!response.ok) {
        const error = new Error(`OpenAI API error: ${response.status}`);
        error.retryable = response.status >= 500 || response.status === 429;
        throw error;
      }
      const payload = await response.json();
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || content.trim() === "") throw new Error("OpenAI returned no content");
      const parsed = JSON.parse(content);
      const findings = Array.isArray(parsed.findings) ? parsed.findings : [];
      // Validate findings through the existing review adapter so the AI cannot
      // weaken the gate or inject malformed/secret-bearing findings.
      return reviewTask({ task, checks, findings });
    } finally {
      clearTimeout(timer);
    }
  };
};
