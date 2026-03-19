export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { FEATURES } from '@/content/feature-flags';
import type { AngleToolRequest, AngleToolNumericParams } from '@/types/tools-angle';
import { runAngleTool, AngleToolError } from '@/server/tools/angle';

function parseParams(value: unknown): AngleToolNumericParams | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;

  const rotation = Number(record.rotation);
  const tilt = Number(record.tilt);
  const zoom = Number(record.zoom);

  if (!Number.isFinite(rotation) || !Number.isFinite(tilt) || !Number.isFinite(zoom)) {
    return null;
  }

  return {
    rotation,
    tilt,
    zoom,
  };
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

  let body: Partial<AngleToolRequest> | null = null;

  try {
    body = (await req.json()) as Partial<AngleToolRequest>;
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

  const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl.trim() : '';
  if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'invalid_image_url',
          message: 'A valid absolute image URL is required.',
        },
      },
      { status: 400 }
    );
  }

  const params = parseParams(body?.params);
  if (!params) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'invalid_params',
          message: 'rotation, tilt, and zoom must be numbers.',
        },
      },
      { status: 400 }
    );
  }

  try {
    const result = await runAngleTool({
      userId,
      imageUrl,
      engineId: body?.engineId,
      params,
      safeMode: body?.safeMode,
      generateBestAngles: body?.generateBestAngles === true,
      imageWidth: typeof body?.imageWidth === 'number' ? body.imageWidth : undefined,
      imageHeight: typeof body?.imageHeight === 'number' ? body.imageHeight : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof AngleToolError ? error.status : 502;
    const code = error instanceof AngleToolError ? error.code : 'angle_tool_error';
    const detail = error instanceof AngleToolError ? error.detail : undefined;
    const message = error instanceof Error ? error.message : 'Angle generation failed.';

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
