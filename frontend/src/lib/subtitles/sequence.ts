import type {WorkspaceTimelineRenderManifest} from '@/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-timeline-render';
import {resolveWorkspaceAudioProvenance,shouldMuteWorkspaceTimelineVideo} from '@/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-audio-provenance';
/** Sound edit only: naming, caption revisions, silent layers and visual transforms do not change the mix. */
export function subtitleSequenceAudioIntent(manifest:WorkspaceTimelineRenderManifest){
  const externalGroups=new Set(manifest.tracks.filter(track=>track.id.startsWith('audio')).flatMap(track=>track.clips.filter(clip=>clip.linkedGroupId&&clip.audioProvenance!=='none').map(clip=>clip.linkedGroupId!)));
  const tracks=manifest.tracks.map(track=>({id:track.id,clips:track.clips.filter(clip=>{
    if(clip.mediaKind==='image'||clip.audioMix?.muted||(clip.audioMix?.volume??100)===0)return false;
    return clip.mediaKind==='audio'||!shouldMuteWorkspaceTimelineVideo({includeAudio:true,audioProvenance:resolveWorkspaceAudioProvenance({kind:'video',audioProvenance:clip.audioProvenance,hasAudio:clip.hasEmbeddedAudio}),hasExternalLinkedAudio:Boolean(clip.linkedGroupId&&externalGroups.has(clip.linkedGroupId)),audioMixMuted:false});
  }).map(clip=>({id:clip.id,assetId:clip.assetId,mediaUrl:clip.mediaUrl,mediaKind:clip.mediaKind,startSec:clip.startSec,durationSec:clip.durationSec,sourceStartSec:clip.sourceStartSec,sourceEndSec:clip.sourceEndSec,audioMix:clip.audioMix??null,linkedGroupId:clip.linkedGroupId??null,audioProvenance:clip.audioProvenance??null,hasEmbeddedAudio:clip.hasEmbeddedAudio??null,transitionOut:clip.transitionOut??null}))})).filter(track=>track.clips.length>0);
  return {sequenceId:manifest.sequenceId,durationSec:manifest.durationSec,fps:manifest.projectSettings?.fps??30,tracks};
}
