'use client';

import clsx from 'clsx';
import { createPortal } from 'react-dom';
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useId
} from 'react';
import type { EngineAvailability, EngineCaps, Mode, Resolution } from '@/types/engines';
import { Card } from './Card';
import { Chip } from './Chip';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { listFalEngines, type FalEngineEntry } from '@/config/falEngines';
import { useI18n } from '@/lib/i18n/I18nProvider';

const MODE_LABELS: Record<Mode, string> = {
  t2v: 'Text -> Video',
  i2v: 'Image -> Video',
  t2i: 'Text -> Image',
  i2i: 'Image -> Image',
};

const ENGINE_REGISTRY: FalEngineEntry[] = listFalEngines();
const ENGINE_ORDER = new Map<string, number>(ENGINE_REGISTRY.map((entry, index) => [entry.id, index]));
const ENGINE_META = new Map<string, FalEngineEntry>(ENGINE_REGISTRY.map((entry) => [entry.id, entry]));

const SORA_ENGINE_IDS = ['sora-2', 'sora-2-pro'] as const;
const SORA_ENGINE_SET = new Set<string>(SORA_ENGINE_IDS);

type EngineGuideEntry = {
  description: string;
  badges: string[];
};

const DEFAULT_MODE_OPTIONS: Mode[] = ['t2v', 'i2v'];

interface EngineSelectProps {
  engines: EngineCaps[];
  engineId: string;
  onEngineChange: (engineId: string) => void;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  modeOptions?: Mode[];
  modeLabelOverrides?: Partial<Record<Mode, string>>;
}

const ENGINE_GUIDE: Record<string, EngineGuideEntry> = {
  'pika-text-to-video': {
    description:
      'Pika 2.2 Text to Video delivers stylized motion graphics fast - perfect for social teasers and product explainers.',
    badges: ['Fast queue', 'Social ready', 'Prompt friendly'],
  },
  'pika-image-to-video': {
    description:
      'Start from a still frame and let Pika animate it with smooth camera moves.',
    badges: ['Image input', 'Camera moves', 'Loop ready'],
  },
  'sora-2': {
    description:
      'OpenAI Sora 2 handles cinematic narratives with lip-sync and audio - ideal for hero renders.',
    badges: ['Audio native', 'Cinematic', 'Remix'],
  },
  'sora-2-pro': {
    description:
      'Sora 2 Pro unlocks higher resolutions, synced dialogue, and image-to-video control for top-tier productions.',
    badges: ['1080p', 'Audio native', 'Lip-sync'],
  },
  'veo-3-1': {
    description:
      'Veo 3.1 reference-to-video keeps subject fidelity across shots thanks to multi-image conditioning.',
    badges: ['Multi reference', 'Audio option', 'High fidelity'],
  },
  'veo-3-fast': {
    description:
      'Fast Veo 3 is tuned for quick iterations while keeping the Google Veo look.',
    badges: ['Fast queue', 'Storyboard', 'Audio option'],
  },
  'veo-3-1-fast': {
    description:
      'Bridge a starting and ending frame in eight seconds - great for transitions or product hero sweeps.',
    badges: ['First/last frame', 'Eight seconds', 'Audio option'],
  },
  'minimax-hailuo-02-text': {
    description:
      'Hailuo 02 Standard (T2V) shines on stylized storytelling with prompt optimizer support.',
    badges: ['Prompt optimizer', 'Six to ten seconds', 'Stylized'],
  },
  'minimax-hailuo-02-image': {
    description:
      'Use MiniMax Hailuo 02 with reference images for sharp motion control at 768P.',
    badges: ['Image input', 'End frame', '768P'],
  },
};

const DEFAULT_ENGINE_SELECT_COPY = {
  latency: 'Latency {tier}',
  choose: 'Choose engine',
  variant: 'Variant',
  browse: 'Browse engines...',
  inputMode: 'Input mode',
  modal: {
    close: 'Close',
    title: 'Choose the right engine for your shot',
    subtitle:
      'Each model has its own strengths - some are fast, others cinematic or experimental. See what fits your project, then generate with confidence.',
    pricingLink: 'How pricing works',
    searchPlaceholder: 'Search by engine, provider, or capability',
    modeAll: 'Mode: All',
    modeValue: 'Mode: {value}',
    resolutionAll: 'Resolution: All',
    empty:
      'No engines match your filters yet. Adjust the filters or clear the search to explore the full catalogue.',
    disclaimer: 'Logos are used for descriptive purposes only. Trademarks belong to their respective owners.',
    descriptionFallback:
      'Versatile engine ready for price-before-you-generate workflows. Review specs and run with confidence.',
  },
} as const;

type EngineSelectCopy = typeof DEFAULT_ENGINE_SELECT_COPY;


