import {z} from 'zod';
import {studioProjectNameSchema} from '@/lib/studio/conversation-project-title';
import {renameStudioConversationProject} from '@/server/studio/conversation-project-naming';
import type {NextRequest} from 'next/server';
import {resolveStudioApiAccess} from '@/server/studio/access';
import {createStudioConversationProject} from '@/server/studio/conversation-project-command';
import {editStudioConversationTimeline} from '@/server/studio/conversation-edit-command';
import {readStudioConversationTimeline} from '@/server/studio/conversation-timeline';
import {conversationTimelineCommandSchema} from '@/lib/studio/conversation-timeline-editing';
import {connectedStudioError} from './studio-connected-route-utils';
import {studioJson} from './studio-route-utils';

export function studioConversationEditingEnabled() {
  return process.env.STUDIO_IMAGE_CONVERSATION_ENABLED === 'true' && process.env.STUDIO_CONVERSATION_ACTIONS_ENABLED === 'true' && process.env.STUDIO_CONVERSATION_EDITING_ENABLED === 'true';
}
export async function handleStudioConversationEditing(req: NextRequest,operation: 'create'|'read'|'edit'|'rename',projectId?: string,dependencies: {
  enabled?: boolean;resolveAccess?: typeof resolveStudioApiAccess;create?: typeof createStudioConversationProject;read?: typeof readStudioConversationTimeline;edit?: typeof editStudioConversationTimeline;rename?:typeof renameStudioConversationProject;
} = {}) {
  const access = await (dependencies.resolveAccess ?? resolveStudioApiAccess)(req);
  if (!access.ok) return studioJson({ok: false,error: access.error},{status: access.status});
  if (!(dependencies.enabled ?? studioConversationEditingEnabled())) return studioJson({ok: false,error: 'STUDIO_CONVERSATION_EDITING_DISABLED'},{status: 404});
  if (operation !== 'read' && (req.headers.get('origin') !== req.nextUrl.origin || req.headers.get('sec-fetch-site') === 'cross-site')) return studioJson({ok: false,error: 'SAME_ORIGIN_REQUIRED'},{status: 403});
  try {
    if (operation === 'read') return studioJson({ok: true,result: await (dependencies.read ?? readStudioConversationTimeline)({userId: access.userId,projectId: projectId!},req.nextUrl.searchParams.get('preview') === '1')});
    const reader = req.body?.getReader();
    if (!reader) return studioJson({ok: false,error: 'INVALID_REQUEST'},{status: 400});
    let size = 0;
    const chunks: Uint8Array[] = [];
    try {while (true) {const next = await reader.read(); if (next.done) break; size += next.value.byteLength; if (size > 12000) {await reader.cancel(); return studioJson({ok: false,error: 'BODY_TOO_LARGE'},{status: 413});} chunks.push(next.value);}}
    finally {reader.releaseLock();}
    const raw = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(operation==='rename'){
      const input=z.object({projectId:z.string().min(1).max(256),name:studioProjectNameSchema,idempotencyKey:z.string().min(1).max(128)}).strict().safeParse(raw);
      if(!input.success)return studioJson({ok:false,error:'INVALID_REQUEST'},{status:400});
      return studioJson({ok:true,result:await(dependencies.rename??renameStudioConversationProject)({userId:access.userId,projectId:input.data.projectId},input.data)});
    }
    if (operation === 'create') return studioJson({ok: true,result: await (dependencies.create ?? createStudioConversationProject)({userId: access.userId},raw,{featureEnabled: true})});
    const parsed = conversationTimelineCommandSchema.omit({projectId: true}).safeParse(raw);
    if (!parsed.success) return studioJson({ok: false,error: 'INVALID_REQUEST'},{status: 400});
    return studioJson({ok: true,result: await (dependencies.edit ?? editStudioConversationTimeline)({userId: access.userId},{...parsed.data,projectId},{featureEnabled: true})});
  } catch (error) {
    if (error instanceof SyntaxError) return studioJson({ok: false,error: 'INVALID_REQUEST'},{status: 400});
    const failure = connectedStudioError(error,'STUDIO_TIMELINE_UNAVAILABLE');
    const message = error instanceof Error ? error.message : failure.error;
    const invalid = /^(Invalid Studio|MEDIA_METADATA_REQUIRED|Timeline track|Edit would|Clip duration|This clip|Timeline clip)/.test(message);
    return studioJson({ok: false,error: invalid ? message : failure.error},{status: invalid ? 400 : failure.status});
  }
}
