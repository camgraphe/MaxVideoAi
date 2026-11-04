import { ArrowRight, ChevronDown, Play } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { PayAsYouGoContent } from '../_content/types';
import type { PayAsYouGoShowcaseVideo } from '../_lib/payg-video-showcase';
import { PayAsYouGoPreview } from './PayAsYouGoPreview.client';

type Props = { copy: PayAsYouGoContent['showcase']['section']; videos: PayAsYouGoShowcaseVideo[] };

function Film({ video, copy, size }: { video: PayAsYouGoShowcaseVideo; copy: Props['copy']; size: 'lead' | 'side' | 'small' }) {
  const lead = size === 'lead';
  const sizes = lead ? '(min-width: 1280px) 710px, (min-width: 768px) 60vw, 93vw'
    : size === 'side' ? '(min-width: 1280px) 430px, (min-width: 768px) 36vw, (min-width: 640px) 45vw, 93vw' : '(min-width: 640px) 210px, 150px';
  return (
    <Link href={video.href} prefetch={false} className="group block min-w-0 rounded-sm text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
      <div className={`relative isolate overflow-hidden rounded-[6px] bg-surface-2 ${lead ? 'aspect-[16/10] md:aspect-[4/3]' : size === 'side' ? 'aspect-[2.2] md:aspect-[2.45]' : 'aspect-video'}`}>
        <PayAsYouGoPreview src={video.videoUrl} poster={video.posterUrl} sizes={sizes}
          label={`${video.title}, ${copy.mediaPhrase} ${video.engineLabel}, ${video.durationLabel}`} placeholder={copy.preview} />
        <span aria-hidden className={`pointer-events-none absolute bottom-3 left-3 grid place-items-center rounded-full bg-black/70 text-white ring-1 ring-white/60 motion-safe:transition-transform motion-safe:group-hover:scale-105 ${lead ? 'h-12 w-12' : 'h-8 w-8'}`}>
          <Play className={lead ? 'h-5 w-5 fill-current' : 'h-3 w-3 fill-current'} />
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className={lead ? 'font-serif text-3xl leading-tight sm:text-4xl' : 'font-serif text-xl leading-tight'}>{video.title}</h3>
        <span className="font-mono text-xs text-text-secondary">{video.engineLabel} · {video.durationLabel}</span>
      </div>
      {lead ? <p className="mt-2 max-w-xl text-sm leading-6 text-text-secondary">{video.useCase}</p> : null}
      <span className="sr-only">{copy.result}</span>
    </Link>
  );
}

export function PayAsYouGoVideoShowcase({ copy, videos }: Props) {
  const [lead, ...rest] = videos;
  if (!lead) return null;
  const more = rest.slice(2);
  return (
    <section id="payg-films" className="scroll-mt-20 border-y border-hairline bg-surface text-text-primary">
      <div className="container-page max-w-[1220px] py-12 sm:py-16">
        <div className="mb-7 grid items-end gap-4 md:grid-cols-[1.25fr_0.75fr] md:gap-14">
          <div>
            <p className="font-mono text-xs uppercase tracking-[.16em] text-brand">{copy.eyebrow}</p>
            <h2 className="mt-2 max-w-[20ch] font-serif text-4xl leading-[1.03] sm:text-5xl">{copy.title}</h2>
          </div>
          <p className="max-w-lg text-sm leading-6 text-text-secondary">{copy.intro}</p>
        </div>
        <div className={rest.length ? 'grid items-start gap-7 md:grid-cols-[1.5fr_1fr]' : 'max-w-3xl'}>
          <Film video={lead} copy={copy} size="lead" />
          {rest.length ? <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-1">
            {rest.slice(0, 2).map(video => <Film key={video.id} video={video} copy={copy} size="side" />)}
          </div> : null}
        </div>
        {more.length ? <details className="group/more mt-7 border-y border-hairline">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-semibold hover:text-brand [&::-webkit-details-marker]:hidden">
            {copy.more} ({more.length})<ChevronDown aria-hidden className="h-4 w-4 group-open/more:rotate-180" />
          </summary>
          <div className="grid grid-cols-2 gap-5 pb-6 sm:grid-cols-3 lg:grid-cols-4">
            {more.map(video => <Film key={video.id} video={video} copy={copy} size="small" />)}
          </div>
        </details> : null}
        <Link href="/app" prefetch={false} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-hairline bg-bg px-5 text-sm font-semibold text-text-primary hover:border-brand hover:text-brand">
          {copy.cta}<ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
