import assert from "node:assert/strict";
import test from "node:test";
import { createStudioImageDirector, type ImageDirectorResponse } from "../frontend/src/server/studio/image-conversation-director";

const usage = {
  input_tokens: 1000,
  input_tokens_details: { cached_tokens: 200, cache_write_tokens: 100 },
  output_tokens: 300,
  output_tokens_details: { reasoning_tokens: 100 },
  total_tokens: 1300,
};
const response: ImageDirectorResponse = {
  id: "response-qa",
  model: "gpt-6.1-sol",
  status: "completed",
  service_tier: "default",
  usage,
  output_text: JSON.stringify({ reply: "What would you like to create?", image: null }),
};
const input = { requestId: "cde73781-c5f5-4f0b-b089-439dc0998e12", message: "How does this work?", references: [] };

test("reports actual response usage without changing the draft or model request", async () => {
  let calls = 0;
  let event;
  const director = createStudioImageDirector({
    createResponse: async (params) => {
      calls++;
      assert.equal(params.model, "gpt-6.1-sol");
      assert.equal(params.store, false);
      assert.equal(params.max_output_tokens, 1600);
      assert.deepEqual(params.reasoning, { effort: "medium" });
      return response;
    },
    onResponse: (value) => { event = value; },
  });
  assert.deepEqual(await director(input, [], []), JSON.parse(response.output_text));
  assert.equal(calls, 1);
  assert.ok(event);
  assert.deepEqual(event.usage, usage);
  assert.equal(event.model, response.model);
  assert.equal(event.responseId, "response-qa");
  assert.equal(event.serviceTier, "default");
  assert.ok(event.elapsedMs >= 0);
  assert.equal("message" in event, false);
});

test("waits for an asynchronous per-call usage checkpoint without losing the QA observer", async () => {
  let saved = false;
  let observed = 0;
  const director = createStudioImageDirector({
    createResponse: async () => response,
    onResponse: () => { observed++; },
  });
  await director(input, [], [], async (event) => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(event.responseId, "response-qa");
    saved = true;
  });
  assert.equal(saved, true);
  assert.equal(observed, 1);
});

test("captures billable incomplete responses before returning a retryable failure", async () => {
  const events: unknown[] = [];
  const director = createStudioImageDirector({
    createResponse: async () => ({ ...response, status: "incomplete", output_text: "" }),
    onResponse: (event) => events.push(event),
  });
  await assert.rejects(director(input, [], []), { code: "INTERNAL_ERROR", retryable: true });
  assert.equal(events.length, 1);
  assert.deepEqual((events[0] as typeof response).usage, usage);
});

test("an observer failure does not discard a valid draft or repeat the API call", async () => {
  let calls = 0;
  const director = createStudioImageDirector({
    createResponse: async () => { calls++; return response; },
    onResponse: () => { throw new Error("report unavailable"); },
  });
  assert.deepEqual(await director(input, [], []), JSON.parse(response.output_text));
  assert.equal(calls, 1);
});

test("retains the last eight real history turns and attached reference in the request", async () => {
  const director = createStudioImageDirector({
    createResponse: async (params) => {
      assert.ok(Array.isArray(params.input));
      assert.equal(params.input.length, 17);
      assert.deepEqual(params.input[0], { role: "user", content: "message 2" });
      assert.deepEqual(params.input[15], { role: "assistant", content: "reply 9" });
      assert.deepEqual(params.input[16], {
        role: "user",
        content: [
          { type: "input_text", text: input.message },
          { type: "input_image", image_url: "https://example.com/reference.png", detail: "low" },
        ],
      });
      return response;
    },
  });
  await director(input, Array.from({ length: 10 }, (_, i) => ({ message: `message ${i}`, reply: `reply ${i}` })), [{
    assetId: "ma_11111111111111111111111111111111", role: "reference", mediaKind: "image",
    storageUrl: "https://example.com/reference.png", width: 512, height: 512, durationSec: null, mimeType: "image/png",
  }]);
});
