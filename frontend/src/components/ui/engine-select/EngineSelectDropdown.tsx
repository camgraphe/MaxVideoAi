'use client';

import clsx from 'clsx';
import { Check, ChevronRight, Search } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState, type RefObject } from 'react';
import type { EngineAvailability, EngineCaps } from '@/types/engines';
import { EngineIcon } from '@/components/ui/EngineIcon';
import type { EngineSelectCopy } from './engine-select-copy';
import {
  buildEngineFamilyGroups,
  formatAvgDuration,
  formatEngineSelectScore,
  getCompactModeLabel,
  getModeDisplayOrder,
} from './engine-select-helpers';
import type { DropdownPosition, EngineRegistryMeta } from './engine-select-types';

type EngineSelectDropdownProps = {
  activeOptionId?: string;
  contentRef: RefObject<HTMLDivElement>;
  copy: EngineSelectCopy;
  engineScores?: Record<string, number | null | undefined>;
  formatEngineShort: (engine: EngineCaps | null | undefined) => string;
  hasLegacyEngines: boolean;
  highlightedIndex: number;
  legacyToggleId: string;
  legacyToggleLabel: string;
  disabledEngineReasons?: Record<string, string>;
  onBrowse: () => void;
  onHighlight: (index: number) => void;
  onItemRef: (index: number, node: HTMLButtonElement | null) => void;
  onSelectEngine: (engineId: string) => void;
  onToggleLegacy: (checked: boolean) => void;
  portalElement: HTMLDivElement;
  position: DropdownPosition;
  registryMeta: EngineRegistryMeta | null;
  selectedEngine: EngineCaps;
  showLegacy: boolean;
  triggerId: string;
  visibleEngines: EngineCaps[];
};

const AVAILABILITY_LABELS: Record<EngineAvailability, string> = {
  available: 'Available',
  limited: 'Limited',
  waitlist: 'Waitlist',
  paused: 'Paused',
};

const AVAILABILITY_DOT_CLASS: Record<EngineAvailability, string> = {
  available: 'bg-emerald-500',
  limited: 'bg-amber-500',
  waitlist: 'bg-sky-500',
  paused: 'bg-rose-500',
};

function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
}

function engineMatchesQuery(engine: EngineCaps, meta: EngineRegistryMeta | null, query: string, familyLabel: string) {
  if (!query) return true;
  const entry = meta?.meta.get(engine.id);
  const haystack = [
    engine.id,
    engine.label,
    engine.provider,
    engine.providerMeta?.provider,
    engine.providerMeta?.modelSlug,
    entry?.marketingName,
    entry?.cardTitle,
    entry?.provider,
    entry?.family,
    familyLabel,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

function getDropdownGeometry(position: DropdownPosition) {
  if (typeof window === 'undefined') {
    return {
      left: position.left,
      width: Math.max(position.width, 620),
    };
  }
  const viewportPadding = 12;
  const width = Math.max(320, Math.min(window.innerWidth - viewportPadding * 2, Math.max(position.width, 620)));
  const left = Math.max(viewportPadding, Math.min(position.left, window.innerWidth - width - viewportPadding));
  return { left, width };
}

function ScoreBadge({ value }: { value: string }) {
  const numeric = Number(value);
  const progress = Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric <= 10 ? numeric * 10 : numeric)) : 0;
  const ringColor = progress < 83 ? '#f59e0b' : '#10b981';
  const textTone = progress < 83 ? 'text-amber-700' : 'text-text-primary';
  return (
    <span
      aria-label={`Score ${value}/10`}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-full p-[2px] shadow-[0_2px_8px_rgba(16,24,40,0.06)]"
      style={{
        background: `conic-gradient(${ringColor} 0% ${progress}%, rgba(148,163,184,0.22) ${progress}% 100%)`,
      }}
    >
      <span className={clsx('grid h-full w-full place-items-center rounded-full bg-surface text-[9px] font-semibold leading-none', textTone)}>
        {value}
      </span>
    </span>
  );
}

