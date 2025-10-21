import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/lib/db';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { createHomepageSection, listHomepageSections, HOMEPAGE_SECTION_TYPES } from '@/server/homepage';

const VALID_TYPES = new Set(HOMEPAGE_SECTION_TYPES);

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
    const sections = await listHomepageSections();
    return NextResponse.json({ ok: true, sections });
  } catch (error) {
    console.error('[admin/homepage] failed to list', error);
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

  const { key, type, title, subtitle, videoId, playlistId, orderIndex, enabled, startAt, endAt } = body as {
    key?: string;
    type?: string;
    title?: string | null;
    subtitle?: string | null;
    videoId?: string | null;
    playlistId?: string | null;
    orderIndex?: number | null;
    enabled?: boolean;
    startAt?: string | null;
    endAt?: string | null;
  };

  if (!key || typeof key !== 'string') {
    return NextResponse.json({ ok: false, error: 'Missing key' }, { status: 400 });
  }

  if (!type || !VALID_TYPES.has(type as (typeof HOMEPAGE_SECTION_TYPES)[number])) {
    return NextResponse.json({ ok: false, error: 'Invalid type' }, { status: 400 });
  }

  try {
    const section = await createHomepageSection({
      key,
      type: type as (typeof HOMEPAGE_SECTION_TYPES)[number],
      title: title ?? null,
      subtitle: subtitle ?? null,
      videoId: videoId ?? null,
      playlistId: playlistId ?? null,
      orderIndex: orderIndex ?? null,
      enabled,
      startAt: startAt ?? null,
      endAt: endAt ?? null,
      userId: adminId,
    });
    return NextResponse.json({ ok: true, section });
  } catch (error) {
    console.error('[admin/homepage] failed to create section', error);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
