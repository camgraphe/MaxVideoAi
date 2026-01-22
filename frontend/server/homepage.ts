import { query } from '@/lib/db';
import { cache } from 'react';
import { ensureBillingSchema } from '@/lib/schema';
import { getVideosByIds, type GalleryVideo } from '@/server/videos';

export const HOMEPAGE_SECTION_TYPES = ['hero', 'gallery', 'playlist_rail'] as const;
export type HomepageSectionType = (typeof HOMEPAGE_SECTION_TYPES)[number];

export const HERO_SLOT_KEYS = ['hero-1', 'hero-2', 'hero-3', 'hero-4'] as const;
export const GALLERY_SLOT_KEYS = ['gallery-1', 'gallery-2', 'gallery-3'] as const;

export type HomepageSlot = {
  sectionId: string | null;
  key: string;
  type: 'hero' | 'gallery';
  title: string;
  subtitle: string | null;
  videoId: string | null;
  orderIndex: number;
};

export type HomepageSlotWithVideo = HomepageSlot & {
  video?: GalleryVideo | null;
};

export type HomepageSectionRecord = {
  id: string;
  key: string;
  type: HomepageSectionType;
  title: string | null;
  subtitle: string | null;
  videoId: string | null;
  playlistId: string | null;
  orderIndex: number;
  enabled: boolean;
  startAt: string | null;
  endAt: string | null;
  updatedBy: string | null;
  updatedAt: string;
};

function assertValidType(type: string): asserts type is HomepageSectionType {
  if (!HOMEPAGE_SECTION_TYPES.includes(type as HomepageSectionType)) {
    throw new Error(`Invalid homepage section type: ${type}`);
  }
}

export async function listHomepageSections(): Promise<HomepageSectionRecord[]> {
  await ensureBillingSchema();
  const rows = await query<{
    id: string;
    key: string;
    type: HomepageSectionType;
    title: string | null;
    subtitle: string | null;
    video_id: string | null;
    playlist_id: string | null;
    order_index: number;
    enabled: boolean;
    start_at: string | null;
    end_at: string | null;
    updated_by: string | null;
    updated_at: string;
  }>(
    `SELECT id, key, type, title, subtitle, video_id, playlist_id, order_index, enabled, start_at, end_at, updated_by, updated_at
       FROM homepage_sections
       ORDER BY type ASC, order_index ASC, updated_at DESC`
  );

  return rows.map((row) => ({
    id: row.id,
    key: row.key,
    type: row.type,
    title: row.title,
    subtitle: row.subtitle,
    videoId: row.video_id,
    playlistId: row.playlist_id,
    orderIndex: row.order_index,
    enabled: row.enabled,
    startAt: row.start_at,
    endAt: row.end_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  }));
}

