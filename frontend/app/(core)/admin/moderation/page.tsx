import { Boxes, Eye, ListChecks, TriangleAlert } from 'lucide-react';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { ModerationTable, type ModerationVideo } from '@/components/admin/ModerationTable';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { type AdminMetricItem, AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
import { ButtonLink } from '@/components/ui/Button';

type ModerationBucket = 'not-published' | 'published' | 'all';
type ModerationSurface = 'video' | 'image' | 'audio' | 'character' | 'angle';

function getBaseUrl() {
  const headerStore = headers();
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

  const metrics = buildModerationMetrics(videos);

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Curation"
        title="Publication queue"
        description="Surface de tri éditorial pour publier, retirer ou réaffecter les médias par surface. Les incidents restent côté Jobs, et le rollout Google Video reste isolé."
        actions={
          <>
            <ButtonLink href="/admin/jobs" variant="outline" size="sm" className="border-border bg-surface">
              Jobs
            </ButtonLink>
            <ButtonLink href="/admin/video-seo" variant="outline" size="sm" className="border-border bg-surface">
              Video SEO
            </ButtonLink>
            <ButtonLink href="/admin/playlists" variant="outline" size="sm" className="border-border bg-surface">
              Playlists
            </ButtonLink>
          </>
        }
      />

      <AdminSection
        title="Queue Pulse"
        description="Lecture rapide du lot actuellement chargé. Cette surface reste volontairement dense pour le triage et la publication."
      >
        <AdminMetricGrid items={metrics} columnsClassName="sm:grid-cols-2 xl:grid-cols-4" density="compact" />
      </AdminSection>

      <ModerationTable
        videos={videos}
        initialCursor={nextCursor}
        initialBucket={initialBucket}
        initialSurface={initialSurface}
        embedded
      />
    </div>
  );
}

function buildModerationMetrics(videos: ModerationVideo[]): AdminMetricItem[] {
  const publishedCount = videos.filter((video) => video.isPublishedOnSite).length;
  const unpublishedCount = videos.length - publishedCount;
  const seoWatchCount = videos.filter((video) => video.seoWatch).length;
  const mismatchCount = videos.filter((video) => video.hasLegacyMismatch).length;

  return [
    {
      label: 'Loaded rows',
      value: String(videos.length),
      helper: 'Current moderation slice from the queue',
      icon: ListChecks,
    },
    {
      label: 'Published',
      value: String(publishedCount),
      helper: 'Already live on at least one public surface',
      tone: publishedCount ? 'success' : 'default',
      icon: Eye,
    },
    {
      label: 'Not published',
      value: String(unpublishedCount),
      helper: 'Still waiting for editorial release',
      tone: unpublishedCount ? 'warning' : 'default',
      icon: Boxes,
    },
    {
      label: 'Legacy mismatch',
      value: String(mismatchCount),
      helper: `${seoWatchCount} rows currently part of the Google Video shortlist`,
      tone: mismatchCount ? 'warning' : 'info',
      icon: TriangleAlert,
    },
  ];
}
