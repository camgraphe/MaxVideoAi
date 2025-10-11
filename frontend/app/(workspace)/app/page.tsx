'use client';

import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useEngines, useInfiniteJobs, runPreflight, runGenerate, getJobStatus } from '@/lib/api';
import { supabase } from '@/lib/supabaseClient';
import type { EngineCaps, EngineInputField, Mode, PreflightRequest, PreflightResponse } from '@/types/engines';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { EngineSelect } from '@/components/ui/EngineSelect';
import { SettingsControls } from '@/components/SettingsControls';
import { Composer, type ComposerAttachment, type AssetFieldConfig } from '@/components/Composer';
import { PreviewCard } from '@/components/PreviewCard';
import { QuadPreviewPanel, type QuadPreviewTile, type QuadTileAction, type QuadGroupAction } from '@/components/QuadPreviewPanel';
import { GalleryRail } from '@/components/GalleryRail';
import type { GroupSummary, GroupMemberSummary } from '@/types/groups';
import type { GroupedJobAction } from '@/components/GroupedJobCard';
import type { PriceFactorKind } from '@/components/PriceFactorsBar';
import { CURRENCY_LOCALE } from '@/lib/intl';
import { getRenderEta } from '@/lib/render-eta';
import { savePersistedGroupSummaries } from '@/lib/job-groups';

function resolveRenderThumb(render: { thumbUrl?: string | null; aspectRatio?: string | null }): string {
  if (render.thumbUrl) return render.thumbUrl;
  switch (render.aspectRatio) {
    case '9:16':
      return '/assets/frames/thumb-9x16.svg';
    case '1:1':
      return '/assets/frames/thumb-1x1.svg';
    default:
      return '/assets/frames/thumb-16x9.svg';
  }
}

type GroupCardAction = GroupedJobAction;

type ReferenceAsset = {
  fieldId: string;
  file: File;
  previewUrl: string;
  kind: 'image' | 'video';
  name: string;
  size: number;
  type: string;
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('File reading failed'));
    reader.readAsDataURL(file);
  });
}

type GenerateClientError = Error & {
  code?: string;
  details?: {
    requiredCents?: number;
    balanceCents?: number;
  };
};

function isInsufficientFundsError(error: unknown): error is GenerateClientError & { code: 'INSUFFICIENT_WALLET_FUNDS' } {
  return error instanceof Error && (error as GenerateClientError).code === 'INSUFFICIENT_WALLET_FUNDS';
}

function emitClientMetric(event: string, payload?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('mvai:analytics', { detail: { event, payload } }));
  } catch {
    // swallow errors if analytics transport is unavailable
  }
}

interface FormState {
  engineId: string;
  mode: Mode;
  durationSec: number;
  resolution: string;
  aspectRatio: string;
  fps: number;
  iterations: number;
  addons: {
    audio: boolean;
    upscale4k: boolean;
  };
  seedLocked?: boolean;
  openaiApiKey?: string;
}

const DEFAULT_PROMPT = 'A quiet cinematic shot of neon-lit Tokyo streets in the rain';
const STORAGE_KEYS = {
  prompt: 'maxvideoai.generate.prompt.v1',
  negativePrompt: 'maxvideoai.generate.negativePrompt.v1',
  form: 'maxvideoai.generate.form.v1',
  renders: 'maxvideoai.generate.renders.v1',
  batchHeroes: 'maxvideoai.generate.batchHeroes.v1',
  groupSummaries: 'maxvideoai.generate.groupSummaries.v1',
} as const;

const MAX_PERSISTED_RENDERS = 40;

function parseStoredForm(value: string): FormState | null {
  try {
    const raw = JSON.parse(value) as Partial<FormState> | null;
    if (!raw || typeof raw !== 'object') return null;

    const {
      engineId,
      mode,
      durationSec,
      resolution,
      aspectRatio,
      fps,
      iterations,
      addons,
      seedLocked,
      openaiApiKey,
    } = raw;

    if (
      typeof engineId !== 'string' ||
      typeof mode !== 'string' ||
      typeof durationSec !== 'number' ||
      typeof resolution !== 'string' ||
      typeof aspectRatio !== 'string' ||
      typeof fps !== 'number'
    ) {
      return null;
    }

    const safeAddons =
      addons && typeof addons === 'object'
        ? {
            audio: Boolean((addons as FormState['addons']).audio),
            upscale4k: Boolean((addons as FormState['addons']).upscale4k),
          }
        : { audio: false, upscale4k: false };

    return {
      engineId,
      mode: mode as Mode,
      durationSec,
      resolution,
      aspectRatio,
      fps,
      iterations: typeof iterations === 'number' && iterations > 0 ? iterations : 1,
      addons: safeAddons,
      seedLocked: typeof seedLocked === 'boolean' ? seedLocked : undefined,
      openaiApiKey: typeof openaiApiKey === 'string' ? openaiApiKey : undefined,
    };
  } catch {
    return null;
  }
}

const DEBOUNCE_MS = 200;
const FRIENDLY_MESSAGES = [
  'Warming up the camera…',
  'Stirring pixels gently…',
  'Brewing a fresh render…',
  'Setting the virtual stage…',
  'Letting ideas take shape…',
  'Polishing the lights…'
] as const;

export default function Page() {
  const { data, error: enginesError, isLoading } = useEngines();
  const engines = useMemo(() => data?.engines ?? [], [data]);
  const { data: latestJobsPages } = useInfiniteJobs(1);

  const [form, setForm] = useState<FormState | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = window.localStorage.getItem(STORAGE_KEYS.form);
    return stored ? parseStoredForm(stored) : null;
  });
  const [prompt, setPrompt] = useState<string>(() => {
    if (typeof window === 'undefined') return DEFAULT_PROMPT;
    const stored = window.localStorage.getItem(STORAGE_KEYS.prompt);
    return stored ?? DEFAULT_PROMPT;
  });
  const [negativePrompt, setNegativePrompt] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    const stored = window.localStorage.getItem(STORAGE_KEYS.negativePrompt);
    return stored ?? '';
  });
  const [preflight, setPreflight] = useState<PreflightResponse | null>(null);
  const [preflightError, setPreflightError] = useState<string | undefined>();
  const [isPricing, setPricing] = useState(false);
  const [memberTier, setMemberTier] = useState<'Member' | 'Plus' | 'Pro'>('Member');
  const [notice, setNotice] = useState<string | null>(null);
  const [topUpModal, setTopUpModal] = useState<{
    message: string;
    amountLabel?: string;
    shortfallCents?: number;
  } | null>(null);
  const [topUpAmount, setTopUpAmount] = useState<number>(500);
  const [isTopUpLoading, setIsTopUpLoading] = useState(false);
  const [topUpError, setTopUpError] = useState<string | null>(null);

type LocalRender = {
  localKey: string;
  batchId: string;
  iterationIndex: number;
  iterationCount: number;
    id: string;
    jobId?: string;
    engineId: string;
    engineLabel: string;
    createdAt: string;
    aspectRatio: string;
    durationSec: number;
    prompt: string;
    progress: number; // 0-100
    message: string;
    videoUrl?: string;
    thumbUrl?: string;
    priceCents?: number;
    currency?: string;
    pricingSnapshot?: PreflightResponse['pricing'];
    paymentStatus?: string;
    etaSeconds?: number;
    etaLabel?: string;
    startedAt: number;
  minReadyAt: number;
};

