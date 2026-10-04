import type {NextRequest} from 'next/server';
import {handleStudioConversationEditing} from '../_lib/studio-conversation-editing-handler';
import {handleStudioConversationProjects} from '../_lib/studio-conversation-projects-handler';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {return handleStudioConversationProjects(req);}
export async function POST(req: NextRequest) {return handleStudioConversationEditing(req,'create');}
