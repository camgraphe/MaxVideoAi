'use client';

import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useEngines, useInfiniteJobs, runPreflight, runGenerate, getJobStatus } from '@/lib/api';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { EngineCaps, EngineInputField, Mode, PreflightRequest, PreflightResponse } from '@/types/engines';
import { getEngineCaps, type EngineCaps as EngineCapabilityCaps } from '@/fixtures/engineCaps';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { EngineSelect } from '@/components/ui/EngineSelect';
import { SettingsControls } from '@/components/SettingsControls';
import { Composer, type ComposerAttachment, type AssetFieldConfig } from '@/components/Composer';
import type { QuadPreviewTile, QuadTileAction } from '@/components/QuadPreviewPanel';
import { GalleryRail } from '@/components/GalleryRail';
import type { GroupSummary, GroupMemberSummary } from '@/types/groups';
import { CompositePreviewDock } from '@/components/groups/CompositePreviewDock';
import { GroupViewerModal } from '@/components/groups/GroupViewerModal';
import { CURRENCY_LOCALE } from '@/lib/intl';
import { getRenderEta } from '@/lib/render-eta';
import { savePersistedGroupSummaries } from '@/lib/job-groups';
import { getMockJob, subscribeMockJobs } from '@/lib/mock-jobs-store';
import { ENV as CLIENT_ENV } from '@/lib/env';
import { adaptGroupSummaries, adaptGroupSummary } from '@/lib/video-group-adapter';
import type { VideoGroup } from '@/types/video-groups';
import { useResultProvider } from '@/hooks/useResultProvider';
import { GroupedJobCard, type GroupedJobAction } from '@/components/GroupedJobCard';
import { normalizeGroupSummaries, normalizeGroupSummary } from '@/lib/normalize-group-summary';

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

const MODE_DISPLAY_LABEL: Record<Mode, string> = {
  t2v: 'Text → Video',
  i2v: 'Image → Video',
  v2v: 'Video → Video',
};

type DurationOptionMeta = {
  raw: number | string;
  value: number;
  label: string;
};

function parseDurationOptionValue(option: number | string): DurationOptionMeta {
  if (typeof option === 'number') {
    return {
      raw: option,
      value: option,
      label: `${option}s`,
    };
  }
  const numeric = Number(option.replace(/[^\d.]/g, ''));
  return {
    raw: option,
    value: Number.isFinite(numeric) ? numeric : 0,
    label: option,
  };
}

function matchesDurationOption(meta: DurationOptionMeta, previousOption: number | string | null | undefined, previousSeconds: number | null | undefined): boolean {
  if (previousOption != null) {
    if (typeof previousOption === 'number') {
      return Math.abs(meta.value - previousOption) < 0.001;
    }
    if (typeof previousOption === 'string') {
      if (previousOption === meta.raw || previousOption === meta.label) return true;
      const previousNumeric = Number(previousOption.replace(/[^\d.]/g, ''));
      if (Number.isFinite(previousNumeric)) {
        return Math.abs(meta.value - previousNumeric) < 0.001;
      }
    }
  }
  if (previousSeconds != null) {
    return Math.abs(meta.value - previousSeconds) < 0.001;
  }
  return false;
}

function framesToSeconds(frames: number): number {
  if (!Number.isFinite(frames) || frames <= 0) return 1;
  return Math.max(1, Math.round(frames / 24));
}

