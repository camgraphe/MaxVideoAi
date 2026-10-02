import {AgentApiError} from '@/server/agent-api/errors';
import {randomUUID} from 'node:crypto';
import {query,withDbTransaction,type TransactionQueryExecutor} from '@/lib/db';
import {studioExportPreparationSchema,studioExportConfirmationSchema,studioExportReadSchema,studioPreparedExportSchema,type StudioPreparedExport} from '@/lib/studio/conversation-export-contract';
import {readStudioWorkspace} from './workspace-command';
import {buildWorkspaceTimelineRenderManifest} from '@/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-render';
import {buildWorkspaceTimelineVideoExportRequest,type WorkspaceTimelineVideoExportRequest} from '@/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-export';
import type {WorkspaceTimelineItem,WorkspaceGraphNode,WorkspaceProjectSettings} from '@/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';
import {filterHiddenVideoTrackItems,muteAudioTrackItems} from '@/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-selection';
import {coerceVideoTrackCount,coerceAudioTrackCount,coerceHiddenVideoTracks,coerceMutedAudioTracks} from '@/app/(core)/(workspace)/app/studio/workspace/_state/workspace-state';
import {parseTimelineExportRequest} from '@/server/timeline-exports/render-request';
import {estimateOwnedTimelineExport,submitOwnedTimelineExport} from '@/server/timeline-exports/orchestration';
import {timelineExportManifestHash} from '@/server/timeline-exports/estimate-token';
import {timelineExportIdFromIdempotencyKey,type TimelineExportJobRecord} from '@/server/timeline-exports/repository';
import {ownedTimelineExportJobResponse} from '@/server/timeline-exports/media-access';

