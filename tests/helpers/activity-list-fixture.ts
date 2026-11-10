import { startWorkspaceReferenceFixture } from './workspace-reference-browser-fixture';

const source = `import {useState} from 'react';import {createRoot} from 'react-dom/client';
import {JobsPageShell} from './app/(core)/jobs/_components/JobsPageShell';
import {DEFAULT_JOBS_COPY} from './app/(core)/jobs/_lib/jobs-copy';
import {I18nProvider} from './lib/i18n/I18nProvider';
for(const group of fixtureConfig.groups){for(const member of [group.hero,...group.members]){if(member.thumbUrl)member.thumbUrl=new URL(member.thumbUrl,location.href).href;}}
function Scene(){const[source,setSource]=useState('all'),[status,setStatus]=useState('all'),[limit,setLimit]=useState(24),[opened,setOpened]=useState('');
const groups=fixtureConfig.groups.filter(g=>source==='all'||g.hero.job.surface===source).slice(0,limit);
return <I18nProvider locale="fr" dictionary={{}} fallback={{}}><JobsPageShell copy={fixtureConfig.copy??DEFAULT_JOBS_COPY}
 groups={groups} source={source} status={status} onSourceChange={setSource} onStatusChange={setStatus}
 hasMore={limit<fixtureConfig.groups.length} isInitialLoading={false} isValidating={false} error={null}
 onRetry={()=>{}} onLoadMore={()=>setLimit(n=>n+24)} hasCuratedVideo={false} actionFeedback={[]}
 onRetryAction={()=>{}} onDismissAction={()=>{}} onGroupOpen={g=>setOpened(g.id)} onGroupAction={()=>{}}
 allowRemove={()=>true} savingImageGroupIds={new Set()} viewerGroup={null} onCloseViewer={()=>{}}
 onRefreshJob={async()=>{}} onSaveLightboxEntryToLibrary={async()=>{}}/><output data-opened={opened}>{opened}</output></I18nProvider>};
createRoot(document.getElementById('root')).render(<Scene/>);`;

export function activityFixtureGroups() {
  return Array.from({length:60},(_,index)=>{
    const surface=index%3===0?'video':index%3===1?'image':'audio';
    const status=index===1?'pending':index===2?'failed':'completed';
    const createdAt='2026-11-10T12:00:00Z';
    const job={jobId:`job-${index}`,surface,engineId:'test-engine',engineLabel:surface==='video'?'Wan 3 Prime':surface==='image'?'Nano Banana':'Audio Model',durationSec:15,status,prompt:'A character walks into a bright kitchen, with a long prompt that stays on one line.',createdAt,
      ...(index===3?{activityOrigin:{kind:'studio',projectId:'project_fixture'}}:index===6?{activityOrigin:{kind:'mcp'}}:{})};
    const member={id:job.jobId,jobId:job.jobId,job,engineLabel:job.engineLabel,durationSec:15,status,prompt:job.prompt,createdAt,source:'job',thumbUrl:surface==='audio'?null:'/poster-portrait.svg',videoUrl:surface==='video'?'https://media.fixture.test/original.mp4':null,originalUrl:surface==='image'?'https://media.fixture.test/original.png':null,audioUrl:surface==='audio'?'https://media.fixture.test/original.wav':null};
    return {id:job.jobId,hero:member,members:[member],previews:[],count:1,source:'history',createdAt,totalPriceCents:46,currency:'USD'};
  });
}

export function startActivityFixture(copy?:unknown) {
  return startWorkspaceReferenceFixture({source,config:{groups:activityFixtureGroups(),copy},hostModules:{
    '@/components/HeaderBar':`export const HeaderBar=()=> <header style={{height:68,padding:20,borderBottom:'1px solid #ccc'}}>MaxVideoAI</header>;`,
    '@/components/AppSidebar':`export const AppSidebar=()=>null;`,
    '@/hooks/useRequireAuth':`export const useRequireAuth=()=>({user:{id:'fixture-owner'},loading:false,requireAuth:()=>true});`,
    'next/link':`export default function Link({prefetch,children,...props}){return <a {...props}>{children}</a>}`,
    'next/navigation':`export const useRouter=()=>({push:()=>{},replace:()=>{},refresh:()=>{}});export const usePathname=()=>'/jobs';export const useSearchParams=()=>new URLSearchParams();`,
    'next/dynamic':`import {lazy,Suspense} from 'react';export default function dynamic(load){const C=lazy(()=>Promise.resolve(load()).then(module=>({default:module.default??module})));return props=><Suspense fallback={null}><C {...props}/></Suspense>}`,
  }});
}
