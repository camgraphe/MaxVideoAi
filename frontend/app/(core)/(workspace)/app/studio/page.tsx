import type {Metadata} from 'next';
import {notFound,redirect} from 'next/navigation';
import {HeaderBar} from '@/components/HeaderBar';
import {AppSidebar} from '@/components/AppSidebar';
import {resolveStudioPageAccess} from '@/server/studio/access';
import {listStudioConversationProjects} from '@/server/studio/conversation-project-list';
import {buildLoginHref} from '@/lib/auth-entry-href';
import {resolveStudioMarketingStarter} from './_lib/studio-project-marketing-entry';
import {StudioStart} from './_components/StudioStart.client';
import StudioPreviewAccess from './_components/StudioPreviewAccess.client';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const metadata:Metadata={title:'Studio | MaxVideoAI',robots:{index:false,follow:false}};

export default async function StudioPage({searchParams}: {searchParams: Promise<{starter?: string | string[]}>}) {
  const starter = resolveStudioMarketingStarter((await searchParams).starter);
  const access=await resolveStudioPageAccess();
  if(!access.ok&&access.status===404)notFound();
  if(!access.ok&&access.status===401)redirect(buildLoginHref({mode:'signin',nextPath:'/app/studio'}));
  const conversationEnabled=process.env.STUDIO_IMAGE_CONVERSATION_ENABLED==='true'&&process.env.STUDIO_CONVERSATION_ACTIONS_ENABLED==='true'&&process.env.STUDIO_CONVERSATION_EDITING_ENABLED==='true';
  let unavailable=!conversationEnabled;
  if(access.ok&&conversationEnabled){
    const projects=await listStudioConversationProjects(access.userId).catch(()=>{unavailable=true;return [];});
    const recent=projects.find(project=>project.persistenceMode==='connected');
    if(recent&&!starter)redirect('/app/studio/conversation/'+encodeURIComponent(recent.id));
  }
  const localQa=process.env.NODE_ENV!=='production'&&process.env.STUDIO_INTEGRATION_RUNTIME==='1';
  return <div className="flex h-[calc(100dvh-var(--app-bottom-nav-height,0px))] flex-col overflow-hidden bg-bg">
    <HeaderBar localQa={localQa}/><div className="flex min-h-0 min-w-0 flex-1 flex-col md:flex-row"><AppSidebar/><main className="min-h-0 min-w-0 flex-1 overflow-hidden">
      {access.ok?<StudioStart key={access.userId} accountKey={access.userId} unavailable={unavailable} starter={starter??undefined}/>:<StudioPreviewAccess visitor={access.status===401}/>}
    </main></div>
  </div>;
}
