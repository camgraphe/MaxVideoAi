import type {NextRequest} from 'next/server';
import {handleStudioConversationEditing} from '../../../_lib/studio-conversation-editing-handler';
export const runtime = 'nodejs';
type Context = {params: Promise<{projectId: string}>};
export async function GET(req: NextRequest,context: Context) {return handleStudioConversationEditing(req,'read',(await context.params).projectId);}
export async function POST(req: NextRequest,context: Context) {return handleStudioConversationEditing(req,'edit',(await context.params).projectId);}
