import { NextRequest } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { readLibraryStorageUsage } from '@/server/media-library/storage-usage';
import { organizationResponse, organizationRouteError } from '@/server/media-library/organization-route';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) return organizationResponse({ ok: false, error: 'UNAUTHORIZED' }, 401);
  try { return organizationResponse({ ok: true, usage: await readLibraryStorageUsage(userId) }); }
  catch (error) { return organizationRouteError(error); }
}
