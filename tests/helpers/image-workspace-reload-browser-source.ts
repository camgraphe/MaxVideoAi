/** Actual account boundary and full Image workspace. Test adapters replace only external services/Next host APIs. */
export const imageWorkspaceReloadBrowserSource=`
import {createRoot} from 'react-dom/client';
import {I18nProvider} from './lib/i18n/I18nProvider';
import ImageWorkspaceSession from './app/(core)/(workspace)/app/image/_components/ImageWorkspaceSession.client';
createRoot(document.getElementById('root')).render(<I18nProvider locale="en" dictionary={{}} fallback={{}}><ImageWorkspaceSession engines={globalThis.fixtureConfig.engines}/></I18nProvider>);
`;

export const imageWorkspaceReloadHostModules={
 'next/link':`import React from 'react';export default function Link({prefetch,...props}){return <a {...props}/>;}`,
 'next/image':`import React from 'react';export default function Image({fill,priority,unoptimized,fetchPriority,...props}){return <img {...props}/>;}`,
 'next/navigation':`const params=new URLSearchParams(globalThis.fixtureConfig.query??'');export function useSearchParams(){return params;}export function usePathname(){return '/app/image';}export function useRouter(){return {push(){},replace(){},prefetch(){}};}export function redirect(){throw Error('Unexpected navigation');}export const permanentRedirect=redirect;`,
 '@/hooks/useRequireAuth':`const user={id:'image-reload-owner'};export function useRequireAuth(){return {user,loading:false};}`,
 'swr':`const mutate=async()=>{},pricing={ok:true,unitPriceCents:7,totalPriceCents:7,currency:'USD',pricing:null};export default function useSWR(key){return {data:Array.isArray(key)&&key[0]==='image-pricing'?pricing:undefined,error:null,isLoading:false,mutate};}export function useSWRConfig(){return {mutate};}export {mutate};export function SWRConfig({children}){return children;}`,
 'swr/infinite':`const data=[{jobs:[],nextCursor:null}],mutate=async()=>{};export default function useSWRInfinite(){return {data,mutate,size:1,setSize:mutate,isLoading:false,isValidating:false};}`,
 '@/lib/authFetch':`export const authFetch=(url,init)=>fetch(url,init);`,
 // Observe the real surface's input without changing its props, state or rendered content.
 './_components/ImageWorkspaceComposerSurface':`import React from 'react';import {ImageWorkspaceComposerSurface as Surface} from './app/(core)/(workspace)/app/image/_components/ImageWorkspaceComposerSurface';
 const keys=['selectedEngineId','mode','aspectRatio','resolution','quality','numImages','background','customImageHeight','customImageWidth','enableWebSearch','limitGenerations','maskUrl','outputFormat','seed','style','thinkingLevel','watermark','prompt'];
 export function ImageWorkspaceComposerSurface(props){const frame={...Object.fromEntries(keys.map(key=>[key,props[key]])),referenceFields:props.referenceAssetFields.map(({field,required,disabled})=>({field,required,disabled})),assets:props.composerReferenceAssets};globalThis.imageOwnerFrames??=[];globalThis.imageOwnerFrames.push(JSON.parse(JSON.stringify(frame)));return <Surface {...props}/>;}`,
};
