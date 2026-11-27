'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  Activity, ArrowRight, ArrowUpRight, ChevronDown, CirclePause, CirclePlay, ExternalLink,
  FlaskConical, GitBranch, History, Maximize2, Minimize2, Radio, SkipForward, Waypoints, X,
} from 'lucide-react';
import { PURCHASE_STRATEGY_LABELS } from '@/lib/video-purchase-decision';
import type { InstalledRoute } from '../_lib/installed-routes';
import type { RoutingScenario } from '../_lib/routing-scenarios';
import type { RoutingTrafficSnapshot } from '../_lib/routing-traffic-types';
import { dollars, offerAccessLabel, presets, type Preset } from '../_lib/route-playback';
import {
  demoProviderNodes, demoTraces, eventKey, eventTone, newObservedEvents, observedProviderNodes, providerLabel,
  type MapNode, type MapTone, type TrafficEvent,
} from '../_lib/traffic-map-model';
import { TrafficDiagram } from './TrafficDiagram.client';
import { RoutingMonitor } from './RoutingMonitor.client';
import s from './TrafficMap.module.css';

const HistoricalReplay = dynamic(() => import('./HistoricalReplay.client').then(module => module.HistoricalReplay));

type Source = 'demo' | 'observed' | 'replay';
type Props = {
  scenarios: RoutingScenario[];
  routes: InstalledRoute[];
  observed: RoutingTrafficSnapshot | null;
  initialReplay?: boolean;
  initialReplayEngine?: string;
  onInspectScenario?: (id: string) => void;
  onObservedChange?: (active: boolean) => void;
};
const tickLength = 1650;
const stageNames = { primary: 'First attempt', fallback: 'Fallback', attempt: 'Later attempt', job: 'Job owner' };
const clock = (iso: string) => new Date(iso).toISOString().slice(11, 19) + ' UTC';
const names = (ids: string[], labels: Map<string, string>) => ids.map(id => ({ id, label: labels.get(id) ?? id }));
const receiptTones: Record<string, MapTone> = { accepted: 'success', sending: 'active', refused: 'failure', invalid: 'failure', uncertain: 'warning', empty: 'warning' };
const visibleWithSelection = (nodes: MapNode[], selected: string, limit: number) => {
  if (nodes.length <= limit) return nodes;
  const first = nodes.slice(0, limit);
  const chosen = nodes.find(n => n.id === selected);
  if (chosen && !first.includes(chosen)) first[limit - 1] = chosen;
  return first;
};

