import { NextRequest } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { createLibraryCollection, listLibraryCollections } from '@/server/media-library/collections';
import { onlyFields } from '@/server/media-library/organization-validation';
import { organizationResponse, organizationRouteError } from '@/server/media-library/organization-route';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
    const { userId } = await getRouteAuthContext(req);
    if (!userId)
        return organizationResponse({ ok: false, error: 'UNAUTHORIZED' }, 401);
    try {
        return organizationResponse({ ok: true, ...await listLibraryCollections({ userId, limit: Number(req.nextUrl.searchParams.get('limit') ?? 30), cursor: req.nextUrl.searchParams.get('cursor') }) });
    }
    catch (error) {
        return organizationRouteError(error);
    }
}
export async function POST(req: NextRequest) {
    const { userId } = await getRouteAuthContext(req);
    if (!userId)
        return organizationResponse({ ok: false, error: 'UNAUTHORIZED' }, 401);
    try {
        const body = await req.json();
        onlyFields(body, ['name']);
        return organizationResponse({ ok: true, collection: await createLibraryCollection({ userId, name: body.name as string }) }, 201);
    }
    catch (error) {
        return organizationRouteError(error);
    }
}
