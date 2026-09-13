import type { NextRequest } from 'next/server';
import { handleStudioChatPost } from '../_lib/studio-chat-handler';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  return handleStudioChatPost(req);
}
