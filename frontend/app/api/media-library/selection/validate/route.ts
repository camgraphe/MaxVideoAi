import type { NextRequest } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { validateLibraryPickerCandidates } from '@/server/media-library/picker-validation';
import { organizationResponse, organizationRouteError } from '@/server/media-library/organization-route';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  const { userId } = await getRouteAuthContext(request);
  if (!userId) return organizationResponse({ ok: false, error: 'UNAUTHORIZED' }, 401);
  try {
    return organizationResponse({
      ok: true,
      results: await validateLibraryPickerCandidates(userId, await request.json()),
    });
  } catch (error) {
    return organizationRouteError(error);
  }
}
