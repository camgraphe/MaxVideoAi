import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/lib/db';
import { submitToIndexNow } from '@/lib/indexnow';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import {
  appendPlaylistItem,
  removePlaylistItem,
  reorderPlaylistItems,
} from '@/server/playlists';

type RouteParams = {
  params: {
    playlistId: string;
  };
};

function parseJson<T>(value: unknown): T | null {
  if (!value || typeof value !== 'object') return null;
  return value as T;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = undefined;
  }
  const payload = parseJson<{ videoId?: string }>(body);
  const videoId = payload?.videoId?.trim();
  if (!videoId) {
    return NextResponse.json({ ok: false, error: 'Missing videoId' }, { status: 400 });
  }

  try {
    await appendPlaylistItem(playlistId, videoId);
    await submitToIndexNow('/examples');
    return NextResponse.json({ ok: true });
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
  const queryVideoId = url.searchParams.get('videoId');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = undefined;
  }
  const payload = parseJson<{ videoId?: string }>(body);
  const bodyVideoId = payload?.videoId?.trim();
  const videoId = (bodyVideoId || queryVideoId || '').trim();
  if (!videoId) {
    return NextResponse.json({ ok: false, error: 'Missing videoId' }, { status: 400 });
  }

  try {
    await removePlaylistItem(playlistId, videoId);
    await submitToIndexNow('/examples');
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin/playlists/:id/items] failed to remove', error);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
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

  let order: unknown;
  try {
    order = await req.json();
  } catch {
    order = undefined;
  }
  if (!Array.isArray(order)) {
    return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
  }

  const normalized = order
    .map((entry) => (typeof entry === 'object' && entry ? entry : null))
    .filter(Boolean)
    .map((entry) => ({
      videoId: typeof (entry as { videoId?: string }).videoId === 'string' ? (entry as { videoId: string }).videoId : '',
      pinned: Boolean((entry as { pinned?: boolean }).pinned),
    }))
    .filter((entry) => entry.videoId.trim().length);

  if (!normalized.length) {
    return NextResponse.json({ ok: false, error: 'No valid items provided' }, { status: 400 });
  }

  try {
    await reorderPlaylistItems(playlistId, normalized);
    await submitToIndexNow('/examples');
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin/playlists/:id/items] failed to reorder', error);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
