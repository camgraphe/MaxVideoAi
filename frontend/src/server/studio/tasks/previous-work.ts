import {query} from '@/lib/db';
import type {StudioGenerationActor} from '@/server/agent-api/generation-actor';
import {studioComparisonFingerprint} from '../conversation-comparison-recovery';
import {projectStudioQuoteSettings} from '../conversation-quote-facts';
import type {StudioTaskExecution} from './execution';

type PreviousWork=NonNullable<StudioTaskExecution['previousWork']>[number];
const record=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const token=(value:unknown,max=128)=>typeof value==='string'&&value.length<=max&&/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value)?value:undefined;
const positive=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)&&value>0?value:null;
const tokens=(value:unknown)=>Array.isArray(value)?value.flatMap(v=>token(v,64)?[v as string]:[]).slice(0,16):[];

function modeFacts(value:unknown) {
  const mode=record(value),duration=record(mode.duration),range=record(duration.range);
  return {modelId:token(mode.modelId),mode:token(mode.mode,64),
    duration:mode.duration===null?null:{options:Array.isArray(duration.options)?duration.options.filter(v=>positive(v)!==null).slice(0,64):null,
      range:positive(range.min)!==null&&positive(range.max)!==null?{min:range.min,max:range.max}:null},
    ...(Array.isArray(duration.options)&&duration.options.length>64?{durationOptionsTruncated:true}:{}),
    durationPolicy:token(mode.durationPolicy,32),audio:token(mode.audio,32),resolutions:tokens(mode.resolutions),aspectRatios:tokens(mode.aspectRatios)};
}
function comparisonFacts(value:unknown) {
  const action=record(value);
  if(action.action!=='pricing.compare')return undefined;
  const settings=Array.isArray(action.settings)?Object.fromEntries(action.settings.map(v=>{const s=record(v);return [String(s.name),s.value];})):{};
  const references=Array.isArray(action.references)?action.references:[];
  return {action:'pricing.compare',surface:token(action.surface,32),mode:token(action.mode,64),
    settings:Object.entries(projectStudioQuoteSettings(settings)).map(([name,value])=>({name,value})),
    referenceCount:references.length,referenceRoles:references.flatMap(v=>token(record(v).role,32)?[record(v).role]:[]).slice(0,16),
    baselineModelId:token(action.baselineModelId),candidateModelIds:tokens(action.candidateModelIds),outputCount:positive(action.outputCount)};
}
function resultFacts(value:unknown) {
  const result=record(value);
  if(result.ok===false){
    const error=record(result.error),next=record(error.nextAction);
    return {ok:false,action:token(result.action,64),error:{code:token(error.code,64),
      message:typeof error.message==='string'?error.message.replace(/https?:\/\/\S+/gi,'[redacted URL]').slice(0,800):'',retryable:error.retryable===true,
      nextAction:next.type==='generation_comparison'?{type:'generation_comparison',reason:token(next.reason,64),
        requestedDurationSec:positive(next.requestedDurationSec),durationMismatch:next.durationMismatch===true,catalogFingerprint:token(next.catalogFingerprint,64),modelsOrder:token(next.modelsOrder,64),
        models:Array.isArray(next.models)?next.models.slice(0,8).map(modeFacts):[],modelsTruncated:next.modelsTruncated===true}:null}};
  }
  const data=record(result.data);
  return result.ok===true&&result.action==='model.details'?{ok:true,action:'model.details',data:{modelId:token(data.modelId),surface:token(data.surface,32),
    modes:Array.isArray(data.modes)?data.modes.slice(0,8).map(modeFacts):[]}}:undefined;
}
function compactWork(row:PreviousWork):PreviousWork {
  const result=record(row.result),error=record(result.error),next=record(error.nextAction);
  return {action:row.action,callId:row.callId,completed:true,historical:true,factsTruncated:true,
    ...(row.comparisonFingerprint?{comparisonFingerprint:row.comparisonFingerprint}:{}),
    ...(result.ok===false?{result:{...result,error:{...error,message:typeof error.message==='string'?error.message.slice(0,160):'',
      nextAction:next.type==='generation_comparison'?{type:next.type,reason:next.reason,requestedDurationSec:next.requestedDurationSec,durationMismatch:next.durationMismatch,catalogFingerprint:next.catalogFingerprint,modelsTruncated:true}:null}}}: {})};
}

