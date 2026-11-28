'use client';

import { useEffect, useRef, useState } from 'react';
import type { InstalledRoute } from '../_lib/installed-routes';
import type { RoutingScenario } from '../_lib/routing-scenarios';
import type { RoutingTrafficSnapshot } from '../_lib/routing-traffic-types';
import { RouteSimulator } from './RouteSimulator.client';
import { TrafficMap } from './TrafficMap.client';
import { EngineUsage } from './EngineUsage';

const refreshMs = 30_000;

function useObservedTraffic(enabled: boolean) {
  const [snapshot, setSnapshot] = useState<RoutingTrafficSnapshot | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'offline' | 'unauthorized'>('loading');

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    let pending: AbortController | undefined;

    async function refresh() {
      clearTimeout(timer);
      if (disposed || document.hidden || pending) return;
      const controller = new AbortController();
      pending = controller;
      const deadline = setTimeout(() => controller.abort(), 12_000);
      let authorized = true;
      try {
        const response = await fetch('/api/admin/routing/traffic', { cache: 'no-store', signal: controller.signal });
        if (disposed) return;
        if (response.status === 401 || response.status === 403) {
          authorized = false;
          setSnapshot(null);
          setState('unauthorized');
          return;
        }
        if (!response.ok) throw new Error('Traffic unavailable');
        const data: RoutingTrafficSnapshot = await response.json();
        if (!disposed) {
          setSnapshot(data);
          setState('ready');
        }
      } catch {
        if (!disposed) setState('offline');
      } finally {
        clearTimeout(deadline);
        pending = undefined;
        if (!disposed && authorized && !document.hidden) timer = setTimeout(refresh, refreshMs);
      }
    }
    void refresh();
    document.addEventListener('visibilitychange', refresh);
    return () => {
      disposed = true;
      clearTimeout(timer);
      pending?.abort();
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [enabled]);
  return { snapshot, state };
}

export function RoutingWorkspace({ scenarios, routes, initialEngine, initialReplay }: {
  scenarios: RoutingScenario[];
  routes: InstalledRoute[];
  initialEngine?: string;
  initialReplay?: boolean;
}) {
  const [observing, setObserving] = useState(false);
  const { snapshot, state } = useObservedTraffic(observing);
  const [inspection, setInspection] = useState({ id: '', revision: 0 });
  const lab = useRef<HTMLDetailsElement>(null);

  function inspect(id: string) {
    if (!scenarios.some(scenario => scenario.id === id)) return;
    setInspection(previous => ({ id, revision: previous.revision + 1 }));
    if (lab.current) {
      lab.current.open = true;
      lab.current.querySelector('summary')?.focus({ preventScroll: true });
      lab.current.scrollIntoView({ block: 'start' });
    }
  }

  const [labOpen, setLabOpen] = useState(Boolean(initialEngine) && !initialReplay);
  return <>
    <div>
      <TrafficMap scenarios={scenarios} routes={routes} observed={snapshot} initialReplay={initialReplay} initialReplayEngine={initialEngine}
        onObservedChange={setObserving} onInspectScenario={inspect} />
      {observing && state !== 'ready' && (
        <p role="status" className="mt-2 text-sm text-text-secondary">
          {state === 'loading' && 'Loading recorded traffic…'}
          {state === 'unauthorized' && 'Admin access is required to view recorded traffic.'}
          {state === 'offline' && (snapshot ? 'Refresh unavailable. Showing the last recorded snapshot.' : 'Recorded traffic is unavailable. Retrying every 30 seconds while this tab is visible.')}
        </p>
      )}
    </div>
    {observing && snapshot?.engineUsage && (
      <EngineUsage engines={snapshot.engineUsage} sampledJobs={snapshot.sampledJobs} windowMinutes={snapshot.windowMinutes}
        truncated={snapshot.truncated} labels={new Map(scenarios.map(scenario => [scenario.engineId, scenario.engineLabel]))} />
    )}
    <details open={labOpen} onToggle={event => setLabOpen(event.currentTarget.open)} ref={lab}
      className="scroll-mt-4 rounded-card border border-hairline bg-surface">
      <summary className="cursor-pointer p-4 font-semibold">Scenario lab · prices, outages and fallbacks</summary>
      {labOpen && <RouteSimulator key={inspection.revision} scenarios={scenarios} routes={routes}
        initialEngine={initialEngine} initialProfile={inspection.id} />}
    </details>
  </>;
}
