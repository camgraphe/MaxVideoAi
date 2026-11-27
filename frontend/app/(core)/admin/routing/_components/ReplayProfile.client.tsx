'use client';

import { useState } from 'react';
import { ArrowRight, Check, ExternalLink, Route } from 'lucide-react';
import type { HistoricalReplayReport, ReplayTrace } from '../_lib/historical-replay-types';
import { dollars } from '../_lib/route-playback';
import { providerLabel, type MapNode } from '../_lib/traffic-map-model';
import { TrafficDiagram } from './TrafficDiagram.client';
import s from './HistoricalReplay.module.css';

export type ReplayPath = 'history' | 'installed' | 'all';
const modeLabels: Record<string,string> = { t2v: 'Text to video', i2v: 'Image to video', ref2v: 'Reference to video' };
const pathLabels: Record<ReplayPath,string> = {
  history: 'Historical owner', installed: 'Installed suppliers', all: 'With candidates',
};

export function ReplayProfile({ trace, path, onPath, coverage, labels, compact, animate, onEngine }: {
  trace: ReplayTrace; path: ReplayPath; onPath: (path: ReplayPath) => void;
  coverage: HistoricalReplayReport['coverage']; labels: Map<string, string>;
  compact: boolean; animate: boolean; onEngine: (value: string) => void;
}) {
  const [pinned, setPinned] = useState('');
  const comparisonPath = path === 'installed' ? 'installed' : 'all';
  const choice = trace[comparisonPath];
  const target = path === 'history' ? trace.historicalProvider : choice?.provider;
  const cost = choice?.costMicros;
  const gain = !trace.excludedReason && trace.historicalMicros != null && cost != null ? trace.historicalMicros - cost : null;
  const engineLabel = labels.get(trace.engineId) ?? trace.engineId;
  const busiest = coverage.slice().sort((a,b) => b.jobs - a.jobs).slice(0, 6);
  const engines: MapNode[] = busiest.map(row => ({
    id: row.engineId, label: labels.get(row.engineId) ?? row.engineId, detail: row.jobs.toLocaleString('en-US') + ' jobs',
  }));
  if (!engines.some(engine => engine.id === trace.engineId)) engines.push({ id: trace.engineId, label: engineLabel });
  const providerIds = new Set<string>(trace.offers.map(offer => offer.provider));
  if (trace.historicalProvider) providerIds.add(trace.historicalProvider);
  if (target) providerIds.add(target);
  const providers: MapNode[] = [...providerIds].map(id => {
    const offer = trace.offers.find(candidate => candidate.provider === id);
    const isTarget = id === target;
    const isOwner = id === trace.historicalProvider;
    const amount = isOwner ? trace.historicalMicros ?? offer?.costMicros : offer?.costMicros;
    return {
      id, label: providerLabel(id), detail: amount == null ? undefined : dollars(amount),
      stateLabel: isTarget ? path === 'history' ? 'Owner' : 'Modelled' : isOwner ? 'Owner' : offer?.reason ? 'Excluded' : 'Quoted',
      tone: isTarget ? 'active' : isOwner || (offer && !offer.reason) ? 'candidate' : 'idle',
    };
  });
  const offer = trace.offers.find(candidate => candidate.provider === pinned);
  const historical = trace.historicalProvider ? providerLabel(trace.historicalProvider) : 'Unknown owner';
  const hypothetical = choice ? providerLabel(choice.provider) : 'No eligible estimate';
  const details = trace.profile;
  const referenceImages = details ? details.images - Number(details.hasStartFrame) : 0;
  const references = details ? [
    details.hasStartFrame ? 'start frame' : null,
    details.hasEndFrame ? 'end frame' : null,
    referenceImages > 0 ? referenceImages + (referenceImages === 1 ? ' reference image' : ' reference images') : null,
    details.hasVideo ? 'source video' + (details.inputVideoSeconds == null ? '' : ' (' + details.inputVideoSeconds + ' s)') : null,
    details.hasAudioReference ? 'audio reference' : null,
    details.hasDocument ? 'document input' : null,
    details.audioEnabled == null ? null : details.audioEnabled ? 'audio on' : 'audio off',
  ] : [];
  const profile = [trace.mode && (modeLabels[trace.mode] ?? trace.mode), trace.resolution, trace.durationSec != null ? trace.durationSec + ' s' : null, details?.aspectRatio ?? (details?.observedAspectRatio ? 'delivered ' + details.observedAspectRatio : null), ...references]
    .filter(Boolean).join(' · ');
  return <>
    <div className={s.profile}>
      <div><h3>{engineLabel}</h3><p>{profile || 'Request settings unavailable'}</p></div>
      <div className={s.tags}><span>{trace.jobs} {trace.jobs === 1 ? 'job' : 'jobs'} in group</span>
        <span>{trace.status.replaceAll('_', ' ')}</span>{trace.source && <span>Source · {trace.source}</span>}</div>
    </div>
    <div className={s.pathSwitch} role="group" aria-label="Replay route comparison">
      {(Object.keys(pathLabels) as ReplayPath[]).map(key => <button type="button" key={key} aria-pressed={key === path}
        onClick={() => { setPinned(''); onPath(key); }}>{key === path ? <Check size={13}/> : <Route size={13}/>} {pathLabels[key]}</button>)}
    </div>
    <div className={s.chart}>
      <TrafficDiagram engines={engines} providers={providers} activeEngine={trace.engineId} activeProvider={target ?? undefined}
        focusedProvider={pinned} activityKey={path + (target ?? '')} animate={animate && Boolean(target)} compact={compact}
        onEngine={onEngine} onProvider={id => setPinned(current => current === id ? '' : id)} />
    </div>
    {pinned && <div className={s.offer} role="region" aria-label="Replay supplier estimate">
      <strong>{providerLabel(pinned)}</strong>
      {offer ? <span>{offer.costMicros == null ? 'Unpriced' : dollars(offer.costMicros) + ' per job'} · {offer.tariff}{offer.reason ? ' · ' + offer.reason : ''}</span>
        : <span>Recorded owner · no comparable offer</span>}
      {offer?.sourceUrl && <a href={offer.sourceUrl} target="_blank" rel="noreferrer">Rate card <ExternalLink size={12}/></a>}
    </div>}
    <div className={s.comparison} aria-label="Historical and modelled purchase costs">
      <div><small>Historical owner</small><strong>{historical}</strong><span>{trace.historicalMicros == null ? 'Unpriced' : dollars(trace.historicalMicros) + ' / job'}</span></div>
      <ArrowRight size={18}/>
      <div><small>{pathLabels[comparisonPath]}</small><strong>{hypothetical}</strong>
        <span>{cost == null ? 'Unpriced' : dollars(cost) + ' / job'}</span></div>
      <div className={s.gain}><small>Estimated saving / job</small><strong>{gain == null ? '—' : dollars(gain)}</strong>
        {trace.ceilingMicros != null && <span>{dollars(trace.ceilingMicros)} ceiling</span>}</div>
    </div>
    {trace.basisNote && <p className={s.order}>{trace.basisNote}</p>}
    {trace.excludedReason && <p className={s.reason}>{choice ? 'Hypothetical route · outside savings' : 'Excluded from cost totals'} · {trace.excludedReason}</p>}
    {choice && choice.order.length > 1 && <p className={s.order}>Modelled route order <strong>{choice.order.map(providerLabel).join(' → ')}</strong></p>}
  </>;
}