function coerceFormState(engine: EngineCaps, mode: Mode, previous: FormState | null | undefined): FormState {
  const capability = getEngineCaps(engine.id, mode) as EngineCapabilityCaps | undefined;

  const durationResult = (() => {
    const prevOption = previous?.durationOption ?? null;
    const prevSeconds = previous?.durationSec ?? null;
    const prevFrames = previous?.numFrames ?? null;
    if (capability?.frames && capability.frames.length) {
      const framesList = capability.frames;
      const selectedFrames = prevFrames && framesList.includes(prevFrames) ? prevFrames : framesList[0];
      const durationSec = framesToSeconds(selectedFrames);
      return {
        durationSec,
        durationOption: selectedFrames,
        numFrames: selectedFrames,
      };
    }
    if (capability?.duration) {
      if ('options' in capability.duration) {
        const parsedOptions = capability.duration.options.map(parseDurationOptionValue).filter((entry) => entry.value > 0);
        const defaultRaw = capability.duration.default ?? parsedOptions[0]?.raw ?? engine.maxDurationSec;
        const defaultMeta = parseDurationOptionValue(defaultRaw as number | string);
        const selected = parsedOptions.find((meta) => matchesDurationOption(meta, prevOption, prevSeconds))
          ?? parsedOptions.find((meta) => matchesDurationOption(meta, defaultRaw as number | string, defaultMeta.value))
          ?? parsedOptions[0]
          ?? defaultMeta;
        const clampedSeconds = Math.max(1, Math.min(engine.maxDurationSec, Math.round(selected.value)));
        return {
          durationSec: clampedSeconds,
          durationOption: selected.raw,
          numFrames: null,
        };
      }
      const min = capability.duration.min;
      const defaultValue = typeof capability.duration.default === 'number' ? capability.duration.default : min;
      const candidate = prevSeconds != null ? Math.max(min, prevSeconds) : defaultValue;
      const clampedSeconds = Math.max(min, Math.min(engine.maxDurationSec, Math.round(candidate)));
      return {
        durationSec: clampedSeconds,
        durationOption: clampedSeconds,
        numFrames: null,
      };
    }
    const fallback = prevSeconds != null ? prevSeconds : Math.min(engine.maxDurationSec, 8);
    return {
      durationSec: Math.max(1, Math.round(fallback)),
      durationOption: fallback,
      numFrames: null,
    };
  })();

  const resolutionOptions = capability?.resolution && capability.resolution.length ? capability.resolution : engine.resolutions;
  const aspectOptions = capability?.aspectRatio && capability.aspectRatio.length ? capability.aspectRatio : engine.aspectRatios;

  const resolution = (() => {
    if (resolutionOptions.length === 0) {
      return previous?.resolution ?? engine.resolutions[0] ?? '1080p';
    }
    const previousResolution = previous?.resolution;
    if (previousResolution && resolutionOptions.includes(previousResolution)) {
      return previousResolution;
    }
    return resolutionOptions[0];
  })();

  const aspectRatio = (() => {
    if (aspectOptions.length === 0) {
      return previous?.aspectRatio ?? engine.aspectRatios[0] ?? '16:9';
    }
    const previousAspect = previous?.aspectRatio;
    if (previousAspect && aspectOptions.includes(previousAspect)) {
      return previousAspect;
    }
    return aspectOptions[0];
  })();

  const fpsOptions = engine.fps && engine.fps.length ? engine.fps : [24];
  const fps = (() => {
    if (previous?.fps && fpsOptions.includes(previous.fps)) {
      return previous.fps;
    }
    return fpsOptions[0];
  })();

  const audioSupported = capability?.audioToggle === true && mode === 't2v';
  const addons = {
    audio: audioSupported ? Boolean(previous?.addons.audio) : false,
    upscale4k: engine.upscale4k ? Boolean(previous?.addons.upscale4k) : false,
  };

  const iterations = previous?.iterations ? Math.max(1, Math.min(4, previous.iterations)) : 1;

  return {
    engineId: engine.id,
    mode,
    durationSec: durationResult.durationSec,
    durationOption: durationResult.durationOption,
    numFrames: durationResult.numFrames ?? undefined,
    resolution,
    aspectRatio,
    fps,
    iterations,
    addons,
    seedLocked: previous?.seedLocked ?? false,
    openaiApiKey: previous?.openaiApiKey,
  };
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
  durationOption?: number | string | null;
  numFrames?: number | null;
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
  memberTier: 'maxvideoai.generate.memberTier.v1',
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
      durationOption,
      numFrames,
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
      durationOption:
        typeof durationOption === 'number' || typeof durationOption === 'string'
          ? durationOption
          : undefined,
      numFrames:
        typeof numFrames === 'number' && Number.isFinite(numFrames) && numFrames > 0
          ? Math.round(numFrames)
          : undefined,
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
  const provider = useResultProvider();
  const showCenterGallery = CLIENT_ENV.WORKSPACE_CENTER_GALLERY === 'true';

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [form, setForm] = useState<FormState | null>(null);
  const [prompt, setPrompt] = useState<string>(DEFAULT_PROMPT);
  const [negativePrompt, setNegativePrompt] = useState<string>('');
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

  const storageScope = useMemo(() => userId ?? 'anon', [userId]);
  const storageKey = useCallback(
    (base: string, scope: string = storageScope) => `${base}:${scope}`,
    [storageScope]
  );
  const readStorage = useCallback(
    (base: string): string | null => {
      if (typeof window === 'undefined') return null;
      const scopedValue = window.localStorage.getItem(storageKey(base));
      if (scopedValue !== null) {
        return scopedValue;
      }
      if (storageScope !== 'anon') {
        const anonValue = window.localStorage.getItem(storageKey(base, 'anon'));
        if (anonValue !== null) {
          return anonValue;
        }
      }
      return window.localStorage.getItem(base);
    },
    [storageKey, storageScope]
  );
  const writeStorage = useCallback(
    (base: string, value: string | null) => {
      if (typeof window === 'undefined') return;
      const key = storageKey(base);
      if (value === null) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, value);
      }
      if (storageScope !== 'anon') {
        window.localStorage.removeItem(storageKey(base, 'anon'));
        window.localStorage.removeItem(base);
      } else if (value === null) {
        window.localStorage.removeItem(base);
      } else {
        window.localStorage.setItem(base, value);
      }
    },
    [storageKey, storageScope]
  );
  const nextPath = useMemo(() => {
    const base = pathname || '/app';
    const search = searchParams?.toString();
    return search ? `${base}?${search}` : base;
  }, [pathname, searchParams]);

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
  status: 'pending' | 'completed' | 'failed';
  videoUrl?: string;
  readyVideoUrl?: string;
  thumbUrl?: string;
  priceCents?: number;
  currency?: string;
  pricingSnapshot?: PreflightResponse['pricing'];
  paymentStatus?: string;
  etaSeconds?: number;
  etaLabel?: string;
  startedAt: number;
  minReadyAt: number;
  groupId?: string | null;
  renderIds?: string[];
  heroRenderId?: string | null;
};

