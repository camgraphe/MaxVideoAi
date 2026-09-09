'use client';

import clsx from 'clsx';
import { Check, ChevronRight, ExternalLink, Info, Search, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { EngineAvailability, EngineCaps } from '@/types/engines';
import { EngineIcon } from '@/components/ui/EngineIcon';
import type { EngineSelectCopy } from './engine-select-copy';
import {
  filterEngineFamilyGroups,
  getEngineSelectCatalogueSummary,
  normalizeEngineSelectQuery,
} from './engine-select-catalogue';
import {
  buildEngineFamilyGroups,
  formatAvgDuration,
  formatEngineSelectScore,
  getCompactModeLabel,
  getModeDisplayOrder,
} from './engine-select-helpers';
import type { DropdownPosition, EngineRegistryMeta } from './engine-select-types';

type EngineSelectDropdownProps = {
  title?: string;
  activeOptionId?: string;
  contentRef: RefObject<HTMLDivElement>;
  copy: EngineSelectCopy;
  engines: EngineCaps[];
  engineScores?: Record<string, number | null | undefined>;
  formatEngineShort: (engine: EngineCaps | null | undefined) => string;
  hasLegacyEngines: boolean;
  highlightedIndex: number;
  legacyToggleId: string;
  legacyToggleLabel: string;
  disabledEngineReasons?: Record<string, string>;
  onBrowse: () => void;
  onClose: () => void;
  onHighlight: (index: number) => void;
  onItemRef: (index: number, node: HTMLButtonElement | null) => void;
  onSelectEngine: (engineId: string) => void;
  onToggleLegacy: (checked: boolean) => void;
  portalElement: HTMLDivElement;
  position: DropdownPosition;
  registryMeta: EngineRegistryMeta | null;
  selectedEngine: EngineCaps;
  selectedIds?: string[];
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

export function getDropdownGeometry(position: DropdownPosition, viewport?: { width: number; height: number }) {
  if (!viewport && typeof window === 'undefined') {
    return {
      left: position.left,
      width: Math.max(position.width, 620),
      top: position.top,
      maxHeight: 560,
    };
  }
  const bounds = viewport ?? { width: window.innerWidth, height: window.innerHeight };
  const viewportPadding = 12;
  const width = Math.max(0, Math.min(bounds.width - viewportPadding * 2, Math.max(position.width, 620)));
  const maxHeight = Math.min(560, Math.max(0, bounds.height - viewportPadding * 2));
  const left = Math.max(viewportPadding, Math.min(position.left, bounds.width - width - viewportPadding));
  const top = Math.max(viewportPadding, Math.min(position.top, bounds.height - maxHeight - viewportPadding));
  return { left, width, top, maxHeight };
}

export function EngineSelectDropdown({
  title,
  contentRef,
  copy,
  engines,
  engineScores,
  formatEngineShort,
  hasLegacyEngines,
  highlightedIndex,
  legacyToggleId,
  legacyToggleLabel,
  disabledEngineReasons,
  onBrowse,
  onClose,
  onHighlight,
  onItemRef,
  onSelectEngine,
  onToggleLegacy,
  portalElement,
  position,
  registryMeta,
  selectedEngine,
  selectedIds,
  showLegacy,
  triggerId,
  visibleEngines,
}: EngineSelectDropdownProps) {
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const catalogueGroups = useMemo(
    () =>
      buildEngineFamilyGroups({
        engines,
        engineScores,
        registryMeta,
        showLegacy: true,
      }),
    [engineScores, engines, registryMeta]
  );
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
  const normalizedQuery = normalizeEngineSelectQuery(query);
  const filteredGroups = useMemo(
    () => filterEngineFamilyGroups({ groups: familyGroups, query, registryMeta }),
    [familyGroups, query, registryMeta]
  );
  const filteredCatalogueGroups = useMemo(
    () => filterEngineFamilyGroups({ groups: catalogueGroups, query, registryMeta }),
    [catalogueGroups, query, registryMeta]
  );
  const catalogueSummary = useMemo(
    () => getEngineSelectCatalogueSummary({ engines, visibleEngines, registryMeta }),
    [engines, registryMeta, visibleEngines]
  );
  const visibleEngineIds = useMemo(
    () => new Set(visibleEngines.map((engine) => engine.id)),
    [visibleEngines]
  );
  const matchingHiddenLegacyCount = normalizedQuery
    ? filteredCatalogueGroups
        .flatMap((group) => group.engines)
        .filter(
          (engine) =>
            !visibleEngineIds.has(engine.id) &&
            Boolean(registryMeta?.meta.get(engine.id)?.isLegacy),
        ).length
    : 0;
  const catalogueSummaryLabel = copy.catalogueSummary
    .replace('{visible}', String(catalogueSummary.visibleCount))
    .replace('{total}', String(catalogueSummary.totalCount))
    .replace('{families}', String(catalogueSummary.familyCount));
  const hiddenLegacyLabel = (
    catalogueSummary.hiddenLegacyCount === 1 ? copy.legacyHiddenOne : copy.legacyHiddenMany
  ).replace('{count}', String(catalogueSummary.hiddenLegacyCount));
  const emptySearchLabel = copy.emptySearch.replace('{query}', query.trim());
  const emptySearchLegacyLabel = (
    matchingHiddenLegacyCount === 1 ? copy.emptySearchLegacyOne : copy.emptySearchLegacyMany
  ).replace('{count}', String(matchingHiddenLegacyCount));

  const selectedFamilyId =
    filteredGroups.find((group) => group.engines.some((engine) => engine.id === selectedEngine.id))?.id ??
    filteredGroups[0]?.id ??
    '';
  const [activeFamilyId, setActiveFamilyId] = useState(selectedFamilyId);
  const activeFamily = filteredGroups.find((group) => group.id === activeFamilyId) ?? filteredGroups[0] ?? null;
  const highlightedEngine = highlightedIndex >= 0 ? visibleEngines[highlightedIndex] : null;
  const geometry = getDropdownGeometry(position);
  const tabbableEngineId = activeFamily?.engines.find((engine) => engine.id === highlightedEngine?.id && !disabledEngineReasons?.[engine.id])?.id
    ?? activeFamily?.engines.find((engine) => !disabledEngineReasons?.[engine.id])?.id;

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
      role="dialog"
      aria-label={title ?? copy.choose}
      style={{ top: geometry.top, left: geometry.left, width: geometry.width }}
    >
      <div style={{ height: geometry.maxHeight }} className="app-engine-browser flex flex-col overflow-hidden rounded-card border border-border bg-surface shadow-float">
        <div className="flex items-center justify-between border-b border-hairline px-3 py-1">
          <span className="text-base font-semibold text-text-primary">{title ?? copy.choose}<span className="ml-2 text-xs font-normal text-text-muted">{catalogueSummary.visibleCount} {copy.models.toLowerCase()}</span></span>
          <button type="button" onClick={onClose} className="inline-flex min-h-11 items-center gap-2 rounded-input px-2 text-xs font-medium text-text-primary hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring"><X className="h-4 w-4" aria-hidden />{copy.modal.close}</button>
        </div>
        <div className="flex flex-col gap-2 border-b border-hairline px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder={copy.searchPlaceholder}
              aria-label={copy.searchPlaceholder}
              className="h-11 w-full rounded-input border border-border bg-bg pl-8 pr-12 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-border-hover focus:ring-2 focus:ring-ring"
            />
            {query ? <button type="button" aria-label={copy.clearSearch} onClick={() => { setQuery(''); searchRef.current?.focus(); }} className="absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-input focus-visible:ring-2 focus-visible:ring-ring"><X className="h-4 w-4" aria-hidden /></button> : null}
          </div>
          <div className="flex flex-wrap shrink-0 items-center justify-between gap-2 text-[12px] text-text-muted sm:justify-end">
            {hasLegacyEngines ? (
              <label
                htmlFor={legacyToggleId}
                aria-describedby={`${legacyToggleId}-summary`}
                className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap text-xs font-medium text-text-secondary"
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
            <details className="app-engine-catalogue-details">
              <summary aria-label={catalogueSummaryLabel} className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-input focus-visible:ring-2 focus-visible:ring-ring"><Info className="h-4 w-4" aria-hidden /></summary>
              <div id={`${legacyToggleId}-summary`} className="app-engine-catalogue-note rounded-input border border-border bg-surface p-3 text-xs" role="status" aria-live="polite">
                <p>{catalogueSummaryLabel}</p>
                {catalogueSummary.hiddenLegacyCount > 0 ? <p>{hiddenLegacyLabel}</p> : null}
              </div>
            </details>
            <button
              type="button"
              onClick={onBrowse}
              className="grid min-h-11 min-w-11 place-items-center rounded-input border border-transparent px-2 py-1 text-xs font-medium text-brand transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ExternalLink className="h-4 w-4" aria-hidden /><span className="sr-only">{copy.browse}</span>
            </button>
          </div>
        </div>


        <div className="app-engine-browser-body grid min-h-0 min-w-0 flex-1 sm:grid-cols-[180px_minmax(0,1fr)]">
          <div className="min-h-0 min-w-0 overflow-hidden border-b border-hairline bg-surface-2/60 sm:border-b-0 sm:border-r">
            <div className="app-engine-families app-scroll-surface flex gap-1 overflow-x-auto px-2 pb-2 sm:block sm:h-full sm:space-y-1 sm:overflow-x-hidden sm:overflow-y-auto" aria-label={copy.families}>
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
                      'flex min-h-11 min-w-[130px] shrink-0 snap-start items-center gap-2 rounded-input border px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-w-0 sm:w-full',
                      active
                        ? 'border-brand/25 bg-brand-soft text-text-primary'
                        : 'border-transparent text-text-secondary hover:bg-surface'
                    )}
                    aria-pressed={active}
                  >
                    <EngineIcon engine={{ id: group.id, label: group.label, brandId: group.brandId }} size={24} className="shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-[12px] font-semibold leading-tight">{group.label}</span>
                    </span>
                    <ChevronRight aria-hidden="true" className={clsx('hidden h-3.5 w-3.5 sm:block', active ? 'text-brand' : 'text-text-muted')} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="app-scroll-surface min-h-0 min-w-0 overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between gap-3 px-3 pb-1 pt-2">
              <p className="min-w-0 break-words text-xs font-semibold uppercase leading-tight tracking-micro text-text-muted">
                {activeFamily?.label ?? copy.models}
              </p>
              {activeFamily ? (
                <span className="text-xs text-text-muted">{activeFamily.engines.length}</span>
              ) : null}
            </div>
            <ul
              className="px-2 pb-2"
              aria-labelledby={triggerId}
            >
              {activeFamily?.engines.map((engine) => {
                const index = engineIndexById.get(engine.id) ?? -1;
                const active = selectedIds ? selectedIds.includes(engine.id) : engine.id === selectedEngine.id;
                const highlighted = index === highlightedIndex;
                const meta = registryMeta?.meta.get(engine.id);
                const avgDurationLabel = formatAvgDuration(engine.avgDurationMs);
                const scoreLabel = formatEngineSelectScore(engineScores?.[engine.id]);
                const availability: EngineAvailability = meta?.availability ?? engine.availability ?? 'available';
                const disabledReason = disabledEngineReasons?.[engine.id];
                const disabled = availability === 'paused' || Boolean(disabledReason);
                const visibleModes = getModeDisplayOrder(engine.id, engine.modes);
                return (
                  <li key={engine.id} className="app-engine-row border-b border-hairline last:border-0">
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
                        'flex min-h-11 w-full items-center gap-2.5 rounded-input px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        'hover:bg-surface-2',
                        active && 'bg-surface-2',
                        highlighted && !active && 'bg-surface-2',
                        disabled && 'cursor-not-allowed opacity-60'
                      )}
                      data-engine-option="true"
                      id={`${engine.id}-option`}
                      aria-pressed={active}
                      aria-disabled={disabled}
                      disabled={disabled}
                      tabIndex={engine.id === tabbableEngineId ? 0 : -1}
                    >
                      <EngineIcon engine={engine} size={28} className="mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-semibold leading-tight text-text-primary">
                              {meta?.marketingName ?? formatEngineShort(engine)}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {meta?.surfaces.app.launchBadge === 'new' ? (
                              <span className="rounded-full bg-brand px-1.5 py-0.5 text-xs font-semibold text-[var(--on-brand)]">
                                {copy.badges.new}
                              </span>
                            ) : null}
                            {active ? <Check aria-hidden="true" className="h-3.5 w-3.5 text-brand" /> : null}
                          </div>
                        </div>
                        {disabledReason ? <p className="mt-1 text-xs text-text-secondary">{disabledReason}</p> : null}
                      </div>
                    </button>
                    <details className="app-engine-details px-3 pb-1">
                      <summary className="min-h-11 cursor-pointer content-center text-xs text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{copy.details}<span className="sr-only"> — {meta?.marketingName ?? engine.label}</span></summary>
                      <div className="space-y-2 pb-3 text-sm text-text-secondary">
                        <p>{engine.provider}{meta?.versionLabel || engine.version ? ` · ${meta?.versionLabel ?? engine.version}` : ''}</p>
                        <p>{AVAILABILITY_LABELS[availability]}{engine.isLab ? ' · Lab' : ''}{engine.status ? ` · ${engine.status}` : ''}</p>
                        {scoreLabel ? <p>{copy.score}: {scoreLabel}/10</p> : null}
                        {avgDurationLabel ? <p>{copy.avgDuration.replace('{value}', avgDurationLabel)}{engine.durationSource === 'completion_event' ? ` · ${copy.observedTiming}${engine.durationSampleCount ? ` (${engine.durationSampleCount})` : ''}` : ''}</p> : null}
                        <p>{visibleModes.map(getCompactModeLabel).join(' · ')}</p>
                      </div>
                    </details>
                  </li>
                );
              })}
              {!activeFamily && normalizedQuery ? (
                <li className="flex min-h-[180px] items-center justify-center px-6 py-8 text-center" role="status">
                  <div className="max-w-sm space-y-2">
                    <p className="text-sm font-medium text-text-primary">{emptySearchLabel}</p>
                    {matchingHiddenLegacyCount > 0 ? (
                      <p className="text-xs leading-relaxed text-text-secondary">{emptySearchLegacyLabel}</p>
                    ) : null}
                  </div>
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      </div>
    </div>,
    portalElement
  );
}
