import assert from "node:assert/strict";
import test from "node:test";
import { buildChatRequest, extractContent, isProviderHeld, parseProviderJson, PROVIDER_NAMES, resolveActiveProviders, resolveProvider } from "./ai-providers.mjs";

test("provider names cover deepseek, openai, anthropic, and kimi", () => {
  assert.deepEqual([...PROVIDER_NAMES].sort(), ["anthropic", "deepseek", "kimi", "openai"]);
});

test("resolveProvider reads prefix env and defaults", () => {
  const config = resolveProvider({
    name: "openai",
    env: { OPENAI_API_KEY: "k", OPENAI_MODEL: "gpt-5" }
  });
  assert.equal(config.name, "openai");
  assert.equal(config.auth, "bearer");
  assert.equal(config.apiKey, "k");
  assert.equal(config.model, "gpt-5");
  assert.equal(config.endpoint, "https://api.openai.com/v1/chat/completions");

  const kimi = resolveProvider({ name: "kimi", env: { KIMI_API_KEY: "k2" } });
  assert.equal(kimi.model, "kimi-k2-0711-preview");
});

test("resolveProvider fails fast for unknown, missing key, and held providers", () => {
  assert.throws(() => resolveProvider({ name: "nope", env: {} }), /unknown AI provider/);
  assert.throws(() => resolveProvider({ name: "anthropic", env: {} }), /ANTHROPIC_API_KEY/);
  assert.throws(
    () => resolveProvider({ name: "openai", env: { OPENAI_API_KEY: "k", OPENAI_ENABLED: "false" } }),
    /held/
  );
});

test("buildChatRequest shapes the OpenAI-compatible dialect with bearer auth", () => {
  const config = resolveProvider({ name: "deepseek", env: { DEEPSEEK_API_KEY: "k", DEEPSEEK_MODEL: "deepseek-chat" } });
  const { body, headers } = buildChatRequest(config, { system: "sys", user: "usr" });
  assert.deepEqual(body.messages, [
    { role: "system", content: "sys" },
    { role: "user", content: "usr" }
  ]);
  assert.deepEqual(body.response_format, { type: "json_object" });
  assert.equal(headers.Authorization, "Bearer k");
  assert.equal(headers["x-api-key"], undefined);
});

test("buildChatRequest attaches thinking and reasoning_effort and omits json_object", () => {
  const config = resolveProvider({ name: "deepseek", env: { DEEPSEEK_API_KEY: "k" } });
  const enriched = Object.freeze({ ...config, thinkingEnabled: true, reasoningEffort: "high" });
  const { body } = buildChatRequest(enriched, { system: "s", user: "u" });
  assert.deepEqual(body.thinking, { type: "enabled" });
  assert.equal(body.reasoning_effort, "high");
  assert.equal("response_format" in body, false);
});

test("buildChatRequest shapes the Anthropic Messages dialect with x-api-key", () => {
  const config = resolveProvider({ name: "anthropic", env: { ANTHROPIC_API_KEY: "ant" } });
  const { body, headers } = buildChatRequest(config, { system: "sys", user: "usr" });
  assert.equal(body.system, "sys");
  assert.deepEqual(body.messages, [{ role: "user", content: "usr" }]);
  assert.ok(body.max_tokens > 0);
  assert.equal(headers["x-api-key"], "ant");
  assert.equal(headers["anthropic-version"], "2023-06-01");
  assert.equal(headers.Authorization, undefined);
});

