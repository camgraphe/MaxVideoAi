import { PROVIDER_LABELS, rankQuotedOffers } from '@/lib/video-purchase-decision';
import type { InstalledRoute } from './installed-routes';
import { dollars, presetConditions, routeFrames, type Preset } from './route-playback';
import type { RoutingScenario } from './routing-scenarios';
import type { RoutingTrafficSnapshot } from './routing-traffic-types';

export type MapTone = 'idle' | 'candidate' | 'active' | 'success' | 'fallback' | 'failure' | 'warning';
export type MapNode = { id: string; label: string; detail?: string; tone?: MapTone; standby?: boolean };
export type TrafficEvent = RoutingTrafficSnapshot['events'][number];

export function providerLabel(id: string) {
  return Object.hasOwn(PROVIDER_LABELS, id) ? PROVIDER_LABELS[id as keyof typeof PROVIDER_LABELS] : id;
}

export function demoTraces(scenarios: RoutingScenario[], routes: InstalledRoute[], engine: string, preset: Preset | 'tour') {
  const unavailable = Object.fromEntries(routes.filter(r => r.standbyReason).map(r => [r.provider, r.standbyReason!]));
  const groups = new Map<string, RoutingScenario[]>();
  for (const scenario of scenarios) {
    if (engine && scenario.engineId !== engine) continue;
    const group = groups.get(scenario.engineId) ?? [];
    group.push(scenario);
    groups.set(scenario.engineId, group);
  }
  // Interleave engines. Every profile still appears once before the sequence repeats.
  const queues = [...groups.values()];
  const ordered = Array.from({ length: Math.max(0, ...queues.map(q => q.length)) },
    (_, i) => queues.flatMap(q => q[i] ? [q[i]] : [])).flat();
  return ordered.map((scenario, index) => {
    const decision = rankQuotedOffers(scenario.candidates, {
      ceilingMicros: scenario.ceiling, strategy: scenario.strategy, unavailable,
    });
    const playback = preset === 'tour'
      ? (decision.order.length > 1 && index % 3 === 0 ? 'fallback' : 'best')
      : preset;
    const frames = routeFrames(decision, presetConditions(playback, decision.order));
    return { scenario, decision, frames };
  });
}

export type DemoTrace = ReturnType<typeof demoTraces>[number];

export function demoProviderNodes(scenarios: RoutingScenario[], routes: InstalledRoute[], trace: DemoTrace, phase: number): MapNode[] {
  const all = [...new Set(scenarios.flatMap(s => s.candidates.map(row => row.provider)))];
  const current = trace.frames[phase];
  const reached = trace.frames.slice(0, phase + 1);
  return all.map(id => {
    const candidate = trace.decision.candidates.find(row => row.provider === id);
    const latest = reached.filter(frame => frame.provider === id).at(-1);
    const fallback = latest && trace.decision.order.indexOf(id) > 0;
    const standby = routes.some(row => row.provider === id && row.standbyReason);
    let tone: MapTone = 'idle';
    if (candidate && !candidate.excluded) tone = 'candidate';
    if (latest?.kind === 'sending') tone = fallback ? 'fallback' : 'active';
    if (latest?.kind === 'accepted') tone = 'success';
    if (latest?.kind === 'refused' || latest?.kind === 'invalid') tone = 'failure';
    if (latest?.kind === 'uncertain') tone = 'warning';
    const detail = standby ? 'Standby' : candidate?.costMicros != null ? dollars(candidate.costMicros) : undefined;
    return { id, label: providerLabel(id), tone, standby, detail: id === current.provider || !current.provider || tone !== 'idle' ? detail : undefined };
  });
}

export function eventKey(e: TrafficEvent) {
  return [e.at, e.engineId, e.provider, e.previousProvider ?? '', e.stage, e.status].join('|');
}

/** Compare counts: two different anonymous observations can share every exposed field. */
export function newObservedEvents(previous: RoutingTrafficSnapshot | null, next: RoutingTrafficSnapshot, engine: string) {
  if (!previous || previous.observedAt >= next.observedAt) return [];
  const previousCounts = new Map<string, number>();
  for (const event of previous.events) {
    const key = eventKey(event);
    previousCounts.set(key, (previousCounts.get(key) ?? 0) + 1);
  }
  const arrivals = next.events.filter(event => {
    if (engine && event.engineId !== engine) return false;
    const key = eventKey(event);
    const remaining = previousCounts.get(key) ?? 0;
    if (!remaining) return true;
    previousCounts.set(key, remaining - 1);
    return false;
  });
  return arrivals.sort((a, b) => a.at.localeCompare(b.at));
}

export function eventTone(e: TrafficEvent): MapTone {
  if (['failed', 'cancelled', 'canceled', 'rejected', 'fallback_failed'].includes(e.status)) return 'failure';
  if (['polling_stalled', 'provider_polling_stalled', 'uncertain'].includes(e.status)) return 'warning';
  if (['completed', 'succeeded', 'delivered'].includes(e.status)) return 'success';
  return e.stage === 'fallback' ? 'fallback' : 'active';
}

export function observedProviderNodes(snapshot: RoutingTrafficSnapshot, engine: string, event?: TrafficEvent): MapNode[] {
  const providers = new Map<string, number>();
  for (const route of snapshot.routes) {
    if (engine && route.engineId !== engine) continue;
    providers.set(route.provider, (providers.get(route.provider) ?? 0) + route.attempts + route.jobsOnly);
  }
  return [...providers].sort((a, b) => b[1] - a[1]).map(([id, count]) => ({
    id, label: providerLabel(id), detail: count + (count === 1 ? ' record' : ' records'), tone: event?.provider === id ? eventTone(event) : 'candidate',
  }));
}
