export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import type { UpscaleToolRequest } from '@/types/tools-upscale';

export async function POST(req: NextRequest) {
  let body: Partial<UpscaleToolRequest> | null = null;
  try {
    body = (await req.clone().json()) as Partial<UpscaleToolRequest>;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'invalid_payload',
          message: 'Payload must be valid JSON.',
        },
      },
      { status: 400 }
    );
  }

  if (body?.mediaType !== 'image' && body?.mediaType !== 'video') {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'invalid_media_type',
          message: 'mediaType must be image or video.',
        },
      },
      { status: 400 }
    );
  }

  const redirectUrl = new URL(`/api/tools/upscale/${body.mediaType}`, req.url);
  return NextResponse.redirect(redirectUrl, 307);
}
