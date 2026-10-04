import type {NextRequest} from 'next/server';
import {resolveStudioApiAccess} from '@/server/studio/access';
import {listStudioConversationProjects} from '@/server/studio/conversation-project-list';
import {studioConversationEditingEnabled} from './studio-conversation-editing-handler';
import {studioJson} from './studio-route-utils';

export async function handleStudioConversationProjects(req:NextRequest,dependencies:{enabled?:boolean;resolveAccess?:typeof resolveStudioApiAccess;list?:typeof listStudioConversationProjects}={}) {
  const access=await (dependencies.resolveAccess??resolveStudioApiAccess)(req);
  if(!access.ok)return studioJson({ok:false,error:access.error},{status:access.status});
  if(!(dependencies.enabled??studioConversationEditingEnabled()))return studioJson({ok:false,error:'STUDIO_CONVERSATION_EDITING_DISABLED'},{status:404});
  try{return studioJson({ok:true,projects:await (dependencies.list??listStudioConversationProjects)(access.userId)});}
  catch{return studioJson({ok:false,error:'STUDIO_PROJECTS_UNAVAILABLE'},{status:503});}
}
