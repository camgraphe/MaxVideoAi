import { NextRequest } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { browseLibrary } from '@/server/media-library/browse';
import { normalizeLibraryBrowseScope } from '@/server/media-library/browse-validation';
import { LibraryOrganizationError } from '@/server/media-library/organization-validation';
import { organizationResponse, organizationRouteError } from '@/server/media-library/organization-route';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
    const { userId } = await getRouteAuthContext(req);
    if (!userId)
        return organizationResponse({ ok: false, error: 'UNAUTHORIZED', assets: [] }, 401);
    try {
        const params = req.nextUrl.searchParams, raw: Record<string, unknown> = {};
        for (const [key, value] of params) {
            if (params.getAll(key).length !== 1)
                throw new LibraryOrganizationError('INVALID_SCOPE');
            if (key === 'cursor' || key === 'limit')
                continue;
            if (key === 'favorite' || key === 'trash') {
                if (value !== 'true' && value !== 'false')
                    throw new LibraryOrganizationError('INVALID_SCOPE');
                raw[key] = value === 'true';
            }
            else
                raw[key] = value;
        }
        const scope = normalizeLibraryBrowseScope(raw);
        const page = await browseLibrary({ userId, scope, limit: params.has('limit') ? Number(params.get('limit')) : undefined, cursor: params.get('cursor') });
        return organizationResponse({ ok: true, ...page });
    }
    catch (error) {
        return organizationRouteError(error);
    }
}
