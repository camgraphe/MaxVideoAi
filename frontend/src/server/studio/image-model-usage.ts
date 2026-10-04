import { query } from "@/lib/db";
import { AgentApiError } from "@/server/agent-api/errors";
import type { StudioGenerationActor } from "@/server/agent-api/generation-actor";
import type { ResolvedReference } from "@/server/agent-api/reference-types";
import type { ImageTurnInput, ImageConversationHistoryTurn } from "@/lib/studio/image-conversation-contract";
import type { ImageDirector, ImageDirectorTelemetry } from "./image-conversation-director";
import type { StoredImageTurn } from "./image-conversation-repository";

export type ImageModelUsage = {
  requestId: string;
  attemptId: string;
  state: "started" | "reported" | "unknown";
  response: ImageDirectorTelemetry | null;
  createdAt: Date;
};

/** Server-only provider evidence; customer quotes and billing remain canonical. */
export async function listImageModelUsage(actor: StudioGenerationActor): Promise<ImageModelUsage[]> {
  return query(`SELECT request_id AS "requestId", lease_id AS "attemptId", state,
    response_json AS response, created_at AS "createdAt" FROM studio_image_model_usage
    WHERE user_id = $1 AND project_id = $2 ORDER BY created_at, lease_id`, [actor.userId, actor.projectId]);
}

export async function runMeteredImageDirector(
  actor: StudioGenerationActor,
  turn: StoredImageTurn,
  director: ImageDirector,
  input: ImageTurnInput,
  history: ImageConversationHistoryTurn[],
  references: ResolvedReference[],
) {
  const scope = [actor.userId, actor.projectId, turn.request_id, turn.lease_id];
  // If usage storage is unavailable, stop before the paid text call.
  const started = await query(`INSERT INTO studio_image_model_usage (user_id, project_id, request_id, lease_id)
    SELECT user_id, project_id, request_id, lease_id FROM studio_image_turns t
    WHERE user_id = $1 AND project_id = $2 AND request_id = $3 AND lease_id = $4
      AND state = 'thinking' AND draft_json IS NULL
      AND EXISTS (SELECT 1 FROM studio_projects p WHERE p.id = t.project_id AND p.user_id = t.user_id AND p.deleted_at IS NULL)
    RETURNING lease_id`, scope);
  if (!started.length) throw new AgentApiError("PARAMETER_INVALID", "This message has been superseded.");
  let reported = false;
  try {
    return await director(input, history, references, async (event) => {
      // Whitelist metadata only. Never retain prompts, references, keys or outputs.
      const response: ImageDirectorTelemetry = {
        responseId: event.responseId, model: event.model, status: event.status,
        serviceTier: event.serviceTier, usage: event.usage, elapsedMs: event.elapsedMs,
      };
      const saved = await query(`UPDATE studio_image_model_usage SET state = 'reported', response_id = $5, response_json = $6::jsonb
        WHERE user_id = $1 AND project_id = $2 AND request_id = $3 AND lease_id = $4 AND state <> 'reported' RETURNING lease_id`,
        [...scope, response.responseId, JSON.stringify(response)]);
      reported = saved.length > 0;
    });
  } finally {
    if (!reported) {
      try {
        await query(`UPDATE studio_image_model_usage SET state = 'unknown'
          WHERE user_id = $1 AND project_id = $2 AND request_id = $3 AND lease_id = $4 AND state = 'started'`, scope);
      } catch {
        // Leave 'started' unresolved. Never hide it as zero or repeat a text call.
        console.warn("[studio-model-usage] usage checkpoint unavailable");
      }
    }
  }
}
