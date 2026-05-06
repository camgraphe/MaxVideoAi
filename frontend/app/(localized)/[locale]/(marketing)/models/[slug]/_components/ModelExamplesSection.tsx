import Image from 'next/image';
import { Link, type LocalizedLinkHref } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import type { ExampleGalleryVideo } from '@/components/examples/ExamplesGalleryGrid';
import { ButtonLink } from '@/components/ui/Button';
import { TextLink } from '@/components/ui/TextLink';
import { getImageAlt } from '@/lib/image-alt';
import {
  FULL_BLEED_CONTENT,
  FULL_BLEED_SECTION,
  SECTION_BG_A,
  SECTION_PAD,
  SECTION_SCROLL_MARGIN,
  type SoraCopy,
} from '../_lib/model-page-specs';

type ModelExamplesSectionProps = {
  hideExamplesSection: boolean;
  textAnchorId: string;
  copy: SoraCopy;
  galleryVideos: ExampleGalleryVideo[];
  galleryPreviewAlts: Map<string, string>;
  locale: AppLocale;
  examplesLinkHref: LocalizedLinkHref;
  galleryCtaHref: LocalizedLinkHref;
};

export function ModelExamplesSection({
  hideExamplesSection,
  textAnchorId,
  copy,
  galleryVideos,
  galleryPreviewAlts,
  locale,
  examplesLinkHref,
  galleryCtaHref,
}: ModelExamplesSectionProps) {
  return !hideExamplesSection ? (
          <section
            id={textAnchorId}
            className={`${FULL_BLEED_SECTION} ${SECTION_BG_A} ${SECTION_PAD} ${SECTION_SCROLL_MARGIN}`}
          >
            <div className={`${FULL_BLEED_CONTENT} px-6 sm:px-8`}>
              {copy.galleryTitle ? (
                <h2 className="mt-0 text-center text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">
                  {copy.galleryTitle}
                </h2>
              ) : null}
              {galleryVideos.length ? (
                <>
                  {copy.galleryIntro ? (
                    <p className="mt-2 text-center text-base leading-relaxed text-text-secondary">{copy.galleryIntro}</p>
                  ) : null}
                  <div className="mt-4 stack-gap">
                    <div className="overflow-x-auto pb-2">
                      <div className="flex min-w-full gap-4">
                        {galleryVideos.slice(0, 6).map((video) => (
                          <article
                            key={video.id}
                            className="flex w-80 shrink-0 flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-card"
                          >
                            <Link href={video.href} className="group relative block aspect-video bg-placeholder">
                              {video.optimizedPosterUrl || video.rawPosterUrl ? (
                                <Image
                                  src={video.optimizedPosterUrl ?? video.rawPosterUrl ?? ''}
                                  alt={
                                    galleryPreviewAlts.get(video.id) ??
                                    getImageAlt({
                                      kind: 'renderThumb',
                                      engine: video.engineLabel,
                                      label: video.prompt,
                                      prompt: video.prompt,
                                      locale,
                                    })
                                  }
                                  fill
                                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                                  sizes="320px"
                                  quality={70}
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-skeleton text-xs font-semibold text-text-muted">
                                  No preview
                                </div>
                              )}
                            </Link>
                            <div className="space-y-1 px-4 py-3">
                              <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">
                                {video.engineLabel} · {video.durationSec}s
                              </p>
                              {video.recreateHref && copy.recreateLabel ? (
                                <TextLink href={video.recreateHref} className="text-[11px]" linkComponent={Link}>
                                  {copy.recreateLabel}
                                </TextLink>
                              ) : null}
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  </div>
                  {copy.galleryAllCta ? (
                    <p className="mt-4 text-center text-base leading-relaxed text-text-secondary">
                      <Link href={examplesLinkHref} className="font-semibold text-brand hover:text-brandHover">
                        {copy.galleryAllCta}
                      </Link>
                    </p>
                  ) : null}
                </>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-hairline bg-surface/60 px-4 py-4 text-sm text-text-secondary">
                  {copy.galleryIntro ?? 'Sora 2 examples will appear here soon.'}{' '}
                  {copy.galleryAllCta ? (
                    <Link href={examplesLinkHref} className="font-semibold text-brand hover:text-brandHover">
                      {copy.galleryAllCta}
                    </Link>
                  ) : null}
                </div>
              )}
              {copy.gallerySceneCta ? (
                <div className="mt-6">
                  <ButtonLink
                    href={galleryCtaHref}
                    size="lg"
                    className="shadow-card"
                    linkComponent={Link}
                  >
                    {copy.gallerySceneCta}
                  </ButtonLink>
                </div>
              ) : null}
            </div>
          </section>
  ) : null;
}
