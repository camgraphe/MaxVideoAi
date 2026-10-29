import { startWorkspaceReferenceFixture } from './workspace-reference-browser-fixture';

export const imageRailSource = `
import {useState} from 'react';import {createRoot} from 'react-dom/client';
import {ImageWorkspaceShell} from './app/(core)/(workspace)/app/image/_components/ImageWorkspaceShell';
import {ImageMediaHandoff} from './app/(core)/(workspace)/app/image/_components/ImageMediaHandoff.client';
const engine={id:'fixture-image',label:'Image model',modes:['t2i','i2i'],inputSchema:{required:[],optional:[]}};
const jobs=Array.from({length:10},(_,index)=>({jobId:'image-'+index,groupId:'image-'+index,engineId:engine.id,engineLabel:engine.label,
 status:'completed',outputKind:'image',imageUrl:'/first.svg',thumbUrl:'/first.svg',prompt:'A landscape',createdAt:'2026-10-28T10:'+String(59-index).padStart(2,'0')+':00Z'}));
globalThis.galleryFeed={stableJobs:jobs,data:[{jobs}],isLoading:false,isValidating:false,mutate(){},setSize(){}};
globalThis.fixtureOwner='owner-a';
function Fixture(){
 const [slots,setSlots]=useState([]),[open,setOpen]=useState('');
 return <div style={{display:'flex',minHeight:'100vh'}}>
 <ImageMediaHandoff key={globalThis.fixtureOwner} modelName="Image model" slots={slots} limit={1} onInsert={(asset,index)=>{setSlots([asset]);return true;}}>
 {(recentMedia,openRecentMedia)=><ImageWorkspaceShell onOpenRecentMedia={openRecentMedia} isDesktopLayout={true} recentMedia={recentMedia} galleryRailProps={{activeGroups:[],engineCapsList:[engine],selectedEngineCaps:engine,isImageJob:()=>true,onSelectStarter:()=>{},onOpenGroup:group=>setOpen(group.id)}}>
 <div data-testid="preview" style={{borderRadius:14,overflow:'hidden'}}><img src="/first.svg" alt="Image preview" style={{width:'100%',maxHeight:360,objectFit:'cover'}}/></div>
 <label>Prompt<textarea defaultValue="Keep this image prompt." /></label><output data-testid="reference">{slots[0]?.url??'No reference'}</output><output data-testid="opened">{open}</output>
 </ImageWorkspaceShell>}
 </ImageMediaHandoff></div>;
}createRoot(document.getElementById('root')).render(<Fixture/>);`;

export function startImageRailFixture() {
 return startWorkspaceReferenceFixture({source:imageRailSource,config:{},assistancePreview:true,hostModules:{
  '@/lib/supabaseClientLoader': `export async function loadSupabaseClient(){return {auth:{getSession:async()=>({data:{session:{user:{id:globalThis.fixtureOwner},access_token:'fixture-token'}},error:null})}};}`,
  '@/hooks/useRequireAuth': `export function useRequireAuth(){return {user:{id:globalThis.fixtureOwner},loading:false};}`,
  'next/navigation': `const params=new URLSearchParams();export function useSearchParams(){return params;}export function usePathname(){return '/app/image';}export function useRouter(){return {push(){},replace(){},prefetch(){}};}`,
  '@/lib/i18n/I18nProvider': `export function useI18n(){return {locale:'en',t:(_key,fallback)=>fallback};}`,
  '@/lib/api': `export function useInfiniteJobs(){return globalThis.galleryFeed;}export function useEngines(){return {data:{engines:[]}};}export async function saveImageToLibrary(){}`,
  '@/lib/authFetch': `export async function authFetch(){globalThis.recentFetches=(globalThis.recentFetches??0)+1;return Response.json({ok:true,outputs:[{id:'recent-image',url:'https://media.example/original.svg',thumbUrl:'/first.svg',kind:'image',mime:'image/svg+xml',status:'ready',jobId:'image-0'}]});}`,
  'next/link': `import React from 'react';export default function Link({prefetch,...props}){return <a {...props}/>;}`,
  'next/image': `import React from 'react';export default function Image({fill,priority,unoptimized,...props}){return <img {...props}/>;}`,
 }});
}
