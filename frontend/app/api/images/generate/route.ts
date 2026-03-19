export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import type { ImageGenerationRequest, ImageGenerationResponse } from '@/types/image-generation';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { executeImageGeneration, ImageGenerationExecutionError } from '@/server/images/execute-image-generation';

function respondError(
  mode: ImageGenerationRequest['mode'],
  code: string,
  message: string,
  status: number,
  detail?: unknown,
  extras?: Partial<ImageGenerationResponse>
) {
  const payload: ImageGenerationResponse = {
    ok: false,
    mode,
    images: [],
    ...extras,
    error: {
      code,
      message,
      detail,
    },
  };
  return NextResponse.json(payload, { status });
}

export async function POST(req: NextRequest) {
  let body: Partial<ImageGenerationRequest> | null = null;
  try {
    body = (await req.json()) as Partial<ImageGenerationRequest>;
  } catch {
    return respondError('t2i', 'invalid_payload', 'Payload must be valid JSON.', 400);
  }

  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return respondError('t2i', 'auth_required', 'Authentication required.', 401);
  }

  try {
    const result = await executeImageGeneration({
      userId,
      body,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ImageGenerationExecutionError) {
      return respondError(error.mode, error.code, error.message, error.status, error.detail, error.extras);
    }
    console.error('[images] unexpected generation error', error);
    return respondError('t2i', 'image_generation_failed', 'Image generation failed.', 500);
  }
}
