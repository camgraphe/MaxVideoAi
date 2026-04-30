import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { isDatabaseConfigured } from '@/lib/db';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { logAdminAction } from '@/server/admin-audit';
import {
  deleteHomepageSection,
  updateHomepageSection,
  listHomepageSections,
  HOMEPAGE_SECTION_TYPES,
  HOMEPAGE_SLOTS_CACHE_TAG,
} from '@/server/homepage';

type RouteParams = {
  params: Promise<{
    sectionId: string;
  }>;
};

const VALID_TYPES = new Set(HOMEPAGE_SECTION_TYPES);

export async function PUT(req: NextRequest, props: RouteParams) {
  const params = await props.params;
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  let adminId: string;
  try {
    adminId = await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }

  const sectionId = params.sectionId;
  if (!sectionId) {
    return NextResponse.json({ ok: false, error: 'Missing section id' }, { status: 400 });
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
    orderIndex?: number;
    enabled?: boolean;
    startAt?: string | null;
    endAt?: string | null;
  };

  if (type && !VALID_TYPES.has(type as (typeof HOMEPAGE_SECTION_TYPES)[number])) {
    return NextResponse.json({ ok: false, error: 'Invalid type' }, { status: 400 });
  }

  try {
    await updateHomepageSection(sectionId, {
      key,
      type: type as (typeof HOMEPAGE_SECTION_TYPES)[number] | undefined,
      title: title ?? undefined,
      subtitle: subtitle ?? undefined,
      videoId: videoId ?? undefined,
      playlistId: playlistId ?? undefined,
      orderIndex,
      enabled,
      startAt: startAt ?? undefined,
      endAt: endAt ?? undefined,
      userId: adminId,
    });
    const sections = await listHomepageSections();
    const section = sections.find((entry) => entry.id === sectionId) ?? null;
    await logAdminAction({
      adminId,
      action: 'HOMEPAGE_SECTION_UPDATE',
      route: `/api/admin/homepage/${sectionId}`,
      metadata: {
        sectionId,
        sectionKey: section?.key ?? key ?? null,
        sectionType: section?.type ?? type ?? null,
        title: section?.title ?? title ?? null,
        videoId: section?.videoId ?? videoId ?? null,
      },
    });
    revalidateTag(HOMEPAGE_SLOTS_CACHE_TAG);
    revalidatePath('/');
    revalidatePath('/en');
    revalidatePath('/fr');
    revalidatePath('/es');
    return NextResponse.json({ ok: true, section });
  } catch (error) {
    console.error('[admin/homepage/:id] failed to update', error);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, props: RouteParams) {
  const params = await props.params;
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  let adminId: string;
  try {
    adminId = await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }

  const sectionId = params.sectionId;
  if (!sectionId) {
    return NextResponse.json({ ok: false, error: 'Missing section id' }, { status: 400 });
  }

  try {
    const sections = await listHomepageSections();
    const section = sections.find((entry) => entry.id === sectionId) ?? null;
    await deleteHomepageSection(sectionId);
    await logAdminAction({
      adminId,
      action: 'HOMEPAGE_SECTION_DELETE',
      route: `/api/admin/homepage/${sectionId}`,
      metadata: {
        sectionId,
        sectionKey: section?.key ?? null,
        sectionType: section?.type ?? null,
        title: section?.title ?? null,
        videoId: section?.videoId ?? null,
      },
    });
    revalidateTag(HOMEPAGE_SLOTS_CACHE_TAG);
    revalidatePath('/');
    revalidatePath('/en');
    revalidatePath('/fr');
    revalidatePath('/es');
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin/homepage/:id] failed to delete', error);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
