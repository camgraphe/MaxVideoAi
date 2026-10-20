import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { PublicVideoPlayer } from '@/components/media/PublicVideoPlayer.client';
import { UIIcon } from '@/components/ui/UIIcon';
import { buildPublicVideoPosterUrl, isOptimizablePublicMediaUrl } from '@/lib/media-helpers';
import type { ModelKeyframeDemoViewModel } from '../_lib/model-page-keyframe-demo';
import { SECTION_SCROLL_MARGIN } from '../_lib/model-page-specs';

export function ModelKeyframeDemoSection({ viewModel }: { viewModel: ModelKeyframeDemoViewModel }) {
  const { copy, recipe, images, timeline, locale, recreateHref } = viewModel;
  return (
    <section id="keyframe-example" aria-labelledby="keyframe-example-title" className={`${SECTION_SCROLL_MARGIN} mt-5 rounded-[28px] border border-hairline bg-surface p-5 sm:p-7`}>
      <h2 id="keyframe-example-title" className="text-2xl font-semibold text-text-primary">{copy.title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-secondary">{copy.intro}</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{copy.imagesLabel}</h3>
          <ol className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map(image => (
              <li key={image.frameIndex} id={`keyframe-example-frame-${image.frameIndex}`}>
                <figure>
                  <div className="relative aspect-video overflow-hidden rounded-xl border border-hairline bg-black">
                    <Image src={image.imageUrl} alt={image.caption ?? `${copy.imagesLabel} ${image.number}`} fill sizes="(min-width: 1024px) 200px, (min-width: 640px) 30vw, 45vw" quality={75} unoptimized={!isOptimizablePublicMediaUrl(image.imageUrl)} className="object-contain" />
                    <span aria-hidden="true" className="absolute left-2 top-2 rounded-full bg-black/75 px-2 py-0.5 text-xs font-semibold text-white">{image.number}</span>
                  </div>
                  <figcaption className="mt-2 text-xs text-text-secondary">
                    {image.caption ? <span className="mb-1 block font-medium text-text-primary">{image.caption}</span> : null}
                    {image.timeLabel} · {copy.frameLabel} {image.frameIndex}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ol>
          <h3 className="mt-5 text-sm font-semibold text-text-primary">{copy.timelineLabel} <span className="font-normal text-text-secondary">· 24 fps</span></h3>
          <ol className="mt-3 flex flex-wrap items-center gap-2" aria-label={copy.timelineLabel}>
            {timeline.map((image, index) => (
              <li key={image.frameIndex} className="flex items-center gap-2">
                {index > 0 ? <UIIcon icon={ArrowRight} size={14} className="text-text-muted" /> : null}
                <a href={`#keyframe-example-frame-${image.frameIndex}`} className="rounded-lg border border-hairline px-3 py-2 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="font-semibold">{image.number}</span> · {image.timeLabel}
                </a>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs leading-relaxed text-text-secondary">{copy.limitation}</p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{copy.resultLabel}</h3>
          <div className="relative mt-3 overflow-hidden rounded-xl bg-black">
            <PublicVideoPlayer src={viewModel.videoUrl} poster={buildPublicVideoPosterUrl(viewModel.posterUrl)} title={copy.resultLabel} locale={locale} className="aspect-video w-full object-contain" />
          </div>
          <p className="mt-2 text-xs text-text-secondary">{viewModel.modelName} · {recipe.durationSec} {copy.secondsLabel} · {recipe.resolution}</p>
        </div>
      </div>
      <div className="mt-6 rounded-xl border border-hairline bg-surface-2 p-4">
        <h3 className="text-sm font-semibold text-text-primary">{copy.promptLabel}</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{recipe.prompt}</p>
      </div>
      {recreateHref ? (
        <a href={recreateHref} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brandHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {copy.recreateLabel}<UIIcon icon={ArrowRight} size={16} />
        </a>
      ) : null}
    </section>
  );
}
