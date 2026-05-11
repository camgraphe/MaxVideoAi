import { ArrowDown, ArrowUpRight, Sparkles } from 'lucide-react';
import { Link } from '@/i18n/navigation';

type PricingHeroSectionProps = {
  badges?: string[];
  calculatorHref?: string;
  calculatorLabel?: string;
  compareHref?: string;
  compareLabel?: string;
  eyebrow?: string;
  subtitle?: string;
  supportingLine?: string;
  title?: string;
};

const DEFAULT_BADGES = ['No subscription', 'Guest preview', 'Starter credits from $10', 'Refunds on failed generations'];

export function PricingHeroSection({
  badges = DEFAULT_BADGES,
  calculatorHref = '/app',
  calculatorLabel = 'Open app for live pricing before you generate',
  compareHref = '#video-pricing',
  compareLabel = 'Compare prices below',
  eyebrow = 'MaxVideoAI Pricing',
  subtitle = 'Compare video, image, audio and tool costs before you generate.',
  supportingLine = 'Pay as you go. See the exact live price in the app before launch. Failed generations are refunded.',
  title = 'AI Video Pricing Comparison',
}: PricingHeroSectionProps) {
  return (
    <header className="relative min-h-[260px] border-b border-hairline bg-bg">
      <div className="container-page grid min-h-[260px] max-w-[1220px] items-center gap-6 py-8 sm:py-10 lg:grid-cols-[1fr_auto]">
        <div className="max-w-[780px]">
          <p className="mb-2 text-xs font-semibold uppercase tracking-micro text-text-muted">{eyebrow}</p>
          <h1 className="text-[32px] font-semibold leading-[1.08] tracking-normal text-text-primary sm:text-[40px]">
            {title}
          </h1>
          <p className="mt-3 max-w-[680px] text-base leading-7 text-text-secondary sm:text-lg">{subtitle}</p>
          <p className="mt-1 max-w-[740px] text-sm leading-6 text-text-muted">{supportingLine}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {badges.map((badge) => (
              <span
                key={badge}
                className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-hairline bg-surface px-2.5 text-[11px] font-semibold text-text-secondary"
              >
                <Sparkles className="h-3 w-3" strokeWidth={1.8} />
                {badge}
              </span>
            ))}
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 lg:w-[320px] lg:items-stretch">
          <Link
            href={calculatorHref}
            prefetch={false}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] bg-text-primary px-5 text-sm font-semibold text-bg shadow-card transition hover:bg-text-primary/90"
          >
            {calculatorLabel}
            <ArrowUpRight className="h-4 w-4" strokeWidth={1.8} />
          </Link>
          <Link
            href={compareHref}
            className="inline-flex min-h-10 items-center justify-center gap-2 text-sm font-semibold text-[#1F5EFF] transition hover:underline"
          >
            {compareLabel}
            <ArrowDown className="h-4 w-4" strokeWidth={1.8} />
          </Link>
        </div>
      </div>
    </header>
  );
}
