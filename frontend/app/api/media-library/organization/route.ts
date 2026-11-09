import { NextRequest } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import type { LibraryMediaReference, LibraryOrganizationOperation } from '@/lib/media-library-organization';
import { mutateLibraryOrganization } from '@/server/media-library/organization';
import { mutateLibrarySelectionSnapshot, type SnapshotMutationInput } from '@/server/media-library/selection';
import { LibraryOrganizationError, onlyFields } from '@/server/media-library/organization-validation';
import { organizationResponse, organizationRouteError } from '@/server/media-library/organization-route';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
    const { userId } = await getRouteAuthContext(req);
    if (!userId)
        return organizationResponse({ ok: false, error: 'UNAUTHORIZED' }, 401);
    try {
        const body = await req.json();
        onlyFields(body, ['operation', 'references', 'collectionId', 'snapshotId', 'excludedKeys']);
        if ('snapshotId' in body) {
            if ('references' in body) throw new LibraryOrganizationError('INVALID_SELECTION');
            const result = await mutateLibrarySelectionSnapshot({userId, ...body} as SnapshotMutationInput);
            const rolledBack = result.failed.some(row => row.errorCode === 'TRANSACTION_FAILED');
            return organizationResponse({ok: !rolledBack, ...result}, rolledBack ? 500 : 200);
        }
        if ('excludedKeys' in body) throw new LibraryOrganizationError('INVALID_SELECTION');
        const result = await mutateLibraryOrganization({ userId, operation: body.operation as LibraryOrganizationOperation, references: body.references as LibraryMediaReference[], collectionId: body.collectionId as string | undefined });
        const rolledBack = result.results.some(row => row.error === 'TRANSACTION_FAILED');
        return organizationResponse({ ok: !rolledBack, ...result }, rolledBack ? 500 : 200);
    }
    catch (error) {
        return organizationRouteError(error);
    }
}
