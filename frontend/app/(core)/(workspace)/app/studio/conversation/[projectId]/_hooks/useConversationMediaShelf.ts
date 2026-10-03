'use client';
import {useEffect,useRef,useState} from 'react';
import type {ImageLibraryAsset} from '@/lib/studio/image-library';
import type {ImageConversationTurn,ImageTurnInput} from '@/lib/studio/image-conversation-contract';
import type {ConversationLocale} from '@/lib/studio/conversation-quote-presentation';
import {rememberShelfMedia,type ShelfMedia} from '../_lib/conversation-media-shelf';

export function useConversationMediaShelf(turns:ImageConversationTurn[],locale:ConversationLocale,mediaEnabled:boolean) {
  const [items,setItems]=useState<ShelfMedia[]>([]),[references,setReferences]=useState<ShelfMedia[]>([]);
  const [selectedId,setSelectedId]=useState<string|null>(null),[expanded,setExpanded]=useState(true);
  const [uploading,setUploading]=useState(false),[error,setError]=useState<string|null>(null);
  const all=useRef(items),attached=useRef(references),busy=useRef(false),alive=useRef(true);
  const history=turns.flatMap(turn=>turn.referenceMentions??[]);
  const t=(en:string,fr:string)=>locale==='fr'?fr:en;
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useEffect(()=>{
    let next=all.current;
    for(const mention of turns.flatMap(turn=>turn.referenceMentions??[]).slice(-24)) {
      if(next.some(item=>item.assetId===mention.assetId))continue;
      const kind=mention.label.startsWith('Video ')?'video':mention.label.startsWith('Audio ')?'audio':'image';
      next=[...next,{...mention,kind,url:''}];
    }
    if(next!==all.current){all.current=next;setItems(next);}
  },[turns]);
  function remember(asset:ImageLibraryAsset) {
    const next=rememberShelfMedia(all.current,asset,history);
    all.current=next.items;setItems(next.items);return next.item;
  }
  function attach(asset:ImageLibraryAsset) {
    if(!attached.current.some(ref=>ref.assetId===asset.assetId)&&attached.current.length>=8) {
      setError(t('You can attach up to eight media to one message.','Vous pouvez joindre huit médias par message.'));return null;
    }
    const item=remember(asset);
    if(!attached.current.some(ref=>ref.assetId===asset.assetId)) {attached.current=[...attached.current,item];setReferences(attached.current);}
    setSelectedId(item.assetId);setExpanded(true);setError(null);return item;
  }
  function detach(assetId:string) {attached.current=attached.current.filter(item=>item.assetId!==assetId);setReferences(attached.current);}
  function clear() {attached.current=[];setReferences([]);}
  function restore(input:ImageTurnInput) {
    clear();
    const values=[...input.references.map(assetId=>({assetId,kind:'image' as const})),...(input.attachments??[]).flatMap(ref=>ref.type==='asset'?[{assetId:ref.assetId,kind:ref.kind}]:[])];
    for(const value of values) {
      const existing=all.current.find(item=>item.assetId===value.assetId);
      const label=input.referenceMentions?.find(item=>item.assetId===value.assetId)?.label;
      if(!existing&&label) {const item={...value,url:'',label};all.current=[...all.current,item];setItems(all.current);}
      attach(existing??{...value,url:''});
    }
  }
  async function upload(files:File[]) {
    if(busy.current)return;
    const kinds:Record<string,'image'|'video'|'audio'>={'image/png':'image','image/jpeg':'image','image/webp':'image','video/mp4':'video','video/quicktime':'video','audio/mpeg':'audio','audio/wav':'audio','audio/x-wav':'audio'};
    if(files.length+attached.current.length>8) {setError(t('Attach up to eight media at a time.','Joignez huit médias au maximum.'));return;}
    if(files.some(file=>!kinds[file.type]||(!mediaEnabled&&kinds[file.type]!=='image'))) {setError(t('Choose a supported image'+(mediaEnabled?', MP4/MOV video, or MP3/WAV audio.':': PNG, JPEG or WebP.'),'Choisissez une image compatible'+(mediaEnabled?', une vidéo MP4/MOV ou un audio MP3/WAV.':' : PNG, JPEG ou WebP.')));return;}
    busy.current=true;setUploading(true);setError(null);
    try {
      for(const file of files) {
        const kind=kinds[file.type],body=new FormData();body.set('file',file);
        const response=await fetch('/api/uploads/'+kind,{method:'POST',body});
        const data=await response.json();
        if(!response.ok||!data.ok||!/^ma_[a-f0-9]{32}$/.test(data.asset?.assetId??'')) throw new Error('UPLOAD_FAILED');
        if(!alive.current)return;
        attach({...data.asset,kind,name:file.name});
      }
    } catch {if(alive.current)setError(t('This import did not finish. Your attached media are still here. Try again from the library.','L’import n’a pas abouti. Vos médias joints sont conservés. Réessayez depuis la bibliothèque.'));}
    finally {busy.current=false;if(alive.current)setUploading(false);}
  }
  return {items,references,selectedId,expanded,setSelectedId,setExpanded,attach,detach,clear,restore,upload,uploading,error,setError};
}
