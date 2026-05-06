import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { PREP_LINK_VISUALS } from '../_lib/model-page-static';
import { FULL_BLEED_SECTION, SECTION_BG_A, SECTION_PAD, SECTION_SCROLL_MARGIN } from '../_lib/model-page-specs';

type PrepLinksSection = {
  eyebrow: string;
  title: string;
  body: string;
  links: Array<{ href: string; label: string }>;
};

type ModelPrepLinksSectionProps = {
  prepLinksSection: PrepLinksSection | null;
  locale: AppLocale;
};

export function ModelPrepLinksSection({ prepLinksSection, locale }: ModelPrepLinksSectionProps) {
  return prepLinksSection ? (
          <section
            className={`${FULL_BLEED_SECTION} ${SECTION_BG_A} ${SECTION_PAD} ${SECTION_SCROLL_MARGIN} stack-gap`}
          >
            <div className="rounded-[28px] border border-hairline bg-surface/85 p-5 shadow-card sm:p-6">
              <div className="mx-auto max-w-3xl text-center">
                <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">
                  {prepLinksSection.eyebrow}
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-text-primary sm:text-3xl">
                  {prepLinksSection.title}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-text-secondary sm:text-base">
                  {prepLinksSection.body}
                </p>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {prepLinksSection.links.map((item) => {
                  const visual = PREP_LINK_VISUALS[item.href as keyof typeof PREP_LINK_VISUALS];
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="group overflow-hidden rounded-2xl border border-hairline bg-bg shadow-card transition hover:-translate-y-0.5 hover:border-text-muted"
                    >
                      {visual ? (
                        <div className="relative aspect-[16/10] overflow-hidden bg-placeholder">
                          <Image
                            src={visual.imageSrc}
                            alt={visual.alt[locale] ?? visual.alt.en}
                            fill
                            className="object-cover transition duration-300 group-hover:scale-[1.02]"
                            sizes="(max-width: 768px) 100vw, 33vw"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
                        </div>
                      ) : null}
                      <div className="space-y-2 px-4 py-4">
                        <h3 className="text-base font-semibold text-text-primary">{item.label}</h3>
                        {visual ? (
                          <p className="text-sm leading-relaxed text-text-secondary">
                            {visual.summary[locale] ?? visual.summary.en}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
  ) : null;
}
