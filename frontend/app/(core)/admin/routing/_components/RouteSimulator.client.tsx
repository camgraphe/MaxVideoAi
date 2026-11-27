'use client';

import { useState } from 'react';
import {
  ChevronDown,
  CircleDollarSign,
  FlaskConical,
  GitFork,
  Network,
  SlidersHorizontal,
  Waypoints,
} from 'lucide-react';
import { PROVIDER_LABELS, rankQuotedOffers } from '@/lib/video-purchase-decision';
import type { RoutingScenario } from '../_lib/routing-data';
import type { InstalledRoute } from '../_lib/installed-routes';
import {
  dollars,
  presetConditions,
  presets,
  responseLabels,
  routeFrames,
  type Conditions,
  type Preset,
  type Response,
} from '../_lib/route-playback';
import { RouteGraph } from './RouteGraph.client';
import { ProviderMap } from './ProviderMap.client';
import s from './routing.module.css';

export function RouteSimulator({
  scenarios,
  routes,
}: {
  scenarios: RoutingScenario[];
  routes: InstalledRoute[];
}) {
  const [view, setView] = useState<'simulation' | 'map'>('simulation');
  const [profile, setProfile] = useState(scenarios[0].id);
  const [cap, setCap] = useState('');
  const [preset, setPreset] = useState<Preset>('fallback');
  const [custom, setCustom] = useState<Conditions | null>(null);
  const scenario = scenarios.find((item) => item.id === profile) ?? scenarios[0];
  const ceilingMicros =
    cap === '' ? scenario.ceiling : Math.min(scenario.ceiling, Math.floor(Number(cap) * 1e6));
  const eligible = rankQuotedOffers(scenario.candidates, { ceilingMicros });
  const conditions = custom ?? presetConditions(preset, eligible.order);
  const unavailable = Object.fromEntries(
    Object.entries(conditions)
      .filter(([, state]) => state === 'offline')
      .map(([key]) => [key, 'Unavailable before submission']),
  );
  const decision = rankQuotedOffers(scenario.candidates, { ceilingMicros, unavailable });
  const frames = routeFrames(decision, conditions);
  const runKey = JSON.stringify([profile, ceilingMicros, conditions]);
  const simulation = view === 'simulation';

  return (
    <section className={s.console} aria-label="Video routing explorer">
      <header className={s.header}>
        <div className={s.heading}>
          <span className={s.brandIcon}>
            <Waypoints size={25} />
          </span>
          <div>
            <h2>{simulation ? 'Route simulator' : 'Provider map'}</h2>
            <p>
              {simulation
                ? 'Trace a video request across competing offers.'
                : 'Inspect the configured paths for each engine in this environment.'}
            </p>
          </div>
        </div>
        <div className={s.viewSwitch} aria-label="Routing view">
          <button aria-pressed={simulation} onClick={() => setView('simulation')}>
            <GitFork size={14} /> Simulator
          </button>
          <button aria-pressed={!simulation} onClick={() => setView('map')}>
            <Network size={15} /> Provider map
          </button>
        </div>
      </header>
      {simulation ? (
        <>
          <div className={s.strip}>
            <span className={s.sandbox}>
              <FlaskConical size={13} /> Simulation only
            </span>
            <span className={s.scenario}>
              <select
                aria-label="Wan 3 Prime scenario"
                value={profile}
                onChange={(e) => {
                  setProfile(e.target.value);
                  setCap('');
                  setCustom(null);
                }}
              >
                {scenarios.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} />
            </span>
            <span className={s.settings}>{scenario.settings}</span>
          </div>
          <RouteGraph key={runKey} frames={frames} scenario={scenario} decision={decision} />
          <div className={s.experiments}>
            <span>Simulate</span>
            <div>
              {(Object.keys(presets) as Preset[]).map((id) => (
                <button
                  key={id}
                  aria-pressed={custom === null && id === preset}
                  onClick={() => {
                    setCustom(null);
                    setPreset(id);
                  }}
                >
                  {presets[id]}
                </button>
              ))}
            </div>
          </div>
          <details className={s.details}>
            <summary>
              <SlidersHorizontal size={15} /> Scenario settings <ChevronDown size={15} />
            </summary>
            <div className={s.fields}>
              <label>
                <span>
                  <CircleDollarSign size={13} />
                  Purchase ceiling (USD)
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.00001"
                  max={scenario.ceiling / 1e6}
                  placeholder={String(scenario.ceiling / 1e6)}
                  value={cap}
                  onChange={(e) => setCap(e.target.value)}
                />
                <small>Effective ceiling {dollars(ceilingMicros)}</small>
              </label>
              {decision.candidates.map((row) => (
                <label key={row.provider}>
                  <span>{PROVIDER_LABELS[row.provider]}</span>
                  <select
                    aria-label={PROVIDER_LABELS[row.provider] + ' response'}
                    value={conditions[row.provider] ?? 'accepted'}
                    onChange={(e) => setCustom({ ...conditions, [row.provider]: e.target.value as Response })}
                  >
                    {Object.entries(responseLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <small>{row.excluded ?? row.tariff}</small>
                </label>
              ))}
            </div>
          </details>
        </>
      ) : (
        <ProviderMap routes={routes} />
      )}
    </section>
  );
}
