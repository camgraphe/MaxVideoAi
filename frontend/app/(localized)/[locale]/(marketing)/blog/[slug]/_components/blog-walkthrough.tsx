import Image from 'next/image';
import { PublicVideoPlayer } from '@/components/media/PublicVideoPlayer.client';
import type { ContentFrontMatter } from '@/lib/content/markdown';

/** Authored evidence, shown in order; media stays manual and geometry stays reserved. */
export function BlogWalkthrough({ content, locale }: {
  content: NonNullable<ContentFrontMatter['walkthrough']>;
  locale: string;
}) {
  return (
    <section aria-labelledby="article-walkthrough" className="border-b border-hairline px-6 py-6 sm:px-10">
      <h2 id="article-walkthrough" className="text-xl font-semibold tracking-tight text-text-primary">{content.title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">{content.description}</p>
      <ol className="mt-5 grid gap-4 sm:grid-cols-3">
        {content.steps.map((step, index) => (
          <li key={step.title} className="min-w-0 overflow-hidden rounded-xl border border-hairline bg-bg">
            <figure>
              <div className="relative aspect-video overflow-hidden bg-surface-2">
                {step.video ? (
                  <PublicVideoPlayer src={step.video} poster={step.image} title={step.alt} locale={locale} className="h-full w-full object-contain" />
                ) : (
                  <a href={step.image} aria-label={step.alt}>
                    <Image src={step.image} alt={step.alt} fill priority={index === 0} fetchPriority={index === 0 ? 'high' : undefined}
                      sizes="(min-width: 1024px) 280px, (min-width: 640px) 30vw, 100vw" className="object-contain" />
                  </a>
                )}
              </div>
              <figcaption className="p-4">
                <p className="text-xs font-semibold text-brand"><span aria-hidden="true">{String(index + 1).padStart(2, '0')} · </span>{step.title}</p>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{step.caption}</p>
              </figcaption>
            </figure>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs leading-5 text-text-muted">{content.note}</p>
    </section>
  );
}
