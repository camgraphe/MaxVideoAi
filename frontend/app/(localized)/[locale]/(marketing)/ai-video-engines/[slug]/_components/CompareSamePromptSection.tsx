import { PublicVideoPlayer } from '@/components/media/PublicVideoPlayer.client';
import clsx from 'clsx';
import type { AppLocale } from '@/i18n/locales';
import { buildPublicVideoPosterUrl } from '@/lib/media-helpers';
import { buildVideoWatchPath } from '@/lib/video-seo-canonical';
import {
  samePromptAnchor,
  samePromptClipFacts,
  samePromptExampleNote,
  samePromptText,
} from '../_lib/compare-same-prompt-copy';
import type { SamePromptCase, SamePromptClip } from '../_lib/compare-same-prompt-data';

function Clip({ clip, locale, portrait }: { clip: SamePromptClip; locale: AppLocale; portrait: boolean }) {
  const copy = samePromptText[locale];
  const date = clip.createdAt
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(clip.createdAt))
    : null;

  return (
    <figure className="min-w-0">
      <p className="mb-2 font-semibold text-text-primary">{clip.model}</p>
      <div className={clsx('relative overflow-hidden rounded-card bg-black', portrait ? 'aspect-[9/16]' : 'aspect-video')}>
        <PublicVideoPlayer
          className="h-full w-full object-contain"
          src={clip.videoUrl}
          poster={buildPublicVideoPosterUrl(clip.posterUrl)}
          title={`${copy.render} · ${clip.model}`}
          locale={locale}
          deferPoster
        />
      </div>
      <figcaption className="mt-2 space-y-1 text-sm text-text-muted">
        <p>{samePromptClipFacts(clip, locale).join(' · ')}</p>
        {clip.createdAt && date && (
          <p>{copy.generated} <time dateTime={clip.createdAt}>{date}</time></p>
        )}
        <a className="inline-block font-medium text-brand hover:underline"
          href={buildVideoWatchPath(clip.id)}
          aria-label={`${copy.source} · ${clip.model}`}>
          {copy.source}
        </a>
      </figcaption>
    </figure>
  );
}

function Example({ example, locale }: { example: SamePromptCase; locale: AppLocale }) {
  const copy = samePromptText[locale];
  const anchor = samePromptAnchor(example.promptHash);
  const note = samePromptExampleNote(example, locale);
  const portrait = example.clips.every(clip => clip.aspectRatio === '9:16');
  return (
    <article id={anchor} className={clsx(
      'scroll-mt-24 rounded-card border border-hairline bg-surface p-4 sm:p-5',
      portrait && 'sm:mx-auto sm:max-w-[720px]'
    )}>
      {note && (
        <div className="mb-4">
          <h3 className="text-base font-semibold text-text-primary">{note.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-text-muted">{note.observation}</p>
        </div>
      )}
      <div className={clsx('grid', portrait ? 'mx-auto max-w-[420px] grid-cols-2 gap-3 sm:gap-5' : 'gap-5 sm:grid-cols-2')}>
        {example.clips.map(clip => <Clip key={clip.id} clip={clip} locale={locale} portrait={portrait} />)}
      </div>
      <details className="mt-4 border-t border-hairline pt-3">
        <summary className="cursor-pointer text-sm font-semibold text-text-primary">{copy.prompt}</summary>
        <blockquote className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-text-muted">
          {example.prompt}
        </blockquote>
      </details>
      <a className="mt-2 inline-block text-sm font-medium text-brand hover:underline" href={`#${anchor}`}>
        {copy.link}
      </a>
    </article>
  );
}

export function CompareSamePromptSection({ cases, locale }: { cases: SamePromptCase[]; locale: AppLocale }) {
  const [first, ...others] = cases;
  if (!first) return null;
  const copy = samePromptText[locale];

  return (
    <section id="same-prompt" aria-labelledby="same-prompt-heading" className="my-8 scroll-mt-24 space-y-4">
      <div>
        <h2 id="same-prompt-heading" className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
          {copy.heading}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-text-muted">{copy.intro}</p>
      </div>
      <Example example={first} locale={locale} />
      {others.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-brand hover:underline">
            {copy.more(others.length)}
          </summary>
          <div className="mt-3 space-y-4">
            {others.map(example => <Example key={example.promptHash} example={example} locale={locale} />)}
          </div>
        </details>
      )}
    </section>
  );
}