export function EngineSelectDropdown({
  activeOptionId,
  contentRef,
  copy,
  engineScores,
  formatEngineShort,
  hasLegacyEngines,
  highlightedIndex,
  legacyToggleId,
  legacyToggleLabel,
  disabledEngineReasons,
  onBrowse,
  onHighlight,
  onItemRef,
  onSelectEngine,
  onToggleLegacy,
  portalElement,
  position,
  registryMeta,
  selectedEngine,
  showLegacy,
  triggerId,
  visibleEngines,
}: EngineSelectDropdownProps) {
  const [query, setQuery] = useState('');
  const familyGroups = useMemo(
    () =>
      buildEngineFamilyGroups({
        engines: visibleEngines,
        engineScores,
        registryMeta,
        selectedEngineId: selectedEngine.id,
        showLegacy,
      }),
    [engineScores, registryMeta, selectedEngine.id, showLegacy, visibleEngines]
  );
  const engineIndexById = useMemo(
    () => new Map(visibleEngines.map((engine, index) => [engine.id, index] as const)),
    [visibleEngines]
  );
  const normalizedQuery = normalizeQuery(query);
  const filteredGroups = useMemo(() => {
    return familyGroups
      .map((group) => {
        const familyMatches = group.label.toLowerCase().includes(normalizedQuery) || group.id.includes(normalizedQuery);
        const engines = normalizedQuery
          ? group.engines.filter((engine) => engineMatchesQuery(engine, registryMeta, normalizedQuery, group.label))
          : group.engines;
        return {
          ...group,
          engines: familyMatches && normalizedQuery ? group.engines : engines,
        };
      })
      .filter((group) => group.engines.length > 0);
  }, [familyGroups, normalizedQuery, registryMeta]);

  const selectedFamilyId =
    filteredGroups.find((group) => group.engines.some((engine) => engine.id === selectedEngine.id))?.id ??
    filteredGroups[0]?.id ??
    '';
  const [activeFamilyId, setActiveFamilyId] = useState(selectedFamilyId);
  const activeFamily = filteredGroups.find((group) => group.id === activeFamilyId) ?? filteredGroups[0] ?? null;
  const highlightedEngine = highlightedIndex >= 0 ? visibleEngines[highlightedIndex] : null;
  const geometry = getDropdownGeometry(position);

  useEffect(() => {
    if (!filteredGroups.length) {
      setActiveFamilyId('');
      return;
    }
    if (!filteredGroups.some((group) => group.id === activeFamilyId)) {
      setActiveFamilyId(selectedFamilyId);
    }
  }, [activeFamilyId, filteredGroups, selectedFamilyId]);

  useEffect(() => {
    if (!highlightedEngine) return;
    const family = filteredGroups.find((group) => group.engines.some((engine) => engine.id === highlightedEngine.id));
    if (family && family.id !== activeFamilyId) {
      setActiveFamilyId(family.id);
    }
  }, [activeFamilyId, filteredGroups, highlightedEngine]);

  return createPortal(
    <div
      ref={contentRef}
      className="fixed z-[9999]"
      style={{ top: position.top, left: geometry.left, width: geometry.width }}
    >
      <div className="max-h-[min(78vh,560px)] overflow-hidden rounded-card border border-border bg-surface shadow-float">
        <div className="flex flex-col gap-2 border-b border-hairline px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder={copy.searchPlaceholder}
              className="h-8 w-full rounded-input border border-border bg-bg pl-8 pr-3 text-[12px] text-text-primary outline-none transition placeholder:text-text-muted focus:border-border-hover focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex shrink-0 items-center justify-between gap-3 text-[12px] text-text-muted sm:justify-end">
            {hasLegacyEngines ? (
              <label
                htmlFor={legacyToggleId}
                className="inline-flex items-center gap-2 whitespace-nowrap text-[11px] font-medium text-text-secondary"
              >
                <input
                  id={legacyToggleId}
                  type="checkbox"
                  checked={showLegacy}
                  onChange={(event) => onToggleLegacy(event.currentTarget.checked)}
                  className="h-4 w-4 rounded border border-border accent-brand"
                />
                <span>{legacyToggleLabel}</span>
              </label>
            ) : null}
            <button
              type="button"
              onClick={onBrowse}
              className="rounded-input border border-transparent px-2 py-1 text-[11px] font-medium text-brand transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {copy.browse}
            </button>
          </div>
        </div>

        <div className="grid min-h-[250px] min-w-0 sm:grid-cols-[170px_minmax(0,1fr)]">
          <div className="min-w-0 border-b border-hairline bg-surface-2/60 sm:border-b-0 sm:border-r">
            <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-micro text-text-muted">
              {copy.families}
            </div>
            <div className="flex w-full min-w-0 max-w-full snap-x gap-2 overflow-x-auto overscroll-x-contain px-2 pb-2 [scrollbar-width:thin] sm:block sm:max-h-[390px] sm:space-y-1 sm:overflow-y-auto sm:pb-3">
              {filteredGroups.map((group) => {
                const active = group.id === activeFamily?.id;
                const firstIndex = engineIndexById.get(group.engines[0]?.id ?? '') ?? -1;
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => {
                      setActiveFamilyId(group.id);
                      if (firstIndex >= 0) onHighlight(firstIndex);
                    }}
                    className={clsx(
                      'flex min-w-[116px] snap-start items-center gap-2 rounded-input border px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-w-0 sm:w-full',
                      active
                        ? 'border-brand/25 bg-surface text-text-primary shadow-sm'
                        : 'border-transparent text-text-secondary hover:bg-surface'
                    )}
                    aria-pressed={active}
                  >
                    <EngineIcon engine={{ id: group.id, label: group.label, brandId: group.brandId }} size={24} className="shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-semibold">{group.label}</span>
                      <span className="block text-[9px] text-text-muted">{group.engines.length} models</span>
                    </span>
                    <ChevronRight aria-hidden="true" className={clsx('hidden h-3.5 w-3.5 sm:block', active ? 'text-brand' : 'text-text-muted')} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center justify-between gap-3 px-3 pb-1 pt-2">
              <p className="truncate text-[10px] font-semibold uppercase tracking-micro text-text-muted">
                {activeFamily?.label ?? copy.models}
              </p>
              {activeFamily ? (
                <span className="text-[10px] text-text-muted">{activeFamily.engines.length}</span>
              ) : null}
            </div>
            <ul
              className="max-h-[min(36vh,300px)] overflow-y-auto overscroll-contain px-2 pb-2 sm:max-h-[390px]"
              role="listbox"
              aria-labelledby={triggerId}
              aria-activedescendant={activeOptionId}
            >
              {activeFamily?.engines.map((engine) => {
                const index = engineIndexById.get(engine.id) ?? -1;
                const active = engine.id === selectedEngine.id;
                const highlighted = index === highlightedIndex;
                const meta = registryMeta?.meta.get(engine.id);
                const avgDurationLabel = formatAvgDuration(engine.avgDurationMs);
                const scoreLabel = formatEngineSelectScore(engineScores?.[engine.id]);
                const availability: EngineAvailability = meta?.availability ?? engine.availability ?? 'available';
                const disabledReason = disabledEngineReasons?.[engine.id];
                const disabled = availability === 'paused' || Boolean(disabledReason);
                const visibleModes = getModeDisplayOrder(engine.id, engine.modes).slice(0, 4);
                const hiddenModeCount = Math.max(0, engine.modes.length - visibleModes.length);
                return (
                  <li key={engine.id}>
                    <button
                      ref={(node) => {
                        if (index >= 0) onItemRef(index, node);
                      }}
                      type="button"
                      onClick={() => {
                        if (disabled) return;
                        onSelectEngine(engine.id);
                      }}
                      title={disabledReason}
                      onMouseEnter={() => {
                        if (index >= 0) onHighlight(index);
                      }}
                      onFocus={() => {
                        if (index >= 0) onHighlight(index);
                      }}
                      className={clsx(
                        'flex w-full items-start gap-2.5 rounded-input px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        'hover:bg-surface-2',
                        active && 'bg-surface-2',
                        highlighted && !active && 'bg-surface-2',
                        disabled && 'cursor-not-allowed opacity-60'
                      )}
                      role="option"
                      id={`${engine.id}-option`}
                      aria-selected={active}
                      aria-disabled={disabled}
                      disabled={disabled}
                      tabIndex={-1}
                    >
                      <EngineIcon engine={engine} size={28} className="mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-text-primary">
                              {meta?.marketingName ?? formatEngineShort(engine)}
                            </p>
                            <p className="truncate text-[10px] text-text-muted">
                              {engine.provider}
                              {meta?.versionLabel || engine.version ? ` - ${meta?.versionLabel ?? engine.version ?? ''}` : ''}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {scoreLabel ? <ScoreBadge value={scoreLabel} /> : null}
                            {active ? <Check aria-hidden="true" className="h-3.5 w-3.5 text-brand" /> : null}
                          </div>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[9px] text-text-muted">
                          <span
                            className="inline-flex items-center gap-1"
                            title={AVAILABILITY_LABELS[availability]}
                            aria-label={AVAILABILITY_LABELS[availability]}
                          >
                            <span className={clsx('h-1.5 w-1.5 rounded-full', AVAILABILITY_DOT_CLASS[availability])} />
                            {availability !== 'available' ? (
                              <span>{AVAILABILITY_LABELS[availability]}</span>
                            ) : null}
                          </span>
                          {avgDurationLabel ? <span>~{avgDurationLabel}</span> : null}
                          {engine.isLab ? <span>Lab</span> : null}
                          {engine.status ? <span className="uppercase tracking-micro">{engine.status}</span> : null}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {visibleModes.map((engineMode) => (
                            <span
                              key={engineMode}
                              className="rounded-[6px] border border-hairline bg-surface px-1 py-0.5 text-[8px] font-semibold uppercase tracking-normal text-text-muted"
                              title={engineMode}
                            >
                              {getCompactModeLabel(engineMode)}
                            </span>
                          ))}
                          {hiddenModeCount > 0 ? (
                            <span className="rounded-[6px] bg-surface-2 px-1 py-0.5 text-[8px] font-semibold text-text-muted">
                              +{hiddenModeCount}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>,
    portalElement
  );
}