/** Bounded historical operational evidence, never provider output, authored prompts or current prices. */
export async function readStudioTaskPreviousWork(actor:StudioGenerationActor,taskRequestId:string,segmentRequestId:string):Promise<PreviousWork[]> {
  const rows=await query<PreviousWork>(`SELECT c.action_json->>'action' action,c.call_id AS "callId",true completed,true historical,
    CASE WHEN c.action_json->>'action'='timeline.edit' AND c.result_json->>'ok'='true' THEN c.action_json ELSE NULL END details,
    CASE WHEN c.action_json->>'action'='pricing.compare' THEN c.action_json-'prompt' ELSE NULL END comparison,
    CASE WHEN c.result_json->>'ok'='false' THEN jsonb_build_object('ok',false,'action',c.action_json->>'action','error',
      jsonb_build_object('code',c.result_json->'error'->>'code','message',left(c.result_json->'error'->>'message',800),
        'retryable',c.result_json->'error'->'retryable','nextAction',CASE WHEN c.result_json->'error'->'nextAction'->>'type'='generation_comparison'
          THEN jsonb_build_object('type','generation_comparison','reason',c.result_json->'error'->'nextAction'->>'reason',
            'requestedDurationSec',c.result_json->'error'->'nextAction'->'requestedDurationSec',
            'durationMismatch',c.result_json->'error'->'nextAction'->'durationMismatch',
            'catalogFingerprint',c.result_json->'error'->'nextAction'->>'catalogFingerprint',
            'modelsOrder',c.result_json->'error'->'nextAction'->>'modelsOrder',
            'modelsTruncated',c.result_json->'error'->'nextAction'->'modelsTruncated',
            'models',(SELECT jsonb_agg(jsonb_build_object('modelId',m->>'modelId','mode',m->>'mode','duration',m->'duration',
              'durationPolicy',m->'durationPolicy','audio',m->'audio','resolutions',m->'resolutions','aspectRatios',m->'aspectRatios'))
              FROM (SELECT value m FROM jsonb_array_elements(CASE WHEN jsonb_typeof(c.result_json->'error'->'nextAction'->'models')='array'
                THEN c.result_json->'error'->'nextAction'->'models' ELSE '[]'::jsonb END) LIMIT 8) models)) ELSE NULL END))
    WHEN c.action_json->>'action'='model.details' AND c.result_json->>'ok'='true' THEN
      jsonb_build_object('ok',true,'action','model.details','data',jsonb_build_object('modelId',c.result_json->'data'->>'modelId',
        'surface',c.result_json->'data'->>'surface','modes',(SELECT jsonb_agg(jsonb_build_object('mode',m->>'mode',
          'duration',m->'duration','durationPolicy',m->'durationPolicy','audio',m->'audio','resolutions',m->'resolutions','aspectRatios',m->'aspectRatios'))
          FROM (SELECT value m FROM jsonb_array_elements(CASE WHEN jsonb_typeof(c.result_json->'data'->'modes')='array'
            THEN c.result_json->'data'->'modes' ELSE '[]'::jsonb END) LIMIT 8) modes)))
    ELSE NULL END result
    FROM studio_conversation_steps c JOIN studio_task_segments s ON s.user_id=c.user_id AND s.project_id=c.project_id AND s.request_id=c.request_id
    JOIN studio_projects p ON p.id=c.project_id AND p.user_id=c.user_id AND p.deleted_at IS NULL
    WHERE c.user_id=$1 AND c.project_id=$2 AND s.task_request_id=$3 AND c.request_id<>$4 AND c.state='completed'
      AND c.result_json->>'ok' IN ('true','false') ORDER BY c.created_at DESC,c.call_id DESC LIMIT 12`,
  [actor.userId,actor.projectId,taskRequestId,segmentRequestId]);
  const facts=rows.map(row=>({...row,action:row.action.slice(0,64),callId:row.callId.slice(0,200),
    comparison:comparisonFacts(row.comparison),comparisonFingerprint:studioComparisonFingerprint(row.comparison)??undefined,result:resultFacts(row.result)}));
  const compact=facts.map(compactWork);
  // Reserve every minimal receipt first, including array punctuation. Overflow
  // drops optional facts, never the failure identity needed to prevent a loop.
  let remaining=12000-JSON.stringify(compact).length;
  return facts.map((row,index)=>{
    const size=JSON.stringify(row).length,extra=size-JSON.stringify(compact[index]).length;
    if(size<=4000&&extra<=remaining){remaining-=extra;return row;}
    return compact[index];
  });
}
