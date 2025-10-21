import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/lib/db';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { deletePlaylist, updatePlaylist, getPlaylistItems } from '@/server/playlists';

type RouteParams = {
  params: {
    playlistId: string;
  };
};

export async function GET(req: NextRequest, { params }: RouteParams) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  try {
    await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }

  const playlistId = params.playlistId;
  if (!playlistId) {
    return NextResponse.json({ ok: false, error: 'Missing playlist id' }, { status: 400 });
  }

  try {
    const items = await getPlaylistItems(playlistId);
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error('[admin/playlists/:id] failed to fetch items', error);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  let adminId: string;
  try {
    adminId = await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }

  const playlistId = params.playlistId;
  if (!playlistId) {
    return NextResponse.json({ ok: false, error: 'Missing playlist id' }, { status: 400 });
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

  try {
    await updatePlaylist(playlistId, {
      slug,
      name,
      description: description ?? null,
      isPublic,
      userId: adminId,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin/playlists/:id] failed to update', error);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  try {
    await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }

  const playlistId = params.playlistId;
  if (!playlistId) {
    return NextResponse.json({ ok: false, error: 'Missing playlist id' }, { status: 400 });
  }

  try {
    await deletePlaylist(playlistId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin/playlists/:id] failed to delete', error);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
