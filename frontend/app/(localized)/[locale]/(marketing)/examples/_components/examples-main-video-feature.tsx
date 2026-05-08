import clsx from 'clsx';
import Link from 'next/link';
import { AudioEqualizerBadge } from '@/components/ui/AudioEqualizerBadge';
import { ExamplesHeroVideo } from '@/components/examples/ExamplesHeroVideo.client';
import { DeferredSourcePrompt } from '@/components/i18n/DeferredSourcePrompt.client';

type ExamplesMainVideoCopy = {
  audioOn: string;
  fullPrompt: string;
  openExample: string;
  openWatchPage: string;
  preview: string;
};

export function ExamplesMainVideoFeature({
  aspectRatio,
  contentUrl,
  copy,
  durationSec,
  engineLabel,
  exampleHref,
  hasAudio,
  heroLine,
  isPortrait,
  locale,
  mimeType,
  modelHref,
  poster,
  promptFull,
  title,
}: {
  aspectRatio: string;
  contentUrl: string;
  copy: ExamplesMainVideoCopy;
  durationSec: number | null | undefined;
  engineLabel: string;
  exampleHref: string;
  hasAudio: boolean;
  heroLine: string | null;
  isPortrait: boolean;
  locale: string;
  mimeType: string;
  modelHref: string | null;
  poster: string | null;
  promptFull: string | null;
  title: string;
}) {
  return (
    <section className="mx-auto w-full max-w-[920px]">
      <article className="group relative overflow-hidden rounded-[22px] border border-hairline bg-surface shadow-card">
        <Link
          href={exampleHref}
          prefetch={false}
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          aria-label={`${copy.openWatchPage}: ${title}`}
        >
          <div
            className="relative overflow-hidden bg-surface-on-media-dark-5"
            style={{ aspectRatio: isPortrait ? '16 / 9' : aspectRatio }}
          >
            {isPortrait && poster ? (
              <>
                <div
                  className="absolute inset-0 scale-110 bg-cover bg-center blur-2xl"
                  style={{ backgroundImage: `url(${poster})` }}
                  aria-hidden
                />
                <div className="absolute inset-0 bg-black/30" aria-hidden />
              </>
            ) : null}

            <div className="absolute left-3 top-3 z-30 inline-flex items-center rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-micro text-white shadow-sm">
              {copy.preview}
            </div>

            <div
              className={clsx(
                'relative h-full w-full',
                isPortrait ? 'flex items-center justify-center p-3 sm:p-4' : ''
              )}
            >
              <ExamplesHeroVideo
                className={clsx(
                  isPortrait
                    ? 'relative z-10 h-full w-auto max-w-full rounded-[18px] object-contain shadow-[0_18px_48px_rgba(15,23,42,0.28)]'
                    : 'h-full w-full object-cover'
                )}
                src={contentUrl}
                type={mimeType}
                poster={poster ?? undefined}
                posterFit={isPortrait ? 'contain' : 'cover'}
                ariaLabel={title}
                ariaHidden
                controls={false}
              />
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-end justify-between gap-3 bg-gradient-to-t from-black/65 via-black/15 to-transparent px-3 py-3">
              {hasAudio ? (
                <AudioEqualizerBadge tone="light" size="sm" label={copy.audioOn} />
              ) : (
                <span />
              )}
              <span className="inline-flex items-center rounded-full bg-white/92 px-3 py-1.5 text-[11px] font-semibold text-black shadow-sm">
                {copy.openWatchPage}
              </span>
            </div>
          </div>
        </Link>

        <div className="space-y-2.5 px-5 py-4 text-left sm:px-6 sm:py-4.5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-micro text-text-muted">
            {modelHref ? (
              <Link href={modelHref} prefetch={false} className="hover:text-text-primary">
                {engineLabel}
              </Link>
            ) : (
              <span>{engineLabel}</span>
            )}
            <span>
              {aspectRatio ?? 'Auto'} · {durationSec}s
            </span>
          </div>

          <h2 className="text-lg font-semibold leading-snug text-text-primary sm:text-xl">
            {heroLine}
          </h2>

          {promptFull ? (
            <DeferredSourcePrompt
              locale={locale}
              prompt={promptFull}
              mode="details"
              className="group"
              summaryClassName="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-micro text-text-muted transition hover:text-text-primary"
              promptClassName="mt-2 whitespace-pre-line text-sm leading-relaxed text-text-secondary"
              fallbackClassName="text-sm leading-relaxed text-text-secondary"
              summaryLabel={copy.fullPrompt}
            />
          ) : null}

          <div className="flex flex-wrap items-center gap-3 pt-0.5">
            <Link
              href={exampleHref}
              prefetch={false}
              className="inline-flex items-center rounded-full bg-text-primary px-4 py-2 text-sm font-semibold text-bg transition hover:opacity-90"
            >
              {copy.openExample}
            </Link>
            {modelHref ? (
              <Link
                href={modelHref}
                prefetch={false}
                className="inline-flex items-center rounded-full border border-hairline px-4 py-2 text-sm font-semibold text-text-primary transition hover:border-text-muted hover:bg-surface-2"
              >
                {engineLabel}
              </Link>
            ) : null}
          </div>
        </div>
      </article>
    </section>
  );
}
