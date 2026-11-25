import { query } from '@/lib/db';
import type { StudioGenerationActor } from '@/server/agent-api/generation-actor';

const referenceErrors = ['REFERENCE_INVALID', 'REFERENCE_REQUIRED', 'REFERENCE_NOT_FOUND'];
export const isStudioReferenceError = (code: string) => referenceErrors.includes(code);

const deterministicErrors = [...referenceErrors, 'PARAMETER_INVALID', 'MODE_UNSUPPORTED'];
export const isStudioPreparationError = (code: string) => deterministicErrors.includes(code);

/** Attribute a stop only to the final recorded tool call in that exact segment. A later
 * response, pending action, successful correction or unknown usage is not evidence. */
export async function readStudioPreparationRefusals(actor: StudioGenerationActor, requestIds: string[]) {
  if (!requestIds.length) return new Map<string, string>();
  const rows = await query<{request_id: string; code: string}>(
    `SELECT t.request_id,s.result_json->'error'->>'code' AS code
     FROM studio_image_turns t JOIN studio_projects p ON p.id=t.project_id AND p.user_id=t.user_id AND p.deleted_at IS NULL
     JOIN LATERAL (SELECT call_id,state,action_json,result_json FROM studio_conversation_steps
       WHERE user_id=t.user_id AND project_id=t.project_id AND request_id=t.request_id
       ORDER BY created_at DESC,call_id DESC LIMIT 1) s ON true
     JOIN LATERAL (SELECT state,response_json FROM studio_conversation_responses
       WHERE user_id=t.user_id AND project_id=t.project_id AND request_id=t.request_id
       ORDER BY created_at DESC,response_index DESC LIMIT 1) r ON true
     WHERE t.user_id=$1 AND t.project_id=$2 AND t.request_id=ANY($3::uuid[]) AND t.state='failed'
       AND t.quote_id IS NULL AND t.draft_json IS NULL
       AND s.state='completed' AND s.result_json->'ok'='false'::jsonb AND s.result_json->'error'->'retryable'='false'::jsonb
       AND s.result_json->>'action'=s.action_json->>'action' AND s.action_json->>'action' LIKE '%.prepare'
       AND s.result_json->'error'->>'code'=ANY($4::text[]) AND r.state='reported'
       AND EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(r.response_json->'output')='array' THEN r.response_json->'output' ELSE '[]'::jsonb END) call
         WHERE call->>'type'='function_call' AND call->>'call_id'=s.call_id)`,
    [actor.userId, actor.projectId, requestIds, deterministicErrors],
  );
  return new Map(rows.map(row => [row.request_id, row.code]));
}
