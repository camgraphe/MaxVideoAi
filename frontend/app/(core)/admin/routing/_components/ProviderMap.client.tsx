'use client';

import { useState } from 'react';
import { GitBranch, Layers, ScanLine, X } from 'lucide-react';
import { PROVIDER_LABELS } from '@/lib/video-purchase-decision';
import type { InstalledRoute } from '../_lib/installed-routes';
import s from './routing.module.css';

const name = (key: string) => PROVIDER_LABELS[key as keyof typeof PROVIDER_LABELS] ?? key;
type Selection = { engine: string } | { provider: string };

export function ProviderMap({ routes }: { routes: InstalledRoute[] }) {
  const [configured, setConfigured] = useState(false);
  const [selected, setSelected] = useState<Selection | null>(null);
  const standby = new Map(routes.filter((r) => r.standbyReason).map((r) => [String(r.provider), r.standbyReason]));
  const providers = [...new Set(routes.flatMap((r) => [...r.installedTargets, ...r.targets]))].sort((a, b) =>
    name(a).localeCompare(name(b), 'en'),
  );
  const height = Math.max(routes.length, providers.length, 1) * 66;
  const y = (index: number, count: number) => ((index + 0.5) * height) / count;
  const links = routes.flatMap((row, engineIndex) =>
    (configured ? row.targets : row.installedTargets).map((provider, rank) => ({
      engineIndex,
      engine: row.engineId,
      provider,
      rank,
    })),
  );
  const matching = links.filter(
    (link) =>
      !selected ||
      ('engine' in selected ? selected.engine === link.engine : selected.provider === link.provider),
  );
  const engine =
    selected && 'engine' in selected ? routes.find((row) => row.engineId === selected.engine) : null;
  const provider = selected && 'provider' in selected ? selected.provider : null;
  function pick(choice: Selection, current: boolean) {
    setSelected(current ? null : choice);
  }
  return (
    <div>
      <div className={s.mapHead}>
        <div className={s.mapMode}>
          {[false, true].map((mode) => (
            <button key={String(mode)} aria-pressed={configured === mode} onClick={() => setConfigured(mode)}>
              {mode ? 'Configured here' : 'Installed integrations'}
            </button>
          ))}
        </div>
        <span>{configured ? 'Current environment' : routes.length + ' engine / mode examples'}</span>
      </div>
      <div className={s.networkLabels}>
        <span>
          <Layers size={13} /> Engine / mode
        </span>
        <span>
          <GitBranch size={13} /> Provider
        </span>
      </div>
      <div className={s.network} style={{ height }}>
        <svg viewBox={`0 0 1000 ${height}`} preserveAspectRatio="none" aria-hidden="true" className={s.wires}>
          {links.map((link) => {
            const a = y(link.engineIndex, routes.length),
              b = y(providers.indexOf(link.provider), providers.length);
            const d = `M 373 ${a} C 527 ${a}, 479 ${b}, 626 ${b}`;
            const active = matching.includes(link) && !standby.has(link.provider);
            return (
              <g key={link.engine + link.provider}>
                <path
                  d={d}
                  data-tone={active ? (link.rank ? 'violet' : 'cyan') : 'idle'}
                  className={s.networkWire}
                  strokeDasharray={link.rank ? '5 4' : undefined}
                />
                {selected && active && (
                  <circle
                    key={JSON.stringify(selected)}
                    r="3.5"
                    className={s.mapDot}
                    style={{ offsetPath: 'path("' + d + '")' }}
                  />
                )}
              </g>
            );
          })}
        </svg>
        {routes.map((row, i) => {
          const current = engine?.engineId === row.engineId;
          const active = current || matching.some((link) => link.engine === row.engineId);
          return (
            <button
              key={row.engineId}
              className={s.engineNode}
              data-tone={active ? 'cyan' : 'idle'}
              aria-pressed={current}
              style={{ top: y(i, routes.length) }}
              onClick={() => pick({ engine: row.engineId }, current)}
            >
              <span className={s.port} />
              <strong>{row.label}</strong>
              <small>{[row.mode, row.profile].filter(Boolean).join(' · ')}</small>
            </button>
          );
        })}
        {providers.map((key, i) => {
          const current = provider === key;
          const active = !standby.has(key) && (current || matching.some((link) => link.provider === key));
          return (
            <button
              key={key}
              className={s.targetNode}
              data-tone={active ? 'violet' : 'idle'}
              aria-pressed={current}
              style={{ top: y(i, providers.length) }}
              onClick={() => pick({ provider: key }, current)}
            >
              <span className={s.port} />
              <strong>{name(key)}{standby.has(key) && <small className={s.standby}>Standby · No funds</small>}</strong>
            </button>
          );
        })}
      </div>
      <div className={s.networkFooter} aria-live="polite">
        <ScanLine size={16} />
        <div>
          <strong>
            {engine?.label ??
              (provider ? name(provider) : configured ? 'Configured routes' : 'Installed integrations')}
          </strong>
          {provider && standby.get(provider) && <p>{standby.get(provider)}</p>}
          <p>
            {engine
              ? matching.length
                ? matching.map((link) => name(link.provider)).join(' → ')
                : 'Unavailable in this environment.'
              : provider
                ? matching.length
                  ? matching.map((link) => routes[link.engineIndex].label).join(' · ')
                  : 'No configured path from these engine examples.'
                : configured
                  ? 'Select an engine or provider. Dashed lines show configured fallbacks.'
                  : 'Select an engine or provider to trace its integration.'}
          </p>
        </div>
        {selected && (
          <button onClick={() => setSelected(null)}>
            <X size={14} />
            Show all
          </button>
        )}
      </div>
    </div>
  );
}
