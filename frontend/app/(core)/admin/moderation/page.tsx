import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { ModerationTable, type ModerationVideo } from '@/components/admin/ModerationTable';

type ModerationBucket = 'not-published' | 'published' | 'all';
type ModerationSurface = 'video' | 'image' | 'audio' | 'character' | 'angle';

function getBaseUrl() {
  const headerStore = headers();
  const forwardedProto = headerStore.get('x-forwarded-proto');
  const forwardedHost = headerStore.get('x-forwarded-host');
  const host = forwardedHost ?? headerStore.get('host');
  if (host) {
    const protocol =
      forwardedProto ??
      (process.env.NODE_ENV === 'development' ? 'http' : 'https');
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
  const res = await fetch(`${getBaseUrl()}/api/admin/videos/pending?${params.toString()}`, {
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
  const cookieHeader = cookies().toString();
  const initialBucket: ModerationBucket = 'not-published';
  const initialSurface: ModerationSurface = 'video';
  const { videos, nextCursor } = await fetchPendingVideos(cookieHeader, initialBucket, initialSurface).catch((error) => {
    console.error('[admin/moderation] failed to fetch pending videos', error);
    return { videos: [] as ModerationVideo[], nextCursor: null };
  });

  return <ModerationTable videos={videos} initialCursor={nextCursor} initialBucket={initialBucket} initialSurface={initialSurface} />;
}
