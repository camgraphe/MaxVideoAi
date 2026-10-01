import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { AgentApiError } from "../frontend/src/server/agent-api/errors";
import { handleStudioImageConversation } from "../frontend/app/api/studio/_lib/studio-image-conversation-handler";
import {
  LIVE_PRICING_POLICY_REVISION,
  PRICING_POLICY_HEADER,
} from "../frontend/src/lib/membership-policy";
const url =
  "http://localhost:4320/api/studio/projects/project/image-conversation";
test("pilot authenticates and validates origin/policy before constructing any model/DB service", async () => {
  let calls = 0;
  const serviceFactory = (() => {
    calls++;
    throw new Error("Unexpected work");
  }) as never;
  const denied = await handleStudioImageConversation(
    new NextRequest(url),
    "project",
    "read",
    {
      enabled: true,
      resolveAccess: async () => ({
        ok: false,
        status: 401,
        error: "UNAUTHORIZED",
      }),
      serviceFactory,
    },
  );
  assert.equal(denied.status, 401);
  assert.equal(calls, 0);
  const auth = {
    enabled: true,
    resolveAccess: async () => ({ ok: true as const, userId: "owner" }),
    serviceFactory,
  };
  assert.equal(
    (
      await handleStudioImageConversation(
        new NextRequest(url, {
          method: "POST",
          headers: { origin: "https://attacker.example" },
          body: "{}",
        }),
        "project",
        "submit",
        auth,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await handleStudioImageConversation(
        new NextRequest(url, {
          method: "POST",
          headers: { origin: "http://localhost:4320" },
          body: "{}",
        }),
        "project",
        "confirm",
        auth,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await handleStudioImageConversation(
        new NextRequest(url),
        "project",
        "read",
        { ...auth, enabled: false },
      )
    ).status,
    404,
  );
  assert.equal(calls, 0);
});
test("confirmation carries a server session actor and only the exact human payload", async () => {
  let capture: unknown;
  const payload = {
    requestId: "123e4567-e89b-42d3-a456-426614174000",
    quoteId: "123e4567-e89b-42d3-a456-426614174001",
    confirmed: true,
  };
  const response = await handleStudioImageConversation(
    new NextRequest(url, {
      method: "POST",
      headers: {
        origin: "http://localhost:4320",
        [PRICING_POLICY_HEADER]: LIVE_PRICING_POLICY_REVISION,
      },
      body: JSON.stringify(payload),
    }),
    "project",
    "confirm",
    {
      enabled: true,
      resolveAccess: async () => ({ ok: true, userId: "owner" }),
      serviceFactory: ((actor: unknown) => {
        capture = actor;
        return {
          confirm: async (value: unknown) => {
            assert.deepEqual(value, payload);
            return { jobId: payload.quoteId };
          },
        };
      }) as never,
    },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(capture, {
    authMethod: "studio-session",
    userId: "owner",
    projectId: "project",
    clientId: null,
  });
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("malformed, missing, and oversized request bodies stop before submit/confirm", async () => {
  let submitCalls = 0;
  let confirmCalls = 0;
  const serviceFactory = (() => ({
    submit: async () => {
      submitCalls++;
      return {};
    },
    confirm: async () => {
      confirmCalls++;
      return {};
    },
  })) as never;
  const auth = {
    enabled: true,
    resolveAccess: async () => ({ ok: true as const, userId: "owner" }),
    serviceFactory,
  };
  const requests = [
    {
      name: "malformed JSON",
      request: new NextRequest(url, {
        method: "POST",
        headers: { origin: "http://localhost:4320" },
        body: "{not-json",
      }),
      action: "submit" as const,
      expectedStatus: 400,
    },
    {
      name: "missing body",
      request: new NextRequest(url, {
        method: "POST",
        headers: {
          origin: "http://localhost:4320",
          [PRICING_POLICY_HEADER]: LIVE_PRICING_POLICY_REVISION,
        },
      }),
      action: "confirm" as const,
      expectedStatus: 400,
    },
    {
      name: "body over 24KB",
      request: new NextRequest(url, {
        method: "POST",
        headers: { origin: "http://localhost:4320" },
        body: "x".repeat(24_001),
      }),
      action: "submit" as const,
      expectedStatus: 413,
    },
  ];

  for (const scenario of requests) {
    const response = await handleStudioImageConversation(
      scenario.request,
      "project",
      scenario.action,
      auth,
    );
    assert.equal(response.status, scenario.expectedStatus, scenario.name);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    const payload = await response.json();
    assert.equal(payload.ok, false, scenario.name);
    assert.equal(
      payload.error,
      scenario.expectedStatus === 413 ? "BODY_TOO_LARGE" : "INVALID_REQUEST",
      scenario.name,
    );
  }

  assert.equal(submitCalls, 0);
  assert.equal(confirmCalls, 0);
});

test("AgentApiError codes retain their route status and private response headers", async () => {
  const cases = [
    { code: "QUOTE_EXPIRED", status: 409 },
    { code: "INSUFFICIENT_FUNDS", status: 402 },
    { code: "RATE_LIMITED", status: 429 },
    { code: "ENGINE_UNAVAILABLE", status: 503 },
  ] as const;

  for (const scenario of cases) {
    const response = await handleStudioImageConversation(
      new NextRequest(url, {
        method: "POST",
        headers: {
          origin: "http://localhost:4320",
          [PRICING_POLICY_HEADER]: LIVE_PRICING_POLICY_REVISION,
        },
        body: JSON.stringify({
          requestId: "123e4567-e89b-42d3-a456-426614174000",
          quoteId: "123e4567-e89b-42d3-a456-426614174001",
          confirmed: true,
        }),
      }),
      "project",
      "confirm",
      {
        enabled: true,
        resolveAccess: async () => ({ ok: true, userId: "owner" }),
        serviceFactory: (() => ({
          confirm: async () => {
            throw new AgentApiError(scenario.code, "Controlled route failure.");
          },
        })) as never,
      },
    );

    assert.equal(response.status, scenario.status, scenario.code);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    const payload = await response.json();
    assert.equal(payload.ok, false);
    assert.equal(payload.error, scenario.code);
  }
});
