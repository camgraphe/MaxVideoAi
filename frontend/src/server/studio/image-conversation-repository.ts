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
  hasDraftCreation,
} from "@/lib/studio/image-conversation-contract";

import {automaticallyNameStudioProject,readStudioProjectTitleFallbacks} from './conversation-project-naming';
import {isUntitledStudioProject} from '@/lib/studio/conversation-project-title';

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
  if(isUntitledStudioProject(rows[0].name)) {
    const fallback=(await readStudioProjectTitleFallbacks(userId,[projectId])).get(projectId);
    if(fallback)return {name:fallback};
  }
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

async function expirePreparedCreationQuotes(actor: StudioGenerationActor, executor: TransactionQueryExecutor) {
  await executor.query(
    "UPDATE mcp_generation_quotes SET state = 'expired', updated_at = clock_timestamp() WHERE user_id = $1 AND auth_origin = 'studio-session' AND studio_project_id = $2 AND state = 'prepared'",
    [actor.userId, actor.projectId],
  );
}

export async function claimImageTurn(
  actor: StudioGenerationActor,
  input: ImageTurnInput,
  options: {allowRecordedResponseRecovery?: boolean} = {},
): Promise<{ turn: StoredImageTurn; claimed: boolean; responseReplayOnly?: boolean }> {
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
    let responseReplayOnly = false;
    if (existing && !existing.draft_json && existing.model_attempts >= 2) {
      // A storage outage must not permanently strand already-recorded usage.
      // This lease can only replay durable responses; the checkpoint forbids any new dispatch.
      responseReplayOnly = options.allowRecordedResponseRecovery === true && (await executor.query(
        `SELECT 1 FROM studio_conversation_responses WHERE user_id=$1 AND project_id=$2 AND request_id=$3 AND state='reported' LIMIT 1`,
        [actor.userId, actor.projectId, parsed.requestId],
      )).length > 0;
      if (!responseReplayOnly) throw new AgentApiError(
        "RATE_LIMITED",
        "This message reached its retry limit. Send a new message instead.",
      );
    }
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
    let renewal: StoredImageTurn | undefined;
    if (!existing?.draft_json && parsed.renewedFromRequestId) {
      renewal = (await executor.query<StoredImageTurn>(
        `SELECT ${IMAGE_TURN_COLUMNS} FROM studio_image_turns WHERE user_id = $1 AND project_id = $2 AND request_id = $3 FOR UPDATE`,
        [actor.userId, actor.projectId, parsed.renewedFromRequestId],
      ))[0];
      if (!renewal || !hasDraftCreation(renewal.draft_json) || !renewal.quote_id
        || renewal.input_json.message !== parsed.message
        || stableJson(renewal.input_json.references) !== stableJson(parsed.references)
        || stableJson(renewal.input_json.attachments ?? []) !== stableJson(parsed.attachments ?? [])
        || stableJson(renewal.input_json.referenceMentions ?? []) !== stableJson(parsed.referenceMentions ?? []))
        throw new AgentApiError("PARAMETER_INVALID", "Renew the saved request without changing its message or references.");
      const quote = (await executor.query<{ state: string; expires_at: Date; job_id: string | null }>(
        `SELECT state, expires_at, job_id FROM mcp_generation_quotes WHERE quote_id = $1 AND user_id = $2 AND auth_origin = 'studio-session' AND studio_project_id = $3 FOR UPDATE`,
        [renewal.quote_id, actor.userId, actor.projectId],
      ))[0];
      if (!quote || quote.job_id || !(quote.state === "expired" || (quote.state === "prepared" && quote.expires_at <= clock)))
        throw new AgentApiError("QUOTE_EXPIRED", "Only an expired, unconfirmed quote can be renewed. Review the existing generation first.");
    }
    // A saved creation retry resumes that intent; a new message has no creation
    // intent yet and may only ask for clarification about the current quote.
    if (hasDraftCreation(existing?.draft_json ?? renewal?.draft_json ?? null))
      await expirePreparedCreationQuotes(actor, executor);
    const lease = randomUUID();
    const rows = existing
      ? await executor.query<StoredImageTurn>(
          `UPDATE studio_image_turns SET state = 'thinking', model_attempts = CASE WHEN draft_json IS NULL AND NOT $5::boolean THEN model_attempts + 1 ELSE model_attempts END, lease_id = $4, lease_expires_at = clock_timestamp() + INTERVAL '3 minutes', updated_at = clock_timestamp() WHERE user_id = $1 AND project_id = $2 AND request_id = $3 RETURNING ${IMAGE_TURN_COLUMNS}`,
          [actor.userId, actor.projectId, parsed.requestId, lease, responseReplayOnly],
        )
      : await executor.query<StoredImageTurn>(
          `INSERT INTO studio_image_turns (user_id, project_id, request_id, request_hash, input_json, lease_id, lease_expires_at, draft_json, draft_reference_fingerprint) VALUES ($1,$2,$3,$4,$5::jsonb,$6,clock_timestamp() + INTERVAL '3 minutes',$7::jsonb,$8) RETURNING ${IMAGE_TURN_COLUMNS}`,
          [
            actor.userId,
            actor.projectId,
            parsed.requestId,
            hash,
            JSON.stringify(parsed),
            lease,
            renewal ? JSON.stringify(renewal.draft_json) : null,
            renewal?.draft_reference_fingerprint ?? null,
          ],
        );
    if(!existing)await automaticallyNameStudioProject(actor,'message',parsed.message,executor);
    return { turn: rows[0], claimed: true, responseReplayOnly };
  });
}
export async function persistImageDraft(
  actor: StudioGenerationActor,
  turn: StoredImageTurn,
  draft: ImageDraft,
  referenceFingerprint: string,
) {
  const parsed = imageDraftSchema.parse(draft);
  await withDbTransaction(async executor => {
    await executor.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`studio-image:${actor.userId}`]);
    const rows = await executor.query(
      `UPDATE studio_image_turns SET draft_json = $5::jsonb, state = $6, draft_reference_fingerprint = $7, updated_at = clock_timestamp() WHERE user_id = $1 AND project_id = $2 AND request_id = $3 AND lease_id = $4 AND state = 'thinking' AND lease_expires_at > clock_timestamp() RETURNING request_id`,
      [
        actor.userId,
        actor.projectId,
        turn.request_id,
        turn.lease_id,
        JSON.stringify(parsed),
        hasDraftCreation(parsed) ? "thinking" : "ready",
        referenceFingerprint,
      ],
    );
    if (!rows.length)
      throw new AgentApiError(
        "PARAMETER_INVALID",
        "This message has been superseded.",
      );
    // Draft persistence and expiry share a transaction: a stale writer must not
    // discard valid quotes, and a changed creation must require fresh consent.
    if (hasDraftCreation(parsed)) await expirePreparedCreationQuotes(actor, executor);
  });
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
