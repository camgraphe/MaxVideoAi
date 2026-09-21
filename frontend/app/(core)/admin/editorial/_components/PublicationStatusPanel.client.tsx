'use client';
import {ApproveDraftButton} from './ApproveDraftButton';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
import type {EditorialPublication} from '@/server/editorial/publication-queue';
const labels={queued:'Publication demandée. Elle démarrera au prochain passage du service.',processing:'Préparation de la mise en ligne…','awaiting-ci':'Vérification du site et des trois langues avant déploiement…','awaiting-deployment':'Déploiement en cours. Les pages publiques restent à vérifier.',published:'Article publié et pages vérifiées.',blocked:'La publication demande une intervention technique.',cancelled:'Publication annulée à la suite d’une correction.'};
export function PublicationStatusPanel({publication:p}:{publication:EditorialPublication}){
 const router=useRouter();
 useEffect(()=>{if(['published','blocked','cancelled'].includes(p.status))return;const timer=setInterval(()=>router.refresh(),15000);return()=>clearInterval(timer);},[p.status,router]);
 return <section className="mt-4 space-y-2" aria-live="polite"><p className="font-semibold">{labels[p.status]}</p>{p.error&&<p className="text-sm text-text-secondary">{p.error}</p>}{p.status==='published'&&p.receipt.urls?.map((url,i)=><a key={url} href={url} className="mr-4 inline-block underline">Lire {['EN','FR','ES'][i]}</a>)}{p.status==='blocked'&&<ApproveDraftButton articleId={p.articleId} version={p.version} digest={p.digest} retryPublication />}{p.status==='queued'&&<p className="text-sm text-text-secondary">Pendant l’essai local, le Mac doit être allumé. La demande est conservée s’il est éteint.</p>}</section>;
}