export function TrafficMap({ scenarios, routes, observed, initialReplay, initialReplayEngine, onInspectScenario, onObservedChange }: Props) {
  const [source, setSource] = useState<Source>(initialReplay ? 'replay' : 'demo');
  const [engine, setEngine] = useState('');
  const [pinned, pin] = useState('');
  const [manualEvent, selectEvent] = useState<TrafficEvent | null>(null);
  const [arrivals, setArrivals] = useState<{event: TrafficEvent; id: string; duration: number}[]>([]);
  const [step, setStep] = useState(1);
  const [preset, setPreset] = useState<Preset | 'tour'>('tour');
  const [paused, setPaused] = useState(false);
  const [motion, setMotion] = useState(false);
  const [foreground, setForeground] = useState(true);
  const [visible, setVisible] = useState(true);
  const [compact, setCompact] = useState(false);
  const [full, setFull] = useState(false);
  const root = useRef<HTMLElement>(null);
  const previousSnapshot = useRef<RoutingTrafficSnapshot | null>(null);

  const isDemo = source === 'demo';

  useEffect(() => {
    const host = root.current;
    if (!host) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => { setMotion(!reduced.matches); if (reduced.matches) setPaused(true); };
    const onVisibility = () => setForeground(!document.hidden);
    const onFullscreen = () => setFull(document.fullscreenElement === host);
    const resize = new ResizeObserver(([entry]) => setCompact(entry.contentRect.width < 610));
    const intersection = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    updateMotion();
    onVisibility();
    resize.observe(host);
    intersection.observe(host);
    reduced.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => {
      resize.disconnect(); intersection.disconnect();
      reduced.removeEventListener('change', updateMotion);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('fullscreenchange', onFullscreen);
    };
  }, []);

  const labels = useMemo(() => new Map([
    ...routes.map(r => [r.engineId, r.label] as const),
    ...scenarios.map(sc => [sc.engineId, sc.engineLabel] as const),
  ]), [routes, scenarios]);
  const traces = useMemo(() => demoTraces(scenarios, routes, isDemo ? engine : '', preset), [scenarios, routes, engine, preset, isDemo]);
  const sequence = useMemo(() => traces.flatMap(trace => trace.frames.map((_, phase) => ({ trace, phase }))), [traces]);
  const at = sequence[step % Math.max(sequence.length, 1)];
  const trace = at?.trace, frame = trace?.frames[at.phase];
  const playing = isDemo && !paused && visible && foreground;
  useEffect(() => {
    if (!playing || sequence.length < 2) return;
    const t = window.setInterval(() => setStep(n => (n + 1) % sequence.length), tickLength);
    return () => clearInterval(t);
  }, [playing, sequence.length]);
  const observedEvents = useMemo(() => observed?.events.filter(e => !engine || e.engineId === engine) ?? [], [observed, engine]);
  const autoObserve = source === 'observed' && !manualEvent && motion && foreground && visible;
  const arrival = autoObserve ? arrivals[0] : undefined;
  const selectedEvent = manualEvent ?? arrival?.event ?? observedEvents[0];
  useEffect(() => {
    if (!observed || !autoObserve) {
      previousSnapshot.current = null;
      setArrivals(current => current.length ? [] : current);
      return;
    }
    const previous = previousSnapshot.current;
    if (previous && previous.observedAt >= observed.observedAt) return;
    previousSnapshot.current = observed;
    const events = newObservedEvents(previous, observed, engine);
    if (!events.length) return;
    // Drain even a full 48-event sample before the next normal 30-second refresh.
    const duration = Math.min(tickLength, Math.floor(24_000 / events.length));
    const batch = events.map((event, i) => ({ event, duration, id: observed.observedAt + '/' + i }));
    setArrivals(pending => [...pending, ...batch]);
  }, [observed, autoObserve, engine]);
  useEffect(() => {
    if (!arrival) return;
    const timer = setTimeout(() => setArrivals(current => current[0]?.id === arrival.id ? current.slice(1) : current), arrival.duration);
    return () => clearTimeout(timer);
  }, [arrival]);

  const activeEngine = (isDemo ? trace?.scenario.engineId : selectedEvent?.engineId) ?? engine;
  const activeProvider = isDemo ? frame?.provider : selectedEvent?.provider;
  const allEngines = isDemo ? names([...new Set(scenarios.map(sc => sc.engineId))], labels) :
    names([...new Set((observed?.routes ?? []).map(r => r.engineId))], labels);
  const providerNodes = isDemo && trace ? demoProviderNodes(scenarios, routes, trace, at.phase) :
    !isDemo && observed ? observedProviderNodes(observed, engine, selectedEvent) : [];
  const scenarioCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const scenario of scenarios) counts.set(scenario.engineId, (counts.get(scenario.engineId) ?? 0) + 1);
    return counts;
  }, [scenarios]);
  const diagramEngines = visibleWithSelection(allEngines.map(node => {
    const count = isDemo ? scenarioCounts.get(node.id) : observed?.engineUsage?.find(row => row.engineId === node.id)?.jobs;
    const unit = isDemo ? 'profile' : 'job';
    return { ...node, detail: count == null ? undefined : count + ' ' + unit + (count === 1 ? '' : 's') };
  }), activeEngine, 9);
  const diagramProviders = visibleWithSelection(providerNodes, pinned || activeProvider || '', 12);
  const reached = trace?.frames.slice(0, at.phase + 1).filter(f => f.kind === 'sending') ?? [];
  const previousProvider = isDemo ? reached.at(-2)?.provider : selectedEvent?.previousProvider ?? undefined;
  const pickedNode = providerNodes.find(n => n.id === pinned);
  const candidate = trace?.decision.candidates.find(c => c.provider === pinned);
  const access = candidate && trace
    ? offerAccessLabel(candidate, trace.scenario.engineId, routes.some(route => route.provider === candidate.provider)) : '';
  const currentCost = trace?.decision.candidates.find(c => c.provider === frame?.provider)?.costMicros;
  const firstCost = trace?.decision.candidates.find(c => c.provider === trace.decision.order[0])?.costMicros;
  const costChange = currentCost != null && firstCost != null ? currentCost - firstCost : 0;
  const pickedRoutes = observed?.routes.filter(r => r.provider === pinned && (!engine || r.engineId === engine)) ?? [];
  const monitorEvents = isDemo && trace ? trace.frames.slice(Math.max(0, at.phase - 3), at.phase + 1).reverse().map(item => ({
    title: item.title, detail: item.detail, tone: receiptTones[item.kind] ?? 'active',
  })) : observedEvents.filter(event => !selectedEvent || event.at <= selectedEvent.at).slice(0, 4).map(event => ({
    title: providerLabel(event.provider) + ' · ' + event.status.replaceAll('_', ' '),
    detail: clock(event.at) + ' · ' + (labels.get(event.engineId) ?? event.engineId)
      + (event.previousProvider ? ' · via ' + providerLabel(event.previousProvider) : ''),
    tone: eventTone(event),
  }));
  const monitorOffers = isDemo ? trace?.decision.candidates.map(offer => ({
    label: providerLabel(offer.provider), costMicros: offer.costMicros, excluded: offer.excluded,
    selected: offer.provider === activeProvider,
  })) : undefined;
  const observedCounts = useMemo(() => {
    const totals = new Map<string, number>();
    for (const route of observed?.routes ?? []) {
      if (!engine || route.engineId === engine)
        totals.set(route.provider, (totals.get(route.provider) ?? 0) + route.attempts + route.jobsOnly);
    }
    return [...totals].map(([id, count]) => ({ label: providerLabel(id), count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [observed, engine]);
  function reset() { setStep(1); pin(''); selectEvent(null); setArrivals([]); previousSnapshot.current = null; }
  function chooseEvent(event: TrafficEvent | null) {
    selectEvent(event); pin(''); setArrivals([]); previousSnapshot.current = null;
  }
  function changeSource(to: Source) {
    if (to === source) return;
    setSource(to); setEngine(''); reset(); onObservedChange?.(to === 'observed');
  }
  function chooseEngine(id: string) { setEngine(id); reset(); }
  const inspect = async () => {
    if (!trace || !onInspectScenario) return;
    if (document.fullscreenElement === root.current && document.fullscreenElement) await document.exitFullscreen();
    onInspectScenario(trace.scenario.id);
  };
  async function toggleFull() {
    if (document.fullscreenElement === root.current && document.fullscreenElement) await document.exitFullscreen();
    else await root.current?.requestFullscreen?.();
  }
  const detailTitle = isDemo ? frame?.title : selectedEvent ? providerLabel(selectedEvent.provider) : undefined;
  const detailTone = isDemo ? receiptTones[frame?.kind ?? ''] ?? 'active' : selectedEvent ? eventTone(selectedEvent) : 'idle';
  const networkVisible = isDemo ? !!trace : providerNodes.length > 0;
  const pulse = motion && visible && foreground && (isDemo ? !paused : Boolean(arrival));
  const key = isDemo ? String(step) + preset + engine : arrival?.id ?? '';
  return (
    <section ref={root} className={s.shell} aria-label="Routing network" data-mode={source}
      style={arrival ? { '--packet-duration': (arrival.duration * 0.82) + 'ms' } as CSSProperties : undefined}>
      <header className={s.header}>
        <div className={s.identity}><span className={s.mark}><Waypoints size={24} /></span>
          <div><h2>Routing network</h2><p>{isDemo ? 'Price decisions and fallback paths' : source === 'observed' ? 'Recorded provider activity' : 'Historical demand at today’s estimated purchase prices'}</p></div>
        </div>
        <div className={s.headerActions}><div className={s.sourceTabs} aria-label="Traffic source">
          <button type="button" aria-pressed={isDemo} onClick={() => changeSource('demo')}><FlaskConical size={14} />Simulation</button>
          <button type="button" aria-pressed={source === 'observed'} onClick={() => changeSource('observed')}><Radio size={15} />Observed</button>
          <button type="button" aria-pressed={source === 'replay'} onClick={() => changeSource('replay')}><History size={15}/>Replay 30d</button>
        </div>
        <button type="button" className={s.expand} onClick={() => void toggleFull().catch(() => {})}
          aria-label={full ? 'Exit full screen' : 'Enter full screen'} title={full ? 'Exit full screen' : 'Full screen'}>
          {full ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}
        </button></div>
      </header>
      {source === 'replay' ? <HistoricalReplay initialEngine={initialReplayEngine} labels={labels} compact={compact} motion={motion} visible={visible && foreground} /> : <>
      <div className={s.tools}>
        <label className={s.select}><Activity size={13} /><select aria-label="Filter traffic by engine" value={engine}
          onChange={e => chooseEngine(e.target.value)}><option value="">All engines</option>
          {allEngines.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}</select><ChevronDown size={11} /></label>
        {isDemo && <label className={s.select}><GitBranch size={13}/><select value={preset} aria-label="Simulated conditions"
          onChange={e => { setPreset(e.target.value as typeof preset); reset(); }}><option value="tour">Routing tour</option>
          {Object.entries(presets).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><ChevronDown size={11}/></label>}
        <div className={s.controlsRight}>{isDemo ? <>
          <button type="button" aria-label={paused ? 'Play simulation' : 'Pause simulation'} title={paused ? 'Play simulation' : 'Pause simulation'}
            onClick={() => setPaused(p => !p)}>{paused ? <CirclePlay size={15}/> : <CirclePause size={15}/>}<span>{paused ? 'Play' : 'Pause'}</span></button>
          <button type="button" aria-label="Next routing step" title="Next step" onClick={() => {setPaused(true); setStep(i => (i+1) % Math.max(sequence.length,1));}}><SkipForward size={15}/></button>
        </> : observed && <>
          <span>{observed.sampledJobs} jobs · {observed.windowMinutes} min{observed.truncated ? ' · partial sample' : ''}</span>
          {selectedEvent && <button type="button" aria-pressed={!manualEvent}
            aria-label={manualEvent ? 'Follow latest observed events' : 'Hold the selected observed event'}
            onClick={() => chooseEvent(manualEvent ? null : selectedEvent)}>
            {manualEvent ? <CirclePlay size={15}/> : <CirclePause size={15}/>}<span>{manualEvent ? 'Follow latest' : 'Hold'}</span>
          </button>}
        </>}</div>
      </div>
      <div className={s.canvas}>
        {networkVisible ? <TrafficDiagram engines={diagramEngines} providers={diagramProviders} activeEngine={activeEngine}
          activeProvider={activeProvider} previousProvider={previousProvider} focusedProvider={pinned} activityKey={key} animate={pulse && (!isDemo || frame?.kind === 'sending' || frame?.kind === 'intake')} compact={compact}
          onEngine={id => chooseEngine(id === engine ? '' : id)} onProvider={id => { pin(p => p === id ? '' : id); if (isDemo) setPaused(true); }} />
          : <div className={s.empty}><span><Radio size={26}/></span><strong>{isDemo ? 'No matching scenario' :
            observed ? 'No provider activity in this sample' : 'Waiting for a recorded snapshot'}</strong>
            <p>{isDemo ? 'Choose another engine to explore its paths.' : observed ? 'Waiting for recorded provider activity.' : 'Activity appears here when the admin feed returns a snapshot.'}</p></div>}
        <div className={s.legend}>
          <span><i data-tone="success"/> {isDemo ? 'Accepted' : 'Completed'}</span><span><i data-tone="active"/> {isDemo ? 'Selected' : 'Recorded'}</span><span><i data-tone="fallback"/> Fallback</span>
          <span><i data-tone="failure"/> {isDemo ? 'Refused' : 'Failed'}</span><span><i data-tone="warning"/> Uncertain</span>
        </div>
      </div>
      {pickedNode ? <div className={s.inspect} data-tone={pickedNode.tone}><div className={s.inspectHeading}>
        <span className={s.indicator}/><strong>{pickedNode.label}</strong><button type="button" title="Close provider details" aria-label="Close provider details" onClick={() => pin('')}><X size={14}/></button></div>
        {isDemo ? <p>{candidate ? [access, candidate.excluded || 'Eligible for this request', candidate.costMicros == null ? '' : dollars(candidate.costMicros), candidate.tariff].filter(Boolean).join(' · ') :
          'This provider has no offer for the selected scenario.'}
          {candidate?.sourceUrl && <a href={candidate.sourceUrl} target="_blank" rel="noreferrer">Rate card <ExternalLink size={12}/></a>}</p>
          : <p>{pickedRoutes.reduce((n,r) => n+r.attempts,0)} recorded attempts · {pickedRoutes.reduce((n,r) => n+r.fallbacks,0)} fallbacks · {pickedRoutes.reduce((n,r) => n+r.jobsOnly,0)} jobs with owner only</p>}
      </div> : null}
      {networkVisible && <div className={s.readout} data-tone={detailTone}>
        <div className={s.receiptHeading}><span className={s.indicator}/><strong>{detailTitle}</strong>
          <span className={s.context}>{isDemo ? trace?.scenario.engineLabel : labels.get(activeEngine) ?? activeEngine}</span></div>
        {isDemo && trace && frame ? <>
          <p>{frame.detail}</p>
          <div className={s.meta}><span>{trace.scenario.label} · {trace.scenario.settings}</span>
            <span>{PURCHASE_STRATEGY_LABELS[trace.decision.strategy]} · {dollars(trace.decision.ceilingMicros)} ceiling</span>
            {currentCost != null && <span>Offer {dollars(currentCost)}{costChange !== 0 && (
              ' · ' + dollars(Math.abs(costChange)) + (costChange > 0 ? ' above' : ' below') + ' first choice'
            )}</span>}
            {onInspectScenario && <button type="button" onClick={() => void inspect()}>Inspect scenario <ArrowUpRight size={14}/></button>}</div>
        </> : selectedEvent && <>
          <p>{stageNames[selectedEvent.stage]}{selectedEvent.previousProvider ? ' from ' + providerLabel(selectedEvent.previousProvider) : ''} · {selectedEvent.status.replaceAll('_',' ')} · {clock(selectedEvent.at)}</p>
          <div className={s.events} aria-label="Recent recorded events">{observedEvents.slice(0,5).map((e,i) =>
            <button type="button" key={eventKey(e)+i} data-tone={eventTone(e)} aria-pressed={eventKey(e) === eventKey(selectedEvent)} onClick={() => chooseEvent(e)}>
              <i/>{clock(e.at).slice(0,8)}<ArrowRight size={10}/>{providerLabel(e.provider)}</button>)}</div>
        </>}
      </div>}
      {networkVisible && <RoutingMonitor observed={!isDemo} offers={monitorOffers}
        ceilingMicros={isDemo ? trace?.decision.ceilingMicros : undefined}
        events={monitorEvents} counts={observedCounts} />}
      </>}
    </section>
  );
}
