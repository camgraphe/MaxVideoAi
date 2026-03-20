import { NextRequest, NextResponse } from 'next/server';

import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { generateAudioRun, AudioGenerationError } from '@/server/audio/generate-audio';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'INVALID_JSON', message: 'Invalid JSON payload.' }, { status: 400 });
  }

  try {
    const response = await generateAudioRun({
      body: body as Parameters<typeof generateAudioRun>[0]['body'],
      userId,
    });
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof AudioGenerationError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.code,
          message: error.message,
          field: error.field,
          providerFailures: error.providerFailures,
        },
        { status: error.status }
      );
    }

    console.error('[api/audio/generate] unexpected failure', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'audio_generation_failed',
        message: error instanceof Error ? error.message : 'Audio generation failed.',
      },
      { status: 500 }
    );
  }
}

