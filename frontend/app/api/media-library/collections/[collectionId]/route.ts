import { NextRequest } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { deleteLibraryCollection, renameLibraryCollection } from '@/server/media-library/collections';
import { onlyFields } from '@/server/media-library/organization-validation';
import { organizationResponse, organizationRouteError } from '@/server/media-library/organization-route';
export const runtime = 'nodejs';
type Context = {
    params: Promise<{
        collectionId: string;
    }>;
};
export async function PATCH(req: NextRequest, context: Context) {
    const { userId } = await getRouteAuthContext(req);
    if (!userId)
        return organizationResponse({ ok: false, error: 'UNAUTHORIZED' }, 401);
    try {
        const { collectionId } = await context.params;
        const body = await req.json();
        onlyFields(body, ['name']);
        return organizationResponse({ ok: true, collection: await renameLibraryCollection({ userId, collectionId, name: body.name as string }) });
    }
    catch (error) {
        return organizationRouteError(error);
    }
}
export async function DELETE(req: NextRequest, context: Context) {
    const { userId } = await getRouteAuthContext(req);
    if (!userId)
        return organizationResponse({ ok: false, error: 'UNAUTHORIZED' }, 401);
    try {
        const { collectionId } = await context.params;
        await deleteLibraryCollection({ userId, collectionId });
        return organizationResponse({ ok: true });
    }
    catch (error) {
        return organizationRouteError(error);
    }
}
