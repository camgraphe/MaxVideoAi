'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {useRequireAuth} from '@/hooks/useRequireAuth';
import {getReleasedCreatorToolIds} from '@/lib/toolbox/creator-availability';
import {supportsMediaDestination,stageMediaHandoff} from '@/lib/media-handoff';
import {creatorCopy} from '@/components/tools/creator/creator-copy';
import type {AssetBrowserAsset} from './AssetLibraryBrowser';
/** Selecting a tool transfers its source only. Preparation and payment remain explicit at the destination. */
export function CreatorToolLinks({asset,locale}:{asset:AssetBrowserAsset;locale:string}){
 const {user}=useRequireAuth({redirectIfLoggedOut:false}),router=useRouter(),[failed,setFailed]=useState(false);
 if(!user)return null;
 const tools=getReleasedCreatorToolIds().filter(id=>supportsMediaDestination(asset,id)),copy=creatorCopy(locale);
 return <div className="flex flex-wrap gap-2">{tools.map(id=><button type="button" key={id} className="min-h-11 rounded-lg border border-border px-3 text-xs" onClick={()=>{try{router.push(stageMediaHandoff(window.sessionStorage,user.id,asset,id,crypto.randomUUID()));}catch{setFailed(true);}}}>{copy.titles[id]}</button>)}{failed?<p role="alert">{locale.startsWith('fr')?'Ce média ne peut pas être ouvert.':locale.startsWith('es')?'No se puede abrir este medio.':'This media could not be opened.'}</p>:null}</div>;
}