type LocalRenderGroup = {
  id: string;
  items: LocalRender[];
  iterationCount: number;
  readyCount: number;
  totalPriceCents: number | null;
  currency?: string;
};

  const [renders, setRenders] = useState<LocalRender[]>([]);
  const [selectedPreview, setSelectedPreview] = useState<{
    localKey?: string;
    batchId?: string;
    iterationIndex?: number;
    iterationCount?: number;
    id?: string;
    videoUrl?: string;
    aspectRatio?: string;
    thumbUrl?: string;
    progress?: number;
    message?: string;
    priceCents?: number;
    currency?: string;
    etaSeconds?: number;
    etaLabel?: string;
  } | null>(null);
  const [viewMode, setViewMode] = useState<'single' | 'quad'>('single');
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [batchHeroes, setBatchHeroes] = useState<Record<string, string>>({});
  const rendersRef = useRef<LocalRender[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storedRendersValue = window.localStorage.getItem(STORAGE_KEYS.renders);
      if (storedRendersValue) {
        const raw = JSON.parse(storedRendersValue);
        if (Array.isArray(raw)) {
          const storedRenders = raw
            .filter((value): value is LocalRender => {
              if (!value || typeof value !== 'object') return false;
              const candidate = value as Partial<LocalRender>;
              return (
                typeof candidate.localKey === 'string' &&
                typeof candidate.batchId === 'string' &&
                typeof candidate.iterationIndex === 'number' &&
                typeof candidate.iterationCount === 'number' &&
                typeof candidate.id === 'string' &&
                typeof candidate.engineId === 'string' &&
                typeof candidate.engineLabel === 'string' &&
                typeof candidate.createdAt === 'string' &&
                typeof candidate.aspectRatio === 'string' &&
                typeof candidate.durationSec === 'number' &&
                typeof candidate.prompt === 'string' &&
                typeof candidate.progress === 'number' &&
                typeof candidate.message === 'string' &&
                typeof candidate.startedAt === 'number' &&
                typeof candidate.minReadyAt === 'number'
              );
            })
            .slice(0, MAX_PERSISTED_RENDERS);
          if (storedRenders.length) {
            setRenders((current) => (current.length ? current : storedRenders));
            if (!activeBatchId) {
              setActiveBatchId(storedRenders[0].batchId ?? null);
            }
          }
        }
      }
      const storedHeroesValue = window.localStorage.getItem(STORAGE_KEYS.batchHeroes);
      if (storedHeroesValue) {
        const rawHeroes = JSON.parse(storedHeroesValue);
        if (rawHeroes && typeof rawHeroes === 'object') {
          const entries = Object.entries(rawHeroes as Record<string, unknown>);
          const storedHeroes: Record<string, string> = {};
          entries.forEach(([batchId, localKey]) => {
            if (typeof batchId === 'string' && typeof localKey === 'string') {
              storedHeroes[batchId] = localKey;
            }
          });
          if (Object.keys(storedHeroes).length) {
            setBatchHeroes((current) => (Object.keys(current).length ? current : storedHeroes));
          }
        }
      }
    } catch {
      // noop
    }
  }, [activeBatchId]);

  useEffect(() => {
    rendersRef.current = renders;
  }, [renders]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (!renders.length) {
        window.localStorage.removeItem(STORAGE_KEYS.renders);
        return;
      }
      const limited = renders.slice(0, MAX_PERSISTED_RENDERS);
      window.localStorage.setItem(STORAGE_KEYS.renders, JSON.stringify(limited));
    } catch {
      // noop
    }
  }, [renders]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (!Object.keys(batchHeroes).length) {
        window.localStorage.removeItem(STORAGE_KEYS.batchHeroes);
        return;
      }
      window.localStorage.setItem(STORAGE_KEYS.batchHeroes, JSON.stringify(batchHeroes));
    } catch {
      // noop
    }
  }, [batchHeroes]);
  const renderGroups = useMemo<Map<string, LocalRenderGroup>>(() => {
    const map = new Map<string, LocalRenderGroup>();
    renders.forEach((item) => {
      const key = item.batchId ?? item.localKey;
      const existing = map.get(key);
      if (existing) {
        existing.items.push(item);
        existing.readyCount += item.videoUrl ? 1 : 0;
        if (typeof item.priceCents === 'number') {
          existing.totalPriceCents = (existing.totalPriceCents ?? 0) + item.priceCents;
        }
        if (!existing.currency && item.currency) {
          existing.currency = item.currency;
        }
      } else {
        map.set(key, {
          id: key,
          items: [item],
          iterationCount: item.iterationCount || 1,
          readyCount: item.videoUrl ? 1 : 0,
          totalPriceCents: typeof item.priceCents === 'number' ? item.priceCents : null,
          currency: item.currency,
        });
      }
    });
    map.forEach((group) => {
      group.items.sort((a, b) => a.iterationIndex - b.iterationIndex);
      if (group.totalPriceCents != null && group.iterationCount > group.items.length) {
        // scale total if some iterations missing price yet
        const average = group.totalPriceCents / group.items.length;
        group.totalPriceCents = Math.round(average * group.iterationCount);
      }
    });
    return map;
  }, [renders]);
  const effectiveBatchId = useMemo(() => activeBatchId ?? selectedPreview?.batchId ?? null, [activeBatchId, selectedPreview?.batchId]);
  const activeGroup = effectiveBatchId ? renderGroups.get(effectiveBatchId) : undefined;
  useEffect(() => {
    if (!effectiveBatchId) return;
    if (batchHeroes[effectiveBatchId]) return;
    const group = renderGroups.get(effectiveBatchId);
    if (!group || !group.items.length) return;
    setBatchHeroes((prev) => {
      if (prev[effectiveBatchId]) return prev;
      return { ...prev, [effectiveBatchId]: group.items[0].localKey };
    });
  }, [effectiveBatchId, renderGroups, batchHeroes]);
  const activeHeroKey = useMemo(() => {
    if (!effectiveBatchId) return undefined;
    const current = batchHeroes[effectiveBatchId];
    if (current) return current;
    const group = renderGroups.get(effectiveBatchId);
    return group?.items[0]?.localKey;
  }, [effectiveBatchId, batchHeroes, renderGroups]);
  useEffect(() => {
    const currentIterations = form?.iterations ?? 1;
    if (currentIterations <= 1 && viewMode !== 'single') {
      setViewMode('single');
    }
  }, [form?.iterations, viewMode]);
  const activeTiles = useMemo<QuadPreviewTile[]>(() => {
    if (!activeGroup) return [];
    return activeGroup.items.map((item) => ({
      localKey: item.localKey,
      batchId: item.batchId,
      id: item.id,
      iterationIndex: item.iterationIndex,
      iterationCount: activeGroup.iterationCount,
      videoUrl: item.videoUrl,
      thumbUrl: item.thumbUrl,
      aspectRatio: item.aspectRatio,
      progress: item.progress,
      message: item.message,
      priceCents: item.priceCents,
      currency: item.currency ?? preflight?.currency ?? 'USD',
      durationSec: item.durationSec,
      engineLabel: item.engineLabel,
      engineId: item.engineId,
      etaLabel: item.etaLabel,
      prompt: item.prompt,
      status: item.videoUrl ? 'completed' : 'pending',
    }));
  }, [activeGroup, preflight?.currency]);
  const pendingGroups = useMemo<GroupSummary[]>(() => {
    const summaries: GroupSummary[] = [];
    renderGroups.forEach((group, id) => {
      if (group.iterationCount <= 1) return;

      const members: GroupMemberSummary[] = group.items.map((item) => {
        const thumb = item.thumbUrl ?? resolveRenderThumb(item);
        const member: GroupMemberSummary = {
          id: item.id,
          jobId: item.id,
          localKey: item.localKey,
          batchId: item.batchId,
          iterationIndex: item.iterationIndex,
          iterationCount: group.iterationCount,
          engineId: item.engineId,
          engineLabel: item.engineLabel,
          durationSec: item.durationSec,
          priceCents: item.priceCents ?? null,
          currency: item.currency ?? group.currency ?? null,
          thumbUrl: thumb,
          videoUrl: item.videoUrl ?? null,
          aspectRatio: item.aspectRatio ?? null,
          prompt: item.prompt,
          status: item.videoUrl ? 'completed' : 'pending',
          progress: item.progress,
          message: item.message,
          etaLabel: item.etaLabel ?? null,
          etaSeconds: item.etaSeconds ?? null,
          createdAt: item.createdAt,
          source: 'render',
        };
        return member;
      });

      if (members.length === 0) return;

      const preferredHeroKey = batchHeroes[id] ?? group.items.find((item) => item.videoUrl)?.localKey ?? group.items[0]?.localKey;
      const hero = preferredHeroKey
        ? members.find((member) => member.localKey === preferredHeroKey) ?? members[0]
        : members[0];

      const previews = members
        .slice(0, Math.max(1, Math.min(4, group.iterationCount)))
        .map((member) => ({
          id: member.id,
          thumbUrl: member.thumbUrl,
          videoUrl: member.videoUrl,
          aspectRatio: member.aspectRatio,
        }));

      summaries.push({
        id,
        source: 'active',
        splitMode: group.iterationCount > 1 ? 'quad' : 'single',
        batchId: id,
        count: group.iterationCount,
        totalPriceCents: group.totalPriceCents,
        currency: group.currency ?? hero.currency ?? null,
        createdAt: hero.createdAt,
        hero,
        previews,
        members,
      });
    });

    return summaries.sort((a, b) => {
      const timeA = Date.parse(a.createdAt);
      const timeB = Date.parse(b.createdAt);
      return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
    });
  }, [renderGroups, batchHeroes]);

  useEffect(() => {
    const groupsForStorage = pendingGroups.filter((group) => group.count > 1 && group.members.length > 1);
    savePersistedGroupSummaries(groupsForStorage.slice(0, 12));
  }, [pendingGroups]);
  const nonGroupedRenders = useMemo(() => {
    const groupedIds = new Set<string>();
    renderGroups.forEach((group) => {
      if (group.iterationCount > 1) {
        group.items.forEach((item) => groupedIds.add(item.localKey));
      }
    });
    return renders.filter((render) => !groupedIds.has(render.localKey));
  }, [renderGroups, renders]);
  const buildQuadTileFromRender = useCallback(
    (render: LocalRender, group: LocalRenderGroup): QuadPreviewTile => ({
      localKey: render.localKey,
      batchId: render.batchId,
      id: render.id,
      iterationIndex: render.iterationIndex,
      iterationCount: group.iterationCount,
      videoUrl: render.videoUrl,
      thumbUrl: render.thumbUrl,
      aspectRatio: render.aspectRatio,
      progress: render.progress,
      message: render.message,
      priceCents: render.priceCents,
      currency: render.currency ?? group.currency ?? preflight?.currency ?? 'USD',
      durationSec: render.durationSec,
      engineLabel: render.engineLabel,
      engineId: render.engineId,
      etaLabel: render.etaLabel,
      prompt: render.prompt,
      status: render.videoUrl ? 'completed' : 'pending',
    }),
    [preflight?.currency]
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!form) {
      window.localStorage.removeItem(STORAGE_KEYS.form);
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEYS.form, JSON.stringify(form));
    } catch {
      // noop
    }
  }, [form]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEYS.prompt, prompt);
    } catch {
      // noop
    }
  }, [prompt]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEYS.negativePrompt, negativePrompt);
    } catch {
      // noop
    }
  }, [negativePrompt]);

  const durationRef = useRef<HTMLElement | null>(null);
  const resolutionRef = useRef<HTMLDivElement>(null);
  const addonsRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const noticeTimeoutRef = useRef<number | null>(null);
