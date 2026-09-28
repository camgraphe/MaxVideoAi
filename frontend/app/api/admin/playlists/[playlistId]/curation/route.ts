import { parseCurationDraft } from '@/lib/admin/playlist-curation';
import { NextRequest, NextResponse } from 'next/server';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import {
  getCurationSnapshot,
  previewCuration,
  saveCuration,
  CurationError,
} from '@/server/playlists/curation-service';
import { listCatalogMembershipIds } from '@/server/videos-catalog-page';
import { listPlaylistVideoIds } from '@/server/videos-playlists';
import { filterEligibleCurationIds, loadSelectedCurationItems } from '@/server/playlists/curation-candidates-page';

async function readInput(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    throw new CurationError('Invalid JSON request', 400);
  }
  if (typeof body?.revision !== 'string') throw new CurationError('Missing revision', 400);
  try {
    return { ...body, draft: parseCurationDraft(body.draft) };
  } catch (error) {
    throw new CurationError((error as Error).message, 400);
  }
}
type Context = { params: Promise<{ playlistId: string }> };
function failure(error: unknown) {
  if (error instanceof CurationError)
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  console.error('[admin/curation]', error);
  return NextResponse.json({ ok: false, error: 'Unable to load or save site placements.' }, { status: 500 });
}
export async function GET(req: NextRequest, context: Context) {
  try {
    await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }
  try {
    const { playlistId } = await context.params;
    const snapshot = await getCurationSnapshot(playlistId);
    if (!snapshot.available || !snapshot.supported)
      return NextResponse.json({
        ok: true,
        snapshot,
        initialIds: [], selectedItems: [], selectedTotal: 0, removedCount: 0,
      });
    const initialIds: string[] = snapshot.config ? [...snapshot.config.orderedIds] : [];
    if (!snapshot.config) {
      for (let offset = 0; ; offset += 500) {
        const page = snapshot.slug.startsWith('family-')
          ? await listCatalogMembershipIds({ familyId: snapshot.slug.slice(7), offset, limit: 500 })
          : await listPlaylistVideoIds(snapshot.slug, { offset, limit: 500 });
        initialIds.push(...page.ids);
        if (!page.ids.length || offset + page.ids.length >= page.total) break;
      }
    }
    const eligibleIds = await filterEligibleCurationIds(snapshot.slug, initialIds);
    const selectedItems = await loadSelectedCurationItems(snapshot.slug, eligibleIds.slice(0, 48));
    return NextResponse.json({
      ok: true, snapshot, initialIds: eligibleIds, selectedItems, selectedTotal: eligibleIds.length,
      removedCount: initialIds.length - eligibleIds.length,
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(req: NextRequest, context: Context) {
  try {
    await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }
  try {
    const body = await readInput(req);
    const { playlistId } = await context.params;
    return NextResponse.json({
      ok: true,
      preview: await previewCuration(playlistId, body.draft, body.revision),
    });
  } catch (error) {
    return failure(error);
  }
}
export async function PUT(req: NextRequest, context: Context) {
  let actor: string;
  try {
    actor = await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }
  try {
    const body = await readInput(req);
    const { playlistId } = await context.params;
    if (typeof body?.revision !== 'string' || typeof body?.token !== 'string')
      return NextResponse.json({ ok: false, error: 'Preview this selection before saving.' }, { status: 400 });
    const snapshot = await saveCuration(playlistId, body.draft, body.revision, body.token, actor);
    return NextResponse.json({ ok: true, snapshot });
  } catch (error) {
    return failure(error);
  }
}
