import {query,type QueryExecutor} from '@/lib/db';
import type {StudioConversationRender} from '@/lib/studio/conversation-export-contract';

type RenderRow=Omit<StudioConversationRender,'createdAt'|'updatedAt'|'startedAt'|'completedAt'|'failedAt'|'durationSec'|'billing'|'message'>&{
  createdAt:Date;updatedAt:Date;startedAt:Date|null;completedAt:Date|null;failedAt:Date|null;durationSec:string|number;
  amountCents:number;currency:string;billingKind:string;
};
const isoDate=(value:Date|string|null)=>value===null?null:new Date(value).toISOString();

/** Manual footer submissions and conversation exports share this bounded, SELECT-only owner. */
export async function readStudioConversationRenderFacts(actor:{userId:string;projectId:string},exportId?:string,executor:QueryExecutor={query}):Promise<StudioConversationRender[]> {
  const table=(await executor.query<{name:string|null}>("SELECT to_regclass('public.app_timeline_exports') AS name"))[0];
  if(!table?.name)return [];
  const rows=await executor.query<RenderRow>(`SELECT e.id,s.id AS "sequenceId",e.status,e.progress,
    e.created_at AS "createdAt",e.updated_at AS "updatedAt",e.started_at AS "startedAt",e.completed_at AS "completedAt",e.failed_at AS "failedAt",
    e.duration_sec AS "durationSec",e.resolution,e.fps,e.quality_preset AS "qualityPreset",
    e.render_manifest->'projectSettings'->>'aspectRatio' AS "aspectRatio",
    CASE WHEN jsonb_typeof(e.export_settings->'includeAudio')='boolean' THEN (e.export_settings->>'includeAudio')::boolean ELSE NULL END AS "includeAudio",
    e.status='completed' AND e.output_url IS NOT NULL AS "artifactAvailable",e.billing_status AS "billingStatus",
    e.amount_cents AS "amountCents",e.currency,e.billing_kind AS "billingKind"
    FROM app_timeline_exports e
    JOIN studio_sequences s ON s.id=e.render_manifest->>'sequenceId' AND s.user_id=e.user_id
    JOIN studio_projects p ON p.id=s.project_id AND p.user_id=s.user_id
    WHERE p.id=$1 AND p.user_id=$2 AND p.deleted_at IS NULL AND s.deleted_at IS NULL
      ${exportId?'AND e.id=$3':''}
    ORDER BY e.created_at DESC,e.id LIMIT ${exportId?'1':'8'}`,[actor.projectId,actor.userId,...exportId?[exportId]:[]]);
  return rows.map(({amountCents,currency,billingKind,...row})=>({
    ...row,durationSec:Number(row.durationSec),createdAt:isoDate(row.createdAt)!,updatedAt:isoDate(row.updatedAt)!,
    startedAt:isoDate(row.startedAt),completedAt:isoDate(row.completedAt),failedAt:isoDate(row.failedAt),
    // Worker messages can contain storage/provider diagnostics. Status is the
    // authoritative evidence; do not send arbitrary worker text to the model.
    message:row.status==='failed'?'The export failed.':row.status==='canceled'?'The export was canceled.':null,
    ...(Number.isSafeInteger(amountCents)&&amountCents>=0&&/^[A-Z]{3}$/.test(currency)&&(billingKind==='free'||billingKind==='paid')
      ?{billing:{amountCents,currency,billingKind}}:{}),
  }));
}
