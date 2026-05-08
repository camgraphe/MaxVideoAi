import { Link } from '@/i18n/navigation';
import { FlagPill } from '@/components/FlagPill';
import { LazyPriceEstimator } from '@/components/marketing/LazyPriceEstimator';
import { FEATURES } from '@/content/feature-flags';
import type { PricingRuleLite } from '@/lib/pricing-rules';
import type { EnginePricingDetails } from '@/types/engines';

type PricingEstimatorSectionProps = {
  comingSoonLabel: string;
  enginePricingOverrides: Record<string, EnginePricingDetails>;
  generatorHref: string;
  liveLabel: string;
  livePricingLine: string;
  openGeneratorLabel: string;
  pricingRules: PricingRuleLite[];
};

export function PricingEstimatorSection({
  comingSoonLabel,
  enginePricingOverrides,
  generatorHref,
  liveLabel,
  livePricingLine,
  openGeneratorLabel,
  pricingRules,
}: PricingEstimatorSectionProps) {
  return (
    <section id="estimator" className="scroll-mt-28">
      <div className="mx-auto max-w-5xl">
        <LazyPriceEstimator
          pricingRules={pricingRules}
          enginePricingOverrides={enginePricingOverrides}
          defaultEngineId="veo-3-1-lite"
          defaultDurationSec={4}
        />
      </div>
      <div className="mx-auto mt-5 flex max-w-3xl flex-col items-center gap-2 rounded-[18px] border border-hairline bg-surface px-4 py-3 text-center text-xs text-text-muted shadow-card sm:flex-row sm:justify-center">
        <FlagPill live={FEATURES.pricing.publicCalculator} liveLabel={liveLabel} soonLabel={comingSoonLabel} />
        <span>
          {livePricingLine}{' '}
          <Link
            href={generatorHref}
            prefetch={false}
            className="font-semibold text-text-primary underline decoration-text-muted/30 underline-offset-4 hover:decoration-text-primary"
          >
            {openGeneratorLabel}
          </Link>
        </span>
      </div>
    </section>
  );
}
