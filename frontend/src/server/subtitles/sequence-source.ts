import {withDbTransaction,type QueryExecutor} from '@/lib/db';
import {readStudioWorkspace} from '../studio/workspace-command';
import {resolveStudioMedia} from '../studio/media-resolver';
import {buildWorkspaceTimelineRenderManifest,type WorkspaceTimelineRenderManifest} from '@/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-timeline-render';
import type {WorkspaceTimelineItem,WorkspaceProjectSettings,WorkspaceGraphNode} from '@/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-types';
import {filterHiddenVideoTrackItems,muteAudioTrackItems} from '@/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-timeline-selection';
import {coerceHiddenVideoTracks,coerceVideoTrackCount,coerceMutedAudioTracks,coerceAudioTrackCount} from '@/app/(core)/(workspace)/app/studio/_shared/_state/workspace-state';
import {parseTimelineExportManifest} from '../timeline-exports/render-request';
import {timelineExportManifestHash} from '../timeline-exports/estimate-token';
import {subtitleSequenceAudioIntent} from '../../lib/subtitles/sequence';
import type {ToolAssetRef} from '../../lib/toolbox/contract';
export type SubtitleSequenceSnapshot={projectId:string;sequenceId:string;revision:number;audioManifestHash:string;manifest:WorkspaceTimelineRenderManifest;media:Array<{ref:ToolAssetRef;id:string;url:string}>};
export const subtitleSequenceAudioHash=(manifest:WorkspaceTimelineRenderManifest)=>timelineExportManifestHash(subtitleSequenceAudioIntent(manifest));
export function subtitleSequenceManifest(workspace:Awaited<ReturnType<typeof readStudioWorkspace>>,sequenceId:string,itemsOverride?:WorkspaceTimelineItem[]){
  const sequence=workspace.sequences.find(value=>value.id===sequenceId);if(!sequence)throw new Error('STUDIO_SEQUENCE_CONFLICT');
  const state=sequence.timelineState as {timelineItems:WorkspaceTimelineItem[];hiddenVideoTracks?:unknown;mutedAudioTracks?:unknown;videoTrackCount?:unknown;audioTrackCount?:unknown};
  const items=muteAudioTrackItems(filterHiddenVideoTrackItems(itemsOverride??state.timelineItems,coerceHiddenVideoTracks(state.hiddenVideoTracks,coerceVideoTrackCount(state.videoTrackCount,state.timelineItems))),coerceMutedAudioTracks(state.mutedAudioTracks,coerceAudioTrackCount(state.audioTrackCount,state.timelineItems))).map(item=>{const clean={...item};delete clean.subtitle;delete clean.subtitleDocument;return clean;});
  return buildWorkspaceTimelineRenderManifest({items,nodes:(workspace.project.workspaceState as {nodes?:WorkspaceGraphNode[]}).nodes??[],projectName:workspace.project.name,sequenceId:sequence.id,sequenceName:sequence.name,projectSettings:sequence.settings as WorkspaceProjectSettings,createdAt:workspace.project.updatedAt});
}
export async function readOwnedSubtitleSequence(userId:string,input:{projectId:string;sequenceId:string;expectedRevision:number},executor?:QueryExecutor):Promise<SubtitleSequenceSnapshot>{
  const run=async(tx:QueryExecutor)=>{
    const workspace=await readStudioWorkspace({userId},input.projectId,{withTransaction:callback=>callback(tx)});
    if(workspace.project.revision!==input.expectedRevision)throw new Error('SUBTITLE_SEQUENCE_CHANGED');
    const sequence=workspace.sequences.find(value=>value.id===input.sequenceId);if(!sequence)throw new Error('STUDIO_SEQUENCE_CONFLICT');
    const items=(sequence.timelineState as {timelineItems:WorkspaceTimelineItem[]}).timelineItems,media:SubtitleSequenceSnapshot['media']=[],cache=new Map<string,Awaited<ReturnType<typeof resolveStudioMedia>>>();
    const resolved:WorkspaceTimelineItem[]=[];
    for(const item of items){
      if(!item.ref)throw new Error('SUBTITLE_SEQUENCE_SOURCE_REQUIRED');const key=timelineExportManifestHash(item.ref);
      let source=cache.get(key);if(!source){source=await resolveStudioMedia(userId,item.ref,(sql,params)=>tx.query(sql,params),{lockAsset:true});cache.set(key,source);media.push({ref:source.ref,id:source.id,url:source.url});}
      resolved.push({...item,mediaUrl:source.url});
    }
    const manifest=parseTimelineExportManifest(subtitleSequenceManifest(workspace,input.sequenceId,resolved));
    if(manifest.tracks.some(track=>track.clips.some(clip=>clip.transitionOut)))throw new Error('SUBTITLE_MIX_TRANSITION_UNSUPPORTED');
    if(!subtitleSequenceAudioIntent(manifest).tracks.length)throw new Error('SUBTITLE_SOURCE_HAS_NO_AUDIO');
    return {projectId:input.projectId,sequenceId:input.sequenceId,revision:input.expectedRevision,manifest,audioManifestHash:subtitleSequenceAudioHash(manifest),media};
  };
  return executor?run(executor):withDbTransaction(run);
}
export async function assertSubtitleSequenceSnapshot(userId:string,snapshot:SubtitleSequenceSnapshot,executor:QueryExecutor){
  const current=await readOwnedSubtitleSequence(userId,{projectId:snapshot.projectId,sequenceId:snapshot.sequenceId,expectedRevision:snapshot.revision},executor);
  if(current.audioManifestHash!==snapshot.audioManifestHash)throw new Error('SUBTITLE_SEQUENCE_CHANGED');
}
