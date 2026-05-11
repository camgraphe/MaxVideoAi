import { Link } from '@/i18n/navigation';
import { Calculator, ArrowRight } from 'lucide-react';
import { FlagPill } from '@/components/FlagPill';
import { FEATURES } from '@/content/feature-flags';

type PricingEstimatorSectionProps = {
  comingSoonLabel: string;
  generatorHref: string;
  liveLabel: string;
  livePricingLine: string;
  openGeneratorLabel: string;
};

export function PricingEstimatorSection({
  comingSoonLabel,
  generatorHref,
  liveLabel,
  livePricingLine,
  openGeneratorLabel,
}: PricingEstimatorSectionProps) {
  return (
    <section id="live-calculator" className="scroll-mt-28">
      <div className="rounded-[8px] border border-hairline bg-text-primary p-5 text-bg shadow-float sm:p-6">
        <div className="grid items-center gap-5 lg:grid-cols-[1fr_auto]">
          <div className="flex gap-4">
            <span className="flex h-12 w-12 flex-none items-center justify-center rounded-[8px] border border-white/15 bg-white/10">
              <Calculator className="h-6 w-6" strokeWidth={1.8} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-semibold">Open live calculator</h2>
                <FlagPill live={FEATURES.pricing.publicCalculator} liveLabel={liveLabel} soonLabel={comingSoonLabel} />
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-bg/78">{livePricingLine}</p>
            </div>
          </div>
          <Link
            href={generatorHref}
            prefetch={false}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-bg px-5 text-sm font-semibold text-text-primary transition hover:bg-bg/90"
          >
            {openGeneratorLabel}
            <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
          </Link>
        </div>
      </div>
    </section>
  );
}
