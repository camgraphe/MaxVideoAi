import { NextRequest, NextResponse } from 'next/server';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { CurationError, getCurationSnapshot } from '@/server/playlists/curation-service';
import { listCurationCandidateIdsPage, loadSelectedCurationItems, searchCurationCandidatesPage } from '@/server/playlists/curation-candidates-page';

export async function GET(req: NextRequest, context: { params: Promise<{ playlistId: string }> }) {
  try { await requireAdmin(req); }
  catch (error) { return adminErrorToResponse(error); }
  try {
    const { playlistId } = await context.params;
    const snapshot = await getCurationSnapshot(playlistId);
    if (!snapshot.available || !snapshot.supported) throw new CurationError('Curation is unavailable for this destination', 400);
    const params = new URL(req.url).searchParams;
    if (params.get('idsOnly') === 'true') {
      const page = await listCurationCandidateIdsPage(snapshot.slug, {
        offset: Number(params.get('offset') ?? 0), limit: Number(params.get('limit') ?? 500),
      });
      return NextResponse.json({ ok: true, ...page });
    }
    if (params.has('ids')) {
      // Repeated ids and a comma-separated window are both accepted; never silently truncate it.
      const ids = params.getAll('ids').flatMap(value => value.split(','));
      if (ids.some(id => !id || id !== id.trim() || id.length > 200) || new Set(ids).size !== ids.length)
        throw new CurationError('Invalid selected video window', 400);
      const items = await loadSelectedCurationItems(snapshot.slug, ids);
      return NextResponse.json({ ok: true, items, nextCursor: null, total: items.length });
    }
    const page = await searchCurationCandidatesPage({
      slug: snapshot.slug, q: params.get('q'), modelSlug: params.get('modelSlug'), format: params.get('format'),
      cursor: params.get('cursor'), exactId: params.get('exactId'),
      limit: params.has('limit') ? Number(params.get('limit')) : undefined,
    });
    return NextResponse.json({ ok: true, ...page });
  } catch (error) {
    if (error instanceof CurationError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error('[admin/curation/candidates]', error);
    return NextResponse.json({ ok: false, error: 'Unable to load videos.' }, { status: 500 });
  }
}
