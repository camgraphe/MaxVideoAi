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
import {
  PROVIDER_LABELS,
  PURCHASE_STRATEGY_LABELS,
  rankQuotedOffers,
  type PurchaseStrategy,
} from '@/lib/video-purchase-decision';
import type { RoutingScenario } from '../_lib/routing-scenarios';
import type { InstalledRoute } from '../_lib/installed-routes';
import {
  dollars,
  offerAccessLabel,
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
  initialEngine,
  initialProfile,
}: {
  scenarios: RoutingScenario[];
  routes: InstalledRoute[];
  initialEngine?: string;
  initialProfile?: string;
}) {
  const [view, setView] = useState<'simulation' | 'map'>('simulation');
  const [profile, setProfile] = useState(
    () => (scenarios.find((s) => s.id === initialProfile) ?? scenarios.find((s) => s.engineId === initialEngine) ?? scenarios[0]).id
  );
  const [cap, setCap] = useState('');
  const [policyOverride, setPolicyOverride] = useState<PurchaseStrategy | null>(null);
  const [presetOverride, setPreset] = useState<Preset | null>(null);
  const [fundedPacks, setFundedPacks] = useState<string[]>([]);
  const [installedOnly, setInstalledOnly] = useState(false);
  const [custom, setCustom] = useState<Conditions | null>(null);
  const scenario = scenarios.find((item) => item.id === profile) ?? scenarios[0];
  const standby = routes.filter((r) => r.standbyReason && scenario.candidates.some((c) => c.provider === r.provider));
  const fundingExclusion = Object.fromEntries(
    standby.filter((r) => !fundedPacks.includes(r.provider)).map((r) => [r.provider, r.standbyReason!])
  );
  const installedProviders = new Set<string>(routes.map(r => r.provider));
  const catalogCandidates = scenario.candidates.filter(c => c.simulationOnly || !installedProviders.has(c.provider));
  const exclusions = {
    ...(installedOnly ? Object.fromEntries(catalogCandidates.map(c => [c.provider, 'Outside the installed supplier comparison'])) : {}),
    ...fundingExclusion,
  };
  const strategy = policyOverride ?? scenario.strategy;
  const engines = new Map(scenarios.map((item) => [item.engineId, item.engineLabel]));
  function selectProfile(id: string) {
    setProfile(id);
    setCap('');
    setFundedPacks([]);
    setPreset(null);
    setCustom(null);
    setPolicyOverride(null);
  }
  const ceilingMicros =
    cap === '' ? scenario.ceiling : Math.min(scenario.ceiling, Math.floor(Number(cap) * 1e6));
  const eligible = rankQuotedOffers(scenario.candidates, { ceilingMicros, strategy, unavailable: exclusions });
  const preset = presetOverride ?? (standby.length || eligible.order.length < 2 ? 'best' : 'fallback');
  const conditions = custom ?? presetConditions(preset, eligible.order);
  const unavailable = Object.fromEntries(
    Object.entries(conditions)
      .filter(([, state]) => state === 'offline')
      .map(([key]) => [key, 'Unavailable before submission'])
  );
  const decision = rankQuotedOffers(scenario.candidates, {
    ceilingMicros, strategy, unavailable: { ...unavailable, ...exclusions },
  });
  const frames = routeFrames(decision, conditions);
  const runKey = JSON.stringify([profile, ceilingMicros, strategy, conditions, exclusions]);
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
                aria-label="Engine"
                value={scenario.engineId}
                onChange={(e) => {
                  const first = scenarios.find((item) => item.engineId === e.target.value);
                  if (first) selectProfile(first.id);
                }}
              >
                {Array.from(engines, ([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} />
            </span>
            <span className={s.scenario}>
              <select
                aria-label={scenario.engineLabel + ' scenario'}
                value={profile}
                onChange={(e) => selectProfile(e.target.value)}
              >
                {scenarios
                  .filter((item) => item.engineId === scenario.engineId)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
              </select>
              <ChevronDown size={13} />
            </span>
            <span className={s.scenario}>
              <select
                aria-label="Routing strategy"
                value={strategy}
                onChange={(e) => {
                  setPolicyOverride(e.target.value as PurchaseStrategy);
                  setCustom(null);
                }}
              >
                {Object.entries(PURCHASE_STRATEGY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} />
            </span>
            <span className={s.settings}>{scenario.settings}</span>
          </div>
          {catalogCandidates.length > 0 && <div className={s.funding}>
            <label>
              <input type="checkbox" checked={installedOnly} onChange={event => {
                setInstalledOnly(event.target.checked);
                setCustom(null);
              }} />
              Compare installed suppliers only
            </label>
          </div>}
          {scenario.priceAssumption && <div className={s.funding}>{scenario.priceAssumption}</div>}
          {standby.map((route) => (
            <div className={s.funding} key={route.provider}>
              <span>{route.standbyReason}</span>
              <label>
                <input
                  type="checkbox"
                  aria-label={'Simulate a funded pack for ' + PROVIDER_LABELS[route.provider]}
                  checked={fundedPacks.includes(route.provider)}
                  onChange={(e) => {
                    setFundedPacks(e.target.checked
                      ? [...fundedPacks, route.provider]
                      : fundedPacks.filter((provider) => provider !== route.provider));
                    setCustom(null);
                  }}
                />
                Simulate a funded pack
              </label>
            </div>
          ))}
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
                  {id === 'best' && strategy === 'preserve-fallback' ? 'All accept' : presets[id]}
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
                    disabled={Boolean(exclusions[row.provider])}
                    value={exclusions[row.provider] ? 'offline' : conditions[row.provider] ?? 'accepted'}
                    onChange={(e) => setCustom({ ...conditions, [row.provider]: e.target.value as Response })}
                  >
                    {Object.entries(responseLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <small>{[row.excluded ?? row.tariff, offerAccessLabel(row, scenario.engineId, installedProviders.has(row.provider))].filter(Boolean).join(' · ')}</small>
                  {row.sourceUrl && <a className="text-xs underline" target="_blank" rel="noreferrer" href={row.sourceUrl}>Published rate ↗</a>}
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
