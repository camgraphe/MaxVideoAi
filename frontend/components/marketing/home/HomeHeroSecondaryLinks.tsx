import { Link } from '@/i18n/navigation';

export function HomeHeroSecondaryLinks({
  compareLabel,
  trustBadges,
}: {
  compareLabel: string;
  trustBadges: string[];
}) {
  return (
    <div className="home-hero-reassurance">
      <Link
        href={{ pathname: '/ai-video-engines' }}
        prefetch={false}
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand underline decoration-transparent underline-offset-4 transition hover:text-brandHover hover:decoration-current"
        data-analytics-event="hero_compare_click"
        data-analytics-cta-name="compare_engines"
        data-analytics-cta-location="home_hero"
        data-analytics-target-family="compare"
      >
        {compareLabel}<span aria-hidden="true">→</span>
      </Link>
      <div className="home-hero-guarantees">{trustBadges.slice(0, 3).map(badge => <span key={badge}>{badge}</span>)}</div>
    </div>
  );
}