export async function createHomepageSection(payload: {
  key: string;
  type: HomepageSectionType;
  title?: string | null;
  subtitle?: string | null;
  videoId?: string | null;
  playlistId?: string | null;
  orderIndex?: number | null;
  enabled?: boolean;
  startAt?: string | null;
  endAt?: string | null;
  userId?: string | null;
}): Promise<HomepageSectionRecord> {
  assertValidType(payload.type);
  await ensureBillingSchema();

  const orderIndex =
    payload.orderIndex ?? null;

  const rows = await query<{
    id: string;
    key: string;
    type: HomepageSectionType;
    title: string | null;
    subtitle: string | null;
    video_id: string | null;
    playlist_id: string | null;
    order_index: number;
    enabled: boolean;
    start_at: string | null;
    end_at: string | null;
    updated_by: string | null;
    updated_at: string;
  }>(
    `INSERT INTO homepage_sections (
        key,
        type,
        title,
        subtitle,
        video_id,
        playlist_id,
        order_index,
        enabled,
        start_at,
        end_at,
        updated_by
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        COALESCE($7, (
          SELECT COALESCE(MAX(order_index), -1) + 1 FROM homepage_sections WHERE type = $2
        )),
        COALESCE($8, TRUE),
        $9,
        $10,
        $11
      )
      RETURNING id, key, type, title, subtitle, video_id, playlist_id, order_index, enabled, start_at, end_at, updated_by, updated_at`,
    [
      payload.key,
      payload.type,
      payload.title ?? null,
      payload.subtitle ?? null,
      payload.videoId ?? null,
      payload.playlistId ?? null,
      orderIndex,
      payload.enabled ?? true,
      payload.startAt ?? null,
      payload.endAt ?? null,
      payload.userId ?? null,
    ]
  );

  const row = rows[0];
  if (!row) {
    throw new Error('Failed to create homepage section');
  }

  return {
    id: row.id,
    key: row.key,
    type: row.type,
    title: row.title,
    subtitle: row.subtitle,
    videoId: row.video_id,
    playlistId: row.playlist_id,
    orderIndex: row.order_index,
    enabled: row.enabled,
    startAt: row.start_at,
    endAt: row.end_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

export async function updateHomepageSection(
  sectionId: string,
  payload: Partial<{
    key: string;
    type: HomepageSectionType;
    title: string | null;
    subtitle: string | null;
    videoId: string | null;
    playlistId: string | null;
    orderIndex: number;
    enabled: boolean;
    startAt: string | null;
    endAt: string | null;
  }> & { userId?: string | null }
): Promise<void> {
  await ensureBillingSchema();

  const updates: string[] = [];
  const params: unknown[] = [];

  if (payload.key !== undefined) {
    params.push(payload.key);
    updates.push(`key = $${params.length}`);
  }
  if (payload.type !== undefined) {
    assertValidType(payload.type);
    params.push(payload.type);
    updates.push(`type = $${params.length}`);
  }
  if (payload.title !== undefined) {
    params.push(payload.title);
    updates.push(`title = $${params.length}`);
  }
  if (payload.subtitle !== undefined) {
    params.push(payload.subtitle);
    updates.push(`subtitle = $${params.length}`);
  }
  if (payload.videoId !== undefined) {
    params.push(payload.videoId);
    updates.push(`video_id = $${params.length}`);
  }
  if (payload.playlistId !== undefined) {
    params.push(payload.playlistId);
    updates.push(`playlist_id = $${params.length}`);
  }
  if (payload.orderIndex !== undefined) {
    params.push(payload.orderIndex);
    updates.push(`order_index = $${params.length}`);
  }
  if (payload.enabled !== undefined) {
    params.push(payload.enabled);
    updates.push(`enabled = $${params.length}`);
  }
  if (payload.startAt !== undefined) {
    params.push(payload.startAt);
    updates.push(`start_at = $${params.length}`);
  }
  if (payload.endAt !== undefined) {
    params.push(payload.endAt);
    updates.push(`end_at = $${params.length}`);
  }

  if (!updates.length) {
    return;
  }

  const updatedByIndex = params.length + 1;
  const sectionIdIndex = params.length + 2;
  params.push(payload.userId ?? null);
  params.push(sectionId);

  await query(
    `UPDATE homepage_sections
       SET ${updates.join(', ')}, updated_at = NOW(), updated_by = $${updatedByIndex}
     WHERE id = $${sectionIdIndex}`,
    params
  );
}

export async function deleteHomepageSection(sectionId: string): Promise<void> {
  await ensureBillingSchema();
  await query(`DELETE FROM homepage_sections WHERE id = $1`, [sectionId]);
}

export async function reorderHomepageSections(sectionIds: string[], userId?: string | null): Promise<void> {
  if (!sectionIds.length) return;
  await ensureBillingSchema();
  await query(
    `WITH ordered AS (
       SELECT id, ord - 1 AS order_index
       FROM UNNEST($1::uuid[]) WITH ORDINALITY AS u(id, ord)
     )
     UPDATE homepage_sections AS hs
        SET order_index = ordered.order_index,
            updated_at = NOW(),
            updated_by = $2
       FROM ordered
      WHERE hs.id = ordered.id`,
    [sectionIds, userId ?? null]
  );
}

type SlotSeed = {
  key: string;
  type: 'hero' | 'gallery';
  defaultTitle: string;
  defaultOrder: number;
};

function buildSlotFromSection(
  section: HomepageSectionRecord | undefined,
  seed: SlotSeed
): HomepageSlot {
  return {
    sectionId: section?.id ?? null,
    key: seed.key,
    type: seed.type,
    title: section?.title ?? seed.defaultTitle,
    subtitle: section?.subtitle ?? null,
    videoId: section?.videoId ?? null,
    orderIndex: section?.orderIndex ?? seed.defaultOrder,
  };
}

export async function getHomepageSlots(): Promise<{
  hero: HomepageSlotWithVideo[];
  gallery: HomepageSlotWithVideo[];
}> {
  const sections = await listHomepageSections();
  const byKey = new Map(sections.map((section) => [section.key, section]));

  const seeds: SlotSeed[] = [
    ...HERO_SLOT_KEYS.map((key, index) => ({
      key,
      type: 'hero' as const,
      defaultTitle: `Featured clip ${index + 1}`,
      defaultOrder: index,
    })),
    ...GALLERY_SLOT_KEYS.map((key, index) => ({
      key,
      type: 'gallery' as const,
      defaultTitle: `Gallery pick ${index + 1}`,
      defaultOrder: index,
    })),
  ];

  const slots = seeds.map((seed) => buildSlotFromSection(byKey.get(seed.key), seed));

  const videoIds = slots
    .map((slot) => slot.videoId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  const videosMap = await getVideosByIds(videoIds);

  const heroSlots: HomepageSlotWithVideo[] = [];
  const gallerySlots: HomepageSlotWithVideo[] = [];

  slots.forEach((slot) => {
    const withVideo: HomepageSlotWithVideo = {
      ...slot,
      video: slot.videoId ? videosMap.get(slot.videoId) ?? null : null,
    };
    if (slot.type === 'hero') {
      heroSlots.push(withVideo);
    } else {
      gallerySlots.push(withVideo);
    }
  });

  heroSlots.sort((a, b) => a.orderIndex - b.orderIndex);
  gallerySlots.sort((a, b) => a.orderIndex - b.orderIndex);

  return { hero: heroSlots, gallery: gallerySlots };
}

export const getHomepageSlotsCached = cache(getHomepageSlots);
