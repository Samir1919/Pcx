/**
 * Provider registry and request config for the multi-agent AI adapters.
 *
 * Keeps every external model provider behind one vendor-neutral config surface so
 * the autonomous loop can swap or "hold" providers without code changes. Each
 * provider is opt-in and read entirely from environment variables; secrets never
 * appear in source, logs, or artifacts.
 *
 * Environment contract (per provider, e.g. `DEEPSEEK_`, `OPENAI_`, `ANTHROPIC_`,
 * `KIMI_`):
 *   <PREFIX>_API_KEY            required when the provider is used
 *   <PREFIX>_MODEL              optional (defaults to the provider's default)
 *   <PREFIX>_ENDPOINT           optional (defaults to the provider's default)
 *   <PREFIX>_ENABLED            optional "true"|"false" (defaults to enabled);
 *                               set "false" to hold a provider without deleting it
 *   <PREFIX>_THINKING           optional "enabled"|"true" (bearer reasoning models)
 *   <PREFIX>_REASONING_EFFORT   optional "low"|"medium"|"high"
 *
 * Auth dial I:
 *   - deepseek / openai / kimi use OpenAI-compatible chat completions with
 *     `Authorization: Bearer <key>`.
 *   - anthropic uses the Messages API with `x-api-key` and
 *     `anthropic-version: 2023-06-01`.
 */

const REASONING_EFFORTS = new Set(["low", "medium", "high"]);

export const PROVIDER_NAMES = Object.freeze(["deepseek", "openai", "anthropic", "kimi"]);

export const PROVIDERS = Object.freeze({
  deepseek: {
    envPrefix: "DEEPSEEK",
    auth: "bearer",
    defaultEndpoint: "https://api.deepseek.com/chat/completions",
    defaultModel: "deepseek-chat"
  },
  openai: {
    envPrefix: "OPENAI",
    auth: "bearer",
    defaultEndpoint: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4o"
  },
  anthropic: {
    envPrefix: "ANTHROPIC",
    auth: "x-api-key",
    defaultEndpoint: "https://api.anthropic.com/v1/messages",
    defaultModel: "claude-3-5-sonnet-latest"
  },
  kimi: {
    envPrefix: "KIMI",
    auth: "bearer",
    defaultEndpoint: "https://api.moonshot.cn/v1/chat/completions",
    defaultModel: "kimi-k2-0711-preview"
  }
});

