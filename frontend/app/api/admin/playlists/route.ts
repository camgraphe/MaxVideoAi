import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/lib/db';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { createPlaylist, listPlaylists } from '@/server/playlists';

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  try {
    await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }

  try {
    const playlists = await listPlaylists();
    return NextResponse.json({ ok: true, playlists });
  } catch (error) {
    console.error('[admin/playlists] failed to list', error);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}

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

  const { slug, name, description, isPublic } = body as {
    slug?: string;
    name?: string;
    description?: string | null;
    isPublic?: boolean;
  };

  if (!slug || !name) {
    return NextResponse.json({ ok: false, error: 'Missing slug or name' }, { status: 400 });
  }

  try {
    const playlist = await createPlaylist({
      slug,
      name,
      description: description ?? null,
      isPublic,
      userId: adminId,
    });
    return NextResponse.json({ ok: true, playlist });
  } catch (error) {
    console.error('[admin/playlists] failed to create', error);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
