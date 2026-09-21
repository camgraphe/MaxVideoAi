'use client';
import {useState} from 'react';
export function CorrectionForm({articleId,version,digest,locale,blocks}:{articleId:string;version:number;digest:string;locale:string;blocks:Array<{id:string;heading?:string}>}) {
 const [status,setStatus]=useState('');const [busy,setBusy]=useState(false);const [requestId]=useState(()=>crypto.randomUUID());
 return <form className="space-y-3 rounded-xl border border-hairline p-5" onSubmit={async e=>{
  e.preventDefault();setBusy(true);const form=new FormData(e.currentTarget);const blockId=String(form.get('blockId')??'');
  try{const r=await fetch(`/api/admin/editorial/${articleId}/corrections`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version,digest,locale,requestId,message:form.get('message'),...(blockId?{blockId}:{})})});setStatus(r.ok?'Demande enregistrée. Cette version reste en brouillon.':'Demande non enregistrée. Vérifie que cette version est la plus récente.');setBusy(r.ok);}catch{setStatus('Connexion interrompue. Tu peux réessayer.');setBusy(false);}
 }}><h2 className="font-bold">Demander une correction</h2><label className="block">Passage<select className="block w-full rounded border p-2" name="blockId"><option value="">Article entier</option>{blocks.map(b=><option key={b.id} value={b.id}>{b.heading??b.id}</option>)}</select></label><label className="block">Ta demande<textarea className="block min-h-32 w-full rounded border p-2" name="message" required minLength={8} maxLength={3000}/></label><button disabled={busy} className="rounded-full border px-5 py-3" type="submit">Enregistrer ma demande</button><p role="status">{status}</p></form>;
}