const [inputAssets, setInputAssets] = useState<Record<string, (ReferenceAsset | null)[]>>({});

const assetsRef = useRef<Record<string, (ReferenceAsset | null)[]>>({});

const revokeAssetPreview = (asset: ReferenceAsset | null | undefined) => {
  if (!asset) return;
  URL.revokeObjectURL(asset.previewUrl);
};

useEffect(() => {
  assetsRef.current = inputAssets;
}, [inputAssets]);

useEffect(() => {
  return () => {
    Object.values(assetsRef.current).forEach((entries) => {
      entries.forEach((asset) => {
        revokeAssetPreview(asset);
      });
    });
  };
}, []);

  const focusElement = useCallback((element: HTMLElement | null) => {
    if (!element) return;
    element.focus({ preventScroll: true });
    element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }, []);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimeoutRef.current !== null) {
      window.clearTimeout(noticeTimeoutRef.current);
    }
    noticeTimeoutRef.current = window.setTimeout(() => {
      setNotice(null);
      noticeTimeoutRef.current = null;
    }, 6000);
  }, []);

  const closeTopUpModal = useCallback(() => {
    setTopUpModal(null);
    setTopUpAmount(500);
    setTopUpError(null);
  }, []);

  const handleAssetAdd = useCallback((field: EngineInputField, file: File, slotIndex?: number) => {
    setInputAssets((previous) => {
      const maxCount = field.maxCount ?? 0;
      const current = previous[field.id] ? [...previous[field.id]] : [];

      if (maxCount > 0 && current.length < maxCount) {
        while (current.length < maxCount) {
          current.push(null);
        }
      }

      const newAsset: ReferenceAsset = {
        fieldId: field.id,
        file,
        previewUrl: URL.createObjectURL(file),
        kind: field.type === 'video' ? 'video' : 'image',
        name: file.name,
        size: file.size,
        type: file.type,
      };

      let targetIndex = typeof slotIndex === 'number' ? slotIndex : -1;
      if (maxCount > 0 && targetIndex >= maxCount) {
        targetIndex = -1;
      }
      if (targetIndex < 0) {
        targetIndex = current.findIndex((asset) => asset === null);
      }
      if (targetIndex < 0) {
        if (maxCount > 0 && current.length >= maxCount) {
          revokeAssetPreview(newAsset);
          return previous;
        }
        current.push(newAsset);
      } else {
        const existing = current[targetIndex];
        if (existing) {
          revokeAssetPreview(existing);
        }
        current[targetIndex] = newAsset;
      }

      return { ...previous, [field.id]: current };
    });
  }, []);

  const handleAssetRemove = useCallback((field: EngineInputField, index: number) => {
    setInputAssets((previous) => {
      const current = previous[field.id];
      if (index < 0 || index >= current.length) return previous;
      const nextList = [...current];
      const toRelease = nextList[index];
      if (toRelease) {
        revokeAssetPreview(toRelease);
      }

      const maxCount = field.maxCount ?? 0;
      if (maxCount > 0) {
        nextList[index] = null;
      } else {
        nextList.splice(index, 1);
      }

      const nextState = { ...previous };
      const hasValues = nextList.some((asset) => asset !== null);

      if (hasValues || (maxCount > 0 && nextList.length)) {
        nextState[field.id] = nextList;
      } else {
        delete nextState[field.id];
      }

      return nextState;
    });
  }, []);

  const handleSelectPresetAmount = useCallback((value: number) => {
    setTopUpAmount(value);
  }, []);

  const handleCustomAmountChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (Number.isNaN(value)) {
      setTopUpAmount(500);
      return;
    }
    setTopUpAmount(Math.max(500, Math.round(value * 100)));
  }, []);

  const handleConfirmTopUp = useCallback(async () => {
    if (!topUpModal) return;
    const amountCents = Math.max(500, topUpAmount);
    setIsTopUpLoading(true);
    setTopUpError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/wallet', {
        method: 'POST',
        headers,
        body: JSON.stringify({ amountCents }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? 'Wallet top-up failed');
      }
      if (json?.url) {
        window.location.href = json.url as string;
        return;
      }
      closeTopUpModal();
      showNotice('Top-up initiated. Complete the payment to update your balance.');
    } catch (error) {
      setTopUpError(error instanceof Error ? error.message : 'Failed to start top-up');
    } finally {
      setIsTopUpLoading(false);
    }
  }, [topUpAmount, topUpModal, closeTopUpModal, showNotice]);

  const handleTopUpSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void handleConfirmTopUp();
    },
    [handleConfirmTopUp]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        const res = await fetch('/api/member-status', { headers });
        if (!res.ok) return;
        const json = await res.json();
        if (mounted) {
          const tier = (json?.tier ?? 'Member') as 'Member' | 'Plus' | 'Pro';
          setMemberTier(tier);
        }
      } catch {
        // noop
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!topUpModal) return undefined;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeTopUpModal();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [topUpModal, closeTopUpModal]);

  useEffect(() => {
    return () => {
      if (noticeTimeoutRef.current !== null) {
        window.clearTimeout(noticeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (selectedPreview || renders.length > 0) return;
    const latestJobWithMedia = latestJobsPages?.[0]?.jobs?.find((job) => job.thumbUrl || job.videoUrl);
    if (!latestJobWithMedia) return;
    setSelectedPreview({
      id: latestJobWithMedia.jobId,
      videoUrl: latestJobWithMedia.videoUrl ?? undefined,
      aspectRatio: latestJobWithMedia.aspectRatio ?? undefined,
      thumbUrl: latestJobWithMedia.thumbUrl ?? undefined,
      priceCents: latestJobWithMedia.finalPriceCents ?? latestJobWithMedia.pricingSnapshot?.totalCents,
      currency: latestJobWithMedia.currency ?? latestJobWithMedia.pricingSnapshot?.currency,
    });
  }, [latestJobsPages, renders.length, selectedPreview]);

  const handleNavigateFactor = useCallback(
    (kind: PriceFactorKind) => {
      if (kind === 'base' || kind === 'duration') {
        focusElement(durationRef.current);
        return;
      }
      if (kind === 'resolution') {
        focusElement(resolutionRef.current);
        return;
      }
      if (kind === 'upscale4k' || kind === 'audio') {
        focusElement(addonsRef.current);
        return;
      }
      if (kind === 'discount') {
        focusElement(addonsRef.current);
        return;
      }
      if (kind === 'tax') {
        focusElement(resolutionRef.current ?? addonsRef.current);
      }
    },
    [focusElement]
  );

  const handleReplacePrompt = useCallback((value: string) => {
    setPrompt(value);
  }, []);

  const handleAppendPrompt = useCallback((value: string) => {
    setPrompt((current) => {
      if (!current?.trim()) {
        return value;
      }
      return `${current.trim()}\n\n${value}`;
    });
  }, []);

  const focusComposer = useCallback(() => {
    if (!composerRef.current) return;
    composerRef.current.focus({ preventScroll: true });
    composerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }, []);

  const handleRequestEngineSwitch = useCallback(
    (engineId: string) => {
      if (!engines.length) return;
      const exists = engines.some((entry) => entry.id === engineId);
      if (!exists) return;
      setForm((current) => (current ? { ...current, engineId } : current));
    },
    [engines]
  );

  const selectedEngine = useMemo<EngineCaps | null>(() => {
    if (!engines.length) return null;
    if (form && engines.some((engine) => engine.id === form.engineId)) {
      return engines.find((engine) => engine.id === form.engineId) ?? engines[0];
    }
    return engines[0];
  }, [engines, form]);
  const engineMap = useMemo(() => {
    const map = new Map<string, EngineCaps>();
    engines.forEach((entry) => {
      map.set(entry.id, entry);
    });
    return map;
  }, [engines]);

  const activeMode: Mode = form?.mode ?? (selectedEngine?.modes[0] ?? 't2v');

  const inputSchemaSummary = useMemo(() => {
    const schema = selectedEngine?.inputSchema;
    if (!schema) {
      return {
        assetFields: [] as AssetFieldConfig[],
        promptField: undefined as EngineInputField | undefined,
        promptRequired: true,
        negativePromptField: undefined as EngineInputField | undefined,
        negativePromptRequired: false,
      };
    }

    const appliesToMode = (field: EngineInputField) => !field.modes || field.modes.includes(activeMode);
    const isRequired = (field: EngineInputField, origin: 'required' | 'optional') => {
      if (field.requiredInModes) {
        return field.requiredInModes.includes(activeMode);
      }
      return origin === 'required';
    };

    const assetFields: AssetFieldConfig[] = [];
    let promptField: EngineInputField | undefined;
    let promptFieldOrigin: 'required' | 'optional' | undefined;
    let negativePromptField: EngineInputField | undefined;
    let negativePromptOrigin: 'required' | 'optional' | undefined;

    const ingest = (fields: EngineInputField[] | undefined, origin: 'required' | 'optional') => {
      if (!fields) return;
      fields.forEach((field) => {
        if (!appliesToMode(field)) return;
        if (field.type === 'text') {
          const normalizedId = (field.id ?? '').toLowerCase();
          const normalizedIdCompact = normalizedId.replace(/[^a-z0-9]/g, '');
          const normalizedLabel = (field.label ?? '').toLowerCase();
          const normalizedLabelCompact = normalizedLabel.replace(/\s+/g, '');
          const hasNegativePromptCue = (value: string) =>
            value.includes('negativeprompt') ||
            (value.includes('negative') && value.includes('prompt')) ||
            value.includes('negprompt');
          const isNegative =
            normalizedId === 'negative_prompt' ||
            hasNegativePromptCue(normalizedIdCompact) ||
            normalizedLabel.includes('negative prompt') ||
            hasNegativePromptCue(normalizedLabelCompact);
          if (isNegative) {
            if (!negativePromptField) {
              negativePromptField = field;
              negativePromptOrigin = origin;
            }
            return;
          }
          const isPrompt = normalizedId === 'prompt';
          if (!promptField || isPrompt) {
            promptField = field;
            promptFieldOrigin = origin;
          }
          return;
        }
        if (field.type === 'image' || field.type === 'video') {
          assetFields.push({ field, required: isRequired(field, origin) });
        }
      });
    };

    ingest(schema.required, 'required');
    ingest(schema.optional, 'optional');

    const promptRequired = promptField ? isRequired(promptField, promptFieldOrigin ?? 'optional') : true;
    const negativePromptRequired = negativePromptField
      ? isRequired(negativePromptField, negativePromptOrigin ?? 'optional')
      : false;

    return {
      assetFields,
      promptField,
      promptRequired,
      negativePromptField,
      negativePromptRequired,
    };
  }, [selectedEngine, activeMode]);
  useEffect(() => {
    setInputAssets((previous) => {
      if (!inputSchemaSummary.assetFields.length) {
        if (Object.keys(previous).length === 0) return previous;
        Object.values(previous).forEach((entries) => {
          entries.forEach((asset) => revokeAssetPreview(asset));
        });
        return {};
      }
      const allowed = new Set(inputSchemaSummary.assetFields.map((entry) => entry.field.id));
      let changed = false;
      const next: Record<string, (ReferenceAsset | null)[]> = {};
      Object.entries(previous).forEach(([fieldId, items]) => {
        if (allowed.has(fieldId)) {
          next[fieldId] = items;
        } else {
          changed = true;
          items.forEach((asset) => revokeAssetPreview(asset));
        }
      });
      return changed ? next : previous;
    });
  }, [inputSchemaSummary.assetFields]);

  const composerAssets = useMemo<Record<string, (ComposerAttachment | null)[]>>(() => {
    const map: Record<string, (ComposerAttachment | null)[]> = {};
    Object.entries(inputAssets).forEach(([fieldId, entries]) => {
      map[fieldId] = entries.map((asset) =>
        asset
          ? {
              kind: asset.kind,
              name: asset.name,
              size: asset.size,
              type: asset.type,
              previewUrl: asset.previewUrl,
            }
          : null
      );
    });
    return map;
  }, [inputAssets]);

  const startRender = useCallback(async () => {
    if (!form || !selectedEngine) return;
    const trimmedPrompt = prompt.trim();
    const trimmedNegativePrompt = negativePrompt.trim();
    const supportsNegativePrompt = Boolean(inputSchemaSummary.negativePromptField);

    if (inputSchemaSummary.promptRequired && !trimmedPrompt) {
      showNotice('A prompt is required for this engine and mode.');
      return;
    }

    if (
      supportsNegativePrompt &&
      inputSchemaSummary.negativePromptRequired &&
      !trimmedNegativePrompt
    ) {
      const label = inputSchemaSummary.negativePromptField?.label ?? 'Negative prompt';
      showNotice(`${label} is required before generating.`);
      return;
    }

    const missingAssetField = inputSchemaSummary.assetFields.find(({ field, required }) => {
      if (!required) return false;
      const minCount = field.minCount ?? 1;
      const current = (inputAssets[field.id]?.filter((asset) => asset !== null).length) ?? 0;
      return current < minCount;
    });

    if (missingAssetField) {
      showNotice(`${missingAssetField.field.label} is required before generating.`);
      return;
    }

    const iterationCount = Math.max(1, form.iterations ?? 1);
    const batchId = `batch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    if (iterationCount > 1) {
      const totalCents = typeof preflight?.pricing?.totalCents === 'number' ? preflight.pricing.totalCents * iterationCount : undefined;
      emitClientMetric('group_render_initiated', {
        batchId,
        iterations: iterationCount,
        engine: selectedEngine.id,
        total_cents: totalCents ?? null,
        currency: preflight?.pricing?.currency ?? preflight?.currency ?? 'USD',
      });
    }

    let inputsPayload: Array<{
      name: string;
      type: string;
      size: number;
      kind: 'image' | 'video';
      slotId?: string;
      label?: string;
      dataUrl: string;
    }> | undefined;

    try {
      const schema = selectedEngine?.inputSchema;
      const fieldIndex = new Map<string, EngineInputField>();
      if (schema) {
        [...(schema.required ?? []), ...(schema.optional ?? [])].forEach((field) => {
          fieldIndex.set(field.id, field);
        });
      }

      const orderedAttachments: Array<{ field: EngineInputField; asset: ReferenceAsset }> = [];
      inputSchemaSummary.assetFields.forEach(({ field }) => {
        const items = inputAssets[field.id] ?? [];
        items.forEach((asset) => {
          if (!asset) return;
          orderedAttachments.push({ field, asset });
        });
      });

      // Include any remaining assets that might not be in the schema summary
      Object.entries(inputAssets).forEach(([fieldId, items]) => {
        if (orderedAttachments.some((entry) => entry.field.id === fieldId)) return;
        const field = fieldIndex.get(fieldId);
        if (!field) return;
        items.forEach((asset) => {
          if (!asset) return;
          orderedAttachments.push({ field, asset });
        });
      });

      if (orderedAttachments.length) {
        inputsPayload = await Promise.all(
          orderedAttachments.map(async ({ field, asset }) => ({
            name: asset.name,
            type: asset.type || (asset.kind === 'image' ? 'image/*' : 'video/*'),
            size: asset.size,
            kind: asset.kind,
            slotId: field.id,
            label: field.label,
            dataUrl: await readFileAsDataUrl(asset.file),
          }))
        );
      }
    } catch (fileError) {
      console.error('[startRender] Unable to read attachment', fileError);
      showNotice('We could not read one of the uploaded files. Please try another format.');
      return;
    }

    const runIteration = async (iterationIndex: number) => {
      const localKey = `local_${batchId}_${iterationIndex + 1}`;
      const id = localKey;
      const ar = form.aspectRatio;
      const thumb = ar === '9:16'
        ? '/assets/frames/thumb-9x16.svg'
        : ar === '1:1'
          ? '/assets/frames/thumb-1x1.svg'
          : '/assets/frames/thumb-16x9.svg';

      const { seconds: etaSeconds, label: etaLabel } = getRenderEta(selectedEngine, form.durationSec);
      const friendlyMessage = iterationCount > 1 ? `Take ${iterationIndex + 1}/${iterationCount} • ${FRIENDLY_MESSAGES[Math.floor(Math.random() * FRIENDLY_MESSAGES.length)]}` : FRIENDLY_MESSAGES[Math.floor(Math.random() * FRIENDLY_MESSAGES.length)];
      const startedAt = Date.now();
      const minDurationMs = Math.max(etaSeconds, 15) * 1000;
      const minReadyAt = startedAt + minDurationMs;

      const initial: LocalRender = {
        localKey,
        batchId,
        iterationIndex,
        iterationCount,
        id,
        engineId: selectedEngine.id,
        engineLabel: selectedEngine.label,
        createdAt: new Date().toISOString(),
        aspectRatio: form.aspectRatio,
        durationSec: form.durationSec,
        prompt,
        progress: 5,
        message: friendlyMessage,
        thumbUrl: thumb,
        priceCents: preflight?.pricing?.totalCents ?? undefined,
        currency: preflight?.pricing?.currency ?? preflight?.currency ?? 'USD',
        pricingSnapshot: preflight?.pricing,
        paymentStatus: 'pending_payment',
        etaSeconds,
        etaLabel,
        startedAt,
        minReadyAt,
      };

      setRenders((prev) => [initial, ...prev]);
      setBatchHeroes((prev) => {
        if (prev[batchId]) return prev;
        return { ...prev, [batchId]: localKey };
      });
      setActiveBatchId(batchId);
      if (iterationCount > 1) {
        setViewMode((prev) => (prev === 'quad' ? prev : 'quad'));
      }
      setSelectedPreview({
        id,
        localKey,
        batchId,
        iterationIndex,
        iterationCount,
        aspectRatio: form.aspectRatio,
        thumbUrl: thumb,
        progress: initial.progress,
        message: friendlyMessage,
        priceCents: initial.priceCents,
        currency: initial.currency,
        etaSeconds,
        etaLabel,
      });

      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        const paymentMode = token ? 'wallet' : 'platform';
        const res = await runGenerate(
          {
            engineId: selectedEngine.id,
            prompt: trimmedPrompt,
            durationSec: form.durationSec,
            aspectRatio: form.aspectRatio,
            resolution: form.resolution,
            fps: form.fps,
            mode: form.mode,
            addons: form.addons,
            membershipTier: memberTier,
            payment: { mode: paymentMode },
            ...(supportsNegativePrompt && trimmedNegativePrompt ? { negativePrompt: trimmedNegativePrompt } : {}),
            ...(inputsPayload ? { inputs: inputsPayload } : {}),
            ...(form.openaiApiKey ? { apiKey: form.openaiApiKey } : {}),
            idempotencyKey: id,
          },
          token ? { token } : undefined
        );
        if (res?.jobId) {
          setRenders((prev) =>
            prev.map((r) =>
              r.id === id
                ? {
                    ...r,
                    id: res.jobId!,
                    jobId: res.jobId!,
                    thumbUrl: res.thumbUrl ?? r.thumbUrl,
                    priceCents: res.pricing?.totalCents ?? r.priceCents,
                    currency: res.pricing?.currency ?? r.currency,
                    pricingSnapshot: res.pricing ?? r.pricingSnapshot,
                    paymentStatus: res.paymentStatus ?? r.paymentStatus,
                  }
                : r
            )
          );
          setSelectedPreview((cur) =>
            cur && (cur.id === id || cur.localKey === localKey)
              ? {
                  ...cur,
                  id: res.jobId!,
                  localKey,
                  thumbUrl: res.thumbUrl ?? cur.thumbUrl,
                  priceCents: res.pricing?.totalCents ?? cur.priceCents,
                  currency: res.pricing?.currency ?? cur.currency,
                  etaLabel: cur.etaLabel,
                  etaSeconds: cur.etaSeconds,
                }
              : cur
          );

          const jobId = res.jobId;
          const poll = async () => {
            try {
              const status = await getJobStatus(jobId!);
              const target = rendersRef.current.find((r) => r.id === jobId);
              const now = Date.now();
              const minReadyAtCurrent = target?.minReadyAt ?? 0;
              const isCompleted = status.status === 'completed' || Boolean(status.videoUrl);
              if (isCompleted && target && now < minReadyAtCurrent) {
                window.setTimeout(poll, Math.max(500, minReadyAtCurrent - now));
                return;
              }
              setRenders((prev) =>
                prev.map((r) =>
                  r.id === jobId
                    ? {
                        ...r,
                        progress: status.progress ?? r.progress,
                        videoUrl: status.videoUrl ?? r.videoUrl,
                        thumbUrl: status.thumbUrl ?? r.thumbUrl,
                        priceCents: status.finalPriceCents ?? status.pricing?.totalCents ?? r.priceCents,
                        currency: status.currency ?? status.pricing?.currency ?? r.currency,
                        pricingSnapshot: status.pricing ?? r.pricingSnapshot,
                        paymentStatus: status.paymentStatus ?? r.paymentStatus,
                      }
                    : r
                )
              );
              setSelectedPreview((cur) =>
                cur && (cur.id === jobId || cur.localKey === localKey)
                  ? {
                      ...cur,
                      id: jobId,
                      localKey,
                      progress: status.progress ?? cur.progress,
                      videoUrl: status.videoUrl ?? cur.videoUrl,
                      thumbUrl: status.thumbUrl ?? cur.thumbUrl,
                      priceCents: status.finalPriceCents ?? status.pricing?.totalCents ?? cur.priceCents,
                      currency: status.currency ?? status.pricing?.currency ?? cur.currency,
                      etaLabel: cur.etaLabel,
                      etaSeconds: cur.etaSeconds,
                    }
                  : cur
              );
              if (status.status !== 'completed' && status.status !== 'failed') {
                window.setTimeout(poll, 2000);
              }
            } catch {
              window.setTimeout(poll, 3000);
            }
          };
          window.setTimeout(poll, 1500);
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('wallet:invalidate'));
        }
      } catch (error) {
        setRenders((prev) => prev.filter((r) => r.localKey !== localKey));
        setSelectedPreview((cur) => (cur && (cur.id === id || cur.localKey === localKey) ? null : cur));
        if (isInsufficientFundsError(error)) {
          const shortfallCents = error.details?.requiredCents;
          const currencyCode = preflight?.pricing?.currency ?? preflight?.currency ?? 'USD';
          let friendlyNotice = 'Insufficient wallet balance. Please add funds to continue generating.';
          let formattedShortfall: string | undefined;
          if (typeof shortfallCents === 'number' && shortfallCents > 0) {
            try {
              formattedShortfall = new Intl.NumberFormat(CURRENCY_LOCALE, {
                style: 'currency',
                currency: currencyCode,
              }).format(shortfallCents / 100);
              friendlyNotice = `Insufficient wallet balance. Add at least ${formattedShortfall} to continue generating.`;
            } catch {
              formattedShortfall = `${currencyCode} ${(shortfallCents / 100).toFixed(2)}`;
              friendlyNotice = `Insufficient wallet balance. Add at least ${formattedShortfall} to continue generating.`;
            }
          }
          showNotice(friendlyNotice);
          setTopUpModal({
            message: friendlyNotice,
            amountLabel: formattedShortfall,
            shortfallCents: typeof shortfallCents === 'number' ? shortfallCents : undefined,
          });
          setPreflightError(friendlyNotice);
          return;
        }
        setPreflightError(error instanceof Error ? error.message : 'Generate failed');
      }

      const totalMs = minDurationMs;
      const started = startedAt;
      const interval = window.setInterval(() => {
        setRenders((prev) => {
          const now = Date.now();
          const elapsed = now - started;
          const pct = Math.min(95, Math.round((elapsed / totalMs) * 100));
          const updated = prev.map((r) =>
            r.localKey === localKey && !r.videoUrl
              ? {
                  ...r,
                  progress: pct < 5 ? 5 : pct,
                  message: friendlyMessage,
                }
              : r
          );
          setSelectedPreview((cur) =>
            cur && (cur.id === id || cur.localKey === localKey) && !cur.videoUrl
              ? { ...cur, progress: pct < 5 ? 5 : pct, message: friendlyMessage }
              : cur
          );
          return updated;
        });
      }, 400);
      window.setTimeout(() => {
        window.clearInterval(interval);
      }, totalMs + 1000);
    };

    for (let iterationIndex = 0; iterationIndex < iterationCount; iterationIndex += 1) {
      void runIteration(iterationIndex);
    }
  }, [form, prompt, negativePrompt, selectedEngine, preflight, memberTier, showNotice, inputSchemaSummary, inputAssets]);

  const isSoraEngine = Boolean(selectedEngine?.id?.startsWith('sora-2'));
  const hasOpenAiBilling = Boolean(form?.openaiApiKey && form.openaiApiKey.trim().length > 0);
  const pricingBillingBadge = isSoraEngine
    ? hasOpenAiBilling
      ? 'Billed by OpenAI (via your key)'
      : 'Billed via FAL credits'
    : undefined;
  const pricingBillingNote = isSoraEngine
    ? hasOpenAiBilling
      ? 'Charges settle on your OpenAI account; the price shown is indicative for budgeting.'
      : 'Without an OpenAI key we run through FAL — price reflects what your wallet will be charged.'
    : undefined;

  useEffect(() => {
    if (!selectedEngine) return;
    setForm((current) => {
      const preservedApiKey = current?.openaiApiKey;
      if (current && current.engineId === selectedEngine.id) {
        return current;
      }
      const defaultMode = selectedEngine.modes[0];
      return {
        engineId: selectedEngine.id,
        mode: defaultMode,
        durationSec: Math.min(8, selectedEngine.maxDurationSec),
        resolution: selectedEngine.resolutions[0],
        aspectRatio: selectedEngine.aspectRatios[0],
        fps: selectedEngine.fps[0],
        iterations: 1,
        addons: {
          audio: selectedEngine.audio && defaultMode === 't2v',
          upscale4k: false,
        },
        seedLocked: false,
        openaiApiKey: preservedApiKey,
      };
    });
  }, [selectedEngine]);

  useEffect(() => {
    if (!form || !selectedEngine) return;
    let canceled = false;

    const payload: PreflightRequest = {
      engine: form.engineId,
      mode: form.mode,
      durationSec: form.durationSec,
      resolution: form.resolution as PreflightRequest['resolution'],
      aspectRatio: form.aspectRatio as PreflightRequest['aspectRatio'],
      fps: form.fps,
      addons: form.addons,
      seedLocked: Boolean(form.seedLocked),
      user: { memberTier },
    };

    setPricing(true);
    setPreflightError(undefined);

    const timeout = setTimeout(() => {
      runPreflight(payload)
        .then((response) => {
          if (canceled) return;
          setPreflight(response);
        })
        .catch((err) => {
          if (canceled) return;
          setPreflightError(err instanceof Error ? err.message : 'Preflight failed');
        })
        .finally(() => {
          if (!canceled) {
            setPricing(false);
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      canceled = true;
      clearTimeout(timeout);
    };
  }, [form, selectedEngine, memberTier]);

  const handleHeroChange = useCallback(
    (tile: QuadPreviewTile) => {
      setBatchHeroes((prev) => {
        const previous = prev[tile.batchId];
        if (previous === tile.localKey) return prev;
        emitClientMetric('hero_changed', { batchId: tile.batchId, from: previous ?? null, to: tile.localKey });
        return { ...prev, [tile.batchId]: tile.localKey };
      });
      setSelectedPreview((current) => {
        if (current && current.batchId === tile.batchId) {
          return {
            ...current,
            id: tile.id,
            localKey: tile.localKey,
            videoUrl: tile.videoUrl,
            aspectRatio: tile.aspectRatio,
            priceCents: tile.priceCents,
            currency: tile.currency,
            etaLabel: tile.etaLabel,
            iterationIndex: tile.iterationIndex,
            iterationCount: tile.iterationCount,
          };
        }
        return current;
      });
    },
    []
  );

  const handleSelectHeroTile = useCallback(
    (tile: QuadPreviewTile) => {
      setActiveBatchId(tile.batchId);
      handleHeroChange(tile);
    },
    [handleHeroChange]
  );

  const handleQuadTileAction = useCallback(
    (action: QuadTileAction, tile: QuadPreviewTile) => {
      emitClientMetric('tile_action', { action, batchId: tile.batchId, version: tile.iterationIndex + 1 });
      switch (action) {
        case 'continue': {
          setPrompt(tile.prompt);
          setForm((current) => (current ? { ...current, engineId: tile.engineId } : current));
          focusComposer();
          break;
        }
        case 'refine': {
          setPrompt(`${tile.prompt}\n\n// refine here`);
          setForm((current) => (current ? { ...current, engineId: tile.engineId } : current));
          focusComposer();
          break;
        }
        case 'branch': {
          showNotice('Branching flow is coming soon in this build.');
          break;
        }
        case 'copy': {
          if (typeof navigator !== 'undefined' && navigator.clipboard) {
            void navigator.clipboard.writeText(tile.prompt).then(
              () => showNotice('Prompt copied to clipboard'),
              () => showNotice('Unable to copy prompt, please copy manually.')
            );
          } else {
            showNotice('Clipboard not available in this context.');
          }
          break;
        }
        case 'open': {
          setActiveBatchId(tile.batchId);
          setViewMode('quad');
          setSelectedPreview({
            id: tile.id,
            localKey: tile.localKey,
            batchId: tile.batchId,
            iterationIndex: tile.iterationIndex,
            iterationCount: tile.iterationCount,
            videoUrl: tile.videoUrl,
            aspectRatio: tile.aspectRatio,
            progress: tile.progress,
            message: tile.message,
            priceCents: tile.priceCents,
            currency: tile.currency,
            etaLabel: tile.etaLabel,
          });
          break;
        }
        default:
          break;
      }
    },
    [focusComposer, setForm, setPrompt, showNotice]
  );

  const handleGroupAction = useCallback(
    (action: QuadGroupAction, tile?: QuadPreviewTile) => {
      if (action === 'open') {
        const target = tile ?? (activeTiles.length ? activeTiles[0] : undefined);
        if (!target) return;
        handleQuadTileAction('open', target);
        handleNavigateFactor('base');
        return;
      }
      if (action === 'compare') {
        emitClientMetric('compare_used', { batchId: tile?.batchId ?? activeTiles[0]?.batchId ?? null });
        showNotice('Compare view is coming soon.');
        return;
      }
      if (action === 'hero' && tile) {
        handleHeroChange(tile);
        return;
      }
    },
    [activeTiles, handleHeroChange, handleQuadTileAction, handleNavigateFactor, showNotice]
  );

  const fallbackEngineId = selectedEngine?.id ?? 'unknown-engine';

  const handleGalleryGroupAction = useCallback(
    (group: GroupSummary, action: GroupCardAction) => {
      if (group.source === 'active') {
        const renderGroup = renderGroups.get(group.id);
        if (!renderGroup || renderGroup.items.length === 0) return;
        const preferredHeroKey =
          batchHeroes[group.id] ?? renderGroup.items.find((item) => item.videoUrl)?.localKey ?? renderGroup.items[0]?.localKey;
        const heroRender = preferredHeroKey
          ? renderGroup.items.find((item) => item.localKey === preferredHeroKey) ?? renderGroup.items[0]
          : renderGroup.items[0];
        if (!heroRender) return;
        if (action === 'compare') {
          emitClientMetric('compare_used', { batchId: group.id });
          showNotice('Compare view is coming soon.');
          return;
        }
        const tile = buildQuadTileFromRender(heroRender, renderGroup);
        if (action === 'open') {
          handleQuadTileAction('open', tile);
          return;
        }
        if (action === 'continue') {
          handleQuadTileAction('continue', tile);
          return;
        }
        if (action === 'refine') {
          handleQuadTileAction('refine', tile);
          return;
        }
        if (action === 'branch') {
          handleQuadTileAction('branch', tile);
        }
        return;
      }

      const hero = group.hero;
      const memberToTile = (member: GroupMemberSummary): QuadPreviewTile => ({
        localKey: member.localKey ?? member.id,
        batchId: member.batchId ?? group.id,
        id: member.jobId ?? member.id,
        iterationIndex: member.iterationIndex ?? 0,
        iterationCount: member.iterationCount ?? group.count,
        videoUrl: member.videoUrl ?? undefined,
        thumbUrl: member.thumbUrl ?? undefined,
        aspectRatio: member.aspectRatio ?? '16:9',
        progress: typeof member.progress === 'number' ? member.progress : member.status === 'completed' ? 100 : 0,
        message: member.message ?? '',
        priceCents: member.priceCents ?? undefined,
        currency: member.currency ?? undefined,
        durationSec: member.durationSec,
        engineLabel: member.engineLabel,
        engineId: member.engineId ?? fallbackEngineId,
        etaLabel: member.etaLabel ?? undefined,
        prompt: member.prompt ?? '',
        status: member.status ?? 'completed',
      });

      if (action === 'compare') {
        emitClientMetric('compare_used', { batchId: group.id });
        showNotice('Compare view is coming soon.');
        return;
      }

      if (action === 'branch') {
        showNotice('Branching flow is coming soon in this build.');
        return;
      }

      const tile = memberToTile(hero);

      if (action === 'open') {
        const targetBatchId = tile.batchId ?? group.batchId ?? null;
        if (tile.iterationCount > 1) {
          setViewMode('quad');
        } else {
          setViewMode('single');
        }
        if (targetBatchId) {
          setActiveBatchId(targetBatchId);
          if (tile.localKey) {
            setBatchHeroes((prev) => ({ ...prev, [targetBatchId]: tile.localKey! }));
          }
        }
        setSelectedPreview({
          id: tile.id,
          localKey: tile.localKey,
          batchId: tile.batchId,
          iterationIndex: tile.iterationIndex,
          iterationCount: tile.iterationCount,
          videoUrl: tile.videoUrl,
          aspectRatio: tile.aspectRatio,
          thumbUrl: tile.thumbUrl,
          progress: tile.progress,
          message: tile.message,
          priceCents: tile.priceCents,
          currency: tile.currency,
          etaLabel: tile.etaLabel,
        });
        return;
      }

      if (action === 'continue' || action === 'refine') {
        handleQuadTileAction(action, tile);
        return;
      }
    },
    [
      renderGroups,
      batchHeroes,
      buildQuadTileFromRender,
      handleQuadTileAction,
      showNotice,
      fallbackEngineId,
      setViewMode,
      setActiveBatchId,
      setSelectedPreview,
    ]
  );

  const openGroupViaGallery = useCallback(
    (group: GroupSummary) => {
      handleGalleryGroupAction(group, 'open');
    },
    [handleGalleryGroupAction]
  );

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg text-text-secondary">
        Loading engines…
      </main>
    );
  }

  if (enginesError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg text-state-warning">
        Failed to load engines: {enginesError.message}
      </main>
    );
  }

  if (!selectedEngine || !form) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg text-text-secondary">
        No engines available.
      </main>
    );
  }

  const singlePrice = preflight?.total ?? null;
  const price = typeof singlePrice === 'number' && form?.iterations ? singlePrice * form.iterations : singlePrice;
  const currency = preflight?.currency ?? 'USD';
  const currentRender = renders[0] ?? null;
  const previewSourceSingle = selectedPreview ??
    (currentRender
      ? {
          id: currentRender.id,
          localKey: currentRender.localKey,
          batchId: currentRender.batchId,
          iterationIndex: currentRender.iterationIndex,
          iterationCount: currentRender.iterationCount,
          videoUrl: currentRender.videoUrl,
          aspectRatio: currentRender.aspectRatio,
          progress: currentRender.progress,
          message: currentRender.message,
          priceCents: currentRender.priceCents,
          currency: currentRender.currency,
          etaSeconds: currentRender.etaSeconds,
          etaLabel: currentRender.etaLabel,
        }
      : null);

  const shouldShowQuad = viewMode === 'quad' && activeTiles.length > 0;

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex flex-1">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <main className="flex flex-1 flex-col gap-5 p-5 lg:p-7">
            {notice && (
              <div className="rounded-[12px] border border-[#FACC15]/60 bg-[#FEF3C7] px-4 py-2 text-sm text-[#92400E] shadow-card">
                {notice}
              </div>
            )}
            <div className="grid gap-5 xl:grid-cols-[320px_auto]">
              <div className="contents xl:col-start-1 xl:row-start-1 xl:flex xl:min-w-0 xl:flex-col xl:gap-5 xl:self-start">
                <div className="order-1 xl:order-none">
                  <div className="min-w-0">
                    <EngineSelect
                      engines={engines}
                      engineId={form.engineId}
                      onEngineChange={(engineId) =>
                        setForm((current) => (current ? { ...current, engineId } : current))
                      }
                      mode={form.mode}
                      onModeChange={(mode) =>
                        setForm((current) =>
                          current
                            ? {
                                ...current,
                                mode,
                                resolution:
                                  mode === 'i2v' && selectedEngine.resolutions.includes('auto')
                                    ? 'auto'
                                    : mode === 't2v' && current.resolution === 'auto'
                                      ? selectedEngine.resolutions.find((value) => value !== 'auto') ?? selectedEngine.resolutions[0]
                                      : current.resolution,
                                aspectRatio:
                                  mode === 'i2v' && selectedEngine.aspectRatios.includes('auto')
                                    ? 'auto'
                                    : mode === 't2v' && current.aspectRatio === 'auto'
                                      ? selectedEngine.aspectRatios.find((value) => value !== 'auto') ?? selectedEngine.aspectRatios[0]
                                      : current.aspectRatio,
                                addons: {
                                  ...current.addons,
                                  audio: selectedEngine.audio && mode === 't2v'
                                }
                              }
                            : current
                        )
                      }
                    />
                  </div>
                </div>
                <div className="order-3 xl:order-none">
                  <div className="min-w-0">
                    <SettingsControls
                      engine={selectedEngine}
                      duration={form.durationSec}
                      onDurationChange={(durationSec) =>
                        setForm((current) => (current ? { ...current, durationSec } : current))
                      }
                      resolution={form.resolution}
                      onResolutionChange={(resolution) =>
                        setForm((current) => (current ? { ...current, resolution } : current))
                      }
                      aspectRatio={form.aspectRatio}
                      onAspectRatioChange={(aspectRatio) =>
                        setForm((current) => (current ? { ...current, aspectRatio } : current))
                      }
                      fps={form.fps}
                      onFpsChange={(fps) =>
                        setForm((current) => (current ? { ...current, fps } : current))
                      }
                      addons={form.addons}
                      onAddonToggle={(key, value) =>
                        setForm((current) =>
                          current
                            ? {
                                ...current,
                                addons: {
                                  ...current.addons,
                                  [key]: value,
                                },
                              }
                            : current
                        )
                      }
                      mode={form.mode}
                      iterations={form.iterations}
                      onIterationsChange={(iterations) =>
                        setForm((current) => {
                          const next = current ? { ...current, iterations } : current;
                          if (iterations <= 1) {
                            setViewMode('single');
                          }
                          return next;
                        })
                      }
                      viewMode={viewMode}
                      onViewModeChange={(mode) => {
                        setViewMode(mode);
                        emitClientMetric('quad_view_toggled', {
                          enabled: mode === 'quad',
                          iterations: form.iterations,
                          engine: selectedEngine.id,
                        });
                        if (mode === 'quad' && effectiveBatchId) {
                          setActiveBatchId(effectiveBatchId);
                        }
                      }}
                      seedLocked={form.seedLocked}
                      onSeedLockedChange={(seedLocked) =>
                        setForm((current) => (current ? { ...current, seedLocked } : current))
                      }
                      apiKey={form.openaiApiKey}
                      onApiKeyChange={(value) =>
                        setForm((current) => {
                          if (!current) return current;
                          const next = value.trim();
                          return { ...current, openaiApiKey: next ? next : undefined };
                        })
                      }
                      showApiKeyField={selectedEngine.id.startsWith('sora-2')}
                      focusRefs={{
                        duration: durationRef,
                        resolution: resolutionRef,
                        addons: addonsRef,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="order-2 xl:order-none xl:col-start-2 xl:row-start-1 xl:self-start">
                <div className="space-y-5">
                  {shouldShowQuad && activeGroup ? (
                    <QuadPreviewPanel
                      tiles={activeTiles}
                      heroKey={activeHeroKey}
                      preflight={preflight}
                      iterations={form.iterations}
                      currency={currency}
                      totalPriceCents={activeGroup.totalPriceCents}
                      onNavigateFactor={handleNavigateFactor}
                      onTileAction={handleQuadTileAction}
                      onGroupAction={handleGroupAction}
                      onSelectHero={handleSelectHeroTile}
                      engineMap={engineMap}
                      onSaveComposite={() => {
                        emitClientMetric('group_composite_saved', { batchId: activeGroup.id });
                        showNotice('Composite saving is coming soon.');
                      }}
                    />
                  ) : (
                    <PreviewCard
                      engine={selectedEngine}
                      price={price}
                      currency={currency}
                      preflight={preflight}
                      isPricing={isPricing}
                      onNavigateFactor={handleNavigateFactor}
                      iterations={form.iterations}
                      renderPending={Boolean(previewSourceSingle && !previewSourceSingle.videoUrl)}
                      renderProgress={previewSourceSingle?.progress ?? 0}
                      renderMessage={previewSourceSingle?.message}
                      renderEtaLabel={previewSourceSingle?.etaLabel}
                      renderVideoUrl={previewSourceSingle?.videoUrl}
                      aspectRatio={previewSourceSingle?.aspectRatio || form.aspectRatio}
                      billingBadge={pricingBillingBadge}
                      billingNote={pricingBillingNote}
                      selectedResolution={form.resolution}
                    />
                  )}
                  <Composer
                    engine={selectedEngine}
                    prompt={prompt}
                    onPromptChange={setPrompt}
                    negativePrompt={negativePrompt}
                    onNegativePromptChange={setNegativePrompt}
                    price={price}
                    currency={currency}
                    isLoading={isPricing}
                    error={preflightError}
                    messages={preflight?.messages}
                    textareaRef={composerRef}
                    onGenerate={startRender}
                    iterations={form.iterations}
                    preflight={preflight}
                    promptField={inputSchemaSummary.promptField}
                    promptRequired={inputSchemaSummary.promptRequired}
                    negativePromptField={inputSchemaSummary.negativePromptField}
                    negativePromptRequired={inputSchemaSummary.negativePromptRequired}
                    assetFields={inputSchemaSummary.assetFields}
                    assets={composerAssets}
                    onAssetAdd={handleAssetAdd}
                    onAssetRemove={handleAssetRemove}
                    onNotice={showNotice}
                  />
                </div>
              </div>
            </div>
          </main>
        </div>
        <GalleryRail
          engine={selectedEngine}
          currentPrompt={prompt}
          onReplacePrompt={handleReplacePrompt}
          onAppendPrompt={handleAppendPrompt}
          onFocusComposer={focusComposer}
          onRequestEngineSwitch={handleRequestEngineSwitch}
          pendingItems={nonGroupedRenders}
          activeGroups={pendingGroups}
                onSelectPreview={(payload) => {
                  setViewMode('single');
                  const render = payload?.id
                    ? renders.find((item) => item.id === payload.id || item.localKey === payload.id)
                    : undefined;
                  if (render) {
                    setActiveBatchId(render.batchId);
                    setSelectedPreview({
                      id: render.id,
                      localKey: render.localKey,
                      batchId: render.batchId,
                      iterationIndex: render.iterationIndex,
                      iterationCount: render.iterationCount,
                      videoUrl: payload?.videoUrl ?? render.videoUrl,
                      thumbUrl: payload?.thumbUrl ?? render.thumbUrl,
                      aspectRatio: payload?.aspectRatio ?? render.aspectRatio,
                      progress: typeof payload?.progress === 'number' ? payload.progress : render.progress,
                      message: payload?.message ?? render.message,
                      priceCents: payload?.priceCents ?? render.priceCents,
                      currency: payload?.currency ?? render.currency,
                      etaSeconds: render.etaSeconds,
                      etaLabel: render.etaLabel,
                    });
                    return;
                  }
                  setSelectedPreview((current) => ({
                    id: payload?.id ?? current?.id,
                    localKey: payload?.localKey ?? current?.localKey,
                    batchId: payload?.batchId ?? current?.batchId,
                    iterationIndex: payload?.iterationIndex ?? current?.iterationIndex,
                    iterationCount: payload?.iterationCount ?? current?.iterationCount,
                    videoUrl: payload?.videoUrl ?? current?.videoUrl,
                    thumbUrl: payload?.thumbUrl ?? current?.thumbUrl,
                    aspectRatio: payload?.aspectRatio ?? current?.aspectRatio,
                    progress: typeof payload?.progress === 'number' ? payload.progress : current?.progress ?? 0,
                    message: payload?.message ?? current?.message ?? '',
                    priceCents: payload?.priceCents ?? current?.priceCents,
                    currency: payload?.currency ?? current?.currency,
                    etaSeconds: current?.etaSeconds,
                    etaLabel: current?.etaLabel,
                  }));
                }}
          onOpenGroup={openGroupViaGallery}
          onGroupAction={handleGalleryGroupAction}
        />
      </div>
      {topUpModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 px-4">
          <div className="absolute inset-0" role="presentation" onClick={closeTopUpModal} />
          <form
            className="relative z-10 w-full max-w-md rounded-[16px] border border-border bg-white p-6 shadow-2xl"
            onSubmit={handleTopUpSubmit}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h2 className="text-base font-semibold text-text-primary">Wallet balance too low</h2>
                <p className="mt-2 text-sm text-text-secondary">{topUpModal.message}</p>
                {topUpModal.amountLabel && (
                  <p className="mt-2 text-sm font-medium text-text-primary">
                    Suggested top-up: {topUpModal.amountLabel}
                  </p>
                )}
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Add credits</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[500, 1000, 2500].map((value) => {
                      const formatted = (() => {
                        try {
                          return new Intl.NumberFormat(CURRENCY_LOCALE, { style: 'currency', currency }).format(value / 100);
                        } catch {
                          return `${currency} ${(value / 100).toFixed(2)}`;
                        }
                      })();
                      const isActive = topUpAmount === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => handleSelectPresetAmount(value)}
                          className={clsx(
                            'rounded-input border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            isActive
                              ? 'border-accent bg-accent/10 text-accent'
                              : 'border-hairline bg-white text-text-secondary hover:border-accentSoft/50 hover:bg-accentSoft/10'
                          )}
                        >
                          {formatted}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3">
                    <label htmlFor="custom-topup" className="text-xs font-semibold uppercase tracking-micro text-text-muted">
                      Other amount
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-text-secondary">
                          $
                        </span>
                        <input
                          id="custom-topup"
                          type="number"
                          min={5}
                          step={1}
                          value={Math.max(5, Math.round(topUpAmount / 100))}
                          onChange={handleCustomAmountChange}
                          className="h-10 w-full rounded-input border border-border bg-white pl-6 pr-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </div>
                      <span className="text-xs text-text-muted">Min $5</span>
                    </div>
                  </div>
                  {topUpError && <p className="mt-2 text-sm text-state-warning">{topUpError}</p>}
                </div>
              </div>
              <button
                type="button"
                onClick={closeTopUpModal}
                className="rounded-full border border-hairline bg-white/80 p-2 text-text-muted transition hover:bg-accentSoft/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Close"
              >
                Close
              </button>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeTopUpModal}
                className="rounded-input border border-hairline px-4 py-2 text-sm font-medium text-text-secondary transition hover:border-accentSoft/50 hover:bg-accentSoft/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Maybe later
              </button>
              <button
                type="submit"
                disabled={isTopUpLoading}
                className={clsx(
                  'rounded-input border border-transparent bg-accent px-4 py-2 text-sm font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
                  !isTopUpLoading && 'hover:brightness-105'
                )}
              >
                {isTopUpLoading ? 'Starting top-up…' : 'Add funds'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
