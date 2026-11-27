import Link from 'next/link';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { PROVIDER_LABELS, PURCHASE_STRATEGY_LABELS } from '@/lib/video-purchase-decision';
import type { RoutingJob } from '../_lib/routing-data';

function label(provider: string) {
  return Object.hasOwn(PROVIDER_LABELS, provider)
    ? PROVIDER_LABELS[provider as keyof typeof PROVIDER_LABELS]
    : provider;
}
export function RoutingHistory({ jobs }: { jobs: RoutingJob[] | null }) {
  return (
    <AdminSection
      title="Recent video routes"
      description="Latest 24 video jobs across all providers. Open a job for its payment and delivery details."
    >
      {!jobs?.length ? (
        <p className="text-sm text-text-secondary">
          {jobs === null
            ? 'Job history is unavailable in this environment.'
            : 'No video jobs have been recorded.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-text-secondary">
              <tr>
                {['Generation', 'Routing decision', 'Actual attempts', 'Job status'].map((h) => (
                  <th className="p-2" key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.job_id} className="border-t border-hairline align-top">
                  <td className="p-2">
                    <Link className="underline" href={'/admin/jobs?jobId=' + encodeURIComponent(job.job_id)}>
                      {job.engine_id}
                    </Link>
                    <p className="text-xs text-text-secondary">
                      {new Date(job.created_at).toISOString().slice(0, 16).replace('T', ' ')} UTC
                    </p>
                  </td>
                  <td className="p-2">
                    {job.purchase_mode ? (
                      <>
                        <span className="font-medium">
                          {job.purchase_mode === 'canary' ? 'Canary' : 'Price simulation'}
                          {job.strategy && ' · ' + (PURCHASE_STRATEGY_LABELS[job.strategy] ?? job.strategy)}
                        </span>
                        <p>{job.ranked?.length ? job.ranked.map(label).join(' → ') : 'No eligible route'}</p>
                        {Array.isArray(job.candidates) && (
                          <details className="mt-1 text-xs">
                            <summary className="cursor-pointer">Costs and exclusions</summary>
                            {job.ceiling_micros != null && (
                              <p>Purchase ceiling · ${Number(job.ceiling_micros) / 1e6}</p>
                            )}
                            <ul>
                              {job.candidates.map((c) => (
                                <li key={c.provider}>
                                  {label(c.provider)} ·{' '}
                                  {c.costMicros == null ? 'Cost unavailable' : '$' + c.costMicros / 1e6}
                                  {c.excluded ? ' · ' + c.excluded : ''}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </>
                    ) : (
                      'Established route'
                    )}
                  </td>
                  <td className="p-2">
                    {job.attempts.length ? (
                      <ol>
                        {job.attempts.map((a, i) => (
                          <li key={i}>
                            {i + 1}. {label(a.provider)} · {a.status}
                            {a.reason && ' · ' + a.reason}
                          </li>
                        ))}
                      </ol>
                    ) : job.provider ? (
                      label(job.provider)
                    ) : (
                      'Awaiting assignment'
                    )}
                  </td>
                  <td className="p-2">{job.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminSection>
  );
}
