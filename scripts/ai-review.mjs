/**
 * OpenAI review adapter.
 *
 * Implements an AI-backed review step using the OpenAI chat-completions API.
 * The reviewer sends a bounded task description plus the declared checks to
 * OpenAI and maps the model's structured response into typed findings that are
 * validated by the existing `reviewTask` adapter (BLOCKER/MAJOR findings reject
 * the task).
 *
 * The API key and model are read from environment variables (`OPENAI_API_KEY`,
 * `OPENAI_MODEL`) so secrets never appear in source, logs, or artifacts. A
 * `fetchImpl` may be injected for deterministic testing; the default uses the
 * global `fetch`. When no API key is present the factory throws, so a real run
 * fails fast instead of silently degrading.
 *
 * This adapter never weakens the review gate: it only produces findings that
 * `reviewTask` validates. It is safe to run locally or in CI (with a mocked
 * fetch).
 */
import { reviewTask } from "./control-plane.mjs";

const asNonEmptyString = (value, field) => {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} must be a non-empty string`);
  return value.trim();
};

const DEFAULT_ENDPOINT = "https://api.openai.com/v1/chat/completions";

/**
 * Builds the OpenAI reviewer. Reads credentials from the environment unless
 * explicitly overridden (for tests). Returns an async function matching the
 * review step contract: `({ task, checks }) => reviewTask result`.
 */
export const createOpenAiReviewer = ({
  apiKey = process.env.OPENAI_API_KEY,
  model = process.env.OPENAI_MODEL ?? "gpt-4o",
  endpoint = DEFAULT_ENDPOINT,
  fetchImpl = fetch,
  timeoutMs = 120_000
} = {}) => {
  const key = asNonEmptyString(apiKey, "OPENAI_API_KEY");
  const safeModel = asNonEmptyString(model, "OPENAI_MODEL");
  if (typeof fetchImpl !== "function") throw new Error("fetchImpl must be a function");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000) throw new Error("timeoutMs must be a positive integer");

  return async ({ task, checks = [] } = {}) => {
    if (!task || typeof task !== "object") throw new Error("task must be an object");
    const prompt = [
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

    const controller = new AbortController();
    let timer;
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
