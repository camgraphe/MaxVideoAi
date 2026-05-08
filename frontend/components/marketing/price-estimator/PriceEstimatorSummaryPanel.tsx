import clsx from 'clsx';
import { Button } from '@/components/ui/Button';
import {
  formatCurrency,
  MEMBER_ORDER,
  type MemberTier,
} from '@/components/marketing/price-estimator/price-estimator-options';

type PriceEstimatorSummaryLabels = {
  audio: string;
  audioIncluded: string;
  audioOff: string;
  audioOn: string;
  chargedNote: string;
  duration: string;
  engine: string;
  engineRate: string;
  memberStatus: string;
  memberTooltip: string;
  priceChipSuffix: string;
  resolution: string;
};

type PriceEstimatorSummaryPanelProps = {
  activeResolutionLabel?: string | null;
  currency: string;
  discountPercent: number;
  durationDisplay: string;
  estimateLabels: Record<string, string>;
  labels: PriceEstimatorSummaryLabels;
  memberBenefitCopy?: string;
  memberNames: Map<MemberTier, string>;
  memberTier: MemberTier;
  priceTotal: number;
  rate: number;
  selectedEngine?: {
    audioIncluded?: boolean;
    label?: string;
    rateUnit?: string;
    showDuration?: boolean;
    showResolution?: boolean;
  } | null;
  selectedResolution?: string;
  audioEnabled: boolean;
  onMemberTierChange: (tier: MemberTier) => void;
};

export function PriceEstimatorSummaryPanel({
  activeResolutionLabel,
  currency,
  discountPercent,
  durationDisplay,
  estimateLabels,
  labels,
  memberBenefitCopy,
  memberNames,
  memberTier,
  priceTotal,
  rate,
  selectedEngine,
  selectedResolution,
  audioEnabled,
  onMemberTierChange,
}: PriceEstimatorSummaryPanelProps) {
  return (
    <aside className="border-t border-hairline bg-surface-2/70 p-5 text-sm text-text-secondary sm:p-6 lg:border-l lg:border-t-0">
      <div className="stack-gap">
        <div className="stack-gap-sm">
          <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-text-muted">
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-hairline bg-surface text-[10px] tracking-normal text-text-muted">
              2
            </span>
            {estimateLabels.heading}
          </span>
          <p className="text-5xl font-semibold tracking-tight text-text-primary sm:text-6xl">
            {formatCurrency(priceTotal, currency)}
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-text-muted">
            {labels.priceChipSuffix}
          </p>
        </div>

        <dl className="grid gap-3 border-b border-hairline pb-4 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-text-secondary">{labels.engine}</dt>
            <dd className="text-right font-semibold text-text-primary">{selectedEngine?.label ?? '—'}</dd>
          </div>
          {selectedEngine?.showDuration !== false ? (
            <div className="flex items-center justify-between gap-4">
              <dt className="text-text-secondary">{labels.duration}</dt>
              <dd className="text-right font-semibold text-text-primary">{durationDisplay}</dd>
            </div>
          ) : null}
          {selectedEngine?.showResolution !== false ? (
            <div className="flex items-center justify-between gap-4">
              <dt className="text-text-secondary">{labels.resolution}</dt>
              <dd className="text-right font-semibold text-text-primary">
                {activeResolutionLabel ?? selectedResolution?.toUpperCase()}
              </dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-4">
            <dt className="text-text-secondary">{labels.audio}</dt>
            <dd className="text-right font-semibold text-text-primary">
              {selectedEngine?.audioIncluded || audioEnabled ? labels.audioOn : labels.audioOff}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-text-secondary">{labels.engineRate}</dt>
            <dd className="text-right font-semibold text-text-primary">
              {formatCurrency(rate, currency)}
              {selectedEngine?.rateUnit ?? '/s'}
            </dd>
          </div>
        </dl>

        <div className="stack-gap-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-muted">
              {estimateLabels.memberChipPrefix}
            </span>
            <span className="rounded-full bg-state-success/15 px-3 py-1 text-xs font-semibold text-state-success">
              {memberTier === 'Member' ? memberNames.get('Member') ?? 'Member' : `${discountPercent}%`}
            </span>
          </div>
          {memberBenefitCopy ? <p className="text-xs text-text-muted">{memberBenefitCopy}</p> : null}
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-muted">
              {labels.memberStatus}
            </span>
            <div className="mt-2 grid grid-cols-3 gap-2 rounded-full border border-hairline bg-surface p-1">
              {MEMBER_ORDER.map((tier) => {
                const selected = tier === memberTier;
                return (
                  <Button
                    key={tier}
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onMemberTierChange(tier)}
                    className={clsx(
                      'member-status-pill min-h-0 h-8 rounded-full px-2 text-xs font-semibold',
                      selected
                        ? 'bg-text-primary !text-bg shadow-card hover:bg-text-primary hover:!text-bg'
                        : 'bg-transparent !text-text-secondary hover:bg-surface-2 hover:!text-text-primary'
                    )}
                    aria-pressed={selected}
                  >
                    {memberNames.get(tier) ?? tier}
                  </Button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-text-muted" aria-label={labels.memberTooltip} title={labels.memberTooltip}>
              {labels.memberTooltip}
            </p>
          </div>
        </div>

        <div className="stack-gap-xs text-xs text-text-muted">
          {selectedEngine?.audioIncluded ? <p className="font-semibold text-text-secondary">{labels.audioIncluded}</p> : null}
          <p>{labels.chargedNote}</p>
        </div>
      </div>
    </aside>
  );
}
