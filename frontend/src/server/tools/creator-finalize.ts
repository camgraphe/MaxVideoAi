import type { CreatorOperationResult } from '@/lib/toolbox/creator-tools';
import { listJobOutputsByJobIds } from '@/server/media-library';
import { createConversationMediaReadAccess } from '@/server/studio/conversation-media-read-access';
import { resolveStudioMedia } from '@/server/studio/media-resolver';
import { downloadCreatorMedia, inspectCreatorBytes, muxCreatorBytes, trimCreatorGeneratedVideoTail, validateCreatorOutputTiming, withCreatorMediaSlot } from './creator-segment-media';
import { persistCreatorMedia } from './creator-sources';
import type { CreatorMediaFacts, PreparedCreatorProfile } from './creator-profiles';

export class CreatorFinalizationError extends Error {}
/** Only the two new Wan snapshots may remove a generated tail. Legacy operations keep exact timing. */
export function validateCreatorOutputPolicy(prepared: PreparedCreatorProfile): number | null {
  const wan = ['lip-photo-wan-v1','lip-video-wan-v1'].includes(prepared.profile.id);
  if (!wan && !prepared.outputTiming) return null;
  const expected = prepared.expectedDurationSec;
  const audio = prepared.sources.find(source => source.input.role === 'audio');
  if (!wan || prepared.input.toolId !== 'lip-sync' || prepared.request.surface !== 'video' || prepared.request.engineId !== 'wan-3'
    || prepared.profile.id !== (prepared.input.settings.mode === 'photo' ? 'lip-photo-wan-v1' : 'lip-video-wan-v1')
    || prepared.request.mode !== (prepared.input.settings.mode === 'photo' ? 'ref2v' : 'v2v')
    || expected == null || !Number.isFinite(expected) || expected < 2 || expected > 15
    || prepared.audioPolicy !== 'preserve' || prepared.audioSourceRole !== 'audio' || audio?.facts.durationSec !== expected
    || prepared.outputTiming?.kind !== 'trim-generated-tail' || prepared.outputTiming.generatedDurationSec !== Math.ceil(expected)
    || prepared.request.settings.durationSec !== prepared.outputTiming.generatedDurationSec) {
    throw new CreatorFinalizationError('The saved output timing policy is invalid.');
  }
  return prepared.outputTiming.generatedDurationSec;
}
export function validateCreatorFinalFacts(prepared:PreparedCreatorProfile,facts:CreatorMediaFacts):void {
  if(facts.kind!==prepared.request.surface) throw new CreatorFinalizationError('The generated media kind is invalid.');
  if(facts.kind==='video') {
    try {validateCreatorOutputTiming(prepared.expectedDurationSec!,facts.durationSec,facts.fps);} catch {throw new CreatorFinalizationError('Output duration differs from the selected segment. No audio was cut or looped.');}
    if(facts.hasAudio!==(prepared.audioPolicy==='preserve')) throw new CreatorFinalizationError('The output audio policy could not be preserved.');
    if(facts.hasAudio) {
      try {validateCreatorOutputTiming(prepared.expectedDurationSec!,facts.audioDurationSec??null,facts.fps);} catch {throw new CreatorFinalizationError('The output audio duration could not be preserved.');}
      if(facts.audioStartSec==null||Math.abs(facts.audioStartSec)>0.025) throw new CreatorFinalizationError('The output audio timing could not be preserved.');
    }
  }
}
const defaults={readAccess:createConversationMediaReadAccess,listOutputs:listJobOutputsByJobIds,resolve:resolveStudioMedia,download:downloadCreatorMedia,inspect:inspectCreatorBytes,mux:muxCreatorBytes,trimVideoTail:trimCreatorGeneratedVideoTail,persist:persistCreatorMedia};
export async function finalizeCreatorOperation(userId:string,jobId:string,prepared:PreparedCreatorProfile,dependencies:Partial<typeof defaults>={}):Promise<CreatorOperationResult> {
  const deps={...defaults,...dependencies};
  const generatedDurationSec=validateCreatorOutputPolicy(prepared);
  return withCreatorMediaSlot(userId,async()=>{
    const outputs=(await deps.listOutputs([jobId],{ensureSchema:false})).get(jobId)??[];
    const eligible=outputs.filter(output=>output.userId===userId&&output.jobId===jobId&&output.kind===prepared.request.surface&&output.status==='ready'&&output.metadata.role!=='last_frame');
    if(eligible.length!==1) throw new Error('The generation output is still being saved.');
    const output=eligible[0];
    const original=await deps.resolve(userId,{type:'job-output',jobId,outputId:output.id,kind:output.kind});
    const access=await deps.readAccess(userId,original);
    const downloaded=await deps.download({file_id:output.id,download_url:access.url});
    let bytes:Uint8Array=downloaded.bytes;
    let facts=await deps.inspect(bytes,prepared.request.surface,downloaded.mimeType);
    if(prepared.request.surface==='video') {
      try {
        validateCreatorOutputTiming(generatedDurationSec ?? prepared.expectedDurationSec!,facts.durationSec,facts.fps);
        if(generatedDurationSec != null && facts.durationSec! < prepared.expectedDurationSec!) throw new Error('Generated video is too short.');
      } catch {throw new CreatorFinalizationError('Output duration differs from the selected segment. No audio was cut or looped.');}
      let audioBytes:Uint8Array|null=null;
      if(prepared.audioPolicy==='preserve') {
        const audio=prepared.sources.find(source=>source.input.role===prepared.audioSourceRole);
        if(!audio) throw new CreatorFinalizationError('The selected audio snapshot is missing.');
        const owned=await deps.resolve(userId,audio.asset);
        if(owned.url!==audio.url) throw new CreatorFinalizationError('The selected audio changed.');
        const audioAccess=await deps.readAccess(userId,owned);
        const file=await deps.download({file_id:audio.asset.assetId,download_url:audioAccess.url});
        const measured=await deps.inspect(file.bytes,audio.facts.kind,file.mimeType);
        if(!measured.hasAudio) throw new CreatorFinalizationError('The selected source no longer contains audio.');
        try {validateCreatorOutputTiming(prepared.expectedDurationSec!,measured.audioDurationSec??null,measured.fps);} catch {throw new CreatorFinalizationError('Selected audio duration is incompatible with the generated output.');}
        if(measured.audioStartSec==null||Math.abs(measured.audioStartSec)>0.025) throw new CreatorFinalizationError('The source audio has an unsupported start offset.');
        audioBytes=file.bytes;
      }
      if(generatedDurationSec != null && facts.durationSec! > prepared.expectedDurationSec!) {
        const trimmed=await deps.trimVideoTail(bytes,facts,prepared.expectedDurationSec!);
        bytes=trimmed.bytes;facts=trimmed.facts;
      }
      // Always map the chosen audio (or remove it). A provider's audio is never assumed identical.
      const muxed=await deps.mux(bytes,audioBytes);bytes=muxed.bytes;facts=muxed.facts;
    }
    validateCreatorFinalFacts(prepared,facts);
    // Revalidate the exact generated output after the slow probe/mux and before publishing a derivative.
    if((await deps.resolve(userId,{type:'job-output',jobId,outputId:output.id,kind:output.kind})).url!==original.url) throw new CreatorFinalizationError('The generation output changed during finalization.');
    const saved=await deps.persist(userId,bytes,facts,{version:1,toolId:prepared.input.toolId,profileId:prepared.profile.id,
      generation:{jobId,outputId:output.id},sourceAssets:prepared.input.inputs.map(entry=>entry.source),segments:prepared.input.inputs.map(entry=>({role:entry.role,segment:entry.segment??null})),audioPolicy:prepared.audioPolicy,...(prepared.outputTiming ? {outputTiming:prepared.outputTiming} : {})});
    return {toolId:prepared.input.toolId,version:1,jobId,sourceAssets:prepared.input.inputs.map(entry=>entry.source),outputs:[{
      asset:saved.asset,kind:prepared.request.surface,originalUrl:saved.url,thumbnailUrl:saved.thumbnailUrl,
      ...(facts.kind==='video'?{durationSec:facts.durationSec!,audioPolicy:prepared.audioPolicy,audioEncoding:'aac' as const}:{})}]};
  });
}
