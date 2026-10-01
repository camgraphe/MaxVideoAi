import { createHash } from "node:crypto";
import { stableJson } from "./generation-normalization";
import type { ResolvedReference } from "./reference-types";
import { AgentApiError } from "./errors";
import type { AgentPrincipal } from "./principal";
import type { McpGenerationQuote } from "./quote-repository";

/** Constructed only after session access and project ownership have been checked. */
export type StudioGenerationActor = {
  authMethod: "studio-session";
  userId: string;
  projectId: string;
  clientId: null;
};
export type GenerationActor = AgentPrincipal | StudioGenerationActor;

function identifier(value: unknown, limit: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= limit &&
    value === value.trim()
  );
}

export function requireGenerationActor(actor: GenerationActor): void {
  if (
    !actor ||
    !identifier(actor.userId, 128) ||
    !(actor.authMethod === "oauth"
      ? actor.clientId === null || identifier(actor.clientId, 256)
      : actor.authMethod === "studio-session" &&
        actor.clientId === null &&
        identifier(actor.projectId, 128))
  ) {
    throw new AgentApiError(
      "AUTH_REQUIRED",
      "Authenticate before preparing a generation.",
    );
  }
}

export function requireOAuthGenerationActor(actor: AgentPrincipal): void {
  requireGenerationActor(actor);
  if (actor.authMethod !== "oauth") {
    throw new AgentApiError(
      "AUTH_REQUIRED",
      "Connect MaxVideoAI before using the agent generation API.",
    );
  }
}

export function quoteMatchesActor(
  quote: McpGenerationQuote,
  actor: GenerationActor,
): boolean {
  return (
    quote.userId === actor.userId &&
    quote.oauthClientId === actor.clientId &&
    (actor.authMethod === "oauth"
      ? (quote.authOrigin ?? "oauth") === "oauth" && !quote.studioProjectId
      : quote.authOrigin === "studio-session" &&
        quote.studioProjectId === actor.projectId &&
        quote.fundingMode === "wallet")
  );
}

export function studioReferenceFingerprint(
  references: readonly ResolvedReference[],
): string {
  return createHash("sha256").update(stableJson(references)).digest("hex");
}

export function bindStudioReferenceSnapshot(
  snapshot: Record<string, unknown>,
  actor: GenerationActor,
  references: readonly ResolvedReference[],
): Record<string, unknown> {
  return actor.authMethod === "studio-session"
    ? {
        ...snapshot,
        studioReferenceFingerprint: studioReferenceFingerprint(references),
      }
    : snapshot;
}
