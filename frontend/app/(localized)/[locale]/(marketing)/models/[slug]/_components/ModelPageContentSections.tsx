import type { ComponentProps } from 'react';

import { Link } from '@/i18n/navigation';

import type { ModelDecisionData } from '../_lib/model-page-decision-data';
import { ModelCompareSection } from './ModelCompareSection';
import { ModelDecisionCardsSection } from './ModelDecisionCardsSection';
import { ModelExamplesSection } from './ModelExamplesSection';
import { ModelPageToc } from './ModelPageToc';
import { ModelPrepLinksSection } from './ModelPrepLinksSection';
import { ModelPricingCallout } from './ModelPricingCallout';
import { ModelPromptingSection } from './ModelPromptingSection';
import { ModelSafetyFaqSection } from './ModelSafetyFaqSection';
import { ModelSpecsSection } from './ModelSpecsSection';
import { ModelTipsSection } from './ModelTipsSection';

type ModelPageContentSectionsProps = {
  isDecision: boolean;
  tocProps: ComponentProps<typeof ModelPageToc>;
  specsProps: ComponentProps<typeof ModelSpecsSection>;
  pricingCallout: ComponentProps<typeof ModelPricingCallout>['callout'] | null;
  microCta: string | null | undefined;
  microCtaHref: ComponentProps<typeof Link>['href'];
  examplesProps: ComponentProps<typeof ModelExamplesSection>;
  decisionCards: ModelDecisionData['decisionCards'] | null;
  promptingProps: ComponentProps<typeof ModelPromptingSection>;
  prepLinksProps: ComponentProps<typeof ModelPrepLinksSection>;
  tipsProps: ComponentProps<typeof ModelTipsSection>;
  compareProps: ComponentProps<typeof ModelCompareSection>;
  safetyFaqProps: ComponentProps<typeof ModelSafetyFaqSection>;
};

export function ModelPageContentSections({
  isDecision,
  tocProps,
  specsProps,
  pricingCallout,
  microCta,
  microCtaHref,
  examplesProps,
  decisionCards,
  promptingProps,
  prepLinksProps,
  tipsProps,
  compareProps,
  safetyFaqProps,
}: ModelPageContentSectionsProps) {
  const variant = isDecision ? 'decision' : 'default';
  const toc = <ModelPageToc {...tocProps} />;
  const specs = <ModelSpecsSection {...specsProps} variant={variant} />;
  const examples = <ModelExamplesSection {...examplesProps} variant={variant} />;
  const prompting = <ModelPromptingSection {...promptingProps} variant={variant} />;
  const prepLinks = <ModelPrepLinksSection {...prepLinksProps} />;
  const tips = <ModelTipsSection {...tipsProps} variant={variant} />;
  const compare = <ModelCompareSection {...compareProps} variant={variant} />;
  const safetyFaq = <ModelSafetyFaqSection {...safetyFaqProps} variant={variant} />;

  if (isDecision) {
    return (
      <>
        {toc}
        {examples}
        {decisionCards ? <ModelDecisionCardsSection cards={decisionCards} /> : null}
        {prompting}
        {prepLinks}
        {tips}
        {compare}
        {specs}
        {safetyFaq}
      </>
    );
  }

  return (
    <>
      {toc}
      {specs}
      {pricingCallout ? <ModelPricingCallout callout={pricingCallout} /> : null}
      {microCta ? (
        <div className="flex justify-center">
          <Link href={microCtaHref} className="text-sm font-semibold text-brand transition hover:text-brandHover">
            {microCta}
          </Link>
        </div>
      ) : null}
      {examples}
      {prompting}
      {prepLinks}
      {tips}
      {compare}
      {safetyFaq}
    </>
  );
}
