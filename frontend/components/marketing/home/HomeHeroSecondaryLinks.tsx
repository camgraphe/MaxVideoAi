import { Link } from '@/i18n/navigation';
import { HomeAssistantLink } from './HomeAssistantLink';

export function HomeHeroSecondaryLinks({
  compareLabel,
  assistantLink,
}: {
  compareLabel: string;
  assistantLink: { href: string; label: string } | null;
}) {
  return (
    <div className="min-w-0 min-[900px]:col-start-1 min-[900px]:row-start-3">
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
      <HomeAssistantLink link={assistantLink} />
    </div>
  );
}