export type StudioExportActor={userId:string;authOrigin:'studio-session'|'oauth';clientId:string|null};
type StoredPreparation={scope:Pick<StudioExportActor,'authOrigin'|'clientId'>;request:WorkspaceTimelineVideoExportRequest;estimateToken:string};
type PreparationReceipt={request_hash:string;request_payload:StoredPreparation;safe_result:StudioPreparedExport};
export type StudioExportDependencies={
  enabled:boolean;requestOrigin:string;
  estimate?:typeof estimateOwnedTimelineExport;submit?:typeof submitOwnedTimelineExport;
  readJob?:(params:{userId:string;idempotencyKey:string})=>Promise<TimelineExportJobRecord|null>;
  projectJob?:typeof ownedTimelineExportJobResponse;
  onPrepared?:(quote:StudioPreparedExport,executor:TransactionQueryExecutor)=>Promise<void>;
};
export class StudioExportCommandError extends Error {
  constructor(readonly code:string,readonly status=400){super(code);}
}
function authorize(actor:StudioExportActor,dependencies:StudioExportDependencies){
  if(!actor.userId||actor.userId!==actor.userId.trim()||!['studio-session','oauth'].includes(actor.authOrigin)
    ||(actor.authOrigin==='studio-session'?actor.clientId!==null:!actor.clientId?.trim()))throw new StudioExportCommandError('UNAUTHORIZED',401);
  if(!dependencies.enabled)throw new StudioExportCommandError('STUDIO_EXPORTS_UNAVAILABLE',404);
}
function scope(actor:StudioExportActor){return {authOrigin:actor.authOrigin,clientId:actor.clientId};}
function sameScope(actor:StudioExportActor,receipt:PreparationReceipt){return receipt.request_payload.scope.authOrigin===actor.authOrigin&&receipt.request_payload.scope.clientId===actor.clientId;}
async function findJob({userId,idempotencyKey}:{userId:string;idempotencyKey:string}){
  // Observation never creates tables or starts a worker.
  const table=await query<{name:string|null}>("SELECT to_regclass('public.app_timeline_exports') AS name");
  if(!table[0]?.name)return null;
  return (await query<TimelineExportJobRecord>('SELECT * FROM app_timeline_exports WHERE user_id=$1 AND idempotency_key=$2',[userId,idempotencyKey]))[0]??null;
}
async function readReceipt(actor:StudioExportActor,projectId:string,quoteId:string,executor:TransactionQueryExecutor){
  const receipts=await executor.query<PreparationReceipt>(`SELECT request_hash,request_payload,safe_result FROM studio_project_commands
    WHERE user_id=$1 AND project_id=$2 AND command_kind='timeline_export_prepare' AND command_version=1 AND safe_result->>'quoteId'=$3`,[actor.userId,projectId,quoteId]);
  const receipt=receipts[0];
  if(!receipt||!sameScope(actor,receipt))throw new StudioExportCommandError('EXPORT_QUOTE_NOT_FOUND',404);
  studioPreparedExportSchema.parse(receipt.safe_result);
  return receipt;
}
/** Saved sequence snapshot and signed estimate stay private; the returned quote contains no media grants or token. */
export async function prepareStudioTimelineExport(actor:StudioExportActor,rawInput:unknown,dependencies:StudioExportDependencies):Promise<StudioPreparedExport>{
  authorize(actor,dependencies);
  const input=studioExportPreparationSchema.parse(rawInput);
  const commandKey='export:'+timelineExportManifestHash({scope:scope(actor),idempotencyKey:input.idempotencyKey});
  const requestHash=timelineExportManifestHash({scope:scope(actor),input});
  const read=async(executor:TransactionQueryExecutor)=>{
    const workspace=await readStudioWorkspace(actor,input.projectId,{withTransaction:callback=>callback(executor)});
    const receipts=await executor.query<PreparationReceipt>(`SELECT request_hash,request_payload,safe_result FROM studio_project_commands WHERE user_id=$1 AND command_kind='timeline_export_prepare' AND command_version=1 AND idempotency_key=$2`,[actor.userId,commandKey]);
    if(receipts[0]){
      if(receipts[0].request_hash!==requestHash||!sameScope(actor,receipts[0]))throw new StudioExportCommandError('EXPORT_IDEMPOTENCY_CONFLICT',409);
      return {workspace,quote:studioPreparedExportSchema.parse(receipts[0].safe_result)};
    }
    if(workspace.project.revision!==input.expectedRevision)throw new StudioExportCommandError('EXPORT_PROJECT_STATE_STALE',409);
    if(!workspace.sequences.some(sequence=>sequence.id===input.sequenceId))throw new StudioExportCommandError('STUDIO_SEQUENCE_CONFLICT',404);
    return {workspace,quote:null};
  };
  const initial=await withDbTransaction(read);
  if(initial.quote){await withDbTransaction(async tx=>{await read(tx);await dependencies.onPrepared?.(initial.quote!,tx);});return initial.quote;}
  const sequence=initial.workspace.sequences.find(sequence=>sequence.id===input.sequenceId)!;
  const state=sequence.timelineState as {timelineItems:WorkspaceTimelineItem[];hiddenVideoTracks?:unknown;mutedAudioTracks?:unknown;videoTrackCount?:unknown;audioTrackCount?:unknown};
  const settings=sequence.settings as WorkspaceProjectSettings;
  const quoteId=randomUUID();
  const idempotencyKey='studio-export:'+quoteId;
  const createdAt=initial.workspace.project.updatedAt;
  const items=muteAudioTrackItems(
    filterHiddenVideoTrackItems(state.timelineItems,coerceHiddenVideoTracks(state.hiddenVideoTracks,coerceVideoTrackCount(state.videoTrackCount,state.timelineItems))),
    coerceMutedAudioTracks(state.mutedAudioTracks,coerceAudioTrackCount(state.audioTrackCount,state.timelineItems)),
  );
  const manifest=buildWorkspaceTimelineRenderManifest({items,nodes:(initial.workspace.project.workspaceState as {nodes:WorkspaceGraphNode[]}).nodes,projectName:initial.workspace.project.name,sequenceId:sequence.id,sequenceName:sequence.name,projectSettings:settings,createdAt});
  const request=parseTimelineExportRequest(buildWorkspaceTimelineVideoExportRequest(manifest,{projectId:input.projectId,idempotencyKey,createdAt,qualityPreset:input.qualityPreset,includeAudio:input.includeAudio}));
  const estimated=await (dependencies.estimate??estimateOwnedTimelineExport)({userId:actor.userId,requestOrigin:dependencies.requestOrigin,rawRequest:request});
  if(!estimated.body.ok)throw new StudioExportCommandError(estimated.body.error,estimated.status);
  const estimate=estimated.body;
  const quote=studioPreparedExportSchema.parse({quoteId,exportId:timelineExportIdFromIdempotencyKey(idempotencyKey,actor.userId),projectId:input.projectId,sequenceId:sequence.id,revision:input.expectedRevision,durationSec:manifest.durationSec,resolution:settings.resolution,aspectRatio:settings.aspectRatio,fps:settings.fps,qualityPreset:input.qualityPreset,includeAudio:input.includeAudio,price:{amountCents:estimate.estimate.amountCents,currency:estimate.estimate.currency,billingKind:estimate.estimate.billingKind},expiresAt:new Date(estimate.estimateExpiresAt*1000).toISOString(),confirmationRequired:true});
  return withDbTransaction(async executor=>{
    await executor.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[actor.userId+':'+commandKey]);
    const current=await read(executor);
    if(current.quote){await dependencies.onPrepared?.(current.quote,executor);return current.quote;}
    await executor.query(`INSERT INTO studio_project_commands(user_id,command_kind,command_version,idempotency_key,request_hash,project_id,sequence_id,request_payload,safe_result)
      VALUES($1,'timeline_export_prepare',1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)`,[actor.userId,commandKey,requestHash,input.projectId,sequence.id,JSON.stringify({scope:scope(actor),request,estimateToken:estimate.estimateToken}),JSON.stringify(quote)]);
    await dependencies.onPrepared?.(quote,executor);
    return quote;
  });
}
/** Human adapter only: Sol has no confirmation tool. Accepted job recovery ignores later edits and expired tokens. */
export async function confirmStudioTimelineExport(actor:StudioExportActor,rawInput:unknown,dependencies:StudioExportDependencies){
  authorize(actor,dependencies);
  const parsed=studioExportConfirmationSchema.safeParse(rawInput);
  if(!parsed.success)throw new StudioExportCommandError('CONFIRMATION_REQUIRED',409);
  const input=parsed.data;
  return withDbTransaction(async executor=>{
    await executor.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[actor.userId+':export-confirm:'+input.quoteId]);
    const workspace=await readStudioWorkspace(actor,input.projectId,{withTransaction:callback=>callback(executor)});
    const receipt=await readReceipt(actor,input.projectId,input.quoteId,executor);
    const job=await (dependencies.readJob??findJob)({userId:actor.userId,idempotencyKey:receipt.request_payload.request.idempotencyKey});
    if(job)return {ok:true as const,export:await (dependencies.projectJob??ownedTimelineExportJobResponse)(job,actor.userId),reused:true};
    if(workspace.project.revision!==receipt.safe_result.revision)throw new StudioExportCommandError('EXPORT_PROJECT_STATE_STALE',409);
    const submitted=await (dependencies.submit??submitOwnedTimelineExport)({userId:actor.userId,requestOrigin:dependencies.requestOrigin,rawRequest:receipt.request_payload.request,estimateToken:receipt.request_payload.estimateToken});
    if(!submitted.body.ok)throw new StudioExportCommandError(submitted.body.error,submitted.status);
    return submitted.body;
  });
}
export async function readStudioTimelineExport(actor:StudioExportActor,rawInput:unknown,dependencies:StudioExportDependencies){
  authorize(actor,dependencies);
  const input=studioExportReadSchema.parse(rawInput);
  const receipt=await withDbTransaction(async executor=>{
    await readStudioWorkspace(actor,input.projectId,{withTransaction:callback=>callback(executor)});
    return readReceipt(actor,input.projectId,input.quoteId,executor);
  });
  const job=await (dependencies.readJob??findJob)({userId:actor.userId,idempotencyKey:receipt.request_payload.request.idempotencyKey});
  return job?await (dependencies.projectJob??ownedTimelineExportJobResponse)(job,actor.userId):null;
}

