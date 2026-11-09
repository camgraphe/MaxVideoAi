import type { NextRequest } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { validateHistoricalJobVideo } from '@/server/media-library/historical-job-video-validation';
import { organizationResponse, organizationRouteError } from '@/server/media-library/organization-route';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  const { userId } = await getRouteAuthContext(request);
  if (!userId) return organizationResponse({ ok: false, error: 'UNAUTHORIZED' }, 401);
  try {
    await validateHistoricalJobVideo(userId, await request.json());
    return organizationResponse({ ok: true });
  } catch (error) {
    return organizationRouteError(error);
  }
}
