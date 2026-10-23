'use client';

import { useCallback, useEffect, useState } from 'react';
import { Link2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { authFetch } from '@/lib/authFetch';
import type { MarketingMediaItem } from '@/lib/marketing-media';

function videoIdFromInput(input:string){
 const value=input.trim();
 if(!/^https?:\/\//i.test(value)&&!value.startsWith('/'))return value;
 try{const url=new URL(value,'https://maxvideoai.com');return url.searchParams.get('from')??url.searchParams.get('videoId')??decodeURIComponent(url.pathname.split('/').filter(Boolean).pop()??'');}catch{return value;}
}
async function request(path:string,init?:RequestInit){
 const response=await authFetch(path,init);const body=await response.json();
 if(!response.ok||!body.ok)throw new Error(body.error??'The operation failed. Please retry.');
 return body;
}
const stateLabels={copying:'Copying',ready:'Ready',failed:'Copy incomplete',deleting:'Deletion incomplete',deleted:'Deleted'};

export function MarketingMediaLibrary({initialVideoId=''}:{initialVideoId?:string}){
 const [videoId,setVideoId]=useState(initialVideoId);const [permission,setPermission]=useState(false);
 const [items,setItems]=useState<MarketingMediaItem[]>([]);const [offset,setOffset]=useState(0);const [nextOffset,setNextOffset]=useState<number|null>(null);
 const [loading,setLoading]=useState(true);const [busy,setBusy]=useState<string|null>(null);const [error,setError]=useState<string|null>(null);const [notice,setNotice]=useState<string|null>(null);
 const load=useCallback(async(page:number,signal?:AbortSignal)=>{
  setLoading(true);
  try{const result=await request(`/api/admin/marketing-media?offset=${page}`,{signal});if(signal?.aborted)return;setItems(result.items);setNextOffset(result.nextOffset);}
  catch(e){if(!signal?.aborted)setError(e instanceof Error?e.message:'Unable to load marketing media.');}
  finally{if(!signal?.aborted)setLoading(false);}
 },[]);
 useEffect(()=>{const controller=new AbortController();void load(offset,controller.signal);return()=>controller.abort();},[offset,load]);
 async function copy(id:string){
  if(busy)return;setBusy('copy:'+id);setError(null);setNotice(null);
  try{await request('/api/admin/marketing-media',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({videoId:id,permissionConfirmed:permission})});
   setNotice('Complete marketing copy saved. The original library item is unchanged.');if(offset===0)await load(0);else setOffset(0);
  }catch(e){setError(e instanceof Error?e.message:'Copy failed. Retry when the source files are available.');await load(offset);}
  finally{setBusy(null);}
 }
 async function change(item:MarketingMediaItem,action:'delete'|'visibility'){
  if(busy)return;
  if(action==='delete'&&!window.confirm('Delete this independent marketing copy? The personal original is kept.'))return;
  setBusy(item.videoId);setError(null);setNotice(null);
  try{
   await request(action==='delete'?`/api/admin/marketing-media/${encodeURIComponent(item.videoId)}`:`/api/admin/videos/${encodeURIComponent(item.videoId)}/visibility`,action==='delete'?{method:'DELETE'}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({visibility:item.visibility==='public'?'private':'public',indexable:item.visibility!=='public'})});
   await load(offset);setNotice(action==='delete'?'Marketing copy deleted.':'Publication visibility updated. Video SEO approval remains separate.');
  }catch(e){setError(e instanceof Error?e.message:'Update failed.');}
  finally{setBusy(null);}
 }
 return <>
  <form className="grid gap-3 rounded-xl border border-border bg-surface p-4" onSubmit={event=>{event.preventDefault();void copy(videoIdFromInput(videoId));}}>
   <label className="grid gap-1 text-sm font-medium">Video ID or link
    <input className="min-w-0 rounded-input border border-border bg-bg px-3 py-2" value={videoId} onChange={e=>setVideoId(e.target.value)} placeholder="Video ID or /app?from=… link" required maxLength={2048}/>
   </label>
   <label className="flex items-start gap-2 text-sm text-text-secondary"><input type="checkbox" checked={permission} onChange={e=>setPermission(e.target.checked)} className="mt-1"/>
    I have permission to use this video, its prompt and reference media on the site. Required when copying another user’s media.
   </label>
   <div className="flex flex-wrap items-center gap-3"><Button type="submit" disabled={Boolean(busy)||!videoId.trim()}>{busy?.startsWith('copy:')?'Copying…':'Add to marketing media'}</Button>
    <p className="text-xs text-text-muted">Copies the original, preview, cover and required references. Existing public links keep their identity.</p></div>
  </form>
  {error?<p role="alert" className="rounded-lg border border-error-border bg-error-bg p-3 text-sm text-error">{error}</p>:null}
  {notice?<p role="status" className="text-sm text-text-secondary">{notice}</p>:null}
  <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Site library</h2><Button variant="outline" size="sm" disabled={loading||Boolean(busy)} onClick={()=>{setError(null);void load(offset);}}>Refresh</Button></div>
  {loading?<p role="status">Loading marketing media…</p>:!items.length?<p>No marketing media yet.</p>:null}
  <div className="grid gap-4 lg:grid-cols-2">
   {items.map(item=><article key={item.videoId} className="min-w-0 rounded-xl border border-border bg-surface p-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">{item.engineLabel} · {stateLabels[item.state]}</span>
     {item.placements.length?<details className="max-w-full text-xs"><summary className="flex cursor-pointer items-center gap-1" title="Used on the site"><Link2 size={14} aria-hidden/>Used on the site ({item.placements.length})</summary>
      <ul className="mt-2 grid gap-1 break-words">{item.placements.map((placement,index)=><li key={index}>{placement.href?<a className="underline" href={placement.href}>{placement.label}</a>:placement.label}</li>)}</ul>
     </details>:<span className="text-xs text-text-muted">No site placements</span>}
    </div>
    {item.videoUrl?<video controls playsInline preload="none" poster={item.thumbUrl} src={item.videoUrl} className="h-48 w-full rounded-lg bg-black object-contain"/>:null}
    <p className="mt-2 break-all text-xs text-text-muted">{item.videoId} · {(item.sizeBytes/1024/1024).toFixed(1)} MB · {item.visibility==='public'?'Public':'Private'}</p>
    <details className="my-3 text-sm"><summary className="cursor-pointer">Prompt</summary><p className="mt-2 whitespace-pre-wrap break-words">{item.prompt}</p></details>
    {item.error?<p className="mb-2 text-sm text-error">{item.error}</p>:null}
    <div className="flex flex-wrap items-center gap-2">
     {item.state==='ready'?<><a className="rounded-input border border-border px-3 py-2 text-sm font-semibold" href={`/app?from=${encodeURIComponent(item.videoId)}`}>Reuse settings</a>
      <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={()=>void change(item,'visibility')}>{item.visibility==='public'?'Make private':'Publish on site'}</Button></>:null}
     {item.state==='failed'||(item.state==='copying'&&!item.copyActive)?<Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={()=>void copy(item.videoId)}>Retry copy</Button>:null}
     <Button size="sm" variant="outline" disabled={Boolean(busy)||Boolean(item.placements.length)||Boolean(item.copyActive)} title={item.placements.length?'Remove site placements and unpublish before deleting.':undefined} onClick={()=>void change(item,'delete')}>{item.state==='deleting'?'Retry deletion':'Delete copy'}</Button>
    </div>
   </article>)}
  </div>
  <div className="flex gap-2"><Button variant="outline" size="sm" disabled={offset===0||loading||Boolean(busy)} onClick={()=>setOffset(Math.max(0,offset-20))}>Previous</Button><Button variant="outline" size="sm" disabled={nextOffset===null||loading||Boolean(busy)} onClick={()=>{if(nextOffset!==null)setOffset(nextOffset);}}>Next</Button></div>
 </>;
}
