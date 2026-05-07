import type { BillingCopy } from '../_lib/billing-copy';

type BillingHeroProps = {
  copy: BillingCopy;
  stripeMode: 'test' | 'live' | 'disabled';
  wallet: { balance: number; currency: string } | null;
};

export function BillingHero({ copy, stripeMode, wallet }: BillingHeroProps) {
  return (
    <div className="mb-3 flex flex-col gap-3 sm:mb-5 sm:gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.title}</p>
        <h1 className="mt-1 text-xl font-semibold text-text-primary sm:text-3xl">{copy.wallet.title}</h1>
        <p className="mt-1 max-w-2xl text-xs text-text-secondary sm:mt-2 sm:text-sm">{copy.hero.subtitle}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
        <div className="rounded-input border border-border bg-surface px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">{copy.wallet.balanceLabel}</p>
          <p className="text-base font-semibold text-text-primary">
            {wallet ? `$${wallet.balance.toFixed(2)}` : '--'}
          </p>
        </div>
        {stripeMode !== 'disabled' && (
          <div className="rounded-input border border-border bg-surface px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">Stripe</p>
            <p className={stripeMode === 'test' ? 'text-sm font-semibold text-state-warning' : 'text-sm font-semibold text-success'}>
              {stripeMode === 'test' ? copy.hero.testMode : copy.hero.liveMode}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