const asNonEmptyString = (value, field) => {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} must be a non-empty string`);
  return value.trim();
};

const readBool = (value, field) => {
  if (value == null || value === "") return null;
  const normalized = String(value).toLowerCase();
  if (normalized === "true" || normalized === "enabled" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "disabled" || normalized === "0" || normalized === "no") return false;
  throw new Error(`${field} must be a boolean-like value`);
};

/**
 * Resolves a provider's runtime config from the environment. Throws when the
 * provider is held (disabled), unknown, or missing a required key, so a run
 * fails fast instead of silently degrading.
 */
export const resolveProvider = ({ name = "deepseek", env = process.env } = {}) => {
  const provider = PROVIDERS[name];
  if (!provider) throw new Error(`unknown AI provider: ${name}`);

  const enabled = readBool(env[`${provider.envPrefix}_ENABLED`], `${provider.envPrefix}_ENABLED`);
  if (enabled === false) {
    throw new Error(`${name} provider is held (${provider.envPrefix}_ENABLED=false); set it to true to use this provider`);
  }

  const apiKey = asNonEmptyString(env[`${provider.envPrefix}_API_KEY`], `${provider.envPrefix}_API_KEY`);
  const model = asNonEmptyString(env[`${provider.envPrefix}_MODEL`] ?? provider.defaultModel, `${provider.envPrefix}_MODEL`);

  const reasoningEffort = env[`${provider.envPrefix}_REASONING_EFFORT`] ?? null;
  if (reasoningEffort != null && !REASONING_EFFORTS.has(reasoningEffort)) {
    throw new Error(`${provider.envPrefix}_REASONING_EFFORT must be low, medium, or high`);
  }

  const thinkingValue = env[`${provider.envPrefix}_THINKING`];
  const thinkingEnabled = thinkingValue === "enabled" || thinkingValue === "true" || thinkingValue === "1";

  return Object.freeze({
    name,
    auth: provider.auth,
    apiKey,
    model,
    endpoint: asNonEmptyString(env[`${provider.envPrefix}_ENDPOINT`] ?? provider.defaultEndpoint, `${provider.envPrefix}_ENDPOINT`),
    thinkingEnabled,
    reasoningEffort
  });
};

/**
 * Builds the HTTP request body + headers for a single-turn completion. The
 * caller passes a `system` instruction and a `user` prompt; the body is shaped
 * for the provider's dialect (OpenAI-compatible vs Anthropic Messages). Thinking
 * and reasoning-effort fields are attached only when the provider enables them
 * and the dialect supports them.
 */
export const buildChatRequest = (provider, { system, user, temperature = 0.2 } = {}) => {
  if (!provider || typeof provider !== "object") throw new Error("provider must be a resolved provider config");
  const systemText = asNonEmptyString(system, "system");
  const userText = asNonEmptyString(user, "user");

  if (provider.auth === "x-api-key") {
    const body = {
      model: provider.model,
      system: systemText,
      messages: [{ role: "user", content: userText }],
      max_tokens: 4096
    };
    const headers = {
      "Content-Type": "application/json",
      "x-api-key": provider.apiKey,
      "anthropic-version": "2023-06-01"
    };
    return { body, headers };
  }

  // OpenAI-compatible dialect: deepseek, openai, kimi.
  const body = {
    model: provider.model,
    messages: [
      { role: "system", content: systemText },
      { role: "user", content: userText }
    ],
    temperature
  };
  if (provider.thinkingEnabled) {
    body.thinking = { type: "enabled" };
  } else {
    body.response_format = { type: "json_object" };
  }
  if (provider.reasoningEffort) body.reasoning_effort = provider.reasoningEffort;

  return {
    body,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`
    }
  };
};

/**
 * Extracts the assistant text from a provider response payload. Supports the
 * OpenAI-compatible `choices[].message.content` and Anthropic's
 * `content[].text` shapes.
 */
export const extractContent = (payload) => {
  const choiceText = payload?.choices?.[0]?.message?.content;
  if (typeof choiceText === "string" && choiceText.trim() !== "") return choiceText;
  const anthropicText = (payload?.content ?? [])
    .filter((block) => block?.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n");
  if (anthropicText.trim() !== "") return anthropicText;
  throw new Error("AI provider returned no content");
};

// Some model-serving paths leak their reserved tool-call template tokens back as
// plain assistant text (the `｜` fullwidth bars plus `<invoke>`/`<tool_calls>`
// wrappers). Fail fast with a specific, non-retryable error instead of looping.
export const assertNoLeakedToolCalls = (content) => {
  if (content.includes("\uFF5C") || /<\s*(?:invoke|tool_calls|tool)\b/i.test(content)) {
    const error = new Error("AI provider returned leaked tool-call syntax instead of JSON; the model endpoint is emitting reserved special tokens (fullwidth bars / <invoke>/<tool_calls>). Point the provider endpoint at a native tool-calling route, or use a model variant that does not emit these tokens.");
    error.retryable = false;
    throw error;
  }
};

const parseJson = (content) => {
  const stripped = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  return JSON.parse(stripped);
};

/**
 * Parses a provider's assistant text into a JSON object (tolerant of markdown
 * fences) after rejecting leaked tool-call syntax.
 */
export const parseProviderJson = (content) => {
  assertNoLeakedToolCalls(content);
  return parseJson(content);
};