test("buildChatRequest emits provider-correct reasoning field names", () => {
  // DeepSeek: thinking object + reasoning_effort.
  const deepseek = resolveProvider({ name: "deepseek", env: { DEEPSEEK_API_KEY: "d", DEEPSEEK_THINKING: "enabled", DEEPSEEK_REASONING_EFFORT: "high" } });
  assert.deepEqual(buildChatRequest(deepseek, { system: "s", user: "u" }).body.thinking, { type: "enabled" });
  assert.equal(buildChatRequest(deepseek, { system: "s", user: "u" }).body.reasoning_effort, "high");

  // OpenAI: reasoning_effort, no thinking object.
  const openai = resolveProvider({ name: "openai", env: { OPENAI_API_KEY: "o", OPENAI_REASONING_EFFORT: "medium" } });
  assert.equal(buildChatRequest(openai, { system: "s", user: "u" }).body.reasoning_effort, "medium");
  assert.equal("thinking" in buildChatRequest(openai, { system: "s", user: "u" }).body, false);

  // Anthropic: thinking object + `effort` (not reasoning_effort).
  const anthropic = resolveProvider({ name: "anthropic", env: { ANTHROPIC_API_KEY: "a", ANTHROPIC_THINKING: "enabled", ANTHROPIC_REASONING_EFFORT: "xhigh" } });
  const anthropicBody = buildChatRequest(anthropic, { system: "s", user: "u" }).body;
  assert.deepEqual(anthropicBody.thinking, { type: "enabled" });
  assert.equal(anthropicBody.effort, "xhigh");
  assert.equal("reasoning_effort" in anthropicBody, false);

  // Kimi: reasoning_effort low|high, no thinking object.
  const kimi = resolveProvider({ name: "kimi", env: { KIMI_API_KEY: "k", KIMI_REASONING_EFFORT: "high" } });
  assert.equal(buildChatRequest(kimi, { system: "s", user: "u" }).body.reasoning_effort, "high");
  assert.equal("thinking" in buildChatRequest(kimi, { system: "s", user: "u" }).body, false);
});

test("resolveProvider enforces per-provider reasoning effort values", () => {
  assert.throws(
    () => resolveProvider({ name: "kimi", env: { KIMI_API_KEY: "k", KIMI_REASONING_EFFORT: "medium" } }),
    /KIMI_REASONING_EFFORT must be one of low, high/
  );
  assert.throws(
    () => resolveProvider({ name: "anthropic", env: { ANTHROPIC_API_KEY: "a", ANTHROPIC_REASONING_EFFORT: "extreme" } }),
    /ANTHROPIC_REASONING_EFFORT must be one of low, medium, high, xhigh, max/
  );
  assert.throws(
    () => resolveProvider({ name: "deepseek", env: { DEEPSEEK_API_KEY: "d", DEEPSEEK_REASONING_EFFORT: "xhigh" } }),
    /DEEPSEEK_REASONING_EFFORT must be one of low, medium, high/
  );
});

test("extractContent reads OpenAI and Anthropic response shapes and rejects empty", () => {
  assert.equal(extractContent({ choices: [{ message: { content: "openai" } }] }), "openai");
  assert.equal(extractContent({ content: [{ type: "text", text: "claude" }] }), "claude");
  assert.throws(() => extractContent({ choices: [{ message: { content: "  " } }] }), /no content/);
});

test("parseProviderJson parses plain and fenced JSON and rejects leaked tool calls", () => {
  assert.deepEqual(parseProviderJson(JSON.stringify({ a: 1 })), { a: 1 });
  assert.deepEqual(parseProviderJson("```json\n" + JSON.stringify({ a: 1 }) + "\n```"), { a: 1 });
  assert.throws(() => parseProviderJson("<｜tool_calls｜>"), /leaked tool-call/);
});

test("resolveActiveProviders skips held providers and fails fast when none are active", () => {
  const active = resolveActiveProviders({
    names: ["deepseek", "openai", "anthropic", "kimi"],
    env: {
      DEEPSEEK_API_KEY: "d",
      OPENAI_API_KEY: "o",
      ANTHROPIC_API_KEY: "a",
      ANTHROPIC_ENABLED: "false",
      KIMI_API_KEY: "k",
      KIMI_ENABLED: "false"
    }
  });
  assert.deepEqual(active.map((p) => p.name), ["deepseek", "openai"]);
  assert.equal(isProviderHeld({ name: "anthropic", env: { ANTHROPIC_ENABLED: "false" } }), true);
  assert.equal(isProviderHeld({ name: "deepseek", env: {} }), false);
  assert.throws(
    () => resolveActiveProviders({ names: ["deepseek", "openai"], env: { DEEPSEEK_ENABLED: "false", OPENAI_ENABLED: "false" } }),
    /no active AI providers/
  );
});
