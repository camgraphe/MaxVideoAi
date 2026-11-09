import type { NextRequest } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { listGeneratedVideoCandidates } from '@/server/media-library/generated-video-candidates';
import { organizationResponse, organizationRouteError } from '@/server/media-library/organization-route';
export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
    const { userId } = await getRouteAuthContext(request);
    if (!userId)
        return organizationResponse({ ok: false, error: 'UNAUTHORIZED' }, 401);
    try {
        const p = request.nextUrl.searchParams;
        const page = await listGeneratedVideoCandidates({ userId, surface: (p.get('surface') ?? 'video') as 'video' | 'upscale', limit: p.has('limit') ? Number(p.get('limit')) : undefined, cursor: p.get('cursor') });
        return organizationResponse({ ok: true, ...page });
    }
    catch (error) {
        return organizationRouteError(error);
    }
}
