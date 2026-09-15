import { Plus, ArrowUpRight } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import { getCompareDetailActions } from '../_lib/compare-editorial-copy';
import type { ComparePageCopy } from '../_lib/compare-page-copy';
import type { CompareFaqItem } from '../_lib/compare-page-faq';
import {
  formatEngineName,
  formatTemplate,
} from '../_lib/compare-page-helpers';
import type { ComparePageOverride } from '../_lib/compare-page-overrides';
import type { EngineCatalogEntry } from '../_lib/compare-page-types';

type CompareFaqSectionProps = {
  activeLocale: AppLocale;
  breadcrumbJsonLd: unknown;
  compareCopy: ComparePageCopy;
  faqItems: CompareFaqItem[];
  faqJsonLd: unknown;
  left: EngineCatalogEntry;
  pageOverride?: ComparePageOverride | null;
  right: EngineCatalogEntry;
  webPageJsonLd: unknown;
};

export function CompareFaqSection({
  activeLocale,
  breadcrumbJsonLd,
  compareCopy,
  faqItems,
  faqJsonLd,
  left,
  pageOverride,
  right,
  webPageJsonLd,
}: CompareFaqSectionProps) {
  const actions = getCompareDetailActions(activeLocale);
  return (
    <section id="faq" className="compare-faq stack-gap-sm">
      <div className="compare-faq-layout"><div className="compare-faq-intro">
      <span className="compare-faq-eyebrow">{actions.faqCount.replace('{count}', String(faqItems.length))}</span>
      <h2 className="text-2xl font-semibold text-text-primary">
        {pageOverride?.faq?.title ?? compareCopy.faq?.title ?? 'FAQ'}
      </h2>
      <p className="text-sm text-text-secondary">
        {formatTemplate(
          pageOverride?.faq?.subtitle ??
            compareCopy.faq?.subtitle ??
            'Quick answers about {left} vs {right} on MaxVideoAI (pricing, modes, specs, and why results differ).',
          { left: formatEngineName(left), right: formatEngineName(right) }
        )}
      </p>
      <nav aria-label={actions.jump} className="compare-faq-shortcuts">
        {[['#examples', actions.examples], ['#scores', actions.scores], ['#pricing', actions.pricing], ['#specs', actions.specs]].map(([href, label]) => <a key={href} href={href}>{label}<ArrowUpRight size={16} aria-hidden="true" /></a>)}
      </nav>
      </div><div className="compare-faq-answers">
      <p className="compare-faq-hint">{actions.faqHint}</p>
        {faqItems.map((item, index) => (
          <details key={item.question} name="compare-faq-answers" open={index === 0} className="compare-faq-item">
            <summary className="cursor-pointer text-sm font-semibold text-text-primary">
              <span className="compare-faq-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><span>{item.question}</span><Plus size={18} aria-hidden="true" />
            </summary>
            {Array.isArray(item.answer) ? (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-text-secondary">
                {item.answer.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-text-secondary">{item.answer}</p>
            )}
          </details>
        ))}
      </div></div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, '\\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, '\\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd).replace(/</g, '\\u003c') }}
      />
    </section>
  );
}
