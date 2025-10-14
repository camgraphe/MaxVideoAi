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
import { supabase } from '@/lib/supabaseClient';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { CURRENCY_LOCALE } from '@/lib/intl';
import { getModelByEngineId } from '@/lib/model-roster';

const MODE_LABELS: Record<Mode, string> = {
  t2v: 'Text → Video',
  i2v: 'Image → Video',
  v2v: 'Video → Video'
};

type EngineGuideEntry = {
  description: string;
  badges: string[];
};

const ENGINE_GUIDE: Record<string, EngineGuideEntry> = {
  'sora-2': {
    description:
      'Baseline Sora endpoints for text, image, or video remix with native audio. Reliable when you need cinematic motion with predictable pricing.',
    badges: ['🔊 Audio natif', '🎬 Cinématique', '🧠 Remix IA'],
  },
  'sora-2-pro': {
    description:
      'Pro tier unlocks 1080p output and higher throughput—ideal for hero shots or longer edits.',
    badges: ['🖥️ 1080p', '⚡ Débit pro', '🏆 Hero'],
  },
  veo3: {
    description:
      'Google Veo 3 delivers cinematic realism with lip-sync and robust camera control.',
    badges: ['🎥 Réalisme', '🔊 Audio', '🌆 Narratif'],
  },
  veo3fast: {
    description:
      'Fast queue Veo for previsualisation while keeping the Veo look and audio toggle.',
    badges: ['⚡ File rapide', '💰 Optimisé', '🔄 Préviz'],
  },
  kling25_turbo_pro: {
    description:
      'Stylised animation with guided camera moves—use it for motion boards and concept passes.',
    badges: ['🎯 Caméra', '🎞️ Animatique', '🧪 Turbo'],
  },
  lumaDM: {
    description:
      'Luma Dream Machine v1.5 handles photoreal product loops and lifestyle scenes with balanced detail.',
    badges: ['🧵 Photoréalisme', '🍽️ Tabletop', '🌍 Lifestyle'],
  },
  lumaRay2: {
    description:
      'Ray 2 pushes fidelity for flagship footage when you need premium detail from scratch.',
    badges: ['✨ Haute fidélité', '🏆 Flagship', '🪄 Ray'],
  },
  lumaRay2_flash: {
    description:
      'Flash mode keeps the Ray aesthetic with faster turnaround—perfect for look-dev.',
    badges: ['⚡ Flash', '🗒️ Storyboard', '💡 Look-dev'],
  },
  pika22: {
    description:
      'Fast social-first clips with caption overlays and Pikascenes motion controls.',
    badges: ['📱 Social', '🔤 Légendes', '🎞️ Motion rapide'],
  },
  minimax_video_01: {
    description:
      'MiniMax Video 01 uses camera tags to produce concept animations and Live2D-style motion.',
    badges: ['🎯 Tags caméra', '🧪 Concepts', '🎨 Live2D'],
  },
  minimax_hailuo_02_pro: {
    description:
      'Hailuo 02 Pro handles 1080p image-to-video hero renders when you have a strong reference.',
    badges: ['🖼️ I2V', '🖥️ 1080p', '🏅 Qualité'],
  },
  hunyuan_video: {
    description:
      'Tencent’s Hunyuan Video offers research-grade realism with a Pro mode switch.',
    badges: ['🔬 Recherche', '🌌 Réalisme', '⚙️ Mode Pro'],
  },
};


interface DropdownPosition {
  top: number;
  left: number;
  width: number;
}

