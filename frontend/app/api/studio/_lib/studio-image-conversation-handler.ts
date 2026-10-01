import type { NextRequest } from "next/server";
import { ZodError } from "zod";
import {
  resolveStudioApiAccess,
  type StudioAccessDecision,
} from "@/server/studio/access";
import { createImageConversationService } from "@/server/studio/image-conversation-service";
import { AgentApiError } from "@/server/agent-api/errors";
import {
  LIVE_PRICING_POLICY_REVISION,
  PRICING_POLICY_HEADER,
} from "@/lib/membership-policy";
import { studioJson } from "./studio-route-utils";

async function readBoundedJson(req: NextRequest) {
  if (!req.body) throw new Error("INVALID_BODY");
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.byteLength;
      if (size > 24000) {
        await reader.cancel();
        throw new Error("BODY_TOO_LARGE");
      }
      chunks.push(item.value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
export async function handleStudioImageConversation(
  req: NextRequest,
  projectId: string,
  action: "read" | "submit" | "confirm",
  overrides: {
    enabled?: boolean;
    resolveAccess?: (req: NextRequest) => Promise<StudioAccessDecision>;
    serviceFactory?: typeof createImageConversationService;
  } = {},
) {
  const access = await (overrides.resolveAccess ?? resolveStudioApiAccess)(req);
  if (!access.ok)
    return studioJson(
      { ok: false, error: access.error },
      { status: access.status },
    );
  const enabled =
    overrides.enabled ??
    process.env.STUDIO_IMAGE_CONVERSATION_ENABLED === "true";
  if (!enabled)
    return studioJson(
      { ok: false, error: "STUDIO_IMAGE_PILOT_UNAVAILABLE" },
      { status: 404 },
    );
  if (!projectId || projectId.length > 128 || projectId !== projectId.trim())
    return studioJson({ ok: false, error: "INVALID_PROJECT" }, { status: 400 });
  if (
    action !== "read" &&
    (req.headers.get("origin") !== req.nextUrl.origin ||
      req.headers.get("sec-fetch-site") === "cross-site")
  ) {
    return studioJson(
      { ok: false, error: "SAME_ORIGIN_REQUIRED" },
      { status: 403 },
    );
  }
  if (
    action === "confirm" &&
    req.headers.get(PRICING_POLICY_HEADER) !== LIVE_PRICING_POLICY_REVISION
  ) {
    return studioJson(
      {
        ok: false,
        error: "PRICING_REFRESH_REQUIRED",
        message: "Refresh and review this quote before confirming.",
      },
      { status: 409 },
    );
  }
  try {
    const actor = {
      authMethod: "studio-session" as const,
      userId: access.userId,
      projectId,
      clientId: null,
    };
    const service = (
      overrides.serviceFactory ?? createImageConversationService
    )(actor, { enabled, ...(process.env.STUDIO_CONVERSATION_ACTIONS_ENABLED === "true" ? {actionsEnabled: true} : {}) });
    const result =
      action === "read"
        ? await service.read()
        : action === "submit"
          ? await service.submit(await readBoundedJson(req))
          : await service.confirm(await readBoundedJson(req));
    return studioJson({ ok: true, result });
  } catch (error) {
    if (
      error instanceof ZodError ||
      error instanceof SyntaxError ||
      (error instanceof Error && error.message === "INVALID_BODY")
    )
      return studioJson(
        { ok: false, error: "INVALID_REQUEST" },
        { status: 400 },
      );
    if (error instanceof Error && error.message === "BODY_TOO_LARGE")
      return studioJson(
        { ok: false, error: "BODY_TOO_LARGE" },
        { status: 413 },
      );
    if (error instanceof AgentApiError) {
      const status =
        error.code === "QUOTE_EXPIRED"
          ? 409
          : error.code === "INSUFFICIENT_FUNDS"
            ? 402
            : error.code === "RATE_LIMITED"
              ? 429
              : error.code === "ENGINE_UNAVAILABLE" ||
                  error.code === "INTERNAL_ERROR"
                ? 503
                : 400;
      return studioJson(
        {
          ok: false,
          error: error.code,
          message: error.message,
          retryable: error.retryable,
        },
        { status },
      );
    }
    return studioJson(
      {
        ok: false,
        error: "STUDIO_IMAGE_UNAVAILABLE",
        message:
          "Studio could not recover this message. Retry without changing its request.",
      },
      { status: 503 },
    );
  }
}
