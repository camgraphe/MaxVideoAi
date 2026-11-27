'use client';

import { useState } from 'react';
import {
  nextPurchaseProvider,
  PROVIDER_LABELS,
  rankQuotedOffers,
  type SubmitOutcome,
} from '@/lib/video-purchase-decision';
import type { VideoProviderKey } from '@/server/video-providers/types';
import type { RoutingScenario } from '../_lib/routing-data';

const dollars = (micros: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 5,
  }).format(micros / 1e6);
const fieldClass = 'w-full rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-text-primary';

export function RouteSimulator({ scenarios }: { scenarios: RoutingScenario[] }) {
  const [profile, setProfile] = useState(scenarios[0].id);
  const [cap, setCap] = useState('');
  const [conditions, setConditions] = useState<Partial<Record<VideoProviderKey, SubmitOutcome | 'offline'>>>(
    {}
  );
  const scenario = scenarios.find((item) => item.id === profile) ?? scenarios[0];
  const unavailable = Object.fromEntries(
    Object.entries(conditions)
      .filter(([, state]) => state === 'offline')
      .map(([id]) => [id, 'Unavailable before submission'])
  );
  const ceilingMicros =
    cap === '' ? scenario.ceiling : Math.min(scenario.ceiling, Math.floor(Number(cap) * 1e6));
  const decision = rankQuotedOffers(scenario.candidates, { ceilingMicros, unavailable });
  const steps: string[] = [];
  let provider: VideoProviderKey | null = decision.order[0] ?? null;
  while (provider) {
    const outcome = conditions[provider] ?? 'accepted';
    const label = PROVIDER_LABELS[provider];
    if (outcome === 'offline') break;
    steps.push(
      label +
        ' · ' +
        {
          accepted: 'accepted',
          refused: 'refused before acceptance',
          uncertain: 'awaiting reconciliation',
          invalid: 'request rejected',
        }[outcome]
    );
    provider = nextPurchaseProvider(decision.order, provider, outcome);
  }
  const terminal = steps.length === 0 ? 'No eligible route' : steps[steps.length - 1];
  const verdict = terminal.endsWith('before acceptance') ? 'All eligible routes refused' : terminal;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-medium">
          Wan 3 Prime scenario
          <select
            className={fieldClass}
            value={profile}
            onChange={(e) => {
              setProfile(e.target.value);
              setCap('');
            }}
          >
            {scenarios.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium">
          Purchase ceiling per clip (USD)
          <input
            className={fieldClass}
            type="number"
            min="0"
            step="0.00001"
            value={cap}
            placeholder={String(scenario.ceiling / 1e6)}
            onChange={(e) => setCap(e.target.value)}
          />
        </label>
      </div>
      <p className="text-sm text-text-secondary">{scenario.settings}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-text-secondary">
            <tr>
              {['Route', 'Estimated cost', 'Eligibility', 'Simulated response'].map((h) => (
                <th key={h} className="px-2 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...decision.candidates]
              .sort(
                (a, b) =>
                  (decision.order.includes(a.provider) ? decision.order.indexOf(a.provider) : 99) -
                  (decision.order.includes(b.provider) ? decision.order.indexOf(b.provider) : 99)
              )
              .map((row) => (
                <tr key={row.provider} className="border-t border-hairline">
                  <td className="p-2 font-medium">{PROVIDER_LABELS[row.provider]}</td>
                  <td className="p-2 tabular-nums">
                    {row.costMicros === null ? '—' : dollars(row.costMicros)}
                  </td>
                  <td className="p-2">
                    {row.excluded ??
                      (decision.order[0] === row.provider
                        ? 'First choice'
                        : 'Fallback ' + decision.order.indexOf(row.provider))}
                  </td>
                  <td className="p-2">
                    <select
                      className={fieldClass}
                      aria-label={PROVIDER_LABELS[row.provider] + ' response'}
                      value={conditions[row.provider] ?? 'accepted'}
                      onChange={(e) =>
                        setConditions({
                          ...conditions,
                          [row.provider]: e.target.value as SubmitOutcome | 'offline',
                        })
                      }
                    >
                      <option value="accepted">Accept</option>
                      <option value="offline">Unavailable</option>
                      <option value="refused">Balance refused</option>
                      <option value="uncertain">Response lost</option>
                      <option value="invalid">Invalid request</option>
                    </select>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-md border border-hairline p-4" aria-live="polite">
        <p className="font-semibold">{verdict}</p>
        {steps.length > 1 && <p className="mt-1 text-sm text-text-secondary">{steps.join(' → ')}</p>}
      </div>
    </div>
  );
}
