import { NextRequest, NextResponse } from 'next/server';

import {
  isAiStrategistPlaygroundEnabled,
  runAiStrategistPlaygroundPipeline,
  type AiStrategistPlaygroundInput,
} from '@/lib/ai-strategist/playground-pipeline';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isAiStrategistPlaygroundEnabled()) {
    return NextResponse.json({ ok: false, error: 'AI Strategist playground is disabled.' }, { status: 404 });
  }

  try {
    await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }

  const body = await readBody(req);
  if (!body) {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }

  try {
    const result = await runAiStrategistPlaygroundPipeline(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[admin/ai-strategist-playground] failed to run strategist preview', error);
    return NextResponse.json({ ok: false, error: 'Failed to run AI Strategist preview.' }, { status: 500 });
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
