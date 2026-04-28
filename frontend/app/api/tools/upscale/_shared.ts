import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { FEATURES } from '@/content/feature-flags';
import { getUpscaleToolEngine } from '@/config/tools-upscale-engines';
import type { UpscaleMediaType, UpscaleToolRequest, UpscaleToolResponse } from '@/types/tools-upscale';
import { UpscaleToolError } from '@/server/tools/upscale';

type UpscaleRunner = (
  input: UpscaleToolRequest & {
    userId: string;
  }
) => Promise<UpscaleToolResponse>;

function optionalNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function handleUpscaleToolRequest(
  req: NextRequest,
  mediaType: UpscaleMediaType,
  runUpscale: UpscaleRunner
) {
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

  let body: Partial<UpscaleToolRequest> | null = null;
  try {
    body = (await req.json()) as Partial<UpscaleToolRequest>;
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

  if (body?.mediaType !== mediaType) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'invalid_media_type',
          message: `mediaType must be ${mediaType}.`,
        },
      },
      { status: 400 }
    );
  }

  const mediaUrl = typeof body?.mediaUrl === 'string' ? body.mediaUrl.trim() : '';
  if (!mediaUrl || !/^https?:\/\//i.test(mediaUrl)) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'invalid_media_url',
          message: 'A valid absolute media URL is required.',
        },
      },
      { status: 400 }
    );
  }

  const engine = getUpscaleToolEngine(body?.engineId, mediaType);
  if (body?.engineId && engine.id !== body.engineId) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'invalid_engine',
          message: 'Selected engine does not support this media type.',
        },
      },
      { status: 400 }
    );
  }

  try {
    const result = await runUpscale({
      userId,
      mediaType,
      mediaUrl,
      engineId: engine.id,
      mode: body?.mode,
      upscaleFactor: optionalNumber(body?.upscaleFactor) ?? undefined,
      targetResolution: body?.targetResolution,
      outputFormat: body?.outputFormat,
      sourceJobId: typeof body?.sourceJobId === 'string' ? body.sourceJobId : null,
      sourceAssetId: typeof body?.sourceAssetId === 'string' ? body.sourceAssetId : null,
      imageWidth: optionalNumber(body?.imageWidth),
      imageHeight: optionalNumber(body?.imageHeight),
    });

    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof UpscaleToolError ? error.status : 502;
    const code = error instanceof UpscaleToolError ? error.code : 'upscale_tool_error';
    const detail = error instanceof UpscaleToolError ? error.detail : undefined;
    const message = error instanceof Error ? error.message : 'Upscale generation failed.';

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