export function EngineSelect({ engines, engineId, onEngineChange, mode, onModeChange }: EngineSelectProps) {
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
    return engines.filter((entry) => {
      const rosterEntry = getModelByEngineId(entry.id);
      return rosterEntry && rosterEntry.availability !== 'paused';
    });
  }, [engines]);

  const selectedEngine = useMemo(() => {
    const candidate = availableEngines.find((entry) => entry.id === engineId);
    return candidate ?? availableEngines[0] ?? engines[0];
  }, [availableEngines, engineId, engines]);

  const selectedRosterEntry = useMemo(() => (selectedEngine ? getModelByEngineId(selectedEngine.id) : undefined), [selectedEngine]);

  const visibleEngines = availableEngines;

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

      if (!engines.length) {
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightedIndex((previous) => {
          const next = previous + 1 >= engines.length ? 0 : previous + 1;
          return next;
        });
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightedIndex((previous) => {
          const next = previous - 1 < 0 ? engines.length - 1 : previous - 1;
          return next;
        });
      }

      if (event.key === 'Enter' || event.key === ' ') {
        if (highlightedIndex >= 0 && highlightedIndex < engines.length) {
          event.preventDefault();
          onEngineChange(engines[highlightedIndex].id);
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
  }, [open, engines, highlightedIndex, onEngineChange]);

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
              Latency {selectedEngine.latencyTier}
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
          <label className="text-[12px] uppercase tracking-micro text-text-muted">Choose engine</label>
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
                <p className="truncate font-medium">{formatEngineShort(selectedEngine)}</p>
                <p className="truncate text-[11px] text-text-muted">{selectedEngine.provider}</p>
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

          {selectedRosterEntry?.billingNote && (
            <p className="text-[11px] text-text-muted">{selectedRosterEntry.billingNote}</p>
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
                      Browse engines…
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
                      const rosterEntry = getModelByEngineId(engine.id);
                      const availability: EngineAvailability = rosterEntry?.availability ?? engine.availability ?? 'available';
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
                                <p className="truncate text-sm font-medium text-text-primary">{rosterEntry?.marketingName ?? formatEngineShort(engine)}</p>
                                <p className="truncate text-[12px] text-text-muted">
                                  {engine.provider} • {rosterEntry?.versionLabel ?? engine.version ?? '—'}
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
                                {engine.latencyTier && <span>Latency {engine.latencyTier}</span>}
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
            Browse engines…
          </button>
        </div>

        <div className="min-w-[200px] flex-1 space-y-3">
          <p className="text-[12px] uppercase tracking-micro text-text-muted">Input mode</p>
          <div className="flex flex-wrap gap-2">
            {(['t2v', 'i2v', 'v2v'] as Mode[]).map((candidate) => {
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
                  {MODE_LABELS[candidate]}
                </button>
              );
            })}
          </div>
        </div>
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
}

type ModeFilter = 'all' | Mode;

