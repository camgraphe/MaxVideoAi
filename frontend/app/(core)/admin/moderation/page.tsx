import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { ModerationTable, type ModerationVideo } from '@/components/admin/ModerationTable';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { requireAdmin } from '@/server/admin';
import { AdminActionLink } from '@/components/admin-system/shell/AdminActionLink';

type ModerationBucket = 'not-published' | 'published' | 'all';
type ModerationSurface = 'video' | 'image' | 'audio' | 'character' | 'angle';

async function getBaseUrl() {
  const headerStore = await headers();
  const forwardedProto = headerStore.get('x-forwarded-proto');
  const forwardedHost = headerStore.get('x-forwarded-host');
  const host = forwardedHost ?? headerStore.get('host');
  if (host) {
    const protocol = forwardedProto ?? (process.env.NODE_ENV === 'development' ? 'http' : 'https');
    return `${protocol}://${host}`;
  }
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? null;
  if (envUrl && envUrl.trim().length) {
    return envUrl.replace(/\/$/, '');
  }
  const vercel = process.env.VERCEL_URL;
  if (vercel && vercel.trim().length) {
    return `https://${vercel}`;
  }
  return 'http://localhost:3000';
}

type PendingFetchResult = { videos: ModerationVideo[]; nextCursor: string | null };

async function fetchPendingVideos(
  cookieHeader: string | undefined,
  bucket: ModerationBucket,
  surface: ModerationSurface
): Promise<PendingFetchResult> {
  const params = new URLSearchParams({ limit: '30', bucket, surface });
  const baseUrl = await getBaseUrl();
  const res = await fetch(`${baseUrl}/api/admin/videos/pending?${params.toString()}`, {
    cache: 'no-store',
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  }).catch(() => null);

  if (!res) {
    throw new Error('Failed to reach moderation endpoint');
  }

  if (res.status === 401 || res.status === 403) {
    notFound();
  }

  if (!res.ok) {
    throw new Error(`Failed to load pending videos (${res.status})`);
  }

  const json = await res.json().catch(() => ({ ok: false }));
  if (!json?.ok) {
    throw new Error(json?.error ?? 'Failed to load pending videos');
  }
  return {
    videos: (json.videos ?? []) as ModerationVideo[],
    nextCursor: typeof json.nextCursor === 'string' ? json.nextCursor : null,
  };
}

export const dynamic = 'force-dynamic';

export default async function AdminModerationPage() {
  await requireAdmin();
  const cookieHeader = (await cookies()).toString();
  const initialBucket: ModerationBucket = 'not-published';
  const initialSurface: ModerationSurface = 'video';
  const { videos, nextCursor, initialError } = await fetchPendingVideos(cookieHeader, initialBucket, initialSurface)
    .then((result) => ({ ...result, initialError: null as string | null })).catch((error) => {
    console.error('[admin/moderation] failed to fetch pending videos', error);
    return { videos: [] as ModerationVideo[], nextCursor: null, initialError: 'Unable to load the moderation queue. Select a media type to retry.' };
  });


  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Curation"
        title="Moderation"
        description="Review media, manage site publication and curate collections."
        actions={
          <>
            <AdminActionLink href="/admin/video-seo">
              Video SEO
            </AdminActionLink>
            <AdminActionLink href="/admin/playlists">
              Site placements
            </AdminActionLink>
          </>
        }
      />

      <ModerationTable
        videos={videos}
        initialCursor={nextCursor}
        initialError={initialError}
        initialBucket={initialBucket}
        initialSurface={initialSurface}
        embedded
      />
    </div>
  );
}
