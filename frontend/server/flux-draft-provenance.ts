import {createHash} from 'node:crypto';
import {z} from 'zod';
import {normalizeGenerationRequest,stableJson} from '@/server/agent-api/generation-normalization';

const modes = ['t2v','i2v','fl2v','ref2v'] as const;
const endpoints = {t2v:'text-to-video',i2v:'image-to-video',fl2v:'first-last-frame-to-video',ref2v:'keyframes-to-video'} as const;
export const nativeFluxDraftEndpoint = (mode:typeof modes[number]) => `blackforestlabs/flux-3/${endpoints[mode]}/draft`;
const digest = (value:unknown) => createHash('sha256').update(stableJson(value)).digest('hex');
const submissionSchema = z.object({version:z.literal(1),engineId:z.literal('flux-3-draft'),mode:z.enum(modes),endpoint:z.string(),requestSha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
export type NativeFluxDraftSubmission = z.infer<typeof submissionSchema>;
export type FluxDraftProvenance = {kind:'provider_attempt'}
  | {kind:'fal_submission';enqueueId:string;completedId:string;requestSha256:string}
  | {kind:'canonical_queue';enqueueId:string;completedId:string;snapshotSha256:string};
export type FluxDraftAttempt = {id:string|number;endpoint:string;status:string};
export type FluxDraftQueueEvent = {id:string;status:string;payload:unknown};
const record = (value:unknown):Record<string,unknown>|null => value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;

/** Called only with the final server-built Fal request, before its single submission.
 * Digests bind the exact request without copying provider URLs into queue history. */
export function nativeFluxDraftSubmission(engineId:string,mode:string|undefined,endpoint:string,requestBody:Record<string,unknown>):NativeFluxDraftSubmission|undefined {
  if(engineId!=='flux-3-draft'||!modes.includes(mode as typeof modes[number])||endpoint!==nativeFluxDraftEndpoint(mode as typeof modes[number]))return undefined;
  return {version:1,engineId,mode:mode as typeof modes[number],endpoint,requestSha256:digest({engineId,mode,endpoint,requestBody})};
}
function historicalNativeRequest(snapshot:unknown,enqueuePayload:unknown) {
  const raw=record(snapshot),payload=record(enqueuePayload),summary=record(payload?.inputSummary);
  if(!raw||raw.schemaVersion!==1||raw.surface!=='video'||raw.engineId!=='flux-3-draft'||!modes.includes(raw.mode as typeof modes[number])
    ||!Array.isArray(raw.references)||!record(raw.settings)||raw.outputCount===undefined
    ||payload?.engineId!=='flux-3-draft'||payload?.provider!=='fal'||!summary)throw new Error('No canonical native Draft proof.');
  const request=normalizeGenerationRequest(raw);
  if(request.sourceJobId||request.sourceOutputId||request.elements?.length||request.seedanceWorkflow||(request.operation!==undefined&&request.operation!=='flux-keyframes'))throw new Error('Not native Draft.');
  const refs=request.references,slots=summary.inputSlots;
  if(payload.promptLength!==request.prompt.length||!Array.isArray(slots)||slots.length!==refs.length
    ||slots.some(slot=>{const value=record(slot);return !value||value.kind!=='image'||value.hasUrl!==true;})
    ||summary.referenceVideoCount!==0||summary.referenceAudioCount!==0||summary.primaryAudioUrl!==null
    ||refs.some(ref=>ref.kind==='https'&&ref.mediaKind!=='image'))throw new Error('Draft request and queue disagree.');
  const mode=request.mode as typeof modes[number];
  const roles=refs.map(ref=>ref.role);
  if((mode==='t2v'&&refs.length!==0)||(mode==='i2v'&&(refs.length!==1||!roles.includes('first_frame')))
    ||(mode==='fl2v'&&(refs.length!==2||!roles.includes('first_frame')||!roles.includes('last_frame')))
    ||(mode==='ref2v'&&(refs.length<1||refs.some(ref=>ref.role!=='reference'))))throw new Error('Incomplete native Draft references.');
  const expectedSlots=mode==='t2v'?[]:mode==='i2v'?['image_url']:mode==='fl2v'?['start_image_url','end_image_url']:refs.map(()=>'reference_image_urls');
  if(stableJson(slots.map(slot=>record(slot)?.slotId).sort())!==stableJson(expectedSlots.sort()))throw new Error('Draft queue input slots disagree.');
  return {endpoint:nativeFluxDraftEndpoint(mode),snapshotSha256:digest(raw)};
}
/** All rows are read by the store using the current owned job/provider ID. */
export function resolveFluxDraftProvenance(snapshot:unknown,attempts:FluxDraftAttempt[],events:FluxDraftQueueEvent[]) {
  if(record(snapshot)?.origin==='external_fal_import')throw new Error('Imported output is not a native Draft submission.');
  if(attempts.length){
    const attempt=attempts[0];
    if(attempts.length!==1||attempt.status!=='completed'||!Number.isSafeInteger(Number(attempt.id))||Number(attempt.id)<=0
      ||!modes.some(mode=>nativeFluxDraftEndpoint(mode)===attempt.endpoint))throw new Error('Conflicting Draft attempt.');
    return {endpoint:attempt.endpoint,attemptId:Number(attempt.id),provenance:{kind:'provider_attempt'} as FluxDraftProvenance};
  }
  const enqueues=events.filter(event=>event.status==='enqueue'),completed=events.find(event=>event.status==='completed');
  if(enqueues.length!==1||!completed||!/^\d+$/.test(enqueues[0].id)||!/^\d+$/.test(completed.id)||BigInt(enqueues[0].id)>=BigInt(completed.id))throw new Error('No exact terminal Draft queue proof.');
  const enqueue=enqueues[0],payload=record(enqueue.payload);
  if(payload?.engineId!=='flux-3-draft'||payload?.provider!=='fal')throw new Error('Invalid Draft queue identity.');
  const binding={enqueueId:enqueue.id,completedId:completed.id};
  if(payload.nativeDraftSubmission!==undefined){
    const proof=submissionSchema.parse(payload.nativeDraftSubmission);
    if(proof.endpoint!==nativeFluxDraftEndpoint(proof.mode))throw new Error('Nonnative Draft endpoint.');
    return {endpoint:proof.endpoint,attemptId:null,provenance:{kind:'fal_submission',...binding,requestSha256:proof.requestSha256} as FluxDraftProvenance};
  }
  const historical=historicalNativeRequest(snapshot,payload);
  return {endpoint:historical.endpoint,attemptId:null,provenance:{kind:'canonical_queue',...binding,snapshotSha256:historical.snapshotSha256} as FluxDraftProvenance};
}
