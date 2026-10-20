import type {SubtitleOperationRecord} from './jobs';
export const subtitleUserFailure=(error:unknown)=>error instanceof Error&&/^SUBTITLE_[A-Z_]+$/.test(error.message)?error.message:'Subtitle processing failed.';
export async function cleanupSubtitleAudio(audio:NonNullable<SubtitleOperationRecord['prepared_audio']>){
  if(!audio.retainAsAsset)await (await import('@/server/storage')).deleteStorageObjectByUrl(audio.storageUrl);
}
