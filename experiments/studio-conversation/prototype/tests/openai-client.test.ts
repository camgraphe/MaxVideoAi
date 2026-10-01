import test from "node:test";
import assert from "node:assert/strict";

test("The API adapter binds Sol, strict tools and bounded calls without exposing credentials", async () => {
  const module = await import("../server/openai-client").catch(() => null);
  assert.ok(
    module?.OpenAIResponses,
    "L’adaptateur Responses doit appeler Sol côté serveur",
  );
  let body: any;
  const client = new module.OpenAIResponses(
    "secret-test-key",
    async (_url: any, init: any) => {
      body = JSON.parse(init.body);
      return new Response(
        JSON.stringify({
          id: "response",
          object: "response",
          status: "completed",
          output: [],
          model: "gpt-6.1-sol",
          usage: { input_tokens: 2, output_tokens: 3, total_tokens: 5 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  );
  await client.create({
    input: [{ role: "user", content: "Bonjour" }],
    instructions: "Studio",
    tool_choice: "auto",
  });
  assert.equal(body.model, "gpt-6.1-sol");
  assert.equal(body.store, false);
  assert.equal(body.parallel_tool_calls, false);
  assert.ok(body.max_output_tokens <= 6000);
  assert.ok(
    body.tools.every(
      (t: any) => t.strict && t.parameters.additionalProperties === false,
    ),
  );
  assert.ok(!JSON.stringify(body).includes("secret-test-key"));
  const denied = new module.OpenAIResponses(
    "secret-test-key",
    async () =>
      new Response(
        JSON.stringify({
          error: {
            message: "Invalid API key: secret-test-key",
            type: "invalid_request_error",
            code: "invalid_api_key",
          },
        }),
        { status: 401, headers: { "content-type": "application/json" } },
      ),
  );
  await assert.rejects(
    denied.create({ input: [], instructions: "Studio", tool_choice: "auto" }),
    (e: any) =>
      e.status === 503 &&
      !e.message.includes("secret-test-key") &&
      /clé/i.test(e.message),
  );
});
