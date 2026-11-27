'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowRight, ArrowUpRight, ChevronDown, CirclePause, CirclePlay, ExternalLink,
  FlaskConical, GitBranch, Maximize2, Minimize2, Radio, SkipForward, Waypoints, X,
} from 'lucide-react';
import { PURCHASE_STRATEGY_LABELS } from '@/lib/video-purchase-decision';
import type { InstalledRoute } from '../_lib/installed-routes';
import type { RoutingScenario } from '../_lib/routing-scenarios';
import type { RoutingTrafficSnapshot } from '../_lib/routing-traffic-types';
import { dollars, presets, type Preset } from '../_lib/route-playback';
import {
  demoProviderNodes, demoTraces, eventKey, eventTone, observedProviderNodes, providerLabel,
  type MapNode, type MapTone,
} from '../_lib/traffic-map-model';
import { TrafficDiagram } from './TrafficDiagram.client';
import s from './TrafficMap.module.css';

type Props = {
  scenarios: RoutingScenario[];
  routes: InstalledRoute[];
  observed: RoutingTrafficSnapshot | null;
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

export function TrafficMap({ scenarios, routes, observed, onInspectScenario, onObservedChange }: Props) {
  const [source, setSource] = useState<'demo' | 'observed'>('demo');
  const [engine, setEngine] = useState('');
  const [pinned, pin] = useState('');
  const [eventId, selectEvent] = useState('');
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
  const [arrival, setArrival] = useState('');
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
  const selectedEvent = observedEvents.find(e => eventKey(e) === eventId) ?? observedEvents[0];
  useEffect(() => {
    if (isDemo || !observed) {
      previousSnapshot.current = null;
      setArrival('');
      return;
    }
    const previous = previousSnapshot.current;
    previousSnapshot.current = observed;
    const newest = observed.events[0];
    if (!newest || !previous || previous.observedAt >= observed.observedAt ||
        previous.events.some(event => eventKey(event) === eventKey(newest))) {
      setArrival('');
      return;
    }
    setArrival(eventKey(newest));
    const timer = setTimeout(() => setArrival(''), tickLength);
    return () => clearTimeout(timer);
  }, [isDemo, observed]);

  const activeEngine = (isDemo ? trace?.scenario.engineId : selectedEvent?.engineId) ?? engine;
  const activeProvider = isDemo ? frame?.provider : selectedEvent?.provider;
  const allEngines = isDemo ? names([...new Set(scenarios.map(sc => sc.engineId))], labels) :
    names([...new Set((observed?.routes ?? []).map(r => r.engineId))], labels);
  const providerNodes = isDemo && trace ? demoProviderNodes(scenarios, routes, trace, at.phase) :
    !isDemo && observed ? observedProviderNodes(observed, engine, selectedEvent) : [];
  const diagramEngines = visibleWithSelection(allEngines, activeEngine, 9);
  const diagramProviders = visibleWithSelection(providerNodes, pinned || activeProvider || '', 12);
  const reached = trace?.frames.slice(0, at.phase + 1).filter(f => f.kind === 'sending') ?? [];
  const previousProvider = isDemo ? reached.at(-2)?.provider : selectedEvent?.previousProvider ?? undefined;
  const pickedNode = providerNodes.find(n => n.id === pinned);
  const candidate = trace?.decision.candidates.find(c => c.provider === pinned);
  const currentCost = trace?.decision.candidates.find(c => c.provider === frame?.provider)?.costMicros;
  const firstCost = trace?.decision.candidates.find(c => c.provider === trace.decision.order[0])?.costMicros;
  const costChange = currentCost != null && firstCost != null ? currentCost - firstCost : 0;
  const pickedRoutes = observed?.routes.filter(r => r.provider === pinned && (!engine || r.engineId === engine)) ?? [];
  function reset() { setStep(1); pin(''); selectEvent(''); setArrival(''); }
  function changeSource(to: 'demo' | 'observed') {
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
  const pulse = motion && visible && foreground && (isDemo ? !paused : !!arrival && selectedEvent != null && eventKey(selectedEvent) === arrival);
  const key = isDemo ? String(step) + preset + engine : arrival;
  return (
    <section ref={root} className={s.shell} aria-label="Routing network" data-mode={source}>
      <header className={s.header}>
        <div className={s.identity}><span className={s.mark}><Waypoints size={24} /></span>
          <div><h2>Routing network</h2><p>{isDemo ? 'Price decisions and fallback paths' : 'Recorded provider activity'}</p></div>
        </div>
        <div className={s.headerActions}><div className={s.sourceTabs} aria-label="Traffic source">
          <button type="button" aria-pressed={isDemo} onClick={() => changeSource('demo')}><FlaskConical size={14} />Simulation</button>
          <button type="button" aria-pressed={!isDemo} onClick={() => changeSource('observed')}><Radio size={15} />Observed</button>
        </div>
        <button type="button" className={s.expand} onClick={() => void toggleFull().catch(() => {})}
          aria-label={full ? 'Exit full screen' : 'Enter full screen'} title={full ? 'Exit full screen' : 'Full screen'}>
          {full ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}
        </button></div>
      </header>
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
        </> : observed && <span>{observed.sampledJobs} jobs · {observed.windowMinutes} min{observed.truncated ? ' · partial sample' : ''}</span>}</div>
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
        {isDemo ? <p>{candidate ? [candidate.simulationOnly ? 'Catalogue estimate · simulation only' : '', candidate.excluded || 'Eligible for this request', candidate.costMicros == null ? '' : dollars(candidate.costMicros), candidate.tariff].filter(Boolean).join(' · ') :
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
            <button type="button" key={eventKey(e)+i} data-tone={eventTone(e)} aria-pressed={eventKey(e) === eventKey(selectedEvent)} onClick={() => {selectEvent(eventKey(e));pin('');}}>
              <i/>{clock(e.at).slice(0,8)}<ArrowRight size={10}/>{providerLabel(e.provider)}</button>)}</div>
        </>}
      </div>}
    </section>
  );
}
