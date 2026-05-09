'use client';

import clsx from 'clsx';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useId
} from 'react';
import type { EngineCaps, Mode } from '@/types/engines';
import { Card } from './Card';
import { Chip } from './Chip';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { BrowseEnginesModal } from './engine-select/BrowseEnginesModal';
import { EngineSelectDropdown } from './engine-select/EngineSelectDropdown';
import { DEFAULT_ENGINE_SELECT_COPY, type EngineSelectCopy } from './engine-select/engine-select-copy';
import {
  DEFAULT_MODE_OPTIONS,
  ENGINE_VARIANT_LABEL_OVERRIDES,
  formatAvgDuration,
  getModeLabel,
} from './engine-select/engine-select-helpers';
import { useEngineSelectDropdownState } from './engine-select/useEngineSelectDropdownState';
import { useEngineSelectRegistry } from './engine-select/useEngineSelectRegistry';
import type { EngineSelectProps } from './engine-select/engine-select-types';

export function EngineSelect({
  engines,
  engineId,
  onEngineChange,
  mode,
  onModeChange,
  modeOptions,
  showBillingNote = true,
  modeLabelOverrides,
  showModeSelect = true,
  modeLayout = 'inline',
  variant = 'card',
  density = 'default',
  className,
}: EngineSelectProps) {
  const { t, locale } = useI18n();
  const copy = t('workspace.generate.engineSelect', DEFAULT_ENGINE_SELECT_COPY) as EngineSelectCopy;
  const [open, setOpen] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);

  const triggerId = useId();
  const legacyToggleId = useId();

  const {
    hasLegacyEngines,
    registryMeta,
    selectedEngine,
    selectedMeta,
    setShowLegacy,
    showLegacy,
    showVariantSelector,
    variantEngines,
    visibleEngines,
  } = useEngineSelectRegistry({ browseOpen, engineId, engines, open });

  const formatEngineShort = useCallback((engine: EngineCaps | null | undefined) => {
    if (!engine) return '';
    return String(engine.id || engine.label || '').replace(/\s+/g, '').toUpperCase();
  }, []);

  const getVariantLabel = useCallback(
    (entry: EngineCaps) => {
      const override = registryMeta?.meta.get(entry.id)?.surfaces.app.variantLabel ?? ENGINE_VARIANT_LABEL_OVERRIDES[entry.id];
      if (override) return override;
      const meta = registryMeta?.meta.get(entry.id);
      return meta?.cardTitle ?? meta?.marketingName ?? entry.label ?? entry.id;
    },
    [registryMeta]
  );

  const legacyToggleLabel = copy.modal.legacyToggleLabel ?? DEFAULT_ENGINE_SELECT_COPY.modal.legacyToggleLabel;

  useEffect(() => {
    if (!selectedEngine) return;
    if (!selectedEngine.modes.includes(mode)) {
      onModeChange(selectedEngine.modes[0]);
    }
  }, [mode, onModeChange, selectedEngine]);

  const displayedModeOptions = useMemo(() => {
    const base = modeOptions && modeOptions.length ? modeOptions : DEFAULT_MODE_OPTIONS;
    const deduped: Mode[] = [];
    base.forEach((value) => {
      if (!deduped.includes(value)) {
        deduped.push(value);
      }
    });
    return deduped;
  }, [modeOptions]);

  const modeVariantOptions: Mode[] = [];

  const showModeVariantSelector = modeVariantOptions.length > 1;

  const {
    containerRef,
    contentRef,
    handleTriggerKeyDown,
    highlightedIndex,
    itemRefs,
    portalElement,
    position,
    setHighlightedIndex,
    toggleOpen,
    triggerRef,
  } = useEngineSelectDropdownState({
    onEngineChange,
    open,
    selectedEngineId: selectedEngine?.id,
    setOpen,
    visibleEngines,
  });

  if (!selectedEngine) {
    return null;
  }

  const isBarVariant = variant === 'bar';
  const isStackedMode = modeLayout === 'stacked';
  const isCompact = density === 'compact';
  const shouldShowModes = showModeSelect && displayedModeOptions.length > 0;

  const activeOptionId =
    highlightedIndex >= 0 && highlightedIndex < visibleEngines.length
      ? `${visibleEngines[highlightedIndex].id}-option`
      : undefined;

  itemRefs.current.length = visibleEngines.length;
  const selectedAvgDuration = formatAvgDuration(selectedEngine.avgDurationMs);

  const containerClassName = clsx(
    isBarVariant
      ? isStackedMode
        ? clsx('flex min-w-0 flex-col', isCompact ? 'gap-1.5' : 'gap-2')
        : clsx('flex min-w-0 flex-wrap items-center gap-2', isCompact ? 'sm:gap-3' : 'sm:gap-4')
      : 'relative stack-gap-lg p-5',
    className
  );

  const content = (
    <>
      {!isBarVariant && (
        <div className="flex items-center justify-between gap-4">
          <EngineIcon engine={selectedEngine} size={42} className="shrink-0" />
          <div className="hidden flex-col items-end gap-2 text-xs text-text-muted lg:flex">
            {selectedAvgDuration && (
              <Chip variant="ghost" className="text-[11px] lowercase first-letter:uppercase">
                {copy.avgDuration.replace('{value}', selectedAvgDuration)}
              </Chip>
            )}
            {selectedEngine.status && (
              <Chip variant="ghost" className="text-[11px] uppercase tracking-micro">
                {selectedEngine.status}
              </Chip>
            )}
          </div>
        </div>
      )}

      <div
        className={clsx(
          'flex flex-wrap',
          isBarVariant
            ? isStackedMode
              ? clsx('w-full items-start gap-2', isCompact ? 'sm:gap-3' : 'sm:gap-4')
              : clsx('flex-1 items-center gap-2', isCompact ? 'sm:gap-3' : 'sm:gap-4')
            : 'gap-6'
        )}
      >
        <div className={clsx('flex-1 min-w-0', isBarVariant ? (isCompact ? 'space-y-1' : 'space-y-1.5') : 'space-y-2 sm:min-w-[240px]')}>
          <label className={clsx('uppercase tracking-micro text-text-muted', isBarVariant ? 'text-[10px]' : 'text-[12px]')}>
            {copy.choose}
          </label>
          <div className={clsx('flex min-w-0 flex-col 2xl:flex-row 2xl:items-stretch', isCompact ? 'gap-1.5' : 'gap-2')}>
            <button
              id={triggerId}
              ref={triggerRef}
              type="button"
              onClick={toggleOpen}
              onKeyDown={handleTriggerKeyDown}
              className={clsx(
                'flex min-w-0 flex-1 items-center justify-between gap-4 rounded-input border border-border bg-surface text-left text-text-primary shadow-sm transition hover:border-border-hover hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isBarVariant ? 'px-2.5 py-1.5 text-[12px] sm:px-3 sm:py-2 sm:text-[13px]' : 'px-4 py-3 text-sm'
              )}
              aria-haspopup="listbox"
              aria-expanded={open}
            >
              <div className="flex min-w-0 items-center gap-4">
                <EngineIcon engine={selectedEngine} size={isBarVariant ? 24 : 32} className="shrink-0" />
                <div className="min-w-0">
                  <p className={clsx('truncate font-medium', isBarVariant ? 'text-[13px]' : '')}>
                    {selectedMeta?.marketingName ?? formatEngineShort(selectedEngine)}
                  </p>
                  <p className={clsx('truncate text-text-muted', isBarVariant ? 'text-[10px]' : 'text-[11px]')}>
                    {selectedEngine.provider}
                    {selectedMeta?.versionLabel || selectedEngine.version ? ` - ${selectedMeta?.versionLabel ?? selectedEngine.version ?? ''}` : ''}
                  </p>
                </div>
              </div>
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className={clsx('h-5 w-5 text-text-muted transition-transform', open && 'rotate-180')}
                fill="none"
              >
                <path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setBrowseOpen(true)}
              className={clsx(
                'min-w-0 rounded-input border border-border bg-surface font-medium text-brand transition hover:border-border-hover hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isBarVariant
                  ? 'w-full px-2.5 py-1.5 text-[11px] sm:px-3 sm:py-2 sm:text-[12px] 2xl:w-auto 2xl:max-w-[45%]'
                  : 'px-4 py-3 text-sm'
              )}
            >
              <span className="truncate">{copy.browse}</span>
            </button>
          </div>

          {showVariantSelector && (
            <div className={clsx(isBarVariant ? (isCompact ? 'space-y-0.5' : 'space-y-1') : 'space-y-2')}>
              <span className={clsx('uppercase tracking-micro text-text-muted', isBarVariant ? 'text-[10px]' : 'text-[11px]')}>
                {copy.variant}
              </span>
              <div className={clsx('flex flex-wrap', isCompact ? 'gap-1.5' : 'gap-2')}>
                {variantEngines.map((entry) => {
                  const active = entry.id === selectedEngine.id;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => onEngineChange(entry.id)}
                      className={clsx(
                        'rounded-pill border px-3 py-1 font-semibold uppercase tracking-micro transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                        isBarVariant ? 'text-[10px]' : 'text-[12px]',
                        active
                          ? 'border-brand bg-brand text-on-brand'
                          : 'border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-2'
                      )}
                    >
                      {getVariantLabel(entry)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {showModeVariantSelector && (
            <div className={clsx(isBarVariant ? (isCompact ? 'space-y-0.5' : 'space-y-1') : 'space-y-2')}>
              <span className={clsx('uppercase tracking-micro text-text-muted', isBarVariant ? 'text-[10px]' : 'text-[11px]')}>
                {copy.variant}
              </span>
              <div className={clsx('flex flex-wrap', isCompact ? 'gap-1.5' : 'gap-2')}>
                {modeVariantOptions.map((candidate) => {
                  const active = mode === candidate;
                  return (
                    <button
                      key={candidate}
                      type="button"
                      onClick={() => onModeChange(candidate)}
                      className={clsx(
                        'rounded-pill border px-3 py-1 font-semibold uppercase tracking-micro transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                        isBarVariant ? 'text-[10px]' : 'text-[12px]',
                        active
                          ? 'border-brand bg-brand text-on-brand'
                          : 'border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-2'
                      )}
                    >
                      {getModeLabel(selectedEngine?.id, candidate, locale, modeLabelOverrides)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {showBillingNote && selectedMeta?.billingNote && (
            <p className={clsx('text-text-muted', isBarVariant ? 'text-[10px]' : 'text-[11px]')}>
              {selectedMeta.billingNote}
            </p>
          )}

          {open && portalElement && position ? (
            <EngineSelectDropdown
              activeOptionId={activeOptionId}
              contentRef={contentRef}
              copy={copy}
              formatEngineShort={formatEngineShort}
              hasLegacyEngines={hasLegacyEngines}
              highlightedIndex={highlightedIndex}
              legacyToggleId={legacyToggleId}
              legacyToggleLabel={legacyToggleLabel}
              locale={locale}
              modeLabelOverrides={modeLabelOverrides}
              onBrowse={() => {
                setOpen(false);
                setHighlightedIndex(-1);
                setBrowseOpen(true);
              }}
              onHighlight={setHighlightedIndex}
              onItemRef={(index, node) => {
                itemRefs.current[index] = node;
              }}
              onSelectEngine={(nextEngineId) => {
                onEngineChange(nextEngineId);
                setOpen(false);
                setHighlightedIndex(-1);
                triggerRef.current?.focus();
              }}
              onToggleLegacy={setShowLegacy}
              portalElement={portalElement}
              position={position}
              registryMeta={registryMeta}
              selectedEngine={selectedEngine}
              showLegacy={showLegacy}
              triggerId={triggerId}
              visibleEngines={visibleEngines}
            />
          ) : null}
        </div>

        {shouldShowModes ? (
          <div
            className={clsx(
              isBarVariant
                ? isStackedMode
                  ? 'w-full space-y-2'
                  : 'min-w-[200px] flex-1 space-y-2'
                : 'min-w-[200px] flex-1 stack-gap-sm'
            )}
          >
            <p className={clsx('uppercase tracking-micro text-text-muted', isBarVariant ? 'text-[10px]' : 'text-[12px]')}>
              {copy.inputMode}
            </p>
            <div className="flex flex-wrap gap-2">
              {displayedModeOptions.map((candidate) => {
                const supported = selectedEngine.modes.includes(candidate);
                return (
                  <button
                    key={candidate}
                    type="button"
                    onClick={() => supported && onModeChange(candidate)}
                    disabled={!supported}
                    title={!supported ? copy.unsupportedMode : undefined}
                    className={clsx(
                      'rounded-input border font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isBarVariant ? 'px-3 py-1.5 text-[12px]' : 'px-4 py-2 text-[13px]',
                      mode === candidate && supported
                        ? 'border-brand bg-brand text-on-brand'
                        : supported
                          ? 'border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-2'
                          : 'cursor-not-allowed border-border bg-surface text-text-muted/60'
                    )}
                  >
                    {getModeLabel(selectedEngine?.id, candidate, locale, modeLabelOverrides)}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
      {browseOpen && (
        <BrowseEnginesModal
          engines={engines}
          selectedEngineId={selectedEngine.id}
          onClose={() => setBrowseOpen(false)}
          onSelect={(engineToSelect) => {
            onEngineChange(engineToSelect);
            setBrowseOpen(false);
          }}
          copy={copy}
          modeLabelOverrides={modeLabelOverrides}
          engineMeta={registryMeta?.meta}
          showLegacy={showLegacy}
          onToggleLegacy={() => setShowLegacy((previous) => !previous)}
        />
      )}
    </>
  );

  if (isBarVariant) {
    return (
      <div ref={containerRef} className={containerClassName}>
        {content}
      </div>
    );
  }

  return (
    <Card ref={containerRef} className={containerClassName}>
      {content}
    </Card>
  );
}
