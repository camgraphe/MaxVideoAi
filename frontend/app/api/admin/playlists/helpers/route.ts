import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/lib/db';
import { submitToIndexNow } from '@/lib/indexnow';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import {
  createMissingFamilyPlaylists,
  seedAllFamilyPlaylistsFromCurrentOrder,
  seedFamilyPlaylistFromCurrentOrder,
} from '@/server/example-family-playlists';

type HelpersAction = 'create-missing-family-playlists' | 'seed-family-playlist' | 'seed-all-family-playlists';

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  let adminId: string;
  try {
    adminId = await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = undefined;
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
  }

  const action = (body as { action?: HelpersAction }).action;

  try {
    if (action === 'create-missing-family-playlists') {
      const playlists = await createMissingFamilyPlaylists(adminId);
      return NextResponse.json({ ok: true, playlists });
    }

    if (action === 'seed-family-playlist') {
      const familyId = typeof (body as { familyId?: string }).familyId === 'string'
        ? (body as { familyId: string }).familyId.trim().toLowerCase()
        : '';
      if (!familyId) {
        return NextResponse.json({ ok: false, error: 'Missing familyId' }, { status: 400 });
      }
      const result = await seedFamilyPlaylistFromCurrentOrder(familyId, adminId);
      await submitToIndexNow('/examples');
      await submitToIndexNow(`/examples/${familyId}`);
      return NextResponse.json({ ok: true, result });
    }

    if (action === 'seed-all-family-playlists') {
      const results = await seedAllFamilyPlaylistsFromCurrentOrder(adminId);
      await submitToIndexNow('/examples');
      await Promise.all(results.map((result) => submitToIndexNow(`/examples/${result.familyId}`)));
      return NextResponse.json({ ok: true, results });
    }

    return NextResponse.json({ ok: false, error: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    console.error('[admin/playlists/helpers] failed', error);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
