import { createHash, randomUUID } from "node:crypto";
import {
  query,
  withDbTransaction,
  type TransactionQueryExecutor,
} from "@/lib/db";
import { AgentApiError } from "@/server/agent-api/errors";
import { stableJson } from "@/server/agent-api/generation-normalization";
import type { StudioGenerationActor } from "@/server/agent-api/generation-actor";
import {
  imageTurnInputSchema,
  imageDraftSchema,
  type ImageTurnInput,
  type ImageDraft,
} from "@/lib/studio/image-conversation-contract";

export type StoredImageTurn = {
  request_id: string;
  request_hash: string;
  input_json: ImageTurnInput;
  draft_json: ImageDraft | null;
  draft_reference_fingerprint: string | null;
  quote_id: string | null;
  state: "thinking" | "ready" | "failed";
  model_attempts: number;
  lease_id: string;
  lease_expires_at: Date;
  created_at: Date;
};
export const IMAGE_TURN_COLUMNS =
  "request_id, request_hash, input_json, draft_json, draft_reference_fingerprint, quote_id, state, model_attempts, lease_id, lease_expires_at, created_at";
export async function readImageConversationProject(
  userId: string,
  projectId: string,
) {
  const rows = await query<{ name: string }>(
    "SELECT name FROM studio_projects WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL",
    [projectId, userId],
  );
  if (!rows[0])
    throw new AgentApiError(
      "PARAMETER_INVALID",
      "This Studio project is not available.",
    );
  return rows[0];
}
export async function listImageTurns(
  actor: StudioGenerationActor,
): Promise<StoredImageTurn[]> {
  return query(
    `SELECT ${IMAGE_TURN_COLUMNS} FROM studio_image_turns WHERE user_id = $1 AND project_id = $2 ORDER BY created_at DESC, request_id DESC LIMIT 30`,
    [actor.userId, actor.projectId],
  );
}
export async function claimImageTurn(
  actor: StudioGenerationActor,
  input: ImageTurnInput,
): Promise<{ turn: StoredImageTurn; claimed: boolean }> {
  const parsed = imageTurnInputSchema.parse(input);
  const hash = createHash("sha256").update(stableJson(parsed)).digest("hex");
  return withDbTransaction(async (executor) => {
    await executor.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`studio-image:${actor.userId}`],
    );
    const existing = (
      await executor.query<StoredImageTurn>(
        `SELECT ${IMAGE_TURN_COLUMNS} FROM studio_image_turns WHERE user_id = $1 AND project_id = $2 AND request_id = $3 FOR UPDATE`,
        [actor.userId, actor.projectId, parsed.requestId],
      )
    )[0];
    if (existing && existing.request_hash !== hash)
      throw new AgentApiError(
        "PARAMETER_INVALID",
        "This request ID already belongs to a different message.",
      );
    const clock = (
      await executor.query<{ now: Date }>("SELECT clock_timestamp() AS now")
    )[0].now;
    if (
      existing &&
      (existing.state === "ready" ||
        (existing.state === "thinking" && existing.lease_expires_at > clock))
    )
      return { turn: existing, claimed: false };
    if (existing && !existing.draft_json && existing.model_attempts >= 2)
      throw new AgentApiError(
        "RATE_LIMITED",
        "This message reached its retry limit. Send a new message instead.",
      );
    const active = await executor.query<{ request_id: string }>(
      "SELECT request_id FROM studio_image_turns WHERE user_id = $1 AND state = 'thinking' AND lease_expires_at > clock_timestamp() LIMIT 1",
      [actor.userId],
    );
    if (active.length)
      throw new AgentApiError(
        "RATE_LIMITED",
        "Studio is still preparing your previous message.",
        true,
      );
    const count = (
      await executor.query<{ n: number }>(
        "SELECT COUNT(*)::int AS n FROM studio_image_turns WHERE user_id = $1 AND created_at > clock_timestamp() - INTERVAL '1 hour'",
        [actor.userId],
      )
    )[0].n;
    if (!existing && count >= 20)
      throw new AgentApiError(
        "RATE_LIMITED",
        "The image pilot conversation limit has been reached. Try later.",
        true,
      );
    await executor.query(
      "UPDATE mcp_generation_quotes SET state = 'expired', updated_at = clock_timestamp() WHERE user_id = $1 AND auth_origin = 'studio-session' AND studio_project_id = $2 AND state = 'prepared'",
      [actor.userId, actor.projectId],
    );
    const lease = randomUUID();
    const rows = existing
      ? await executor.query<StoredImageTurn>(
          `UPDATE studio_image_turns SET state = 'thinking', model_attempts = CASE WHEN draft_json IS NULL THEN model_attempts + 1 ELSE model_attempts END, lease_id = $4, lease_expires_at = clock_timestamp() + INTERVAL '3 minutes', updated_at = clock_timestamp() WHERE user_id = $1 AND project_id = $2 AND request_id = $3 RETURNING ${IMAGE_TURN_COLUMNS}`,
          [actor.userId, actor.projectId, parsed.requestId, lease],
        )
      : await executor.query<StoredImageTurn>(
          `INSERT INTO studio_image_turns (user_id, project_id, request_id, request_hash, input_json, lease_id, lease_expires_at) VALUES ($1,$2,$3,$4,$5::jsonb,$6,clock_timestamp() + INTERVAL '3 minutes') RETURNING ${IMAGE_TURN_COLUMNS}`,
          [
            actor.userId,
            actor.projectId,
            parsed.requestId,
            hash,
            JSON.stringify(parsed),
            lease,
          ],
        );
    return { turn: rows[0], claimed: true };
  });
}
export async function persistImageDraft(
  actor: StudioGenerationActor,
  turn: StoredImageTurn,
  draft: ImageDraft,
  referenceFingerprint: string,
) {
  const parsed = imageDraftSchema.parse(draft);
  const rows = await query(
    `UPDATE studio_image_turns SET draft_json = $5::jsonb, state = $6, draft_reference_fingerprint = $7, updated_at = clock_timestamp() WHERE user_id = $1 AND project_id = $2 AND request_id = $3 AND lease_id = $4 AND state = 'thinking' RETURNING request_id`,
    [
      actor.userId,
      actor.projectId,
      turn.request_id,
      turn.lease_id,
      JSON.stringify(parsed),
      parsed.image ? "thinking" : "ready",
      referenceFingerprint,
    ],
  );
  if (!rows.length)
    throw new AgentApiError(
      "PARAMETER_INVALID",
      "This message has been superseded.",
    );
}
export async function attachImageQuote(
  actor: StudioGenerationActor,
  turn: StoredImageTurn,
  quoteId: string,
  executor: TransactionQueryExecutor,
) {
  const rows = await executor.query(
    `UPDATE studio_image_turns SET quote_id = $5, state = 'ready', updated_at = clock_timestamp() WHERE user_id = $1 AND project_id = $2 AND request_id = $3 AND lease_id = $4 AND state = 'thinking' AND draft_json IS NOT NULL RETURNING request_id`,
    [actor.userId, actor.projectId, turn.request_id, turn.lease_id, quoteId],
  );
  if (!rows.length)
    throw new AgentApiError(
      "PARAMETER_INVALID",
      "This message has been superseded.",
    );
}
export async function failImageTurn(
  actor: StudioGenerationActor,
  turn: StoredImageTurn,
) {
  await query(
    "UPDATE studio_image_turns SET state = 'failed', updated_at = clock_timestamp() WHERE user_id = $1 AND project_id = $2 AND request_id = $3 AND lease_id = $4 AND state = 'thinking'",
    [actor.userId, actor.projectId, turn.request_id, turn.lease_id],
  );
}
