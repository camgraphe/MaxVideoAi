import { NextRequest, NextResponse } from 'next/server';
import { FEATURES } from '@/content/feature-flags';
import { readCreatorJson, runCreatorHttp } from '@/server/tools/creator-http';
import { prepareRecast } from '@/server/character-studio/recast';
import { localRecastRehearsalEnabled, rehearseRecast } from '@/server/character-studio/recast-rehearsal';
import { recastReadiness } from '@/server/character-studio/recast-readiness';
import { getActiveAccountRestriction } from '@/server/fraud-cleanup';
import { AgentApiError } from '@/server/agent-api/errors';
import { VideoExcerptError } from '@/server/video-excerpts/media';

export const runtime = 'nodejs';
export const maxDuration = 300;
const failure = (code: string, status: number) =>
  NextResponse.json(
    { ok: false, error: { code } },
    { status, headers: { 'Cache-Control': 'private, no-store' } },
  );

export function GET(request: NextRequest) {
  if (!FEATURES.workflows.toolsSection) return failure('TOOLS_DISABLED', 404);
  return runCreatorHttp(request, async () => {
    const mode = request.nextUrl.searchParams.get('mode');
    if (mode !== 'i2v' && mode !== 'ref2v' && mode !== 'v2v') return failure('PARAMETER_INVALID', 400);
    const issue = localRecastRehearsalEnabled() ? null : recastReadiness(mode);
    return issue ? failure(issue, 503) : { ready: true };
  });
}

export function POST(request: NextRequest) {
  if (!FEATURES.workflows.toolsSection) return failure('TOOLS_DISABLED', 404);
  return runCreatorHttp(request, async (actor) => {
    if (await getActiveAccountRestriction(actor.userId))
      throw new AgentApiError('ACCOUNT_RESTRICTED', 'Account restricted.');
    const body = await readCreatorJson(request);
    if (!body || typeof body !== 'object') return failure('PARAMETER_INVALID', 400);
    const mode =
      'video' in body && body.video
        ? 'v2v'
        : ('audio' in body && body.audio) || ('product' in body && body.product)
          ? 'ref2v'
          : 'i2v';
    const issue = localRecastRehearsalEnabled() ? null : recastReadiness(mode);
    if (issue) return failure(issue, 503);
    try {
      return localRecastRehearsalEnabled()
        ? await rehearseRecast(actor.userId, body)
        : await prepareRecast(actor, body);
    } catch (error) {
      if (error instanceof VideoExcerptError)
        return failure(error.code, error.code === 'PREPARATION_BUSY' ? 429 : 422);
      throw error;
    }
  });
}
