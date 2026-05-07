'use client';

import clsx from 'clsx';
import { createPortal } from 'react-dom';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useId
} from 'react';
import type { EngineAvailability, EngineCaps, Mode } from '@/types/engines';
import { Card } from './Card';
import { Chip } from './Chip';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { BrowseEnginesModal } from './engine-select/BrowseEnginesModal';
import { DEFAULT_ENGINE_SELECT_COPY, type EngineSelectCopy } from './engine-select/engine-select-copy';
import {
  compareEnginesByDefaultPriority,
  DEFAULT_MODE_OPTIONS,
  ENGINE_LEGACY_STORAGE_KEY,
  ENGINE_VARIANT_LABEL_OVERRIDES,
  ensureEngineRegistryMeta,
  formatAvgDuration,
  getCachedEngineRegistryMeta,
  getModeDisplayOrder,
  getModeLabel,
} from './engine-select/engine-select-helpers';
import type { DropdownPosition, EngineRegistryMeta, EngineSelectProps } from './engine-select/engine-select-types';

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
  const [registryMeta, setRegistryMeta] = useState<EngineRegistryMeta | null>(() => getCachedEngineRegistryMeta());
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<DropdownPosition | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [portalElement, setPortalElement] = useState<HTMLDivElement | null>(null);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [showLegacy, setShowLegacy] = useState(false);
  const [legacyHydrated, setLegacyHydrated] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const triggerId = useId();
  const legacyToggleId = useId();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(ENGINE_LEGACY_STORAGE_KEY);
      if (stored === 'true') {
        setShowLegacy(true);
      }
    } catch {
      // ignore storage failures
    } finally {
      setLegacyHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!legacyHydrated) return;
    try {
      window.localStorage.setItem(ENGINE_LEGACY_STORAGE_KEY, showLegacy ? 'true' : 'false');
    } catch {
      // ignore storage failures
    }
  }, [legacyHydrated, showLegacy]);

  const availableEngines = useMemo(() => {
    const sorted = engines.slice();
    sorted.sort((a, b) => compareEnginesByDefaultPriority(a, b, registryMeta));
    return sorted.filter((entry) => entry.availability !== 'paused');
  }, [engines, registryMeta]);

  const selectedEngine = useMemo(() => {
    const candidate = availableEngines.find((entry) => entry.id === engineId);
    return candidate ?? availableEngines[0] ?? engines[0];
  }, [availableEngines, engineId, engines]);

  const selectedMeta = useMemo(
    () => (selectedEngine ? registryMeta?.meta.get(selectedEngine.id) : undefined),
    [registryMeta, selectedEngine]
  );

  const visibleEngines = useMemo(() => {
    return availableEngines.filter((engine) => {
      const meta = registryMeta?.meta.get(engine.id);
      if (!meta?.isLegacy) return true;
      if (showLegacy) return true;
      return engine.id === selectedEngine?.id;
    });
  }, [availableEngines, registryMeta, selectedEngine, showLegacy]);
  const hasLegacyEngines = useMemo(
    () => availableEngines.some((engine) => Boolean(registryMeta?.meta.get(engine.id)?.isLegacy)),
    [availableEngines, registryMeta]
  );
  const legacyToggleLabel = copy.modal.legacyToggleLabel ?? DEFAULT_ENGINE_SELECT_COPY.modal.legacyToggleLabel;

  const variantEngines = useMemo(() => {
    if (!selectedEngine) return [];
    const selectedVariantGroup = selectedMeta?.surfaces.app.variantGroup;
    if (selectedVariantGroup) {
      return availableEngines.filter(
        (entry) => registryMeta?.meta.get(entry.id)?.surfaces.app.variantGroup === selectedVariantGroup
      );
    }
    return [];
  }, [availableEngines, registryMeta, selectedEngine, selectedMeta]);

  const showVariantSelector = variantEngines.length > 1;

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

  useEffect(() => {
    if (registryMeta) return;
    if (typeof window === 'undefined') return;
    let active = true;
    const timer = window.setTimeout(() => {
      ensureEngineRegistryMeta()
        .then((meta) => {
          if (active) setRegistryMeta(meta);
        })
        .catch(() => undefined);
    }, 1200);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [registryMeta]);

  useEffect(() => {
    if (registryMeta) return;
    if (!open && !browseOpen) return;
    let active = true;
    ensureEngineRegistryMeta()
      .then((meta) => {
        if (active) setRegistryMeta(meta);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [browseOpen, open, registryMeta]);

  useEffect(() => {
    const element = document.createElement('div');
    element.dataset.engineSelectPortal = 'true';
    document.body.appendChild(element);
    setPortalElement(element);
    return () => {
      try {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      } catch {}
    };
  }, []);

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

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 8,
      left: rect.left,
      width: rect.width
    });
  }, []);

  const toggleOpen = () => {
    setOpen((previous) => {
      const next = !previous;
      if (next) {
        updatePosition();
      } else {
        setHighlightedIndex(-1);
      }
      return next;
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();

    function handleResize() {
      updatePosition();
    }

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('scroll', handleResize, { passive: true, capture: true });
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    if (!visibleEngines.length) {
      setHighlightedIndex(-1);
      return;
    }
    const currentIndex = visibleEngines.findIndex((candidate) => candidate.id === selectedEngine?.id);
    setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
  }, [open, visibleEngines, selectedEngine]);

  useEffect(() => {
    if (!open) return;
    function handlePointer(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (contentRef.current?.contains(target)) return;
      setOpen(false);
      setHighlightedIndex(-1);
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        setHighlightedIndex(-1);
        triggerRef.current?.focus();
        return;
      }

      if (!visibleEngines.length) {
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightedIndex((previous) => {
          const next = previous + 1 >= visibleEngines.length ? 0 : previous + 1;
          return next;
        });
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightedIndex((previous) => {
          const next = previous - 1 < 0 ? visibleEngines.length - 1 : previous - 1;
          return next;
        });
      }

      if (event.key === 'Enter' || event.key === ' ') {
        if (highlightedIndex >= 0 && highlightedIndex < visibleEngines.length) {
          event.preventDefault();
          onEngineChange(visibleEngines[highlightedIndex].id);
          setOpen(false);
          setHighlightedIndex(-1);
          triggerRef.current?.focus();
        }
      }
    }

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('touchstart', handlePointer, { passive: true });
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('touchstart', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, engines, highlightedIndex, onEngineChange, visibleEngines]);

  useEffect(() => {
    if (!open) return;
    const item = itemRefs.current[highlightedIndex];
    item?.focus({ preventScroll: true });
    item?.scrollIntoView({ block: 'nearest' });
  }, [open, highlightedIndex]);

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        updatePosition();
      }
      setOpen(true);
    }
  };

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

          {open && portalElement && position &&
            createPortal(
              <div
                ref={contentRef}
                className="fixed z-[9999]"
                style={{ top: position.top, left: position.left, minWidth: Math.max(position.width, 280) }}
              >
                <div className="overflow-hidden rounded-card border border-border bg-surface shadow-float">
                  <div className="flex items-center justify-between gap-4 border-b border-hairline px-3 py-2 text-[12px] text-text-muted">
                    <span>Engines</span>
                    <div className="flex items-center gap-3">
                      {hasLegacyEngines ? (
                        <label
                          htmlFor={legacyToggleId}
                          className="inline-flex items-center gap-2 whitespace-nowrap text-[11px] font-medium text-text-secondary"
                        >
                          <input
                            id={legacyToggleId}
                            type="checkbox"
                            checked={showLegacy}
                            onChange={(event) => setShowLegacy(event.currentTarget.checked)}
                            className="h-4 w-4 rounded border border-border accent-brand"
                          />
                          <span>{legacyToggleLabel}</span>
                        </label>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          setHighlightedIndex(-1);
                          setBrowseOpen(true);
                        }}
                        className="rounded-input border border-transparent px-2 py-1 text-[11px] font-medium text-brand transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {copy.browse}
                      </button>
                    </div>
                  </div>
                  <ul
                    className="max-h-72 overflow-y-auto py-1"
                    role="listbox"
                    aria-labelledby={triggerId}
                    aria-activedescendant={activeOptionId}
                  >
                    {visibleEngines.map((engine, index) => {
                      const active = engine.id === selectedEngine.id;
                      const highlighted = index === highlightedIndex;
                      const meta = registryMeta?.meta.get(engine.id);
                      const avgDurationLabel = formatAvgDuration(engine.avgDurationMs);
                      const availability: EngineAvailability = meta?.availability ?? engine.availability ?? 'available';
                      const disabled = availability === 'paused';
                      return (
                        <li key={engine.id}>
                          <button
                            ref={(node) => {
                              itemRefs.current[index] = node;
                            }}
                            type="button"
                            onClick={() => {
                              if (disabled) return;
                              onEngineChange(engine.id);
                              setOpen(false);
                              setHighlightedIndex(-1);
                              triggerRef.current?.focus();
                            }}
                            onMouseEnter={() => setHighlightedIndex(index)}
                            onFocus={() => setHighlightedIndex(index)}
                            className={clsx(
                              'flex w-full items-start gap-4 px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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
                            <EngineIcon engine={engine} size={32} className="mt-0.5 shrink-0" />
                            <div className="flex min-w-0 flex-1 items-start justify-between gap-4">
                              <div className="min-w-0 space-y-1">
                                <p className="truncate text-sm font-medium text-text-primary">{meta?.marketingName ?? formatEngineShort(engine)}</p>
                                <p className="truncate text-[12px] text-text-muted">
                                  {engine.provider} - {meta?.versionLabel ?? engine.version ?? '-'}
                                </p>
                                <div className="flex flex-wrap gap-1 text-[10px]">
                                  {getModeDisplayOrder(engine.id, engine.modes).map((engineMode) => (
                                    <Chip key={engineMode} variant="outline" className="px-1.5 py-0.5 text-[10px]">
                                      {getModeLabel(engine.id, engineMode, locale, modeLabelOverrides)}
                                    </Chip>
                                  ))}
                                  {engine.isLab && (
                                    <Chip variant="ghost" className="px-1.5 py-0.5 text-[10px]">Lab</Chip>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1 text-[11px] text-text-muted">
                                {avgDurationLabel && <span>{copy.avgDuration.replace('{value}', avgDurationLabel)}</span>}
                                {engine.status && <span className="uppercase tracking-micro">{engine.status}</span>}
                              </div>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>,
              portalElement
            )}
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
