'use client';

import clsx from 'clsx';
import { createPortal } from 'react-dom';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FalEngineEntry } from '@/config/falEngines';
import type { EngineCaps, Mode, Resolution } from '@/types/engines';
import { Link } from '@/i18n/navigation';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { Card } from '@/components/ui/Card';
import { normalizeEngineId } from '@/lib/engine-alias';
import { DEFAULT_ENGINE_GUIDE } from '@/lib/engine-guides';
import { getExamplesHref } from '@/lib/examples-links';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { formatResolutionList } from '@/lib/resolution-labels';
import { DEFAULT_ENGINE_SELECT_COPY, type EngineSelectCopy } from './engine-select-copy';
import {
  compareEnginesByDefaultPriority,
  DEFAULT_MODE_OPTIONS,
  engineMatchesBrowseResolution,
  formatAvgDuration,
  getBrowseEngineResolutionValues,
  getBrowseResolutionOptions,
  getModeDisplayOrder,
  getModeLabel,
} from './engine-select-helpers';

interface BrowseEnginesModalProps {
  engines: EngineCaps[];
  selectedEngineId: string;
  onClose: () => void;
  onSelect: (engineId: string) => void;
  copy: EngineSelectCopy;
  modeLabelOverrides?: Partial<Record<Mode, string>>;
  engineMeta?: Map<string, FalEngineEntry>;
  showLegacy: boolean;
  onToggleLegacy: () => void;
}

type ModeFilter = 'all' | Mode;

