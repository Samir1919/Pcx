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
 *   <PREFIX>_THINKING           optional "enabled" — only for providers that
 *                               support a thinking block (deepseek, anthropic)
 *   <PREFIX>_REASONING_EFFORT   optional effort level; per-provider allowed
 *                               values are documented below
 *
 * Provider-specific reasoning shapes (verified against each vendor's docs):
 *   - deepseek:  `thinking: {type:"enabled"}` + `reasoning_effort` (low|medium|high)
 *   - openai:    `reasoning_effort` (low|medium|high); no thinking block
 *   - anthropic: `thinking: {type:"enabled"}` + `effort` (low|medium|high|xhigh|max)
 *   - kimi:      `reasoning_effort` (low|high for kimi-k3); no thinking block
 *
 * Auth:
 *   - deepseek / openai / kimi use OpenAI-compatible chat completions with
 *     `Authorization: Bearer <key>`.
 *   - anthropic uses the Messages API with `x-api-key` and
 *     `anthropic-version: 2023-06-01`.
 */

export const PROVIDER_NAMES = Object.freeze(["deepseek", "openai", "anthropic", "kimi"]);

export const PROVIDERS = Object.freeze({
  deepseek: {
    envPrefix: "DEEPSEEK",
    auth: "bearer",
    defaultEndpoint: "https://api.deepseek.com/chat/completions",
    defaultModel: "deepseek-chat",
    supportsThinking: true,
    effortParam: "reasoning_effort",
    effortAllowed: ["low", "medium", "high"]
  },
  openai: {
    envPrefix: "OPENAI",
    auth: "bearer",
    defaultEndpoint: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4o",
    supportsThinking: false,
    effortParam: "reasoning_effort",
    effortAllowed: ["low", "medium", "high"]
  },
  anthropic: {
    envPrefix: "ANTHROPIC",
    auth: "x-api-key",
    defaultEndpoint: "https://api.anthropic.com/v1/messages",
    defaultModel: "claude-3-5-sonnet-latest",
    supportsThinking: true,
    effortParam: "effort",
    effortAllowed: ["low", "medium", "high", "xhigh", "max"]
  },
  kimi: {
    envPrefix: "KIMI",
    auth: "bearer",
    defaultEndpoint: "https://api.moonshot.cn/v1/chat/completions",
    defaultModel: "kimi-k2-0711-preview",
    supportsThinking: false,
    effortParam: "reasoning_effort",
    effortAllowed: ["low", "high"]
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
  if (reasoningEffort != null && !provider.effortAllowed.includes(reasoningEffort)) {
    throw new Error(`${provider.envPrefix}_REASONING_EFFORT must be one of ${provider.effortAllowed.join(", ")} for ${name}`);
  }

  const maxTokensRaw = env[`${provider.envPrefix}_MAX_TOKENS`];
  let maxTokens = null;
  if (maxTokensRaw != null && maxTokensRaw !== "") {
    maxTokens = Number.parseInt(maxTokensRaw, 10);
    if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 128_000) {
      throw new Error(`${provider.envPrefix}_MAX_TOKENS must be an integer between 1 and 128000 for ${name}`);
    }
  }

  const thinkingValue = env[`${provider.envPrefix}_THINKING`];
  const thinkingEnabled = provider.supportsThinking && (thinkingValue === "enabled" || thinkingValue === "true" || thinkingValue === "1");

  return Object.freeze({
    name,
    auth: provider.auth,
    supportsThinking: provider.supportsThinking,
    effortParam: provider.effortParam,
    apiKey,
    model,
    endpoint: asNonEmptyString(env[`${provider.envPrefix}_ENDPOINT`] ?? provider.defaultEndpoint, `${provider.envPrefix}_ENDPOINT`),
    thinkingEnabled,
    reasoningEffort,
    maxTokens
  });
};

/**
 * Returns true when a provider is explicitly held (`<PREFIX>_ENABLED=false`),
 * false when enabled or unspecified. Held providers retain their config but are
 * skipped by provider pools so operators can keep credentials on disk without
 * using them.
 */
export const isProviderHeld = ({ name = "deepseek", env = process.env } = {}) => {
  const provider = PROVIDERS[name];
  if (!provider) throw new Error(`unknown AI provider: ${name}`);
  return readBool(env[`${provider.envPrefix}_ENABLED`], `${provider.envPrefix}_ENABLED`) === false;
};

/**
 * Resolves the enabled providers from a name list, skipping any held provider.
 * Throws if none are enabled, or if an enabled provider is missing its key, so
 * a pool fails fast instead of silently running with an empty provider set.
 */
export const resolveActiveProviders = ({ names = [], env = process.env } = {}) => {
  if (!Array.isArray(names) || names.length === 0) throw new Error("names must be a non-empty array");
  const active = [];
  for (const name of names) {
    if (isProviderHeld({ name, env })) continue;
    active.push(resolveProvider({ name, env }));
  }
  if (active.length === 0) throw new Error("no active AI providers; enable at least one via <PREFIX>_ENABLED=true and set its API key");
  return active;
};

/**
 * Builds the HTTP request body + headers for a single-turn completion. The
 * caller passes a `system` instruction and a `user` prompt; the body is shaped
 * for the provider's dialect (OpenAI-compatible vs Anthropic Messages).
 * Reasoning/thinking fields use each provider's official parameter names.
 */
export const buildChatRequest = (provider, { system, user, temperature = 0.2 } = {}) => {
  if (!provider || typeof provider !== "object") throw new Error("provider must be a resolved provider config");
  const systemText = asNonEmptyString(system, "system");
  const userText = asNonEmptyString(user, "user");

  if (provider.auth === "x-api-key") {
    // Anthropic Messages API.
    const body = {
      model: provider.model,
      system: systemText,
      messages: [{ role: "user", content: userText }],
      max_tokens: provider.maxTokens ?? 4096
    };
    if (provider.supportsThinking && provider.thinkingEnabled) body.thinking = { type: "enabled" };
    if (provider.reasoningEffort && provider.effortParam) body[provider.effortParam] = provider.reasoningEffort;
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
  const thinkingOn = provider.supportsThinking && provider.thinkingEnabled;
  if (thinkingOn) {
    body.thinking = { type: "enabled" };
  } else {
    body.response_format = { type: "json_object" };
  }
  if (provider.reasoningEffort && provider.effortParam) body[provider.effortParam] = provider.reasoningEffort;
  // Cap output length so a runaway model cannot generate unbounded tokens.
  // Reasoning ("thinking") tokens count against the same cap on DeepSeek, so use
  // a larger default when thinking is on to avoid truncating the reasoning block
  // and breaking the requested JSON.
  body.max_tokens = provider.maxTokens ?? (thinkingOn ? 8192 : 4096);

  return {
    body,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`
    }
  };
};

/**
 * Extracts the provider's token usage from a response payload. Returns
 * `{ promptTokens, completionTokens }` or `null` when the payload carries no
 * usable usage block. Values are numbers only; no secrets are ever exposed.
 */
export const extractUsage = (payload) => {
  const usage = payload?.usage;
  if (!usage || typeof usage !== "object") return null;
  const promptTokens = Number.isFinite(usage.prompt_tokens) ? usage.prompt_tokens : Number.isFinite(usage.promptTokens) ? usage.promptTokens : null;
  const completionTokens = Number.isFinite(usage.completion_tokens) ? usage.completion_tokens : Number.isFinite(usage.completionTokens) ? usage.completionTokens : null;
  if (promptTokens == null && completionTokens == null) return null;
  return Object.freeze({ promptTokens, completionTokens });
};

/**
 * Some model-serving paths leak their reserved tool-call template tokens back as
 * plain assistant text (the `｜` fullwidth bars plus `<invoke>`/`<tool_calls>`
 * wrappers). Fail fast with a specific, non-retryable error instead of looping.
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
