import { Callout } from '@/components/Callout';
import { Link } from '@/i18n/navigation';
import type { DocsContent, DocsSeeAlsoLinks, DocsSectionId } from '../_lib/docs-index-data';
import { DocsSeeAlsoLinks as SeeAlsoLinks } from './DocsSeeAlsoLinks';

type DocsSectionsGridProps = {
  apiNoticeLabel?: string;
  content: DocsContent;
  sectionOrder: readonly DocsSectionId[];
  seeAlsoLinks: DocsSeeAlsoLinks;
};

export function DocsSectionsGrid({ apiNoticeLabel, content, sectionOrder, seeAlsoLinks }: DocsSectionsGridProps) {
  const onboardingChecklist = content.onboardingChecklist ?? {};
  const refundsTimeline = content.refundsTimeline ?? {};
  const safetyQuick = content.safetyQuick ?? {};

  return (
    <section className="grid grid-gap lg:grid-cols-2">
      {content.sections.map((section, index) => {
        const sectionId = sectionOrder[index] ?? undefined;

        return (
          <article
            key={section.title}
            id={sectionId}
            className="scroll-mt-28 rounded-card border border-hairline bg-surface p-6 shadow-card"
          >
            <h2 className="text-lg font-semibold text-text-primary">{section.title}</h2>
            {sectionId === 'api' ? <p className="mt-1 text-xs text-text-muted">{apiNoticeLabel ?? ''}</p> : null}
            <ul className="mt-4 stack-gap-sm text-sm text-text-secondary">
              {section.items.map((item, itemIndex) => (
                <DocsSectionItem key={itemIndex} item={item} />
              ))}
            </ul>
            {sectionId === 'onboarding' ? (
              <section aria-labelledby="onboarding-checklist" className="mt-4">
                <h3 id="onboarding-checklist" className="text-base font-semibold text-text-primary">
                  {onboardingChecklist.title ?? 'Onboarding checklist'}
                </h3>
                <ul className="mt-2 space-y-1.5 text-sm text-text-secondary">
                  {(onboardingChecklist.items ?? []).map((item: string) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-text-muted">{onboardingChecklist.note ?? ''}</p>
              </section>
            ) : null}
            {sectionId === 'pricing' ? (
              <Callout tone="success">
                {content.pricingCallout ?? '✅ You always see the price before you render.'}
              </Callout>
            ) : null}
            {sectionId === 'refunds' ? (
              <section aria-labelledby="refunds-timeline" className="mt-4">
                <h3 id="refunds-timeline" className="text-base font-semibold text-text-primary">
                  {refundsTimeline.title ?? 'Refunds timeline'}
                </h3>
                <ol className="mt-2 space-y-1.5 text-sm text-text-secondary">
                  {(refundsTimeline.steps ?? []).map((item: string) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
                <p className="mt-2 text-xs text-text-muted">{refundsTimeline.note ?? ''}</p>
              </section>
            ) : null}
            {sectionId === 'refunds' ? (
              <Callout tone="success">
                {content.refundsCallout ??
                  '✅ Failed jobs are auto-refunded within minutes; receipts include a short incident note.'}
              </Callout>
            ) : null}
            {sectionId === 'safety' ? (
              <section aria-labelledby="safety-quick" className="mt-4">
                <h3 id="safety-quick" className="text-base font-semibold text-text-primary">
                  {safetyQuick.title ?? 'Quick overview'}
                </h3>
                <ul className="mt-2 space-y-1.5 text-sm text-text-muted">
                  {(safetyQuick.items ?? []).map((item: string) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-text-muted">{safetyQuick.note ?? ''}</p>
              </section>
            ) : null}
            {sectionId === 'safety' ? (
              <Callout tone="warn">
                {content.safetyCallout ?? '⚠️ Sensitive use-cases may require an admin allowlist or human review.'}
              </Callout>
            ) : null}
            {sectionId ? (
              <SeeAlsoLinks label={content.seeAlsoLabel ?? 'See also:'} links={seeAlsoLinks[sectionId]} />
            ) : null}
          </article>
        );
      })}
    </section>
  );
}

type DocsSectionItemProps = {
  item: DocsContent['sections'][number]['items'][number];
};

function DocsSectionItem({ item }: DocsSectionItemProps) {
  if (typeof item === 'string') {
    return (
      <li className="flex items-start gap-2">
        <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-text-muted" />
        <span>{item}</span>
      </li>
    );
  }

  if (typeof item === 'object' && item?.type === 'link') {
    return (
      <li className="flex items-start gap-2">
        <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-text-muted" />
        <span>
          {item.before}
          <Link href="/legal/terms" className="text-brand hover:text-brandHover">
            {item.terms}
          </Link>
          {item.and}
          <Link href="/legal/privacy" className="text-brand hover:text-brandHover">
            {item.privacy}
          </Link>
          {item.after}
        </span>
      </li>
    );
  }

  return null;
}
