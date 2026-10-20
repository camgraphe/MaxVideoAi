'use client';
import {useEffect,useRef,useState} from 'react';
import type {ImageLibraryAsset} from '@/lib/studio/image-library';
import type {ImageConversationTurn,ImageTurnInput} from '@/lib/studio/image-conversation-contract';
import {imageTurnInputSchema} from '@/lib/studio/image-conversation-contract';
import type {ConversationLocale} from '@/lib/studio/conversation-quote-presentation';
import {rememberShelfMedia,type ShelfMedia} from '../_lib/conversation-media-shelf';

export function useConversationMediaShelf(turns:ImageConversationTurn[],locale:ConversationLocale,mediaEnabled:boolean,selection?:{scopeKey:string;ready:boolean}) {
  const [items,setItems]=useState<ShelfMedia[]>([]),[references,setReferences]=useState<ShelfMedia[]>([]);
  const [selectedId,setSelectedId]=useState<string|null>(null),[expanded,setExpanded]=useState(true);
  const [uploading,setUploading]=useState(false),[error,setError]=useState<string|null>(null);
  const all=useRef(items),attached=useRef(references),busy=useRef(false),alive=useRef(true);
  const initialized=useRef<string|null>(null);
  const storageKey=selection?'maxvideoai:studio:selection:v1:'+selection.scopeKey:null;
  const history=turns.flatMap(turn=>turn.referenceMentions??[]);
  const latestHistory=useRef(history);latestHistory.current=history;
  const t=(en:string,fr:string)=>locale==='fr'?fr:en;
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useEffect(()=>{
    const desktop=window.matchMedia('(min-width: 801px)');
    const collapse=()=>{if(!desktop.matches)setExpanded(false);};
    collapse();desktop.addEventListener('change',collapse);
    return()=>desktop.removeEventListener('change',collapse);
  },[]);
  useEffect(()=>{
    let next=all.current;
    for(const mention of turns.flatMap(turn=>turn.referenceMentions??[]).slice(-24)) {
      if(next.some(item=>item.assetId===mention.assetId))continue;
      const kind=mention.label.startsWith('Video ')?'video':mention.label.startsWith('Audio ')?'audio':'image';
      next=rememberShelfMedia(next,{assetId:mention.assetId,kind,url:''},latestHistory.current).items;
    }
    if(next!==all.current){all.current=next;setItems(next);}
  },[turns]);
  useEffect(()=>{
    if(!storageKey||!selection?.ready||initialized.current===storageKey)return;
    initialized.current=storageKey;
    let input:Pick<ImageTurnInput,'references'|'attachments'|'referenceMentions'>|undefined;
    try {
      const saved=window.sessionStorage.getItem(storageKey);
      if(saved!==null){
        const parsed=imageTurnInputSchema.safeParse({...JSON.parse(saved),requestId:'00000000-0000-4000-8000-000000000001',message:'Restore selected media'});
        // Invalid local data never restores a different historical selection.
        input=parsed.success?parsed.data:{references:[]};
      }
    } catch {input={references:[]};}
    input??=turns.at(-1);
    if(input)restore(input);
    // Restore once, after the owned history loads. Polling must not undo a removal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[storageKey,selection?.ready,turns]);
  function saveSelection() {
    if(!storageKey)return;
    const refs=attached.current;
    try {window.sessionStorage.setItem(storageKey,JSON.stringify({
      references:refs.filter(ref=>!ref.kind||ref.kind==='image').map(ref=>ref.assetId),
      attachments:refs.flatMap(ref=>ref.kind==='video'||ref.kind==='audio'?[{type:'asset',assetId:ref.assetId,kind:ref.kind}]:[]),
      referenceMentions:refs.map(({assetId,label})=>({assetId,label})),
    }));} catch {/* A blocked store must not prevent using the current visible selection. */}
  }
  function remember(asset:ImageLibraryAsset) {
    const next=rememberShelfMedia(all.current,asset,latestHistory.current);
    all.current=next.items;setItems(next.items);return next.item;
  }
  function attach(asset:ImageLibraryAsset) {
    if(!mediaEnabled&&asset.kind&&asset.kind!=='image') {
      setError(t('Video and audio references are unavailable in this workspace. You can still preview them.','Les références vidéo et audio sont indisponibles dans cet espace. Vous pouvez toujours les consulter.'));return null;
    }
    if(!attached.current.some(ref=>ref.assetId===asset.assetId)&&attached.current.length>=8) {
      setError(t('You can attach up to eight media to one message.','Vous pouvez joindre huit médias par message.'));return null;
    }
    const item=remember(asset);
    if(!attached.current.some(ref=>ref.assetId===asset.assetId)) {attached.current=[...attached.current,item];setReferences(attached.current);}
    saveSelection();setSelectedId(item.assetId);setExpanded(window.matchMedia('(min-width: 801px)').matches);setError(null);return item;
  }
  function detach(assetId:string) {
    attached.current=attached.current.filter(item=>item.assetId!==assetId);setReferences(attached.current);
    saveSelection();
    setError(!mediaEnabled&&attached.current.some(item=>item.kind!=='image')?t('Remove the video or audio references to send a new message in this image-only workspace.','Retirez les références vidéo ou audio pour envoyer un nouveau message dans cet espace image.'):null);
  }
  function clear() {attached.current=[];setReferences([]);saveSelection();}
  function restore(input:Pick<ImageTurnInput,'references'|'attachments'|'referenceMentions'>) {
    const values=[...input.references.map(assetId=>({assetId,kind:'image' as const})),...(input.attachments??[]).flatMap(ref=>ref.type==='asset'?[{assetId:ref.assetId,kind:ref.kind}]:[])];
    const previous=all.current;
    const known=[...latestHistory.current,...previous];
    let next:ShelfMedia[]=values.flatMap(value=>{
      const label=input.referenceMentions?.find(item=>item.assetId===value.assetId)?.label;
      return label?[{url:'',...previous.find(item=>item.assetId===value.assetId),...value,label}]:[];
    });
    for(const value of values) {
      if(!next.some(item=>item.assetId===value.assetId))next=rememberShelfMedia(next,{url:'',...previous.find(item=>item.assetId===value.assetId),...value},known).items;
    }
    for(const item of previous)if(!next.some(value=>value.assetId===item.assetId))next=rememberShelfMedia(next,item,known).items;
    all.current=next;setItems(next);
    attached.current=values.map(value=>next.find(item=>item.assetId===value.assetId)!);setReferences(attached.current);
    saveSelection();
    setSelectedId(attached.current.at(-1)?.assetId??null);setExpanded(window.matchMedia('(min-width: 801px)').matches);
    setError(!mediaEnabled&&attached.current.some(item=>item.kind!=='image')?t('Remove the video or audio references to send a new message in this image-only workspace.','Retirez les références vidéo ou audio pour envoyer un nouveau message dans cet espace image.'):null);
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
