import { NextRequest, NextResponse } from 'next/server';

import { isAiStrategistBetaApiEnabled } from '@/lib/ai-strategist/beta-flags';
import { getUserIdFromRequest } from '@/lib/user';
import { markAiStrategistConversationApplied } from '@/server/ai-strategist-conversations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isAiStrategistBetaApiEnabled()) {
    return NextResponse.json({ ok: false, error: 'ai_strategist_beta_disabled' }, { status: 404 });
  }

  const body = await readBody(req);
  if (!body) {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }

  const userId = await getUserIdFromRequest(req);
  const applied = await markAiStrategistConversationApplied({
    conversationId: stringField(body.conversationId),
    userId,
    selectedModel: stringField(body.selectedModel),
    selectedWorkflow: stringField(body.workflow),
    target: stringField(body.target),
  });

  return NextResponse.json({ ok: true, applied });
}

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = (await req.json()) as unknown;
    return typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
