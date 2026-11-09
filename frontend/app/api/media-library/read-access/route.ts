import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { renewLibraryMediaReadAccess } from '@/server/media-library/exact-read-access';
import { LibraryOrganizationError, onlyFields } from '@/server/media-library/organization-validation';
import { organizationResponse } from '@/server/media-library/organization-route';
import { buildAppDownloadUrl } from '@/lib/download';
export const runtime = 'nodejs';
const failure = (error: unknown) => organizationResponse({ ok: false, error: error instanceof LibraryOrganizationError ? error.message : error instanceof SyntaxError ? 'INVALID_JSON' : 'READ_ACCESS_FAILED' }, error instanceof LibraryOrganizationError ? error.status : error instanceof SyntaxError ? 400 : 500);
export async function POST(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) return organizationResponse({ ok: false, error: 'UNAUTHORIZED' }, 401);
  try {
    const body: unknown = await req.json();
    onlyFields(body, ['reference', 'revision']);
    return organizationResponse({ ok: true, access: await renewLibraryMediaReadAccess(userId, body.reference, body.revision) });
  } catch (error) { return failure(error); }
}
/** Native anchor navigation preserves popup/download user activation while renewing. */
export async function GET(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) return organizationResponse({ ok: false, error: 'UNAUTHORIZED' }, 401);
  try {
    const params = req.nextUrl.searchParams;
    for (const key of params.keys()) if (!['reference', 'revision', 'action', 'filename'].includes(key) || params.getAll(key).length !== 1) throw new LibraryOrganizationError('INVALID_READ_REFERENCE');
    const action = params.get('action');
    if (action !== 'original' && action !== 'download') throw new LibraryOrganizationError('INVALID_ACTION');
    const access = await renewLibraryMediaReadAccess(userId, JSON.parse(params.get('reference') ?? 'null'), params.get('revision'));
    const href = action === 'download' ? buildAppDownloadUrl(access.accessUrl!, params.get('filename')?.slice(0, 240) ?? undefined) : access.accessUrl!;
    return NextResponse.redirect(new URL(href, req.url), { status: 307, headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } });
  } catch (error) { return failure(error); }
}
