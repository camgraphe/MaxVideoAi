import { NextRequest, NextResponse } from 'next/server';

import { isAiStrategistBetaApiEnabled } from '@/lib/ai-strategist/beta-flags';
import { toAiStrategistBetaResponse } from '@/lib/ai-strategist/beta-response';
import {
  runAiStrategistPlaygroundPipeline,
  type AiStrategistPlaygroundInput,
} from '@/lib/ai-strategist/playground-pipeline';

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

  try {
    const result = await runAiStrategistPlaygroundPipeline({
      ...body,
      surface: 'chat',
    });
    return NextResponse.json(toAiStrategistBetaResponse(result));
  } catch (error) {
    console.error('[ai-video-strategist/beta] failed to run strategist beta', error);
    return NextResponse.json({ ok: false, error: 'Failed to run AI Strategist beta.' }, { status: 500 });
  }
}

async function readBody(req: Request): Promise<AiStrategistPlaygroundInput | null> {
  try {
    const body = (await req.json()) as unknown;
    return isRecord(body) ? (body as AiStrategistPlaygroundInput) : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