type LocalRenderGroup = {
  id: string;
  items: LocalRender[];
  iterationCount: number;
  readyCount: number;
  totalPriceCents: number | null;
  currency?: string;
  groupId?: string | null;
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
    status?: 'pending' | 'completed' | 'failed';
    message?: string;
    priceCents?: number;
    currency?: string;
    etaSeconds?: number;
    etaLabel?: string;
    prompt?: string;
  } | null>(null);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [batchHeroes, setBatchHeroes] = useState<Record<string, string>>({});
  const [viewerTarget, setViewerTarget] = useState<{ kind: 'pending'; id: string } | { kind: 'summary'; summary: GroupSummary } | null>(null);
  const [viewMode, setViewMode] = useState<'single' | 'quad'>('single');
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const rendersRef = useRef<LocalRender[]>([]);
  const hydratedScopeRef = useRef<string | null>(null);
  const clearUserState = useCallback(() => {
    hydratedScopeRef.current = null;
    setUserId(null);
    setAuthChecked(false);
    setForm(null);
    setPrompt(DEFAULT_PROMPT);
    setNegativePrompt('');
    setRenders([]);
    setBatchHeroes({});
    setActiveBatchId(null);
    setSelectedPreview(null);
    setViewMode('single');
    setActiveGroupId(null);
    setPreflight(null);
    setPreflightError(undefined);
    setPricing(false);
    setNotice(null);
    setTopUpModal(null);
    setTopUpError(null);
    setIsTopUpLoading(false);
    setMemberTier('Member');
    setTopUpAmount(500);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const ensureSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      const session = data.session;
      if (!session?.access_token || !session.user?.id) {
        clearUserState();
        const target = nextPath && nextPath !== '/login' ? `/login?next=${encodeURIComponent(nextPath)}` : '/login';
        router.replace(target);
        return;
      }
      setUserId(session.user.id);
      setAuthChecked(true);
    };

    ensureSession().catch(() => {
      clearUserState();
      const target = nextPath && nextPath !== '/login' ? `/login?next=${encodeURIComponent(nextPath)}` : '/login';
      router.replace(target);
    });

    const { data: authSubscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.access_token || !session.user?.id) {
        clearUserState();
        const target = nextPath && nextPath !== '/login' ? `/login?next=${encodeURIComponent(nextPath)}` : '/login';
        router.replace(target);
        return;
      }
      setUserId(session.user.id);
      setAuthChecked(true);
    });

    return () => {
      cancelled = true;
      authSubscription?.subscription.unsubscribe();
    };
  }, [nextPath, router, clearUserState]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hydratedScopeRef.current === storageScope) return;
    hydratedScopeRef.current = storageScope;

    try {
      const promptValue = readStorage(STORAGE_KEYS.prompt);
      setPrompt(promptValue ?? DEFAULT_PROMPT);

      const negativeValue = readStorage(STORAGE_KEYS.negativePrompt);
      setNegativePrompt(negativeValue ?? '');

      const formValue = readStorage(STORAGE_KEYS.form);
      setForm(formValue ? parseStoredForm(formValue) : null);

      const storedRendersValue = readStorage(STORAGE_KEYS.renders);
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
                (typeof candidate.status === 'string' || candidate.status === undefined) &&
                typeof candidate.startedAt === 'number' &&
                typeof candidate.minReadyAt === 'number'
              );
            })
            .map((value) => {
              const videoUrl = typeof value.videoUrl === 'string' ? value.videoUrl : undefined;
              const readyVideoUrl = typeof value.readyVideoUrl === 'string' ? value.readyVideoUrl : undefined;
              const status =
                (value.status as LocalRender['status']) ??
                (videoUrl ? 'completed' : 'pending');
              return {
                ...value,
                videoUrl,
                readyVideoUrl,
                status,
              };
            })
            .slice(0, MAX_PERSISTED_RENDERS);
          setRenders(storedRenders);
          if (storedRenders.length) {
            setActiveBatchId(storedRenders[0].batchId ?? null);
          } else {
            setActiveBatchId(null);
          }
        } else {
          setRenders([]);
          setActiveBatchId(null);
        }
      } else {
        setRenders([]);
        setActiveBatchId(null);
      }

      const storedHeroesValue = readStorage(STORAGE_KEYS.batchHeroes);
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
          setBatchHeroes(storedHeroes);
        } else {
          setBatchHeroes({});
        }
      } else {
        setBatchHeroes({});
      }
      const storedTier = readStorage(STORAGE_KEYS.memberTier);
      if (storedTier === 'Member' || storedTier === 'Plus' || storedTier === 'Pro') {
        setMemberTier(storedTier);
      }
    } catch {
      setRenders([]);
      setBatchHeroes({});
      setActiveBatchId(null);
    }
  }, [readStorage, setMemberTier, storageScope]);

  useEffect(() => {
    rendersRef.current = renders;
  }, [renders]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const unsubscribe = subscribeMockJobs(() => {
      setRenders((previous) =>
        previous.map((render) => {
          const job = getMockJob(render.id);
          if (!job) return render;
          const normalizedStatus = job.status;
          const nextThumb = job.thumbUrl ?? render.thumbUrl;
          const now = Date.now();
          const gatingActive = Boolean(job.videoUrl) && now < render.minReadyAt;
          const nextStatus = gatingActive ? 'pending' : normalizedStatus;
          const nextProgress = gatingActive ? Math.min(job.progress, 95) : job.progress;
          const readyVideo = job.videoUrl ?? render.readyVideoUrl;
          const nextVideoUrl = gatingActive ? render.videoUrl : readyVideo;
          if (
            render.progress === nextProgress &&
            render.status === nextStatus &&
            render.videoUrl === nextVideoUrl &&
            render.readyVideoUrl === readyVideo &&
            render.thumbUrl === nextThumb
          ) {
            return render;
          }
          return {
            ...render,
            progress: nextProgress,
            status: nextStatus,
            readyVideoUrl: readyVideo,
            videoUrl: nextVideoUrl,
            thumbUrl: nextThumb ?? undefined,
          };
        })
      );
      setSelectedPreview((current) => {
        if (!current?.id) return current;
        const job = getMockJob(current.id);
        if (!job) return current;
        const nextVideoUrl = job.videoUrl ?? current.videoUrl;
        const nextThumb = job.thumbUrl ?? current.thumbUrl;
        return {
          ...current,
          progress: job.progress,
          status: job.status,
          videoUrl: nextVideoUrl,
          thumbUrl: nextThumb ?? undefined,
        };
      });
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (!renders.length) {
        writeStorage(STORAGE_KEYS.renders, null);
        return;
      }
      const limited = renders.slice(0, MAX_PERSISTED_RENDERS);
      writeStorage(STORAGE_KEYS.renders, JSON.stringify(limited));
    } catch {
      // noop
    }
  }, [renders, writeStorage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (!Object.keys(batchHeroes).length) {
        writeStorage(STORAGE_KEYS.batchHeroes, null);
        return;
      }
      writeStorage(STORAGE_KEYS.batchHeroes, JSON.stringify(batchHeroes));
    } catch {
      // noop
    }
  }, [batchHeroes, writeStorage]);
  const renderGroups = useMemo<Map<string, LocalRenderGroup>>(() => {
    const map = new Map<string, LocalRenderGroup>();
    renders.forEach((item) => {
      const key = item.groupId ?? item.batchId ?? item.localKey;
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
        if (!existing.groupId && item.groupId) {
          existing.groupId = item.groupId;
        }
      } else {
        map.set(key, {
          id: key,
          items: [item],
          iterationCount: item.iterationCount || 1,
          readyCount: item.videoUrl ? 1 : 0,
          totalPriceCents: typeof item.priceCents === 'number' ? item.priceCents : null,
          currency: item.currency,
          groupId: item.groupId ?? item.batchId ?? null,
        });
      }
    });
    map.forEach((group) => {
      group.items.sort((a, b) => a.iterationIndex - b.iterationIndex);
      if (!group.items.length) {
        group.iterationCount = 1;
        group.totalPriceCents = null;
        return;
      }
      const observedCount = Math.max(group.iterationCount, group.items.length);
      group.iterationCount = Math.max(1, Math.min(4, observedCount));
      if (group.totalPriceCents != null && group.iterationCount > group.items.length) {
        // scale total if some iterations missing price yet
        const average = group.totalPriceCents / group.items.length;
        group.totalPriceCents = Math.round(average * group.iterationCount);
      }
    });
    return map;
  }, [renders]);
  const effectiveBatchId = useMemo(() => activeBatchId ?? selectedPreview?.batchId ?? null, [activeBatchId, selectedPreview?.batchId]);
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
  useEffect(() => {
    const currentIterations = form?.iterations ?? 1;
    if (currentIterations <= 1 && viewMode !== 'single') {
      setViewMode('single');
    }
  }, [form?.iterations, viewMode]);
  const pendingGroups = useMemo<GroupSummary[]>(() => {
    const summaries: GroupSummary[] = [];
    renderGroups.forEach((group, id) => {

      const now = Date.now();
      const members: GroupMemberSummary[] = group.items.map((item) => {
        const thumb = item.thumbUrl ?? resolveRenderThumb(item);
        const gatingActive = now < item.minReadyAt && item.status !== 'failed';
        const memberVideoUrl = gatingActive ? null : item.videoUrl ?? item.readyVideoUrl ?? null;
        const memberStatus: GroupMemberSummary['status'] = (() => {
          if (item.status === 'failed') return 'failed';
          if (gatingActive) return 'pending';
          if (item.status === 'completed' || memberVideoUrl) return 'completed';
          return 'pending';
        })();
        const memberProgress = typeof item.progress === 'number'
          ? gatingActive
            ? Math.min(Math.max(item.progress, 5), 95)
            : item.progress
          : memberStatus === 'completed'
            ? 100
            : item.progress;
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
          videoUrl: memberVideoUrl,
          aspectRatio: item.aspectRatio ?? null,
          prompt: item.prompt,
          status: memberStatus,
          progress: memberProgress,
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
      const observedCount = Math.max(group.iterationCount, members.length);
      const displayCount = Math.max(1, Math.min(4, observedCount));

      const previews = members
        .slice(0, displayCount)
        .map((member) => ({
          id: member.id,
          thumbUrl: member.thumbUrl,
          videoUrl: member.videoUrl,
          aspectRatio: member.aspectRatio,
        }));
      const batchKey = group.groupId ?? group.items[0]?.batchId ?? id;

      summaries.push({
        id,
        source: 'active',
        splitMode: displayCount > 1 ? 'quad' : 'single',
        batchId: batchKey,
        count: displayCount,
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
  const normalizedPendingGroups = useMemo(() => normalizeGroupSummaries(pendingGroups), [pendingGroups]);

  useEffect(() => {
    if (!pendingGroups.length) {
      setActiveGroupId(null);
      return;
    }
    if (!activeGroupId || !pendingGroups.some((group) => group.id === activeGroupId)) {
      setActiveGroupId(pendingGroups[0].id);
    }
  }, [pendingGroups, activeGroupId]);

  useEffect(() => {
    const groupsForStorage = pendingGroups.filter((group) => group.members.length > 0);
    savePersistedGroupSummaries(groupsForStorage.slice(0, 12), storageKey(STORAGE_KEYS.groupSummaries));
  }, [pendingGroups, storageKey]);
  const pendingSummaryMap = useMemo(() => {
    const map = new Map<string, GroupSummary>();
    pendingGroups.forEach((group) => {
      map.set(group.id, group);
    });
    return map;
  }, [pendingGroups]);
  const activeVideoGroups = useMemo(() => adaptGroupSummaries(pendingGroups, provider), [pendingGroups, provider]);
  const activeVideoGroup = useMemo<VideoGroup | null>(() => {
    if (!activeVideoGroups.length) return null;
    if (!activeGroupId) return activeVideoGroups[0] ?? null;
    return activeVideoGroups.find((group) => group.id === activeGroupId) ?? activeVideoGroups[0] ?? null;
  }, [activeVideoGroups, activeGroupId]);
  const isGenerationLoading = useMemo(() => pendingGroups.some((group) => group.members.some((member) => member.status !== 'completed')), [pendingGroups]);
  const generationSkeletonCount = useMemo(() => {
    const count = renders.length > 0 ? renders.length : form?.iterations ?? 1;
    return Math.max(1, Math.min(4, count || 1));
  }, [renders, form?.iterations]);
  const viewerGroup = useMemo<VideoGroup | null>(() => {
    if (!viewerTarget) return null;
    if (viewerTarget.kind === 'pending') {
      const summary = pendingSummaryMap.get(viewerTarget.id);
      if (!summary) return null;
      return adaptGroupSummary(normalizeGroupSummary(summary), provider);
    }
    return adaptGroupSummary(normalizeGroupSummary(viewerTarget.summary), provider);
  }, [viewerTarget, pendingSummaryMap, provider]);
  const buildQuadTileFromRender = useCallback(
    (render: LocalRender, group: LocalRenderGroup): QuadPreviewTile => {
      const gatingActive = render.status !== 'failed' && Date.now() < render.minReadyAt;
      const videoUrl = gatingActive ? undefined : render.videoUrl ?? render.readyVideoUrl;
      const progress = gatingActive ? Math.min(Math.max(render.progress ?? 5, 95), 95) : render.progress;
      const status: QuadPreviewTile['status'] = render.status === 'failed'
        ? 'failed'
        : gatingActive
          ? 'pending'
          : render.status ?? (videoUrl ? 'completed' : 'pending');

      return {
        localKey: render.localKey,
        batchId: render.batchId,
        id: render.id,
        iterationIndex: render.iterationIndex,
        iterationCount: group.iterationCount,
        videoUrl,
        thumbUrl: render.thumbUrl,
        aspectRatio: render.aspectRatio,
        progress,
        message: render.message,
        priceCents: render.priceCents,
        currency: render.currency ?? group.currency ?? preflight?.currency ?? 'USD',
        durationSec: render.durationSec,
        engineLabel: render.engineLabel,
        engineId: render.engineId,
        etaLabel: render.etaLabel,
        prompt: render.prompt,
        status,
      };
    },
    [preflight?.currency]
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!form) {
      writeStorage(STORAGE_KEYS.form, null);
      return;
    }
    try {
      writeStorage(STORAGE_KEYS.form, JSON.stringify(form));
    } catch {
      // noop
    }
  }, [form, writeStorage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      writeStorage(STORAGE_KEYS.prompt, prompt);
    } catch {
      // noop
    }
  }, [prompt, writeStorage]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      writeStorage(STORAGE_KEYS.negativePrompt, negativePrompt);
    } catch {
      // noop
    }
  }, [negativePrompt, writeStorage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      writeStorage(STORAGE_KEYS.memberTier, memberTier);
    } catch {
      // noop
    }
  }, [memberTier, writeStorage]);

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

  const handleRefreshJob = useCallback(async (jobId: string) => {
    try {
      const status = await getJobStatus(jobId);
      if (status.status === 'failed') {
        throw new Error(status.message ?? 'Le rendu a été signalé comme échoué côté fournisseur.');
      }
      if (status.status !== 'completed' && !status.videoUrl) {
        throw new Error('Le rendu est toujours en cours côté fournisseur.');
      }
    } catch (error) {
      throw error instanceof Error ? error : new Error("Impossible d'actualiser le statut du rendu.");
    }
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
    if (!authChecked) return undefined;
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
  }, [authChecked]);

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
      prompt: latestJobWithMedia.prompt ?? undefined,
    });
  }, [latestJobsPages, renders.length, selectedPreview]);

  const focusComposer = useCallback(() => {
    if (!composerRef.current) return;
    composerRef.current.focus({ preventScroll: true });
    composerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }, []);

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

  const capability = useMemo(() => {
    if (!selectedEngine) return undefined;
    return getEngineCaps(selectedEngine.id, activeMode) ?? undefined;
  }, [selectedEngine, activeMode]);

  const handleEngineChange = useCallback(
    (engineId: string) => {
      const nextEngine = engines.find((entry) => entry.id === engineId);
      if (!nextEngine) return;
      setForm((current) => {
        const candidate = current ?? null;
        const nextMode = candidate && nextEngine.modes.includes(candidate.mode) ? candidate.mode : nextEngine.modes[0];
        const normalizedPrevious = candidate ? { ...candidate, engineId: nextEngine.id, mode: nextMode } : null;
        return coerceFormState(nextEngine, nextMode, normalizedPrevious);
      });
    },
    [engines]
  );

  const handleModeChange = useCallback(
    (mode: Mode) => {
      if (!selectedEngine) return;
      const nextMode = selectedEngine.modes.includes(mode) ? mode : selectedEngine.modes[0];
      setForm((current) => coerceFormState(selectedEngine, nextMode, current ? { ...current, mode: nextMode } : null));
    },
    [selectedEngine]
  );

  const handleDurationChange = useCallback((raw: number | string) => {
    setForm((current) => {
      if (!current) return current;
      const numeric = typeof raw === 'number' ? raw : Number(String(raw).replace(/[^\d.]/g, ''));
      const durationSec = Number.isFinite(numeric) ? Math.max(1, Math.round(numeric)) : current.durationSec;
      return {
        ...current,
        durationSec,
        durationOption: raw,
        numFrames: null,
      };
    });
  }, []);

  const handleFramesChange = useCallback((value: number) => {
    setForm((current) => {
      if (!current) return current;
      const safeFrames = Math.max(1, Math.round(value));
      return {
        ...current,
        numFrames: safeFrames,
        durationSec: framesToSeconds(safeFrames),
        durationOption: safeFrames,
      };
    });
  }, []);

  const handleResolutionChange = useCallback(
    (resolution: string) => {
      setForm((current) => {
        if (!current) return current;
        if (!selectedEngine) return current;
        const allowed = capability?.resolution && capability.resolution.length ? capability.resolution : selectedEngine.resolutions;
        if (allowed.length && !allowed.includes(resolution)) {
          const fallback = allowed.includes(current.resolution) ? current.resolution : allowed[0];
          return fallback === current.resolution ? current : { ...current, resolution: fallback };
        }
        if (current.resolution === resolution) return current;
        return { ...current, resolution };
      });
    },
    [capability, selectedEngine]
  );

  const handleAspectRatioChange = useCallback(
    (ratio: string) => {
      setForm((current) => {
        if (!current) return current;
        if (!selectedEngine) return current;
        const allowed = capability?.aspectRatio && capability.aspectRatio.length ? capability.aspectRatio : selectedEngine.aspectRatios;
        if (allowed.length && !allowed.includes(ratio)) {
          const fallback = allowed.includes(current.aspectRatio) ? current.aspectRatio : allowed[0];
          return fallback === current.aspectRatio ? current : { ...current, aspectRatio: fallback };
        }
        if (current.aspectRatio === ratio) return current;
        return { ...current, aspectRatio: ratio };
      });
    },
    [capability, selectedEngine]
  );

  const handleFpsChange = useCallback((fps: number) => {
    setForm((current) => {
      if (!current) return current;
      if (current.fps === fps) return current;
      return { ...current, fps };
    });
  }, []);

  const handleAddonToggle = useCallback((key: 'audio' | 'upscale4k', value: boolean) => {
    setForm((current) => {
      if (!current) return current;
      if (current.addons[key] === value) return current;
      return {
        ...current,
        addons: {
          ...current.addons,
          [key]: value,
        },
      };
    });
  }, []);

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
    if (!form || !selectedEngine || !authChecked) return;
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

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? null;
    const paymentMode: 'wallet' | 'platform' = token ? 'wallet' : 'platform';
    const currencyCode = preflight?.pricing?.currency ?? preflight?.currency ?? 'USD';

    const presentInsufficientFunds = (shortfallCents?: number) => {
      const normalizedShortfall = typeof shortfallCents === 'number' ? Math.max(0, shortfallCents) : undefined;

      let friendlyNotice = 'Insufficient wallet balance. Please add funds to continue generating.';
      let formattedShortfall: string | undefined;
      if (typeof normalizedShortfall === 'number' && normalizedShortfall > 0) {
        try {
          formattedShortfall = new Intl.NumberFormat(CURRENCY_LOCALE, {
            style: 'currency',
            currency: currencyCode,
          }).format(normalizedShortfall / 100);
          friendlyNotice = `Insufficient wallet balance. Add at least ${formattedShortfall} to continue generating.`;
        } catch {
          formattedShortfall = `${currencyCode} ${(normalizedShortfall / 100).toFixed(2)}`;
          friendlyNotice = `Insufficient wallet balance. Add at least ${formattedShortfall} to continue generating.`;
        }
      }

      showNotice(friendlyNotice);
      setTopUpModal({
        message: friendlyNotice,
        amountLabel: formattedShortfall,
        shortfallCents: typeof normalizedShortfall === 'number' ? normalizedShortfall : undefined,
      });
      setPreflightError(friendlyNotice);
    };

    if (paymentMode === 'wallet') {
      const unitCostCents =
        typeof preflight?.pricing?.totalCents === 'number'
          ? preflight.pricing.totalCents
          : typeof preflight?.total === 'number'
            ? preflight.total
            : null;
      if (typeof unitCostCents === 'number' && unitCostCents > 0) {
        const requiredCents = unitCostCents * iterationCount;
        try {
          const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
          const res = await fetch('/api/wallet', { headers });
          if (res.ok) {
            const walletJson = await res.json();
            const balanceCents =
              typeof walletJson.balanceCents === 'number'
                ? walletJson.balanceCents
                : typeof walletJson.balance === 'number'
                  ? Math.round(walletJson.balance * 100)
                  : typeof walletJson.balance === 'string'
                    ? Math.round(Number(walletJson.balance) * 100)
                  : undefined;
            if (typeof balanceCents === 'number') {
              const shortfall = requiredCents - balanceCents;
              if (shortfall > 0) {
                presentInsufficientFunds(shortfall);
                return;
              }
            }
          }
        } catch (walletError) {
          console.warn('[startRender] wallet balance check failed', walletError);
        }
      }
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
      const friendlyMessage = iterationCount > 1
        ? `Take ${iterationIndex + 1}/${iterationCount} • ${FRIENDLY_MESSAGES[Math.floor(Math.random() * FRIENDLY_MESSAGES.length)]}`
        : FRIENDLY_MESSAGES[Math.floor(Math.random() * FRIENDLY_MESSAGES.length)];
      const startedAt = Date.now();
      const minEtaSeconds = Math.max(20, etaSeconds);
      const minDurationMs = Math.max(2000, minEtaSeconds * 1000);
      const minReadyAt = startedAt + minDurationMs;

      let progressMessage = friendlyMessage;
      const totalMs = minDurationMs;
      let progressInterval: number | null = null;
      let progressTimeout: number | null = null;

      const stopProgressTracking = () => {
        if (typeof window === 'undefined') return;
        if (progressInterval !== null) {
          window.clearInterval(progressInterval);
          progressInterval = null;
        }
        if (progressTimeout !== null) {
          window.clearTimeout(progressTimeout);
          progressTimeout = null;
        }
      };

      const startProgressTracking = () => {
        if (typeof window === 'undefined') return;
        if (progressInterval !== null) return;
        progressInterval = window.setInterval(() => {
          const now = Date.now();
          const elapsed = now - startedAt;
          const pct = Math.min(95, Math.round((elapsed / totalMs) * 100));
          setRenders((prev) =>
            prev.map((r) =>
              r.localKey === localKey && !r.videoUrl
                ? {
                    ...r,
                    progress: pct < 5 ? 5 : pct,
                    message: progressMessage,
                  }
                : r
            )
          );
          setSelectedPreview((cur) =>
            cur && cur.localKey === localKey && !cur.videoUrl
              ? { ...cur, progress: pct < 5 ? 5 : pct, message: progressMessage }
              : cur
          );
        }, 400);
        const timeoutMs = Math.max(totalMs * 1.5, totalMs + 15000);
        progressTimeout = window.setTimeout(() => {
          stopProgressTracking();
        }, timeoutMs);
      };

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
        status: 'pending',
        thumbUrl: thumb,
        readyVideoUrl: undefined,
        priceCents: preflight?.pricing?.totalCents ?? undefined,
        currency: preflight?.pricing?.currency ?? preflight?.currency ?? 'USD',
        pricingSnapshot: preflight?.pricing,
        paymentStatus: 'pending_payment',
        etaSeconds,
        etaLabel,
        startedAt,
        minReadyAt,
        groupId: batchId,
        renderIds: undefined,
        heroRenderId: null,
      };

      setRenders((prev) => [initial, ...prev]);
      setBatchHeroes((prev) => {
        if (prev[batchId]) return prev;
        return { ...prev, [batchId]: localKey };
      });
      setActiveBatchId(batchId);
      setActiveGroupId(batchId);
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
        prompt,
        status: initial.status,
      });

      startProgressTracking();

      try {
        const res = await runGenerate(
          {
            engineId: selectedEngine.id,
            prompt: trimmedPrompt,
            durationSec: form.durationSec,
            numFrames: form.numFrames ?? undefined,
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
            batchId,
            groupId: batchId,
            iterationIndex,
            iterationCount,
            localKey,
            message: friendlyMessage,
            etaSeconds,
            etaLabel,
          },
          token ? { token } : undefined
        );

        const resolvedJobId = res.jobId ?? id;
        const resolvedBatchId = res.batchId ?? batchId;
        const resolvedGroupId = res.groupId ?? batchId;
        const resolvedIterationIndex = res.iterationIndex ?? iterationIndex;
        const resolvedIterationCount = res.iterationCount ?? iterationCount;
        const resolvedThumb = res.thumbUrl ?? thumb;
        const resolvedPriceCents =
          res.pricing?.totalCents ?? preflight?.pricing?.totalCents ?? undefined;
        const resolvedCurrency =
          res.pricing?.currency ?? preflight?.pricing?.currency ?? preflight?.currency ?? 'USD';
        const resolvedEtaSeconds =
          typeof res.etaSeconds === 'number' ? res.etaSeconds : etaSeconds;
        const resolvedEtaLabel = res.etaLabel ?? etaLabel;
        const resolvedMessage = res.message ?? friendlyMessage;
        const resolvedStatus =
          res.status ?? (res.videoUrl ? 'completed' : 'pending');
        const resolvedProgress =
          typeof res.progress === 'number' ? res.progress : res.videoUrl ? 100 : 5;
        const resolvedPricingSnapshot = res.pricing ?? preflight?.pricing;
        const resolvedPaymentStatus = res.paymentStatus ?? 'pending_payment';
        const resolvedRenderIds = res.renderIds ?? undefined;
        const resolvedHeroRenderId = res.heroRenderId ?? null;
        const resolvedVideoUrl = res.videoUrl ?? undefined;

        const now = Date.now();
        const gatingActive = Boolean(resolvedVideoUrl) && now < minReadyAt;
        const clampedProgress = resolvedProgress < 5 ? 5 : resolvedProgress;
        const gatedProgress = gatingActive ? Math.min(clampedProgress, 95) : clampedProgress;

        setRenders((prev) =>
          prev.map((render) =>
            render.localKey === localKey
              ? {
                  ...render,
                  id: resolvedJobId,
                  jobId: resolvedJobId,
                  batchId: resolvedBatchId,
                  groupId: resolvedGroupId,
                  iterationIndex: resolvedIterationIndex,
                  iterationCount: resolvedIterationCount,
                  thumbUrl: resolvedThumb,
                  message: resolvedMessage,
                  progress: gatedProgress,
                  status: gatingActive ? 'pending' : resolvedStatus,
                  priceCents: resolvedPriceCents,
                  currency: resolvedCurrency,
                  pricingSnapshot: resolvedPricingSnapshot,
                  paymentStatus: resolvedPaymentStatus,
                  etaSeconds: resolvedEtaSeconds,
                  etaLabel: resolvedEtaLabel,
                  renderIds: resolvedRenderIds,
                  heroRenderId: resolvedHeroRenderId,
                  readyVideoUrl: resolvedVideoUrl ?? render.readyVideoUrl,
                  videoUrl: gatingActive ? render.videoUrl : resolvedVideoUrl ?? render.videoUrl,
                }
              : render
          )
        );
        progressMessage = resolvedMessage;
        setSelectedPreview((cur) =>
          cur && cur.localKey === localKey
            ? {
                ...cur,
                id: resolvedJobId,
                batchId: resolvedBatchId,
                iterationIndex: resolvedIterationIndex,
                iterationCount: resolvedIterationCount,
                thumbUrl: resolvedThumb,
                progress: gatedProgress,
                message: resolvedMessage,
                priceCents: resolvedPriceCents,
                currency: resolvedCurrency,
                etaSeconds: resolvedEtaSeconds,
                etaLabel: resolvedEtaLabel,
                videoUrl: gatingActive ? cur.videoUrl : resolvedVideoUrl ?? cur.videoUrl,
                status: gatingActive ? 'pending' : resolvedStatus,
              }
            : cur
        );

        if (resolvedIterationCount > 1) {
          setViewMode((prev) => (prev === 'quad' ? prev : 'quad'));
        }
        setActiveBatchId(resolvedBatchId);
        setActiveGroupId(resolvedBatchId ?? batchId ?? id);
        setBatchHeroes((prev) => {
          if (prev[resolvedBatchId]) return prev;
          return { ...prev, [resolvedBatchId]: localKey };
        });

        if (resolvedVideoUrl || resolvedStatus === 'completed') {
          stopProgressTracking();
        }

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('wallet:invalidate'));
        }

        const jobId = resolvedJobId;
        const poll = async () => {
          try {
            const status = await getJobStatus(jobId);
            if (status.message) {
              progressMessage = status.message;
            }
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
                      status: status.status ?? r.status,
                      progress: status.progress ?? r.progress,
                      readyVideoUrl: status.videoUrl ?? r.readyVideoUrl,
                      videoUrl: status.videoUrl ?? r.videoUrl ?? r.readyVideoUrl,
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
                    status: status.status ?? cur.status,
                    id: jobId,
                    localKey,
                    progress: status.progress ?? cur.progress,
                    videoUrl: status.videoUrl ?? target?.readyVideoUrl ?? cur.videoUrl,
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
            if (status.status === 'completed' || status.status === 'failed' || status.videoUrl) {
              stopProgressTracking();
            }
          } catch {
            window.setTimeout(poll, 3000);
          }
        };
        window.setTimeout(poll, 1500);

        if (resolvedVideoUrl) {
          stopProgressTracking();
        }
      } catch (error) {
        stopProgressTracking();
        let fallbackBatchId: string | null = null;
        setRenders((prev) => {
          const next = prev.filter((r) => r.localKey !== localKey);
          fallbackBatchId = next[0]?.batchId ?? null;
          return next;
        });
        setBatchHeroes((prev) => {
          if (!prev[batchId]) return prev;
          const next = { ...prev };
          delete next[batchId];
          return next;
        });
        setActiveBatchId((current) => (current === batchId ? fallbackBatchId : current));
        setActiveGroupId((current) => (current === batchId ? fallbackBatchId : current));
        setSelectedPreview((cur) => (cur && cur.localKey === localKey ? null : cur));
        if (isInsufficientFundsError(error)) {
          const shortfallCents = error.details?.requiredCents;
          presentInsufficientFunds(shortfallCents);
          return;
        }
        setPreflightError(error instanceof Error ? error.message : 'Generate failed');
      }
    };

    for (let iterationIndex = 0; iterationIndex < iterationCount; iterationIndex += 1) {
      void runIteration(iterationIndex);
    }
  }, [form, prompt, negativePrompt, selectedEngine, preflight, memberTier, showNotice, inputSchemaSummary, inputAssets, authChecked, setActiveGroupId]);

  useEffect(() => {
    if (!selectedEngine || !authChecked) return;
    setForm((current) => {
      const candidate = current ?? null;
      const nextMode = candidate && selectedEngine.modes.includes(candidate.mode) ? candidate.mode : selectedEngine.modes[0];
      const normalizedPrevious = candidate ? { ...candidate, mode: nextMode } : null;
      const nextState = coerceFormState(selectedEngine, nextMode, normalizedPrevious);
      if (candidate) {
        const hasChanged =
          candidate.engineId !== nextState.engineId ||
          candidate.mode !== nextState.mode ||
          candidate.durationSec !== nextState.durationSec ||
          candidate.durationOption !== nextState.durationOption ||
          candidate.numFrames !== nextState.numFrames ||
          candidate.resolution !== nextState.resolution ||
          candidate.aspectRatio !== nextState.aspectRatio ||
          candidate.fps !== nextState.fps ||
          candidate.iterations !== nextState.iterations ||
          candidate.addons.audio !== nextState.addons.audio ||
          candidate.addons.upscale4k !== nextState.addons.upscale4k ||
          candidate.seedLocked !== nextState.seedLocked ||
          candidate.openaiApiKey !== nextState.openaiApiKey;
        return hasChanged ? nextState : candidate;
      }
      return nextState;
    });
  }, [selectedEngine, authChecked]);

  useEffect(() => {
    if (!form || !selectedEngine || !authChecked) return;
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
      Promise.resolve()
        .then(() => runPreflight(payload))
        .then((response) => {
          if (canceled) return;
          setPreflight(response);
        })
        .catch((err) => {
          if (canceled) return;
          console.error('[preflight] failed', err);
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
  }, [form, selectedEngine, memberTier, authChecked]);

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
            thumbUrl: tile.thumbUrl,
            progress: tile.progress,
            message: tile.message,
            priceCents: tile.priceCents,
            currency: tile.currency,
            etaLabel: tile.etaLabel,
            prompt: tile.prompt,
          });
          break;
        }
        default:
          break;
      }
    },
    [focusComposer, setForm, setPrompt, showNotice]
  );

  const fallbackEngineId = selectedEngine?.id ?? 'unknown-engine';

  const handleGalleryGroupAction = useCallback(
    (group: GroupSummary, action: GroupedJobAction) => {
      setActiveGroupId(group.id);
      if (action === 'remove') {
        return;
      }
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
          setViewerTarget({ kind: 'pending', id: group.id });
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
          prompt: tile.prompt,
        });
        setViewerTarget({ kind: 'summary', summary: group });
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
      setActiveGroupId,
      setViewerTarget,
      setViewMode,
      setActiveBatchId,
      setSelectedPreview,
    ]
  );

  const openGroupViaGallery = useCallback(
    (group: GroupSummary) => {
      setActiveGroupId(group.id);
      handleGalleryGroupAction(group, 'open');
    },
    [handleGalleryGroupAction, setActiveGroupId]
  );
  const handleActiveGroupOpen = useCallback(
    (group: GroupSummary) => {
      setActiveGroupId(group.id);
      handleGalleryGroupAction(group, 'open');
    },
    [handleGalleryGroupAction, setActiveGroupId]
  );
  const handleActiveGroupAction = useCallback(
    (group: GroupSummary, action: GroupedJobAction) => {
      if (action === 'remove') return;
      setActiveGroupId(group.id);
      handleGalleryGroupAction(group, action);
    },
    [handleGalleryGroupAction, setActiveGroupId]
  );

  const singlePriceCents = typeof preflight?.total === 'number' ? preflight.total : null;
  const singlePrice =
    typeof singlePriceCents === 'number' ? singlePriceCents / 100 : null;
  const price =
    typeof singlePrice === 'number' && form?.iterations
      ? singlePrice * form.iterations
      : singlePrice;
  const currency = preflight?.currency ?? 'USD';

  if (!authChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg text-text-secondary">
        Checking session…
      </main>
    );
  }

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
                      onEngineChange={handleEngineChange}
                      mode={form.mode}
                      onModeChange={handleModeChange}
                    />
                  </div>
                </div>
                <div className="order-3 xl:order-none">
                  <div className="min-w-0">
                    <SettingsControls
                      engine={selectedEngine}
                      caps={capability}
                      durationSec={form.durationSec}
                      durationOption={form.durationOption ?? null}
                      onDurationChange={handleDurationChange}
                      numFrames={form.numFrames ?? undefined}
                      onNumFramesChange={handleFramesChange}
                      resolution={form.resolution}
                      onResolutionChange={handleResolutionChange}
                      aspectRatio={form.aspectRatio}
                      onAspectRatioChange={handleAspectRatioChange}
                      fps={form.fps}
                      onFpsChange={handleFpsChange}
                      addons={form.addons}
                      onAddonToggle={handleAddonToggle}
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
                    {selectedEngine && (
                      <div className="mt-3 space-y-1 rounded-input border border-border/80 bg-white/80 p-3 text-[12px] text-text-secondary">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-text-primary">{selectedEngine.label}</span>
                          <span className="text-text-muted">• {MODE_DISPLAY_LABEL[form.mode]}</span>
                        </div>
                        {capability?.notes && <p className="text-[11px] text-text-muted">{capability.notes}</p>}
                        {capability?.maxUploadMB && form.mode === 'i2v' && (
                          <p className="text-[11px] text-text-muted">Max upload: {capability.maxUploadMB} MB</p>
                        )}
                        {capability?.acceptsImageFormats && capability.acceptsImageFormats.length > 0 && form.mode === 'i2v' && (
                          <p className="text-[11px] text-text-muted">
                            Accepted formats: {capability.acceptsImageFormats.map((format) => format.toUpperCase()).join(', ')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="order-2 xl:order-none xl:col-start-2 xl:row-start-1 xl:self-start">
                <div className="space-y-5">
                  {showCenterGallery ? (
                    normalizedPendingGroups.length === 0 && !isGenerationLoading ? (
                      <div className="rounded-card border border-border bg-white/80 p-5 text-center text-sm text-text-secondary">
                        Launch a generation to populate your gallery. Variants for each run will appear here.
                      </div>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2">
                        {normalizedPendingGroups.map((group) => {
                          const engineId = group.hero.engineId;
                          const engine = engineId ? engineMap.get(engineId) ?? null : null;
                          return (
                            <GroupedJobCard
                              key={group.id}
                              group={group}
                              engine={engine ?? undefined}
                              onOpen={handleActiveGroupOpen}
                              onAction={handleActiveGroupAction}
                              allowRemove={false}
                            />
                          );
                        })}
                        {isGenerationLoading &&
                          Array.from({ length: normalizedPendingGroups.length ? 0 : generationSkeletonCount }).map((_, index) => (
                            <div key={`workspace-gallery-skeleton-${index}`} className="rounded-card border border-border bg-white/60 p-0" aria-hidden>
                              <div className="relative overflow-hidden rounded-card">
                                <div className="relative" style={{ aspectRatio: '16 / 9' }}>
                                  <div className="skeleton absolute inset-0" />
                                </div>
                              </div>
                              <div className="border-t border-border bg-white/70 px-3 py-2">
                                <div className="h-3 w-24 rounded-full bg-neutral-200" />
                              </div>
                            </div>
                          ))}
                      </div>
                    )
                  ) : null}
                  <CompositePreviewDock
                    group={activeVideoGroup}
                    isLoading={isGenerationLoading && !activeVideoGroup}
                    onOpenModal={(group) => setViewerTarget({ kind: 'pending', id: group.id })}
                  />
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
          activeGroups={normalizedPendingGroups}
          groupStorageKey={storageKey(STORAGE_KEYS.groupSummaries)}
          onOpenGroup={openGroupViaGallery}
          onGroupAction={handleGalleryGroupAction}
        />
      </div>
      {viewerGroup ? (
        <GroupViewerModal
          group={viewerGroup}
          onClose={() => setViewerTarget(null)}
          onRefreshJob={handleRefreshJob}
        />
      ) : null}
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
