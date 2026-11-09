import { NextRequest } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import type { LibraryBrowseScope } from '@/lib/library-browse';
import { createLibrarySelectionSnapshot } from '@/server/media-library/selection';
import { onlyFields } from '@/server/media-library/organization-validation';
import { organizationResponse, organizationRouteError } from '@/server/media-library/organization-route';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
    const { userId } = await getRouteAuthContext(req);
    if (!userId)
        return organizationResponse({ ok: false, error: 'UNAUTHORIZED' }, 401);
    try {
        const body = await req.json();
        onlyFields(body, ['scope']);
        return organizationResponse({ ok: true, snapshot: await createLibrarySelectionSnapshot({ userId, scope: body.scope as LibraryBrowseScope }) }, 201);
    }
    catch (error) {
        return organizationRouteError(error);
    }
}
