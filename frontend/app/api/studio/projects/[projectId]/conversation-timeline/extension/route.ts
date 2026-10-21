import type {NextRequest} from 'next/server';
import {handleStudioConversationEditing} from '../../../../_lib/studio-conversation-editing-handler';
export const runtime='nodejs';
export async function POST(req:NextRequest,context:{params:Promise<{projectId:string}>}) {
  return handleStudioConversationEditing(req,'finish-extension',(await context.params).projectId);
}
