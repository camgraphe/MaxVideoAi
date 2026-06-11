export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getBackgroundRemovalToolEngine } from '@/config/tools-background-removal-engines';
import { FEATURES } from '@/content/feature-flags';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import {
  resolveOutputCodec,
  resolveStudioBackgroundColor,
  validateBackgroundRemovalDuration,
} from '@/lib/tools-background-removal';
import { RESTRICTED_ACCOUNT_MESSAGE, getActiveAccountRestriction } from '@/server/fraud-cleanup';
import { BackgroundRemovalToolError, runBackgroundRemovalToolBase } from '@/server/tools/background-removal';
import type { BackgroundRemovalToolRequest } from '@/types/tools-background-removal';

function optionalNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(req: NextRequest) {
  if (!FEATURES.workflows.toolsSection) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'tools_disabled',
          message: 'Tools are currently disabled.',
        },
      },
      { status: 404 }
    );
  }

  let body: Partial<BackgroundRemovalToolRequest> | null = null;
  try {
    body = (await req.json()) as Partial<BackgroundRemovalToolRequest>;
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

  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'auth_required',
          message: 'Authentication required.',
        },
      },
      { status: 401 }
    );
  }
  const restriction = await getActiveAccountRestriction(userId);
  if (restriction) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'account_restricted',
          message: RESTRICTED_ACCOUNT_MESSAGE,
        },
      },
      { status: 403 }
    );
  }

  const videoUrl = typeof body?.videoUrl === 'string' ? body.videoUrl.trim() : '';
  if (!videoUrl || !/^https?:\/\//i.test(videoUrl)) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'invalid_video_url',
          message: 'A valid absolute video URL is required.',
        },
      },
      { status: 400 }
    );
  }

  const engine = getBackgroundRemovalToolEngine(body?.engineId, 'studio');
  if (body?.engineId && engine.id !== body.engineId) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'invalid_engine',
          message: 'Selected engine does not support studio background removal.',
        },
      },
      { status: 400 }
    );
  }

  const durationSec = optionalNumber(body?.durationSec);
  const durationError = validateBackgroundRemovalDuration(durationSec);
  if (durationError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'video_metadata_required',
          message: durationError,
        },
      },
      { status: 422 }
    );
  }

  try {
    const result = await runBackgroundRemovalToolBase({
      userId,
      videoUrl,
      engineId: engine.id,
      backgroundColor: resolveStudioBackgroundColor(body?.backgroundColor),
      outputContainerAndCodec: resolveOutputCodec(body?.outputContainerAndCodec),
      preserveAudio: body?.preserveAudio !== false,
      sourceJobId: typeof body?.sourceJobId === 'string' ? body.sourceJobId : null,
      sourceAssetId: typeof body?.sourceAssetId === 'string' ? body.sourceAssetId : null,
      videoWidth: optionalNumber(body?.videoWidth),
      videoHeight: optionalNumber(body?.videoHeight),
      durationSec,
      fps: optionalNumber(body?.fps),
    });

    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof BackgroundRemovalToolError ? error.status : 502;
    const code = error instanceof BackgroundRemovalToolError ? error.code : 'background_removal_tool_error';
    const detail = error instanceof BackgroundRemovalToolError ? error.detail : undefined;
    const message = error instanceof Error ? error.message : 'Background removal failed.';

    return NextResponse.json(
      {
        ok: false,
        error: {
          code,
          message,
          detail,
        },
      },
      { status }
    );
  }
}
