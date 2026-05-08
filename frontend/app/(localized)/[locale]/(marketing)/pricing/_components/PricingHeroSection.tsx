import { Link } from '@/i18n/navigation';
import { MarketingHeroImage } from '@/components/marketing/MarketingHeroImage';

type PricingHeroLink = {
  after?: string;
  before?: string;
  label?: string;
};

type PricingHeroSectionProps = {
  compareBlogHref: string;
  heroAccentLine: string | null;
  heroBodyLines: string[];
  heroEyebrow: string;
  heroHeadline: string;
  heroLink: PricingHeroLink | null;
};

function isNoSubscriptionCopy(line: string) {
  const normalized = line.toLowerCase();
  return (
    normalized.includes('no subscription') ||
    normalized.includes('lock-in') ||
    normalized.includes('abonnement') ||
    normalized.includes('engagement') ||
    normalized.includes('suscripción') ||
    normalized.includes('permanencia')
  );
}

export function PricingHeroSection({
  compareBlogHref,
  heroAccentLine,
  heroBodyLines,
  heroEyebrow,
  heroHeadline,
  heroLink,
}: PricingHeroSectionProps) {
  return (
    <header className="relative min-h-[520px] overflow-hidden border-b border-hairline bg-bg">
      <MarketingHeroImage
        src="/assets/pricing/pricing-hero-reference.webp"
        darkSrc="/assets/pricing/pricing-hero-reference-dark.webp"
        className="opacity-55 dark:opacity-70"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.93)_0%,rgba(255,255,255,0.76)_34%,rgba(247,249,253,0.36)_68%,rgba(247,249,253,0.08)_100%)] dark:bg-[radial-gradient(circle_at_50%_38%,rgba(3,7,18,0.24)_0%,rgba(3,7,18,0.16)_42%,rgba(3,7,18,0.05)_76%,rgba(3,7,18,0.00)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-bg to-transparent" />
      <div className="container-page relative flex min-h-[520px] max-w-[1220px] items-center justify-center pb-24 pt-14 text-center">
        <div className="mx-auto flex max-w-[760px] flex-col items-center gap-4">
          <span className="inline-flex items-center rounded-pill border border-hairline bg-white/72 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#356BE8] shadow-sm backdrop-blur dark:bg-white/10">
            {heroEyebrow}
          </span>
          <h1 className="text-4xl font-semibold leading-[1.04] tracking-tight text-text-primary sm:text-6xl">
            {heroHeadline}
            {heroAccentLine ? (
              <>
                <br />
                <span className="text-text-secondary">{heroAccentLine}</span>
              </>
            ) : null}
          </h1>
          <div className="flex flex-col items-center gap-3 text-base leading-7 text-text-secondary">
            {heroBodyLines.map((line) =>
              isNoSubscriptionCopy(line) ? (
                <p
                  key={line}
                  className="rounded-[14px] border border-hairline bg-white/76 px-5 py-3 text-lg font-semibold tracking-tight text-text-primary shadow-card backdrop-blur sm:text-xl dark:bg-white/10"
                >
                  {line}
                </p>
              ) : (
                <p key={line}>{line}</p>
              )
            )}
          </div>
          {heroLink ? (
            <p className="text-sm leading-6 text-text-secondary">
              {heroLink.before}
              <Link
                href={compareBlogHref}
                className="font-semibold text-text-primary underline decoration-text-muted/30 underline-offset-4 hover:decoration-text-primary"
              >
                {heroLink.label ?? 'AI video comparison'}
              </Link>
              {heroLink.after}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  );
}
