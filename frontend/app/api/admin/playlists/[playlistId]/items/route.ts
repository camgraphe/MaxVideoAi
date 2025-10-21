import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/lib/db';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { appendPlaylistItem, removePlaylistItem } from '@/server/playlists';

interface RouteParams {
  params: {
    playlistId: string;
  };
}

export async function POST(req: NextRequest, { params }: RouteParams) {
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

  const videoId = typeof (body as { videoId?: unknown })?.videoId === 'string' ? (body as { videoId: string }).videoId.trim() : '';
  if (!videoId) {
    return NextResponse.json({ ok: false, error: 'Missing video id' }, { status: 400 });
  }

  try {
    await appendPlaylistItem(playlistId, videoId);
    return NextResponse.json({ ok: true, playlistId, videoId, updatedBy: adminId });
  } catch (error) {
    console.error('[admin/playlists/:id/items] failed to append', error);
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

  const url = new URL(req.url);
  const videoId = url.searchParams.get('videoId');
  if (!videoId) {
    return NextResponse.json({ ok: false, error: 'Missing video id' }, { status: 400 });
  }

  try {
    await removePlaylistItem(playlistId, videoId);
    return NextResponse.json({ ok: true, playlistId, videoId });
  } catch (error) {
    console.error('[admin/playlists/:id/items] failed to remove', error);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
