import Image from 'next/image';
import Link from 'next/link';
import { listGalleryVideos, type GalleryTab, type GalleryVideo } from '@/server/videos';

export const dynamic = 'force-dynamic';

const TABS: Array<{ id: GalleryTab; label: string; description: string }> = [
  { id: 'starter', label: 'Starter', description: 'Curated picks selected by the team.' },
  { id: 'latest', label: 'Latest', description: 'Most recent public renders from the community.' },
  { id: 'trending', label: 'Trending', description: 'Popular clips making the rounds right now.' },
];

function getTab(value: string | undefined): GalleryTab {
  if (value === 'starter' || value === 'trending') return value;
  return 'latest';
}

function GalleryCard({ video }: { video: GalleryVideo }) {
  return (
    <article className="group overflow-hidden rounded-card border border-hairline bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lg">
      <Link href={`/generate?from=${encodeURIComponent(video.id)}`} className="block">
        <div className="relative aspect-video w-full overflow-hidden bg-black">
          {video.videoUrl ? (
            <video
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster={video.thumbUrl}
              aria-label={video.promptExcerpt}
            >
              <source src={video.videoUrl} type="video/mp4" />
            </video>
          ) : video.thumbUrl ? (
            <Image
              src={video.thumbUrl}
              alt={video.promptExcerpt}
              fill
              className="object-cover"
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-100 text-xs font-semibold uppercase tracking-micro text-text-muted">
              Preview unavailable
            </div>
          )}
        </div>
        <div className="space-y-2 border-t border-hairline p-4">
          <h2 className="text-base font-semibold text-text-primary">{video.engineLabel}</h2>
          <p className="text-xs uppercase tracking-micro text-text-muted">
            Duration: {video.durationSec}s · Ratio: {video.aspectRatio ?? 'Auto'}
          </p>
          <p className="line-clamp-3 text-sm text-text-secondary">{video.promptExcerpt}</p>
        </div>
      </Link>
    </article>
  );
}

function EmptyState({ tab }: { tab: GalleryTab }) {
  const message =
    tab === 'starter'
      ? 'No curated videos yet. Check back soon.'
      : tab === 'latest'
        ? 'No public videos yet. Start generating to see them appear here.'
        : 'Trending is quiet for now. Share a clip to kick things off.';
  return (
    <div className="rounded-card border border-dashed border-hairline bg-white/60 p-12 text-center text-sm text-text-secondary">
      {message}
    </div>
  );
}

type GalleryPageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function GalleryPage({ searchParams }: GalleryPageProps) {
  const tabValue = Array.isArray(searchParams.tab) ? searchParams.tab[0] : searchParams.tab;
  const tab = getTab(tabValue);
  const videos = await listGalleryVideos(tab, 36);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-hairline pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">Gallery</h1>
          <p className="text-sm text-text-secondary">
            Discover community renders, copy prompts, and remix them in the workspace.
          </p>
        </div>
        <Link
          href="/examples"
          className="inline-flex items-center rounded-pill border border-hairline px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-secondary transition hover:border-accent hover:text-accent"
        >
          Browse curated examples →
        </Link>
      </header>

      <nav className="mt-8 flex gap-2 border-b border-hairline pb-3 text-sm font-semibold text-text-secondary">
        {TABS.map((entry) => {
          const isActive = entry.id === tab;
          const query = new URLSearchParams({ tab: entry.id }).toString();
          return (
            <Link
              key={entry.id}
              href={`/gallery?${query}`}
              className={`rounded-pill px-3 py-1 transition ${
                isActive
                  ? 'bg-text-primary text-white'
                  : 'border border-hairline bg-white text-text-secondary hover:border-accent hover:text-accent'
              }`}
            >
              {entry.label}
            </Link>
          );
        })}
      </nav>

      <p className="mt-4 text-sm text-text-muted">
        {TABS.find((entry) => entry.id === tab)?.description ?? ''}
      </p>

      <section className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {videos.length ? videos.map((video) => <GalleryCard key={video.id} video={video} />) : <EmptyState tab={tab} />}
      </section>
    </div>
  );
}
