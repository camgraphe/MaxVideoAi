import Image from 'next/image';

import { Link } from '@/i18n/navigation';
import { TextLink } from '@/components/ui/TextLink';

import type { ModelExamplesViewModel } from '../_lib/model-page-examples-view-model';
import {
  FULL_BLEED_CONTENT,
  FULL_BLEED_SECTION,
  SECTION_BG_A,
  SECTION_PAD,
  SECTION_SCROLL_MARGIN,
} from '../_lib/model-page-specs';

export function ModelDefaultExamplesSection({
  viewModel,
}: {
  viewModel: ModelExamplesViewModel;
}) {
  const { defaultPresentation, section } = viewModel;

  return (
    <section id={viewModel.anchorId} className={`${FULL_BLEED_SECTION} ${SECTION_BG_A} ${SECTION_PAD} ${SECTION_SCROLL_MARGIN}`}>
      <div className={`${FULL_BLEED_CONTENT} px-6 sm:px-8`}>
        {section.title ? (
          <h2 className="mt-0 text-center text-2xl font-semibold text-text-primary sm:mt-0 sm:text-3xl">
            {section.title}
          </h2>
        ) : null}
        {defaultPresentation.items.length ? (
          <>
            {section.intro ? (
              <p className="mt-2 text-center text-base leading-relaxed text-text-secondary">{section.intro}</p>
            ) : null}
            <div className="mt-4 stack-gap">
              <div className="overflow-x-auto pb-2">
                <div className="flex min-w-full gap-4">
                  {defaultPresentation.items.map((item) => (
                    <article
                      key={item.id}
                      className="flex w-80 shrink-0 flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-card"
                    >
                      <Link href={item.href} className="group relative block aspect-video bg-placeholder">
                        {item.posterUrl ? (
                          <Image
                            src={item.posterUrl}
                            alt={item.alt}
                            fill
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                            sizes="320px"
                            quality={70}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-skeleton text-xs font-semibold text-text-muted">
                            {defaultPresentation.noPreviewLabel}
                          </div>
                        )}
                      </Link>
                      <div className="space-y-1 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">
                          {item.metadataLabel}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <TextLink href={item.href} className="text-[11px]" linkComponent={Link}>
                            {defaultPresentation.renderLinkLabel}
                          </TextLink>
                          {item.recreateHref && item.recreateLabel ? (
                            <TextLink href={item.recreateHref} className="text-[11px]" linkComponent={Link}>
                              {item.recreateLabel}
                            </TextLink>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
            {section.defaultCtaLabel ? (
              <p className="mt-4 text-center text-base leading-relaxed text-text-secondary">
                <Link href={defaultPresentation.examplesLinkHref} className="font-semibold text-brand hover:text-brandHover">
                  {section.defaultCtaLabel}
                </Link>
              </p>
            ) : null}
          </>
        ) : section.intro || section.defaultCtaLabel ? (
          <div className="mt-4 rounded-2xl border border-dashed border-hairline bg-surface/60 px-4 py-4 text-sm text-text-secondary">
            {section.intro}{' '}
            {section.defaultCtaLabel ? (
              <Link href={defaultPresentation.examplesLinkHref} className="font-semibold text-brand hover:text-brandHover">
                {section.defaultCtaLabel}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
