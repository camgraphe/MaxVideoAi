import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
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