export function asStudioExportAgentError(error: unknown) {
  if (error instanceof AgentApiError) return error;
  const code=error instanceof Error ? error.message : '';
  if (code==='UNAUTHORIZED') return new AgentApiError('AUTH_REQUIRED','Connect MaxVideoAI before exporting a Studio film.');
  if (['EXPORT_NOT_FOUND','EXPORT_QUOTE_NOT_FOUND','STUDIO_PROJECT_NOT_FOUND','STUDIO_SEQUENCE_CONFLICT'].includes(code)) return new AgentApiError('REFERENCE_NOT_FOUND','This project, sequence or export quote is not available.');
  if (code==='STUDIO_CONNECTED_SCHEMA_UNAVAILABLE') return new AgentApiError('RATE_LIMITED','Connected Studio storage is temporarily unavailable. Retry the same operation after it recovers.',true);
  if (['EXPORT_ESTIMATE_EXPIRED','EXPORT_ESTIMATE_CHANGED','EXPORT_ESTIMATE_REQUIRED','EXPORT_ESTIMATE_INVALID','EXPORT_PROJECT_STATE_STALE'].includes(code)) return new AgentApiError('QUOTE_EXPIRED','The saved cut or its export quote changed. Prepare a fresh quote and review it before confirming.');
  if (code==='CONFIRMATION_REQUIRED') return new AgentApiError('CONFIRMATION_REQUIRED','Confirm the exact export quote before starting a render.');
  if (code==='INSUFFICIENT_WALLET_BALANCE') return new AgentApiError('INSUFFICIENT_FUNDS','The wallet cannot cover this export quote.');
  if (['STUDIO_EXPORTS_UNAVAILABLE','TIMELINE_EXPORT_WORKER_NOT_CONFIGURED'].includes(code)) return new AgentApiError('ENGINE_UNAVAILABLE','Studio export is not available in this environment.');
  if (code==='TIMELINE_EXPORT_WORKER_LAUNCH_FAILED') return new AgentApiError('JOB_FAILED','The render worker could not start. Read the saved export status before requesting another quote.');
  if (['EXPORT_IDEMPOTENCY_CONFLICT','EXPORT_MANIFEST_BLOCKED','INVALID_EXPORT_REQUEST','STUDIO_CONNECTED_PROJECT_REQUIRED'].includes(code)) return new AgentApiError('PARAMETER_INVALID',code==='EXPORT_IDEMPOTENCY_CONFLICT'?'This export identity belongs to a different request.':'Save a valid connected sequence before preparing its export.');
  return error;
}
