import type { NextRequest } from 'next/server';
import { createCharacterStudioIntegration } from '@/server/character-studio/integration';
import { AgentApiError } from '@/server/agent-api/errors';
import { resolveStudioApiAccess } from '@/server/studio/access';
import { isStudioCharacterEnabled } from '@/server/studio/feature-access';
import { readImageConversationProject } from '@/server/studio/image-conversation-repository';
import { resolveStudioMedia } from '@/server/studio/media-resolver';
import { isStudioSameOriginRequest, studioJson } from './studio-route-utils';
import { readStudioConversationBody } from './studio-image-conversation-handler';

export async function handleStudioCharacters(req:NextRequest,projectId:string,operation:'read'|'select',options: {
  enabled?:boolean;resolveAccess?:typeof resolveStudioApiAccess;
} = {}) {
  if (!(options.enabled ?? isStudioCharacterEnabled()))
    return studioJson({ok:false,error:'NOT_FOUND'},{status:404});
  const access = await (options.resolveAccess ?? resolveStudioApiAccess)(req);
  if (!access.ok) return studioJson({ok:false,error:access.error},{status:access.status});
  if (!projectId || projectId.length>128 || projectId!==projectId.trim())
    return studioJson({ok:false,error:'INVALID_PROJECT'},{status:400});
  if (operation==='select' && !isStudioSameOriginRequest(req))
    return studioJson({ok:false,error:'SAME_ORIGIN_REQUIRED'},{status:403});
  try {
    try {await readImageConversationProject(access.userId,projectId);}
    catch(error) {
      if (error instanceof AgentApiError && error.code==='PARAMETER_INVALID')
        return studioJson({ok:false,error:'NOT_FOUND'},{status:404});
      throw error;
    }
    const character = createCharacterStudioIntegration({
      authMethod:'studio-session',clientId:null,projectId,userId:access.userId,
    },{executionEnabled:false});
    const params = req.nextUrl.searchParams;
    if (operation==='read') {
      const characterId = params.get('characterId');
      if (characterId!==null) {
        const {id,name,identity,looks,nextLookCursor} = await character.get({
          characterId,lookCursor:params.get('lookCursor'),lookName:params.get('lookName')??undefined,
        });
        return studioJson({ok:true,result:{
          id,name,identity:portraitPreview(identity),looks:looks.map(look=>({id:look.id,name:look.name,...portraitPreview(look)})),nextLookCursor,
        }});
      }
      const {characters,nextCursor} = await character.list({
        cursor:params.get('cursor'),name:params.get('name')??undefined,search:params.get('search')??undefined,
      });
      return studioJson({ok:true,result:{
        characters:characters.map(({id,name,identity,lookCount})=>({id,name,identity:portraitPreview(identity),lookCount})),nextCursor,
      }});
    }
    const selected = await character.select(await readStudioConversationBody(req));
    const media = await resolveStudioMedia(access.userId,{type:'asset',kind:'image',assetId:selected.assetId});
    return studioJson({ok:true,result:{
      assetId:selected.assetId,kind:'image',url:media.url,thumbUrl:media.thumbUrl,
      name:selected.lookName ? selected.name+' · '+selected.lookName : selected.name,
    }});
  } catch (error) {
    const status = error instanceof AgentApiError
      ? error.code==='REFERENCE_NOT_FOUND' ? 404 : error.code==='PARAMETER_INVALID' ? 400 : 503
      : error instanceof SyntaxError || (error instanceof Error && error.message==='INVALID_BODY') ? 400
        : error instanceof Error && error.message==='BODY_TOO_LARGE' ? 413 : 503;
    return studioJson({ok:false,error:status===404?'REFERENCE_NOT_FOUND':status===503?'CHARACTER_LIBRARY_UNAVAILABLE':'INVALID_REQUEST'},{status});
  }
}

function portraitPreview(source:{imageUrl:string;thumbUrl:string}) {
  return {url:source.imageUrl,thumbUrl:source.thumbUrl};
}
