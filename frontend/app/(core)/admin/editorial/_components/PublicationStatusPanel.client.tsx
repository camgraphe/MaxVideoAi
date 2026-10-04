'use client';
import {ApproveDraftButton} from './ApproveDraftButton';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
import type {EditorialPublication} from '@/server/editorial/publication-queue';
const labels={queued:'Publication queued. It will start on the next service run.',processing:'Preparing publication…','awaiting-ci':'Checking the site and all three languages before deployment…','awaiting-deployment':'Deployment in progress. Public pages still need verification.',published:'Article published and public pages verified.',blocked:'Publication needs technical attention.',cancelled:'Publication cancelled after a correction request.'};
export function PublicationStatusPanel({publication:p}:{publication:EditorialPublication}){
 const router=useRouter();
 useEffect(()=>{if(['published','blocked','cancelled'].includes(p.status))return;const timer=setInterval(()=>router.refresh(),15000);return()=>clearInterval(timer);},[p.status,router]);
 return <section className="mt-4 space-y-2" aria-live="polite"><p className="font-semibold">{labels[p.status]}</p>{p.error&&<p className="text-sm text-text-secondary">{p.error}</p>}{p.status==='published'&&p.receipt.urls?.map((url,i)=><a key={url} href={url} className="mr-4 inline-block underline">Read {['EN','FR','ES'][i]}</a>)}{p.status==='blocked'&&<ApproveDraftButton articleId={p.articleId} version={p.version} digest={p.digest} retryPublication />}{p.status==='queued'&&<p className="text-sm text-text-secondary">The request is saved until the publication service processes it.</p>}</section>;
}
