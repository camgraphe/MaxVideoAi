import {parseSubtitleDocument} from '../../lib/subtitles/document';
import {timelineExportManifestHash} from '../timeline-exports/estimate-token';
import {createSubtitleRepository,subtitleRepository,type SubtitleExecutor} from './repository';
import type {WorkspaceTimelineItem} from '@/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-types';
import {toolAssetRefSchema} from '../../lib/toolbox/contract';
export async function validateSubtitleAttachment(userId:string,items:WorkspaceTimelineItem[],edit:{clipId:string;documentId:string|null;revision?:number},executor:SubtitleExecutor){
  const item=items.find(candidate=>candidate.id===edit.clipId);if(!item)throw new Error('Timeline clip not found.');
  if(!edit.documentId||!edit.revision)throw new Error('SUBTITLE_REVISION_INVALID');
  const repository=createSubtitleRepository({...executor,transaction:async run=>run(executor)});
  const document=await repository.read(userId,edit.documentId,edit.revision);if(!document)throw new Error('SUBTITLE_NOT_FOUND');
  const ref=toolAssetRefSchema.safeParse(item.ref);
  if(!ref.success||timelineExportManifestHash(ref.data)!==timelineExportManifestHash(document.source.ref))throw new Error('SUBTITLE_SOURCE_MISMATCH');
}
/** Pinned references hydrate identically for preview and export. Missing documents fail visibly. */
export async function hydrateSubtitleTimelineItems(userId:string,items:WorkspaceTimelineItem[],read=subtitleRepository.read):Promise<WorkspaceTimelineItem[]>{
  const cache=new Map<string,ReturnType<typeof read>>();
  return Promise.all(items.map(async item=>{
    if(!item.subtitle)return item;
    const key=`${item.subtitle.documentId}:${item.subtitle.revision}`;
    if(!cache.has(key))cache.set(key,read(userId,item.subtitle.documentId,item.subtitle.revision));
    const value=await cache.get(key);if(!value)throw new Error('SUBTITLE_NOT_FOUND');const document=parseSubtitleDocument(value);
    const ref=toolAssetRefSchema.safeParse(item.ref);
    if(!ref.success||timelineExportManifestHash(ref.data)!==timelineExportManifestHash(document.source.ref))throw new Error('SUBTITLE_SOURCE_MISMATCH');
    return {...item,subtitleDocument:document};
  }));
}

export async function readSubtitleSequenceAttachment(userId:string,workspace:Awaited<ReturnType<typeof import('../studio/workspace-command').readStudioWorkspace>>,sequenceId:string,read=subtitleRepository.read){
  const sequence=workspace.sequences.find(value=>value.id===sequenceId);if(!sequence)throw new Error('STUDIO_SEQUENCE_CONFLICT');
  const raw=(sequence.timelineState as {sequenceSubtitle?:unknown}).sequenceSubtitle;if(!raw)return null;
  const {subtitleSequenceAttachmentSchema}=await import('../../lib/subtitles/document');const reference=subtitleSequenceAttachmentSchema.parse(raw);
  const document=await read(userId,reference.documentId,reference.revision);if(!document)throw new Error('SUBTITLE_NOT_FOUND');
  const {subtitleSequenceAudioHash,subtitleSequenceManifest}=await import('./sequence-source');
  const currentHash=subtitleSequenceAudioHash(subtitleSequenceManifest(workspace,sequenceId));
  const stale=document.source.sequenceMix?.sequenceId!==sequenceId||document.source.sequenceMix?.audioManifestHash!==reference.audioManifestHash||currentHash!==reference.audioManifestHash;
  return {reference,document:stale?null:document,stale};
}