interface DropdownPosition {
  top: number;
  left: number;
  width: number;
}

export function EngineSelect({
  engines,
  engineId,
  onEngineChange,
  mode,
  onModeChange,
  modeOptions,
  modeLabelOverrides,
}: EngineSelectProps) {
  const { t } = useI18n();
  const copy = t('workspace.generate.engineSelect', DEFAULT_ENGINE_SELECT_COPY) as EngineSelectCopy;
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<DropdownPosition | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [portalElement, setPortalElement] = useState<HTMLDivElement | null>(null);
  const [browseOpen, setBrowseOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const triggerId = useId();

  const availableEngines = useMemo(() => {
    const sorted = engines.slice().sort((a, b) => {
      const orderA = ENGINE_ORDER.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const orderB = ENGINE_ORDER.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    });
    return sorted.filter((entry) => {
      const meta = ENGINE_META.get(entry.id);
      return meta && meta.availability !== 'paused';
    });
  }, [engines]);

  const selectedEngine = useMemo(() => {
    const candidate = availableEngines.find((entry) => entry.id === engineId);
    return candidate ?? availableEngines[0] ?? engines[0];
  }, [availableEngines, engineId, engines]);

  const selectedMeta = useMemo(() => (selectedEngine ? ENGINE_META.get(selectedEngine.id) : undefined), [selectedEngine]);

  const visibleEngines = availableEngines;

  const soraVariantEngines = useMemo(
    () => availableEngines.filter((entry) => SORA_ENGINE_SET.has(entry.id)),
    [availableEngines]
  );
  const isSoraSelection = SORA_ENGINE_SET.has(selectedEngine.id);

  const formatEngineShort = useCallback((engine: EngineCaps | null | undefined) => {
    if (!engine) return '';
    return String(engine.id || engine.label || '').replace(/\s+/g, '').toUpperCase();
  }, []);

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

  const resolveModeLabel = useCallback(
    (value: Mode) => modeLabelOverrides?.[value] ?? MODE_LABELS[value] ?? value.toUpperCase(),
    [modeLabelOverrides]
  );

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

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);
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
    document.addEventListener('touchstart', handlePointer);
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

  const activeOptionId =
    highlightedIndex >= 0 && highlightedIndex < visibleEngines.length
      ? `${visibleEngines[highlightedIndex].id}-option`
      : undefined;

  itemRefs.current.length = visibleEngines.length;

  return (
    <Card ref={containerRef} className="relative space-y-5 p-5">
      <div className="flex items-center justify-between gap-4">
        <EngineIcon engine={selectedEngine} size={42} className="shrink-0" />
        <div className="hidden flex-col items-end gap-2 text-xs text-text-muted lg:flex">
          {selectedEngine.latencyTier && (
            <Chip variant="ghost" className="text-[11px] lowercase first-letter:uppercase">
              {copy.latency.replace('{tier}', selectedEngine.latencyTier)}
            </Chip>
          )}
          {selectedEngine.status && (
            <Chip variant="ghost" className="text-[11px] uppercase tracking-micro">
              {selectedEngine.status}
            </Chip>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-5">
        <div className="min-w-[240px] flex-1 space-y-2">
          <label className="text-[12px] uppercase tracking-micro text-text-muted">{copy.choose}</label>
          <button
            id={triggerId}
            ref={triggerRef}
            type="button"
            onClick={toggleOpen}
            onKeyDown={handleTriggerKeyDown}
            className="flex w-full items-center justify-between gap-3 rounded-input border border-hairline bg-white px-4 py-3 text-left text-sm text-text-primary shadow-sm transition hover:border-accentSoft/50 hover:bg-accentSoft/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            <div className="flex min-w-0 items-center gap-3">
              <EngineIcon engine={selectedEngine} size={32} className="shrink-0" />
              <div className="min-w-0">
                <p className="truncate font-medium">{selectedMeta?.marketingName ?? formatEngineShort(selectedEngine)}</p>
                <p className="truncate text-[11px] text-text-muted">
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

          {isSoraSelection && soraVariantEngines.length > 1 && (
            <div className="space-y-2">
              <span className="text-[11px] uppercase tracking-micro text-text-muted">{copy.variant}</span>
              <div className="flex flex-wrap gap-2">
                {soraVariantEngines.map((entry) => {
                  const active = entry.id === selectedEngine.id;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => onEngineChange(entry.id)}
                      className={clsx(
                        'rounded-pill border px-3 py-1 text-[12px] font-semibold uppercase tracking-micro transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                        active
                          ? 'border-accent bg-accent text-white'
                          : 'border-hairline bg-white text-text-secondary hover:border-accentSoft/50 hover:bg-accentSoft/10'
                      )}
                    >
                      {ENGINE_META.get(entry.id)?.marketingName ?? entry.label ?? entry.id}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selectedMeta?.billingNote && (
            <p className="text-[11px] text-text-muted">{selectedMeta.billingNote}</p>
          )}

          {open && portalElement && position &&
            createPortal(
              <div
                ref={contentRef}
                className="fixed z-[9999]"
                style={{ top: position.top, left: position.left, minWidth: Math.max(position.width, 280) }}
              >
                <div className="overflow-hidden rounded-card border border-border bg-white shadow-float">
                  <div className="flex items-center justify-between gap-3 border-b border-hairline px-3 py-2 text-[12px] text-text-muted">
                    <span>Engines</span>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        setHighlightedIndex(-1);
                        setBrowseOpen(true);
                      }}
                      className="rounded-input border border-transparent px-2 py-1 text-[11px] font-medium text-accent transition hover:bg-accentSoft/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {copy.browse}
                    </button>
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
                      const meta = ENGINE_META.get(engine.id);
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
                              'flex w-full items-start gap-3 px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              'hover:bg-accentSoft/10',
                              active && 'bg-accentSoft/15',
                              highlighted && !active && 'bg-accentSoft/10',
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
                            <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                              <div className="min-w-0 space-y-1">
                                <p className="truncate text-sm font-medium text-text-primary">{meta?.marketingName ?? formatEngineShort(engine)}</p>
                                <p className="truncate text-[12px] text-text-muted">
                                  {engine.provider} - {meta?.versionLabel ?? engine.version ?? '-'}
                                </p>
                                <div className="flex flex-wrap gap-1.5 text-[11px]">
                                  {engine.modes.map((engineMode) => (
                                    <Chip key={engineMode} variant="outline" className="px-2 py-0.5 text-[11px]">
                                      {engineMode.toUpperCase()}
                                    </Chip>
                                  ))}
                                  {engine.isLab && (
                                    <Chip variant="ghost" className="px-2 py-0.5 text-[11px]">Lab</Chip>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1 text-[11px] text-text-muted">
                                {engine.latencyTier && <span>{copy.latency.replace('{tier}', engine.latencyTier)}</span>}
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
          <button
            type="button"
            onClick={() => setBrowseOpen(true)}
            className="w-full rounded-input border border-hairline bg-white px-4 py-2 text-sm font-medium text-accent transition hover:border-accentSoft/50 hover:bg-accentSoft/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {copy.browse}
          </button>
        </div>

        {displayedModeOptions.length ? (
          <div className="min-w-[200px] flex-1 space-y-3">
            <p className="text-[12px] uppercase tracking-micro text-text-muted">{copy.inputMode}</p>
            <div className="flex flex-wrap gap-2">
              {displayedModeOptions.map((candidate) => {
                const supported = selectedEngine.modes.includes(candidate);
                return (
                  <button
                    key={candidate}
                    type="button"
                    onClick={() => supported && onModeChange(candidate)}
                    disabled={!supported}
                    className={clsx(
                      'rounded-input border px-4 py-2 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      mode === candidate && supported
                        ? 'border-accent bg-accent text-white'
                        : supported
                          ? 'border-hairline bg-white text-text-secondary hover:border-accentSoft/50 hover:bg-accentSoft/10'
                          : 'cursor-not-allowed border-hairline bg-white text-text-muted/60'
                    )}
                  >
                    {resolveModeLabel(candidate)}
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
        />
      )}
    </Card>
  );
}

interface BrowseEnginesModalProps {
  engines: EngineCaps[];
  selectedEngineId: string;
  onClose: () => void;
  onSelect: (engineId: string) => void;
  copy: EngineSelectCopy;
}

type ModeFilter = 'all' | Mode;

function BrowseEnginesModal({ engines, selectedEngineId, onClose, onSelect, copy }: BrowseEnginesModalProps) {
  const modalCopy = copy.modal;
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
    const set = new Set<Resolution>();
    engines.forEach((engine) => {
      engine.resolutions?.forEach((resolution) => set.add(resolution));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [engines]);

  const searchValue = searchTerm.trim().toLowerCase();

  const filteredEngines = useMemo(() => {
    const priorityOrder = [
      'sora-2',
      'sora-2-pro',
      'veo-3-1',
      'veo-3-fast',
      'veo-3-1-fast',
      'pika-text-to-video',
      'pika-image-to-video',
      'minimax-hailuo-02-text',
      'minimax-hailuo-02-image',
    ];
    const priorityIndex = new Map(priorityOrder.map((id, index) => [id, index]));
    const ranked = engines
      .slice()
      .filter((engine) => {
        if (modeFilter !== 'all' && !engine.modes.includes(modeFilter)) return false;
        if (resolutionFilter !== 'all' && !engine.resolutions.includes(resolutionFilter)) return false;

        const meta = ENGINE_META.get(engine.id);
        if (!searchValue) return true;
        const guide = ENGINE_GUIDE[engine.id];
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
        const aPriority = priorityIndex.has(a.id) ? priorityIndex.get(a.id)! : Number.MAX_SAFE_INTEGER;
        const bPriority = priorityIndex.has(b.id) ? priorityIndex.get(b.id)! : Number.MAX_SAFE_INTEGER;
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }
        if (a.isLab === b.isLab) {
          const aName = ENGINE_META.get(a.id)?.marketingName ?? a.label ?? a.id;
          const bName = ENGINE_META.get(b.id)?.marketingName ?? b.label ?? b.id;
          return aName.localeCompare(bName);
        }
        return a.isLab ? 1 : -1;
      });
    return ranked;
  }, [engines, modeFilter, resolutionFilter, searchValue]);

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
          ? 'border-accent bg-accent text-white'
          : 'border-hairline bg-white text-text-secondary hover:border-accentSoft/50 hover:bg-accentSoft/10 hover:text-text-primary'
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
      <div className="relative flex h-full max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-[24px] border border-border bg-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full border border-hairline bg-white/80 px-3 py-1 text-xs font-medium text-text-secondary transition hover:bg-accentSoft/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {modalCopy.close}
        </button>
        <header className="border-b border-hairline bg-bg/70 px-6 pb-5 pt-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-xl space-y-2">
              <h2 className="text-xl font-semibold text-text-primary">{modalCopy.title}</h2>
              <p className="text-sm text-text-secondary">
                {modalCopy.subtitle}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <a
                href="/docs/pricing"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-accent hover:underline"
              >
                {modalCopy.pricingLink}
              </a>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            <div className="relative">
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={modalCopy.searchPlaceholder}
                className="w-full rounded-input border border-border bg-white px-3 py-3 text-sm text-text-primary shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterChip active={modeFilter === 'all'} onClick={() => setModeFilter('all')}>
                {modalCopy.modeAll}
              </FilterChip>
              {(['t2v', 'i2v'] as Mode[]).map((candidate) => (
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
          </div>
        </header>
        <div className="flex-1 overflow-y-auto bg-white px-6 py-6">
          <div className="grid gap-4 md:grid-cols-2">
            {filteredEngines.map((engine) => {
              const guide = ENGINE_GUIDE[engine.id];
              const isSelected = engine.id === selectedEngineId;
              const badges = guide?.badges ?? [];
              const labsBadgeNeeded = engine.isLab && !badges.some((badge) => badge === 'Labs');
              const combinedBadges = labsBadgeNeeded ? [...badges, 'Labs'] : badges;
              const meta = ENGINE_META.get(engine.id);
              const name = meta?.marketingName ?? engine.label ?? engine.id;
              const versionLabel = meta?.versionLabel ?? engine.version ?? '-';
              const description = guide?.description ?? meta?.seo.description ?? modalCopy.descriptionFallback;

              return (
                <Card
                  key={engine.id}
                  className={clsx(
                    'flex cursor-pointer flex-col gap-4 p-5 transition hover:border-accentSoft/60 hover:bg-accentSoft/10 hover:shadow-float',
                    isSelected && 'border-accent bg-accentSoft/15 shadow-float'
                  )}
                  onClick={() => onSelect(engine.id)}
                >
                  <div className="flex items-start gap-3">
                    <EngineIcon engine={engine} size={44} className="shrink-0" />
                    <div className="flex flex-1 items-start justify-between gap-3">
                      <div className="space-y-1">
                        <h3 className="text-base font-semibold text-text-primary">{name}</h3>
                        <p className="text-xs uppercase tracking-micro text-text-muted">
                          {engine.provider} - {versionLabel}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 text-[11px] text-text-muted">
                        {engine.latencyTier && <span className="rounded-input border border-border px-2 py-0.5">{engine.latencyTier}</span>}
                        {engine.status && <span className="rounded-input border border-border px-2 py-0.5 uppercase tracking-micro">{engine.status}</span>}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm leading-6 text-text-secondary">
                    {description}
                  </p>
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
                  <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
                    <span>
                      Modes: {engine.modes.map((entry) => entry.toUpperCase()).join(' / ')}
                    </span>
                    <span>
                      Max {engine.maxDurationSec}s / Res {engine.resolutions.join(' / ')}
                    </span>
                  </div>
                </Card>
              );
            })}
            {!filteredEngines.length && (
              <div className="col-span-full rounded-input border border-dashed border-border bg-bg/50 px-6 py-12 text-center text-sm text-text-muted">
                {modalCopy.empty}
              </div>
            )}
          </div>
          <p className="mt-6 text-center text-[11px] text-text-muted">
            {modalCopy.disclaimer}
          </p>
        </div>
      </div>
    </div>,
    portalElement
  );
}
