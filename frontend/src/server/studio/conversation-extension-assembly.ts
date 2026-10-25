import {query} from '@/lib/db';
import {createHash} from 'node:crypto';
import type {ToolAssetRef} from '@/lib/toolbox/contract';
import type {StudioMediaIntent} from '@/lib/studio/conversation-media-contract';
import type {StudioConversationTimeline} from '@/lib/studio/conversation-editing-contract';
import {studioExtensionAssemblyPlanSchema,type StudioExtensionAssemblyPlan,type ImageConversationTurn} from '@/lib/studio/image-conversation-contract';
import {editStudioConversationTimeline,type ConversationEditDependencies} from './conversation-edit-command';
import {resolveStudioMedia,type StudioResolvedMedia} from './media-resolver';
import {StudioConnectedPersistenceError} from './montage-command';

/** Stable original identity plus known facts; qualification may fill unknown facts. */
export function studioExtensionSourceSnapshot(media:StudioResolvedMedia) {
  return {sourceOriginalHash:createHash('sha256').update(JSON.stringify([media.kind,media.url,media.mime])).digest('hex'),
    sourceDurationSec:media.mediaFacts?.source==='probe'?media.mediaFacts.durationSec??null:null,sourceSizeBytes:media.sizeBytes??null};
}

const commandKey=(requestId:string)=>`extension:${requestId}`;
function sameRef(left:ToolAssetRef|undefined,right:ToolAssetRef):boolean {
  return !!left&&left.type===right.type&&left.kind===right.kind&&(left.type==='asset'&&right.type==='asset'?left.assetId===right.assetId:left.type==='job-output'&&right.type==='job-output'&&left.jobId===right.jobId&&left.outputId===right.outputId);
}

/** Freeze only an unambiguous whole-source extension; never overwrite an edited source. */
export function planStudioExtensionAssembly(action:StudioMediaIntent,timeline:StudioConversationTimeline,sourceDurationSec:number|null,snapshot:ReturnType<typeof studioExtensionSourceSnapshot>):StudioExtensionAssemblyPlan|undefined {
  if(action.action!=='video.prepare'||action.mode!=='extend'||action.assembleExtension===false)return;
  const source=action.source??action.references?.find(ref=>ref.role==='source')?.ref;
  if(!source||source.kind!=='video')return;
  const direction=action.settings?.find(setting=>setting.name==='extendPosition')?.value;
  if(direction!=null&&!['before','after','start','end'].includes(String(direction)))return;
  const position=direction==='before'||direction==='start'?'before':'after';
  const visuals=timeline.clips.filter(clip=>clip.kind!=='audio');
  const original=visuals.find(clip=>sameRef(clip.ref,source));
  const includeSource=visuals.length===0;
  if(!includeSource&&(!original||sourceDurationSec===null||original.sourceInFrame!==0
    ||original.durationFrames!==Math.floor(sourceDurationSec*timeline.fps+1e-6)
    ||(position==='before'?original.startFrame!==0:original.startFrame+original.durationFrames!==Math.max(...visuals.map(clip=>clip.startFrame+clip.durationFrames)))))return;
  return {sequenceId:timeline.sequenceId,expectedRevision:timeline.revision,fps:timeline.fps,source,includeSource,position,...snapshot};
}

type ExtensionActor={userId:string;projectId:string};
type ExtensionDependencies={query?:typeof query;editDependencies?:ConversationEditDependencies};

