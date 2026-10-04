import type {ImageLibraryAsset} from '@/lib/studio/image-library';
import type {ConversationReferencePreview} from '@/lib/studio/conversation-reference-previews';

export type ShelfMedia = ImageLibraryAsset & {label: string};
export type MediaMention = {assetId: string;label: string};
export const MEDIA_SHELF_DRAG_TYPE = 'application/x-maxvideoai-reference';

/** Preview access grants are presentation only; timeline receives identity and measured facts. */
export function shelfTimelineAsset(item:ShelfMedia,preview:ConversationReferencePreview|null):ImageLibraryAsset {
  const matching=preview?.assetId===item.assetId&&preview.kind===(item.kind??'image');
  return {...item,...(matching&&preview?.mediaFacts?{mediaFacts:preview.mediaFacts}:{})};
}

export function rememberShelfMedia(items: ShelfMedia[],asset: ImageLibraryAsset,history: readonly MediaMention[]) {
  const previous=items.find(item=>item.assetId===asset.assetId);
  const known=history.findLast(item=>item.assetId===asset.assetId);
  const prefix=asset.kind==='video'?'Video':asset.kind==='audio'?'Audio':'Image';
  const highest=Math.max(0,...[...items,...history].map(item=>item.label.startsWith(prefix+' ')?Number(item.label.slice(prefix.length+1))||0:0));
  const knownLabel=known&&!items.some(item=>item.assetId!==asset.assetId&&item.label===known.label)?known.label:undefined;
  const item={...previous,...asset,label:previous?.label??knownLabel??`${prefix} ${highest+1}`};
  return {item,items:previous?items.map(value=>value.assetId===asset.assetId?item:value):[...items,item]};
}

export function insertMediaMention(text:string,label:string,start=text.length,end=start):{text:string;caret:number}|null {
  const before=text.slice(0,start),after=text.slice(end);
  const inserted=(before&&!/\s$/.test(before)?' ':'')+'@'+label+(!after||!/^\s/.test(after)?' ':'');
  const result=before+inserted+after;
  return result.length>4000?null:{text:result,caret:before.length+inserted.length};
}
export function removeMediaMention(text:string,label:string) {
  return text.replace(new RegExp('@'+label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![0-9])','g'),'');
}
export function readShelfDrag(data:Pick<DataTransfer,'getData'>,items:readonly ShelfMedia[]) {
  const id=data.getData(MEDIA_SHELF_DRAG_TYPE);
  return /^ma_[a-f0-9]{32}$/.test(id)?items.find(item=>item.assetId===id)??null:null;
}