function BrowseEnginesModal({ engines, selectedEngineId, onClose, onSelect }: BrowseEnginesModalProps) {
  const [portalElement, setPortalElement] = useState<HTMLDivElement | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');
  const [resolutionFilter, setResolutionFilter] = useState<'all' | Resolution>('all');
  const [speedFilter, setSpeedFilter] = useState<'all' | string>('all');
  const [labsOnly, setLabsOnly] = useState(false);
  const [accountSummary, setAccountSummary] = useState<{ tier: string; balance: number; currency: string } | null>(null);

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

  useEffect(() => {
    let mounted = true;
    const loadAccount = async (token?: string | null) => {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      try {
        const [walletRes, memberRes] = await Promise.all([
          fetch('/api/wallet', { headers }).then((r) => r.json()),
          fetch('/api/member-status', { headers }).then((r) => r.json()),
        ]);
        if (!mounted) {
          return;
        }
        setAccountSummary({
          balance:
            typeof walletRes?.balance === 'number'
              ? walletRes.balance
              : Number(walletRes?.balance ?? 0),
          currency:
            typeof walletRes?.currency === 'string'
              ? walletRes.currency.toUpperCase()
              : 'USD',
          tier: typeof memberRes?.tier === 'string' ? memberRes.tier : 'Member',
        });
      } catch {
        if (mounted) {
          setAccountSummary((current) => current ?? { tier: 'Member', balance: 0, currency: 'USD' });
        }
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      void loadAccount(data.session?.access_token);
    });
    const { data: authSubscription } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadAccount(session?.access_token);
    });
    return () => {
      mounted = false;
      authSubscription?.subscription.unsubscribe();
    };
  }, []);

  const resolutions = useMemo<Resolution[]>(() => {
    const set = new Set<Resolution>();
    engines.forEach((engine) => {
      engine.resolutions?.forEach((resolution) => set.add(resolution));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [engines]);

  const speedOptions = useMemo(() => {
    const set = new Set<string>();
    engines.forEach((engine) => {
      if (engine.latencyTier) {
        set.add(engine.latencyTier);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [engines]);

  const searchValue = searchTerm.trim().toLowerCase();

  const filteredEngines = useMemo(() => {
    const ranked = engines
      .slice()
      .filter((engine) => {
        if (labsOnly && !engine.isLab) return false;
        if (modeFilter !== 'all' && !engine.modes.includes(modeFilter)) return false;
        if (resolutionFilter !== 'all' && !engine.resolutions.includes(resolutionFilter)) return false;
        if (speedFilter !== 'all' && engine.latencyTier !== speedFilter) return false;

        if (!searchValue) return true;
        const guide = ENGINE_GUIDE[engine.id];
        const haystack = [
          engine.label,
          engine.provider,
          engine.version ?? '',
          guide?.description ?? '',
          ...(guide?.badges ?? []),
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(searchValue);
      })
      .sort((a, b) => {
        if (a.isLab === b.isLab) {
          return a.label.localeCompare(b.label);
        }
        return a.isLab ? 1 : -1;
      });
    return ranked;
  }, [engines, labsOnly, modeFilter, resolutionFilter, speedFilter, searchValue]);

  const formattedBalance = useMemo(() => {
    if (!accountSummary) return null;
    const amount = accountSummary.balance ?? 0;
    const currency = accountSummary.currency ?? 'USD';
    try {
      return new Intl.NumberFormat(CURRENCY_LOCALE, { style: 'currency', currency }).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(2)}`;
    }
  }, [accountSummary]);

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
          Close
        </button>
        <header className="border-b border-hairline bg-bg/70 px-6 pb-5 pt-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-xl space-y-2">
              <h2 className="text-xl font-semibold text-text-primary">🟦 Choose the right engine for your shot</h2>
              <p className="text-sm text-text-secondary">
                Each model has its own strengths — some are fast, others cinematic or experimental. See what fits your project, then generate with confidence.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {accountSummary && (
                <Chip variant="outline" className="px-3 py-1 text-xs font-medium text-text-secondary">
                  Wallet {formattedBalance ?? '$0.00'} · {accountSummary.tier}
                </Chip>
              )}
              <a
                href="/docs/pricing"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-accent hover:underline"
              >
                How pricing works
              </a>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-text-muted">🔍</span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by engine, provider, or capability"
                className="w-full rounded-input border border-border bg-white py-3 pl-11 pr-4 text-sm text-text-primary shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterChip active={modeFilter === 'all'} onClick={() => setModeFilter('all')}>
                Mode · All
              </FilterChip>
              {(['t2v', 'i2v', 'v2v'] as Mode[]).map((candidate) => (
                <FilterChip key={candidate} active={modeFilter === candidate} onClick={() => setModeFilter(candidate)}>
                  Mode · {candidate.toUpperCase()}
                </FilterChip>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterChip active={resolutionFilter === 'all'} onClick={() => setResolutionFilter('all')}>
                Resolution · All
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
              <FilterChip active={speedFilter === 'all'} onClick={() => setSpeedFilter('all')}>
                Speed · All
              </FilterChip>
              {speedOptions.map((speed) => (
                <FilterChip key={speed} active={speedFilter === speed} onClick={() => setSpeedFilter(speed)}>
                  Speed · {speed}
                </FilterChip>
              ))}
              <FilterChip active={labsOnly} onClick={() => setLabsOnly((previous) => !previous)}>
                {labsOnly ? 'Labs · On' : 'Labs · Off'}
              </FilterChip>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto bg-white px-6 py-6">
          <div className="grid gap-4 md:grid-cols-2">
            {filteredEngines.map((engine) => {
              const guide = ENGINE_GUIDE[engine.id];
              const isSelected = engine.id === selectedEngineId;
              const badges = guide?.badges ?? [];
              const labsBadgeNeeded = engine.isLab && !badges.some((badge) => badge.includes('🧪'));
              const combinedBadges = labsBadgeNeeded ? [...badges, '🧪 Labs'] : badges;

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
                        <h3 className="text-base font-semibold text-text-primary">{engine.label}</h3>
                        <p className="text-xs uppercase tracking-micro text-text-muted">
                          {engine.provider} • {engine.version ?? '—'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 text-[11px] text-text-muted">
                        {engine.latencyTier && <span className="rounded-input border border-border px-2 py-0.5">{engine.latencyTier}</span>}
                        {engine.status && <span className="rounded-input border border-border px-2 py-0.5 uppercase tracking-micro">{engine.status}</span>}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm leading-6 text-text-secondary">
                    {guide?.description ??
                      'Versatile engine ready for price-before-you-generate workflows. Review specs and run with confidence.'}
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
                      Modes: {engine.modes.map((entry) => entry.toUpperCase()).join(' · ')}
                    </span>
                    <span>
                      Max {engine.maxDurationSec}s · Res {engine.resolutions.join(' / ')}
                    </span>
                  </div>
                </Card>
              );
            })}
            {!filteredEngines.length && (
              <div className="col-span-full rounded-input border border-dashed border-border bg-bg/50 px-6 py-12 text-center text-sm text-text-muted">
                No engines match your filters yet. Adjust the filters or clear the search to explore the full catalogue.
              </div>
            )}
          </div>
          <p className="mt-6 text-center text-[11px] text-text-muted">
            Logos are used for descriptive purposes only. Trademarks belong to their respective owners.
          </p>
        </div>
      </div>
    </div>,
    portalElement
  );
}