/** Explicit POST only. The accepted quote and frozen draft select media; no model or new spending. */
export async function finishStudioExtensionAssembly(actor:ExtensionActor,requestId:string,dependencies:ExtensionDependencies={}) {
  const rows=await(dependencies.query??query)<{draft_json:{extensionAssembly?:unknown};job_id:string;output_id:string}>(`
    SELECT t.draft_json,q.job_id,o.id AS output_id FROM studio_image_turns t
    JOIN studio_projects p ON p.id=t.project_id AND p.user_id=t.user_id AND p.deleted_at IS NULL
    JOIN mcp_generation_quotes q ON q.quote_id=t.quote_id AND q.user_id=t.user_id AND q.studio_project_id=t.project_id
    JOIN app_jobs j ON j.job_id=q.job_id AND j.user_id=q.user_id
    JOIN job_outputs o ON o.job_id=j.job_id AND o.user_id=j.user_id
    WHERE t.user_id=$1 AND t.project_id=$2 AND t.request_id=$3
      AND q.auth_origin='studio-session' AND q.state='accepted' AND q.request_json->>'mode'='extend'
      AND j.status='completed' AND j.hidden IS NOT TRUE AND o.kind='video' AND o.status='ready'
    ORDER BY o.id LIMIT 2`,[actor.userId,actor.projectId,requestId]);
  if(rows.length!==1)throw new StudioConnectedPersistenceError('EXTENSION_NOT_READY',409);
  const row=rows[0],plan=studioExtensionAssemblyPlanSchema.parse(row.draft_json.extensionAssembly);
  const continuation:ToolAssetRef={type:'job-output',jobId:row.job_id,outputId:row.output_id,kind:'video'};
  const refs=plan.includeSource?(plan.position==='before'?[continuation,plan.source]:[plan.source,continuation]):[continuation];
  return editStudioConversationTimeline(actor,{projectId:actor.projectId,sequenceId:plan.sequenceId,expectedRevision:plan.expectedRevision,idempotencyKey:commandKey(requestId),
    edit:{kind:'assemble',clips:refs.map((ref,index)=>({ref,startFrame:plan.position==='before'&&index===0?0:null,durationFrames:null,sourceInFrame:0}))}},
    {...dependencies.editDependencies,featureEnabled:true,beforeMutation:async executor=>{
      await dependencies.editDependencies?.beforeMutation?.(executor);
      if(plan.source.type==='job-output'){
        const owned=await executor.query(`SELECT q.quote_id FROM mcp_generation_quotes q JOIN app_jobs j ON j.job_id=q.job_id AND j.user_id=q.user_id
          WHERE q.user_id=$1 AND q.studio_project_id=$2 AND q.job_id=$3 AND q.auth_origin='studio-session' AND q.state='accepted'
            AND j.status='completed' AND j.hidden IS NOT TRUE FOR SHARE OF q,j`,[actor.userId,actor.projectId,plan.source.jobId]);
        if(!owned[0])throw new Error('MEDIA_NOT_AVAILABLE');
      }
      const original=await resolveStudioMedia(actor.userId,plan.source,(sql,values)=>executor.query(sql,values),{lockAsset:true});
      const current=studioExtensionSourceSnapshot(original);
      if(current.sourceOriginalHash!==plan.sourceOriginalHash
        ||(plan.sourceDurationSec!==null&&current.sourceDurationSec!==plan.sourceDurationSec)
        ||(plan.sourceSizeBytes!==null&&current.sourceSizeBytes!==plan.sourceSizeBytes))
        throw new StudioConnectedPersistenceError('EXTENSION_SOURCE_CHANGED',409);
    }});
}

/** Receipt/revision facts only; GET never assembles or qualifies media. */
export async function readStudioExtensionAssembly(actor:ExtensionActor,requestId:string,plan:StudioExtensionAssemblyPlan):Promise<NonNullable<ImageConversationTurn['extensionAssembly']>> {
  const rows=await query<{revision:number;safe_result:{totalFrames:number}|null}>(`
    SELECT p.revision,c.safe_result FROM studio_projects p LEFT JOIN studio_project_commands c
      ON c.user_id=p.user_id AND c.project_id=p.id AND c.command_kind='conversation_timeline_edit'
      AND c.command_version=1 AND c.idempotency_key=$3
    WHERE p.id=$1 AND p.user_id=$2 AND p.deleted_at IS NULL`,[actor.projectId,actor.userId,commandKey(requestId)]);
  if(rows[0]?.safe_result)return {state:'saved',durationSec:rows[0].safe_result.totalFrames/plan.fps};
  return {state:rows[0]&&Number(rows[0].revision)===plan.expectedRevision?'pending':'blocked'};
}
