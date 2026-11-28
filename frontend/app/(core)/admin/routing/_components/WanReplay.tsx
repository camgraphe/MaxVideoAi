import { PROVIDER_LABELS } from '@/lib/video-purchase-decision';
import novemberAudit from '../_lib/wan-replay-2026-11-27.json';
import { loadWanPrimeReplay } from '../_lib/wan-replay';

const usd = (micros: number, digits = 2) => (micros / 1e6).toLocaleString('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits,
});

export async function WanReplay({ requested }: { requested: boolean }) {
  const result = requested ? await loadWanPrimeReplay().catch(() => null) : novemberAudit;
  const savings = result ? result.baselineMicros - result.purchaseMicros : 0;
  return (
    <section id="wan-replay" className="rounded-card border border-hairline bg-surface p-5" aria-label="Wan Prime historical replay">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Wan Prime historical replay</h2>
        <a className="text-sm underline" href={requested ? '?engine=wan-3-prime#wan-replay' : '?engine=wan-3-prime&replay=wan-prime#wan-replay'}>
          {requested ? 'View November audit' : 'Replay last 30 days here'}
        </a>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        {requested ? 'Current environment' : 'Saved November audit'} · completed wallet purchases, excluding admin accounts.
      </p>
      {!result ? <p className="mt-3 text-sm">Purchase history unavailable.</p> : (
        <div className="mt-4 space-y-4 text-sm">
          <p>{result.startDay} through {new Date(Date.parse(result.endDay) - 86_400_000).toISOString().slice(0, 10)} · Madrid · {result.total} purchases</p>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {[
              ['Comparable purchases', result.eligible],
              ['Three providers within ceiling', result.threeRoutes],
              ['Estimated savings', usd(savings)],
            ].map(([name, value]) => <div key={name}><dt className="text-xs text-text-secondary">{name}</dt><dd className="text-xl font-semibold">{value}</dd></div>)}
          </dl>
          {result.eligible > 0 && (
            <>
              <div className="max-w-2xl space-y-2">
                {([['Alibaba list', result.baselineMicros], ['Lowest eligible price', result.purchaseMicros]] as const).map(([label, amount]) => (
                  <div key={label}>
                    <div className="flex justify-between gap-2"><span>{label}</span><strong>{usd(amount, 3)}</strong></div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/10">
                      <div className={label === 'Alibaba list' ? 'h-full bg-slate-500' : 'h-full bg-teal-500'}
                        style={{ width: (result.baselineMicros ? amount / result.baselineMicros * 100 : 0) + '%' }} />
                    </div>
                  </div>
                ))}
              </div>
              <p>First choice · {Object.entries(result.firstChoices).map(([provider, jobs]) =>
                (PROVIDER_LABELS[provider as keyof typeof PROVIDER_LABELS] ?? provider) + ' (' + jobs + ')').join(' · ')}</p>
              <p>Eligible requests · {result.modes.t2v} text · {result.modes.i2v} start frame · {result.modes.ref2v} image references</p>
            </>
          )}
          <p className="text-text-secondary">Excluded purchases · {result.outsideCoverage} outside pilot coverage · {result.missingFacts} incomplete records or currency · {result.overCeiling} over ceiling.
            {' '}Estimates use published rates, Gold access and available suppliers. Each replay applies the recorded customer ceiling.</p>
        </div>
      )}
    </section>
  );
}
