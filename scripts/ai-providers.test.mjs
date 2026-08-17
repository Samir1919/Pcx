import assert from "node:assert/strict";
import test from "node:test";
import { buildChatRequest, extractContent, parseProviderJson, PROVIDER_NAMES, resolveProvider } from "./ai-providers.mjs";

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
