'use client';
import {useState} from 'react';
export function CorrectionForm({articleId,version,digest,locale,blocks}:{articleId:string;version:number;digest:string;locale:string;blocks:Array<{id:string;heading?:string}>}) {
 const [status,setStatus]=useState('');const [busy,setBusy]=useState(false);const [requestId]=useState(()=>crypto.randomUUID());
 return <form className="space-y-3" onSubmit={async e=>{
  e.preventDefault();setBusy(true);const form=new FormData(e.currentTarget);const blockId=String(form.get('blockId')??'');
  try{const r=await fetch(`/api/admin/editorial/${articleId}/corrections`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version,digest,locale,requestId,message:form.get('message'),...(blockId?{blockId}:{})})});setStatus(r.ok?'Request saved. Review the corrected version before publishing.':'Request not saved. Check that this is the latest version.');setBusy(r.ok);}catch{setStatus('Connection interrupted. You can retry.');setBusy(false);}
 }}><h2 className="font-bold">Request a correction</h2><label className="block">Section<select className="block w-full rounded border p-2" name="blockId"><option value="">Entire article</option>{blocks.map(b=><option key={b.id} value={b.id}>{b.heading??b.id}</option>)}</select></label><label className="block">Your request<textarea className="block min-h-32 w-full rounded border p-2" name="message" required minLength={8} maxLength={3000}/></label><button disabled={busy} className="rounded-md border px-4 py-2" type="submit">Save request</button><p role="status">{status}</p></form>;
}
