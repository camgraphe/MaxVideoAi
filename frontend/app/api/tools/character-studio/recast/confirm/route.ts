import { NextRequest, NextResponse } from 'next/server';
import { FEATURES } from '@/content/feature-flags';
import { readCreatorJson, runCreatorHttp } from '@/server/tools/creator-http';
import { confirmRecast } from '@/server/character-studio/recast';

import { liveRecastEnabled } from '@/server/character-studio/recast-readiness';
import { localRecastRehearsalEnabled } from '@/server/character-studio/recast-rehearsal';

export const runtime = 'nodejs';
export const maxDuration = 300;

export function POST(request: NextRequest) {
  if (!FEATURES.workflows.toolsSection) return new NextResponse(null, { status: 404 });
  if (localRecastRehearsalEnabled() || !liveRecastEnabled())
    return NextResponse.json(
      { ok: false, error: { code: 'RENDER_DEFERRED' } },
      { status: 409, headers: { 'Cache-Control': 'no-store' } },
    );
  return runCreatorHttp(request, async (actor) => confirmRecast(actor, await readCreatorJson(request)), {
    charge: true,
  });
}
