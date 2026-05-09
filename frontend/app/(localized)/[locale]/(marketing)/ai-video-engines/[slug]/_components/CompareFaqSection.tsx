import type { ComparePageCopy } from '../_lib/compare-page-copy';
import type { CompareFaqItem } from '../_lib/compare-page-faq';
import {
  formatEngineName,
  formatTemplate,
} from '../_lib/compare-page-helpers';
import type { ComparePageOverride } from '../_lib/compare-page-overrides';
import type { EngineCatalogEntry } from '../_lib/compare-page-types';

type CompareFaqSectionProps = {
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
  breadcrumbJsonLd,
  compareCopy,
  faqItems,
  faqJsonLd,
  left,
  pageOverride,
  right,
  webPageJsonLd,
}: CompareFaqSectionProps) {
  return (
    <section className="stack-gap-sm">
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
      <div className="stack-gap-sm">
        {faqItems.map((item) => (
          <details key={item.question} className="rounded-card border border-hairline bg-surface p-4">
            <summary className="cursor-pointer text-sm font-semibold text-text-primary">
              {item.question}
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
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }}
      />
    </section>
  );
}
