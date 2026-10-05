import { createHash } from "node:crypto";
import { stableJson } from "./generation-normalization";
import type { ResolvedReference } from "./reference-types";
import { AgentApiError } from "./errors";
import type { AgentPrincipal } from "./principal";
import type { McpGenerationQuote } from "./quote-repository";
import {CANONICAL_VIDEO_GENERATION_MODES,type CanonicalGenerationRequest} from './generation-types';

export function isStudioGenerationMode(surface: 'image' | 'video',mode: string): boolean {
  return (surface === 'image' ? ['t2i','i2i'] : CANONICAL_VIDEO_GENERATION_MODES).includes(mode as never);
}

/** Studio uses the public canonical modes, one output and owned assets; runtime/certification remain separate gates. */
export function requireStudioGenerationRequest(request: CanonicalGenerationRequest): void {
  if (!isStudioGenerationMode(request.surface,request.mode) || request.outputCount !== 1 || request.references.some(ref=>ref.kind !== 'asset')) {
    throw new AgentApiError('PARAMETER_INVALID','One or more generation settings are invalid for the selected model.');
  }
}

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

export function quoteMatchesActor<Request>(
  quote: McpGenerationQuote<Request>,
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

/** Audio OAuth clients remain mandatory; a server-authorized Studio session has its own scope. */
export function requireAudioGenerationActor(actor: GenerationActor): void {
  requireGenerationActor(actor);
  if (actor.authMethod === 'oauth' && actor.clientId === null)
    throw new AgentApiError('AUTH_REQUIRED', 'Connect MaxVideoAI before using Audio.');
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
