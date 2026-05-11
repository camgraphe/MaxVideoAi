import { ArrowDown, Calculator } from 'lucide-react';
import { Link } from '@/i18n/navigation';

type PricingHeroSectionProps = {
  badges?: string[];
  calculatorHref?: string;
  calculatorLabel?: string;
  compareHref?: string;
  compareLabel?: string;
  subtitle?: string;
  supportingLine?: string;
  title?: string;
};

const DEFAULT_BADGES = ['No subscription', 'Guest preview', 'Starter credits from $10'];

export function PricingHeroSection({
  badges = DEFAULT_BADGES,
  calculatorHref = '/app',
  calculatorLabel = 'Open app for live pricing before you generate',
  compareHref = '#video-pricing',
  compareLabel = 'Compare prices below',
  subtitle = 'Compare video, image, audio and tool costs before you generate.',
  supportingLine = 'Pay as you go. See the exact live price in the app before launch. Failed generations are refunded.',
  title = 'MaxVideoAI Pricing',
}: PricingHeroSectionProps) {
  return (
    <header className="relative min-h-[300px] border-b border-hairline bg-bg">
      <div className="container-page flex min-h-[300px] max-w-[1220px] items-center py-10 sm:py-12">
        <div className="max-w-[820px]">
          <h1 className="text-4xl font-semibold leading-tight tracking-normal text-text-primary sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 max-w-[720px] text-lg leading-7 text-text-secondary">{subtitle}</p>
          <p className="mt-2 max-w-[760px] text-sm leading-6 text-text-muted">{supportingLine}</p>

          <div className="mt-5 flex flex-wrap gap-2">
            {badges.map((badge) => (
              <span
                key={badge}
                className="inline-flex min-h-8 items-center rounded-full border border-hairline bg-surface px-3 text-xs font-semibold text-text-secondary"
              >
                {badge}
              </span>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href={calculatorHref}
              prefetch={false}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-text-primary px-5 text-sm font-semibold text-bg shadow-card transition hover:bg-text-primary/90"
            >
              <Calculator className="h-4 w-4" strokeWidth={1.8} />
              {calculatorLabel}
            </Link>
            <Link
              href={compareHref}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-hairline bg-surface px-5 text-sm font-semibold text-text-primary transition hover:border-text-muted"
            >
              {compareLabel}
              <ArrowDown className="h-4 w-4" strokeWidth={1.8} />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
