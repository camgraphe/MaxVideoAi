import { Crown, Sparkles, UserRound, type LucideIcon } from 'lucide-react';
import { FlagPill } from '@/components/FlagPill';
import { FEATURES } from '@/content/feature-flags';
import type { FormattedMembershipTier } from '../_lib/pricingPageContent';

const MEMBER_TIER_VISUALS: Array<{ Icon: LucideIcon; accentClass: string }> = [
  { Icon: UserRound, accentClass: 'bg-surface-3 text-text-secondary' },
  { Icon: Sparkles, accentClass: 'bg-surface-3 text-text-secondary' },
  { Icon: Crown, accentClass: 'bg-state-warning/10 text-state-warning' },
];

type PricingMemberTiersSectionProps = {
  comingSoonLabel: string;
  liveLabel: string;
  member: {
    title: string;
    subtitle: string;
  };
  tiers: FormattedMembershipTier[];
};

export function PricingMemberTiersSection({
  comingSoonLabel,
  liveLabel,
  member,
  tiers,
}: PricingMemberTiersSectionProps) {
  return (
    <section className="rounded-[8px] border border-hairline bg-white p-5 shadow-[0_18px_54px_rgba(33,49,78,0.06)] dark:bg-white/[0.055] sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-semibold text-text-primary">
            {member.title}
            <FlagPill
              live={FEATURES.pricing.memberTiers}
              liveLabel={liveLabel}
              soonLabel={comingSoonLabel}
            />
          </h2>
          <p className="mt-1 text-sm text-text-secondary">{member.subtitle}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {tiers.map((tier, index) => {
          const visual = MEMBER_TIER_VISUALS[index % MEMBER_TIER_VISUALS.length];
          const Icon = visual.Icon;
          return (
            <article key={tier.name} className="rounded-[8px] border border-hairline bg-bg p-5">
              <span className={`flex h-11 w-11 items-center justify-center rounded-[8px] border border-hairline ${visual.accentClass}`}>
                <Icon className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <h3 className="mt-4 text-base font-semibold text-text-primary">{tier.name}</h3>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                {tier.requirement}
              </p>
              <p className="mt-3 text-sm leading-6 text-text-secondary">{tier.benefit}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
