import type { CheckoutWalletLoad } from '@/server/checkout-report';

const LOAD_LABELS: Record<CheckoutWalletLoad['status'], string> = {
  prepared: 'Preparation recorded',
  ready: 'Wallets ready',
  recovered: 'Wallets ready after timeout',
  no_ready: 'Timeout, no readiness observed',
  error: 'Wallet loading error',
  no_methods: 'No eligible wallets',
};

const LOAD_PHASE_LABELS: Record<string, string> = {
  session_preparation: 'Session preparation',
  stripe_js: 'Stripe.js',
  element_init: 'Element initialization',
  element_ready: 'Waiting for wallets',
};

export function CheckoutWalletLoadDetails({ loads }: { loads: CheckoutWalletLoad[] }) {
  if (!loads.length) return null;

  return (
    <details className="mt-1">
      <summary className="cursor-pointer font-medium text-text-primary">
        {Array.from(new Set(loads.map(load => LOAD_LABELS[load.status]))).join(' · ')}
      </summary>
      <ul className="mt-2 space-y-2">
        {loads.map((load) => {
          const timings = [
            ['Preparation', load.sessionPreparationMs],
            ['Stripe.js wait', load.stripeJsWaitMs],
            ['From mount', load.elementReadyMs],
            ['Total', load.elapsedMs],
          ] as const;
          return (
            <li key={load.id ?? 'legacy'}>
              <span className="font-medium">{LOAD_LABELS[load.status]}</span>
              {(load.status === 'no_ready' || load.status === 'error') && load.phase && LOAD_PHASE_LABELS[load.phase] && (
                <span> · {LOAD_PHASE_LABELS[load.phase]}</span>
              )}
              <div>
                {timings.filter(([, ms]) => ms !== null).map(([label, ms]) => `${label} ${ms} ms`).join(' · ')}
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
