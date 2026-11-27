import type { HistoricalReplayReport } from '../_lib/historical-replay-types';
import { dollars } from '../_lib/route-playback';
import { providerLabel } from '../_lib/traffic-map-model';
import s from './HistoricalReplay.module.css';

export function ReplayBreakdown({ report, labels, onEngine }: {
  report: HistoricalReplayReport; labels: Map<string, string>; onEngine: (value: string) => void;
}) {
  const maximum = Math.max(1, ...report.opportunities.map(row => row.standaloneSavingsMicros));
  const totals = report.totals;
  const renderFlow = (flow: HistoricalReplayReport['flows'][number]) => <li
    key={[flow.historicalProvider,flow.installedProvider,flow.chosenProvider].join('/')} className={s.flow}>
    <div><strong>{providerLabel(flow.historicalProvider)} → {providerLabel(flow.chosenProvider)}</strong>
      <small>Installed choice · {providerLabel(flow.installedProvider)}</small></div>
    <div><strong>{flow.jobs.toLocaleString('en-US')} jobs</strong><small>{dollars(flow.savingsMicros)} estimated saving</small></div>
  </li>;
  return <div className={s.analysis}>
    {report.flows.length > 0 && <section className={s.flows} aria-label="Actual to simulated supplier flows">
      <h3>Actual → simulated</h3><p>Comparable jobs in this cohort, grouped by recorded owner and modelled supplier.</p>
      <ul>{report.flows.slice(0,4).map(renderFlow)}</ul>
      {report.flows.length > 4 && <details><summary>More routes ({report.flows.length - 4})</summary><ul>{report.flows.slice(4).map(renderFlow)}</ul></details>}
    </section>}
    <section aria-label="Supplier opportunities"><h3>Supplier opportunities</h3>
      <p>Estimated savings against installed routing. Incremental savings apply in the order shown.</p>
      {report.opportunities.length ? <ol>{report.opportunities.map(row => <li key={row.provider}>
        <div className={s.row}><strong>{providerLabel(row.provider)}</strong><b>{dollars(row.incrementalSavingsMicros)} incremental</b></div>
        <span className={s.bar}><i style={{width: (100 * row.standaloneSavingsMicros / maximum) + '%'}}/></span>
        <small>{dollars(row.standaloneSavingsMicros)} alone · {row.jobsImproved} jobs improved alone · {row.incrementalJobs} incrementally</small>
      </li>)}</ol> : <p>No additional priced supplier improves this cohort.</p>}
    </section>
    <section aria-label="Profiles with one reachable route"><h3>Profiles with one reachable route</h3>
      <p>These profiles have no second route under this policy. Savings from a new supplier are unknown.</p>
      {report.singleRouteProfiles.length ? <ol>{report.singleRouteProfiles.slice(0,5).map(row =>
        <li key={[row.engineId,row.mode,row.resolution,row.provider].join('/')}>
          <div className={s.row}><button className={s.engineButton} type="button"
            onClick={() => onEngine(row.engineId)}>{labels.get(row.engineId) ?? row.engineId}</button><b>{row.jobs} jobs</b></div>
          <small>{[row.mode, row.resolution, providerLabel(row.provider)].filter(Boolean).join(' · ')} · {dollars(row.historicalMicros)} estimated cost</small>
        </li>)}</ol> : <p>No comparable profile has a single reachable route.</p>}
    </section>
    <section aria-label="Replay coverage"><h3>Comparison coverage</h3><p>{totals.comparableJobs.toLocaleString('en-US')} comparable · {totals.excludedJobs.toLocaleString('en-US')} excluded</p>
      <details><summary>Compare all engines ({report.coverage.length})</summary>
        <ul>{report.coverage.map(row => <li key={row.engineId}><button className={s.engineButton} onClick={() => onEngine(row.engineId)} type="button">{labels.get(row.engineId) ?? row.engineId}</button>
          <small>{row.comparableJobs} of {row.jobs} comparable</small></li>)}</ul>
      </details>
      {report.coverageGaps?.length > 0 && <details><summary>Paid profiles to qualify</summary>
        <ol>{report.coverageGaps.slice(0, 8).map(gap => <li key={JSON.stringify([gap.engineId, gap.mode, gap.resolution, gap.aspectRatio, gap.reason])}>
          <div className={s.row}><strong>{labels.get(gap.engineId) ?? gap.engineId}</strong><b>{gap.jobs} jobs</b></div>
          <small>{[gap.mode, gap.resolution, gap.aspectRatio ? 'Recorded framing ' + gap.aspectRatio : '', gap.reason].filter(Boolean).join(' · ')}</small>
        </li>)}</ol>
      </details>}
      {report.excludedReasons.length > 0 && <details><summary>Exclusion reasons ({report.excludedReasons.length})</summary>
        <ul>{report.excludedReasons.map(row => <li key={row.reason}><strong>{row.reason}</strong><small>{row.jobs} jobs</small></li>)}</ul>
      </details>}
      <p>Profiles group requests with matching settings. Historical ownership comes from recorded jobs. Purchase costs use estimated rate cards. Candidate access, supplier balances and delivery outcomes are unverified.</p>
    </section>
  </div>;
}