export function BrowseEnginesModal({
  engines,
  selectedEngineId,
  onClose,
  onSelect,
  copy,
  modeLabelOverrides,
  engineMeta,
  showLegacy,
  onToggleLegacy,
}: BrowseEnginesModalProps) {
  const { locale } = useI18n();
  const modalCopy = copy.modal;
  const viewModelLabel = modalCopy.viewModel ?? DEFAULT_ENGINE_SELECT_COPY.modal.viewModel;
  const viewExamplesLabel = modalCopy.viewExamples ?? DEFAULT_ENGINE_SELECT_COPY.modal.viewExamples;
  const legacyToggleLabel =
    modalCopy.legacyToggleLabel ?? DEFAULT_ENGINE_SELECT_COPY.modal.legacyToggleLabel;
  const [portalElement, setPortalElement] = useState<HTMLDivElement | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');
  const [resolutionFilter, setResolutionFilter] = useState<'all' | Resolution>('all');

  useEffect(() => {
    const element = document.createElement('div');
    element.dataset.engineBrowsePortal = 'true';
    document.body.appendChild(element);
    setPortalElement(element);
    return () => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    };
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const legacyFilteredEngines = useMemo(() => {
    return engines.filter((engine) => {
      const meta = engineMeta?.get(engine.id);
      if (!meta?.isLegacy) return true;
      if (showLegacy) return true;
      return engine.id === selectedEngineId;
    });
  }, [engines, engineMeta, selectedEngineId, showLegacy]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const resolutions = useMemo<Resolution[]>(() => {
    return getBrowseResolutionOptions(legacyFilteredEngines);
  }, [legacyFilteredEngines]);

  const searchValue = searchTerm.trim().toLowerCase();

  const filteredEngines = useMemo(() => {
    const guides = copy.guides ?? DEFAULT_ENGINE_GUIDE;
    const ranked = legacyFilteredEngines
      .slice()
      .filter((engine) => {
        if (modeFilter !== 'all' && !engine.modes.includes(modeFilter)) return false;
        if (resolutionFilter !== 'all' && !engineMatchesBrowseResolution(engine, resolutionFilter)) return false;

        const meta = engineMeta?.get(engine.id);
        if (!searchValue) return true;
        const guide = guides[engine.id];
        const haystack = [
          meta?.marketingName ?? engine.label ?? engine.id,
          engine.provider,
          engine.version ?? '',
          guide?.description ?? '',
          ...(guide?.badges ?? []),
          meta?.seo.description ?? '',
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(searchValue);
      })
      .sort((a, b) => {
        const ranked = compareEnginesByDefaultPriority(a, b, null, engineMeta);
        if (ranked !== 0) return ranked;
        if (a.isLab !== b.isLab) return a.isLab ? 1 : -1;
        const aName = engineMeta?.get(a.id)?.marketingName ?? a.label ?? a.id;
        const bName = engineMeta?.get(b.id)?.marketingName ?? b.label ?? b.id;
        return aName.localeCompare(bName);
      });
    return ranked;
  }, [legacyFilteredEngines, modeFilter, resolutionFilter, searchValue, copy, engineMeta]);

  const handleBackdropClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  const FilterChip = ({
    active,
    onClick,
    children,
  }: {
    active: boolean;
    onClick: () => void;
    children: ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'rounded-input border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'border-brand bg-brand text-on-brand'
          : 'border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-2 hover:text-text-primary'
      )}
    >
      {children}
    </button>
  );

  if (!portalElement) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 px-4 py-6"
      role="dialog"
      aria-modal="true"
      onClick={handleBackdropClick}
    >
      <div className="relative flex max-h-[95vh] w-full max-w-6xl flex-col overflow-y-auto rounded-modal border border-border bg-surface shadow-float">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full border border-hairline bg-surface px-3 py-1 text-xs font-medium text-text-secondary transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {modalCopy.close}
        </button>
        <header className="border-b border-hairline bg-bg px-6 pb-5 pt-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-xl space-y-2">
              <h2 className="text-xl font-semibold text-text-primary">{modalCopy.title}</h2>
              <p className="text-sm text-text-secondary">{modalCopy.subtitle}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <a
                href="/docs/pricing"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-brand hover:underline"
              >
                {modalCopy.pricingLink}
              </a>
            </div>
          </div>
          <div className="mt-6 stack-gap-sm">
            <div className="relative">
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={modalCopy.searchPlaceholder}
                className="w-full rounded-input border border-border bg-surface px-3 py-3 text-sm text-text-primary shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterChip active={modeFilter === 'all'} onClick={() => setModeFilter('all')}>
                {modalCopy.modeAll}
              </FilterChip>
              {DEFAULT_MODE_OPTIONS.map((candidate) => (
                <FilterChip key={candidate} active={modeFilter === candidate} onClick={() => setModeFilter(candidate)}>
                  {modalCopy.modeValue.replace('{value}', candidate.toUpperCase())}
                </FilterChip>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterChip active={resolutionFilter === 'all'} onClick={() => setResolutionFilter('all')}>
                {modalCopy.resolutionAll}
              </FilterChip>
              {resolutions.map((resolution) => (
                <FilterChip
                  key={resolution}
                  active={resolutionFilter === resolution}
                  onClick={() => setResolutionFilter(resolution)}
                >
                  {resolution}
                </FilterChip>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterChip active={showLegacy} onClick={onToggleLegacy}>
                {legacyToggleLabel}
              </FilterChip>
            </div>
          </div>
        </header>
        <div className="bg-surface px-6 py-6">
          <div className="grid grid-gap-sm md:grid-cols-2">
            {filteredEngines.map((engine) => {
              const guide = (copy.guides ?? DEFAULT_ENGINE_GUIDE)[engine.id];
              const isSelected = engine.id === selectedEngineId;
              const badges = guide?.badges ?? [];
              const labsBadgeNeeded = engine.isLab && !badges.some((badge) => badge === 'Labs');
              const combinedBadges = labsBadgeNeeded ? [...badges, 'Labs'] : badges;
              const canonicalId = normalizeEngineId(engine.id) ?? engine.id;
              const meta = engineMeta?.get(canonicalId);
              const name = meta?.marketingName ?? engine.label ?? engine.id;
              const versionLabel = meta?.versionLabel ?? engine.version ?? '-';
              const description = guide?.description ?? meta?.seo.description ?? modalCopy.descriptionFallback;
              const avgDurationLabel = formatAvgDuration(engine.avgDurationMs);
              const modelSlug = meta?.modelSlug;
              const modelHref = modelSlug ? { pathname: '/models/[slug]', params: { slug: modelSlug } } : null;
              const allowExamples = meta?.category !== 'image' && meta?.type !== 'image';
              const examplesHref = modelSlug && allowExamples ? getExamplesHref(modelSlug) : null;
              const showModelLink = Boolean(modelHref);
              const showExamplesLink = Boolean(examplesHref);
              const browseResolutionValues = getBrowseEngineResolutionValues(engine);
              const browseResolutionLabel = formatResolutionList(engine.id, browseResolutionValues).join(' / ');

              return (
                <Card
                  key={engine.id}
                  className={clsx(
                    'flex cursor-pointer flex-col gap-4 overflow-hidden p-5 transition hover:border-text-muted hover:bg-surface-2 hover:shadow-float',
                    isSelected && 'border-brand bg-surface-2 shadow-float'
                  )}
                  onClick={() => onSelect(engine.id)}
                >
                  <div className="flex flex-1 flex-col gap-4">
                    <div className="flex items-start gap-4">
                      <EngineIcon engine={engine} size={44} className="shrink-0" />
                      <div className="flex flex-1 items-start justify-between gap-4">
                        <div className="space-y-1">
                          <h3 className="text-base font-semibold text-text-primary">{name}</h3>
                          <p className="text-xs uppercase tracking-micro text-text-muted">
                            {engine.provider} - {versionLabel}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 text-[11px] text-text-muted">
                          {avgDurationLabel && (
                            <span className="rounded-input border border-border px-2 py-0.5">
                              {copy.avgDuration.replace('{value}', avgDurationLabel)}
                            </span>
                          )}
                          {engine.status && (
                            <span className="rounded-input border border-border px-2 py-0.5 uppercase tracking-micro">
                              {engine.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm leading-6 text-text-secondary">{description}</p>
                    <div className="flex flex-wrap gap-2">
                      {combinedBadges.map((badge) => (
                        <span
                          key={badge}
                          className="inline-flex items-center rounded-full bg-bg px-3 py-1 text-[12px] font-medium text-text-secondary"
                        >
                          {badge}
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-text-muted">
                      <span>
                        Modes:{' '}
                        {getModeDisplayOrder(engine.id, engine.modes)
                          .map((entry) => getModeLabel(engine.id, entry, locale, modeLabelOverrides))
                          .join(' / ')}
                      </span>
                      <span>
                        Max {engine.maxDurationSec}s{browseResolutionLabel ? ` / Res ${browseResolutionLabel}` : ''}
                      </span>
                    </div>
                  </div>
                  {(showModelLink || showExamplesLink) && (
                    <div className="mt-auto -mx-5 -mb-5 border-t border-hairline">
                      <div className="flex text-xs font-semibold">
                        {modelHref && (
                          <Link
                            href={modelHref}
                            className={clsx(
                              'flex-1 px-4 py-2 text-center text-text-secondary transition hover:text-text-primary',
                              showExamplesLink ? 'border-r border-hairline' : null,
                              'bg-surface',
                              'hover:bg-surface-2'
                            )}
                            onClick={(event) => event.stopPropagation()}
                          >
                            {viewModelLabel}
                          </Link>
                        )}
                        {examplesHref && (
                          <Link
                            href={examplesHref}
                            className="flex-1 bg-surface px-4 py-2 text-center text-text-secondary transition hover:bg-surface-2 hover:text-text-primary"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {viewExamplesLabel}
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
            {!filteredEngines.length && (
              <div className="col-span-full rounded-input border border-dashed border-border bg-bg px-6 py-12 text-center text-sm text-text-muted">
                {modalCopy.empty}
              </div>
            )}
          </div>
          <p className="mt-6 text-center text-[11px] text-text-muted">{modalCopy.disclaimer}</p>
        </div>
      </div>
    </div>,
    portalElement
  );
}
