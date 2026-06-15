export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { compactStudioChatMessages, isStudioChatModelAllowed, resolveStudioChatModel } from '@/lib/studio-chat-models';
import { runStudioChat, type StudioChatMessageInput } from '@/server/studio/chat';
import { studioJson } from '../_lib/studio-route-utils';

function normalizeMessages(value: unknown): StudioChatMessageInput[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((message): StudioChatMessageInput | null => {
      if (!message || typeof message !== 'object') return null;
      const record = message as { role?: unknown; content?: unknown };
      const content = typeof record.content === 'string' ? record.content.trim() : '';
      if (!content) return null;
      const role = record.role === 'assistant' || record.role === 'system' ? record.role : 'user';
      return { role, content };
    })
    .filter((message): message is StudioChatMessageInput => Boolean(message));
}

export async function POST(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return studioJson({ ok: false, error: 'UNAUTHORIZED', message: 'Authentication required.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const payload = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const messages = normalizeMessages(payload.messages);
  if (!messages.length) {
    return studioJson({ ok: false, error: 'MESSAGE_REQUIRED', message: 'At least one message is required.' }, { status: 400 });
  }

  try {
    const provider = payload.provider === 'gemini' ? 'gemini' : 'openai';
    const requestedModelId = typeof payload.modelId === 'string' ? payload.modelId : '';
    if (requestedModelId && !isStudioChatModelAllowed(provider, requestedModelId)) {
      return studioJson({ ok: false, error: 'MODEL_NOT_ALLOWED', message: 'This Studio chat model is not available.' }, { status: 400 });
    }
    const model = resolveStudioChatModel(provider, requestedModelId);
    const result = await runStudioChat({
      provider,
      modelId: model.modelId,
      messages: compactStudioChatMessages(messages),
    });
    return studioJson({ ok: true, ...result });
  } catch (error) {
    return studioJson(
      {
        ok: false,
        error: 'STUDIO_CHAT_FAILED',
        message: error instanceof Error ? error.message : 'Studio chat failed.',
      },
      { status: 500 }
    );
  }
}
