import type { MultiPromptScene } from '@/components/Composer';
import { LOGIN_LAST_TARGET_KEY, LOGIN_SKIP_ONBOARDING_KEY } from '@/lib/auth-storage';
import type { EngineCaps, Mode } from '@/types/engines';
import { deserializePendingRenders, serializePendingRenders, type LocalRender } from './render-persistence';
import { parseStoredForm, type FormState, type StoredFormState } from './workspace-form-state';
import {
  coerceFormState,
  getPreferredEngineMode,
  isModeValue,
  matchesEngineToken,
  normalizeEngineToken,
} from './workspace-engine-helpers';
import { buildWorkspaceStorageKey, STORAGE_KEYS } from './workspace-storage';

type SearchParamsLike = Pick<URLSearchParams, 'get' | 'toString'> | null | undefined;

export type WorkspaceRequestParams = {
  fromVideoId: string | null;
  requestedJobId: string | null;
  requestedEngineId: string | null;
  requestedMode: Mode | null;
  resolvedRequestedEngineId: string | null;
  requestedEngineToken: string;
  searchString: string;
  loginRedirectTarget: string;
};

export type WorkspaceOnboardingSkipIntent = {
  shouldSkip: boolean;
  skippedViaFlag: boolean;
  fromVideoId: string | null;
  lastTarget: string | null;
  lastTargetShouldSkip: boolean;
};

export type InitialWorkspaceFormResult = {
  form: FormState | null;
  preserveStoredDraft: boolean;
  hasStoredForm: boolean;
  formToPersist: FormState | null;
  debugEngineOverride: {
    from: string | null;
    to: string;
    preserveStoredDraft?: boolean;
  } | null;
};

export type PendingRenderHydrationState = {
  pendingRenders: LocalRender[];
  batchHeroes: Record<string, string>;
  activeBatchId: string | null;
  activeGroupId: string | null;
  serialized: string | null;
};

function readTrimmedParam(searchParams: SearchParamsLike, key: string): string | null {
  const value = searchParams?.get(key);
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function resolveWorkspaceRequestParams(
  searchParams: SearchParamsLike,
  pathname: string | null | undefined
): WorkspaceRequestParams {
  const fromVideoId = searchParams?.get('from') ?? null;
  const requestedJobId = readTrimmedParam(searchParams, 'job');
  const requestedEngineId = readTrimmedParam(searchParams, 'engine');
  const requestedModeRaw = readTrimmedParam(searchParams, 'mode')?.toLowerCase() ?? null;
  const requestedMode = isModeValue(requestedModeRaw) ? requestedModeRaw : null;
  const resolvedRequestedEngineId =
    requestedEngineId?.trim().toLowerCase() === 'pika-image-to-video' ? 'pika-text-to-video' : requestedEngineId;
  const requestedEngineToken = normalizeEngineToken(resolvedRequestedEngineId);
  const searchString = searchParams?.toString() ?? '';
  const base = pathname ?? '/app';

  return {
    fromVideoId,
    requestedJobId,
    requestedEngineId,
    requestedMode,
    resolvedRequestedEngineId,
    requestedEngineToken,
    searchString,
    loginRedirectTarget: searchString ? `${base}?${searchString}` : base,
  };
}

function consumeMigratedStorageValue(key: string): string | null {
  if (typeof window === 'undefined') return null;
  let value = window.sessionStorage.getItem(key);
  if (!value) {
    value = window.localStorage.getItem(key);
    if (value) {
      window.localStorage.removeItem(key);
      window.sessionStorage.setItem(key, value);
    }
  }
  return value;
}

export function consumeWorkspaceOnboardingSkipIntent(fromVideoId: string | null): WorkspaceOnboardingSkipIntent {
  if (typeof window === 'undefined') {
    return {
      shouldSkip: Boolean(fromVideoId),
      skippedViaFlag: false,
      fromVideoId,
      lastTarget: null,
      lastTargetShouldSkip: false,
    };
  }

  const skipFlag = consumeMigratedStorageValue(LOGIN_SKIP_ONBOARDING_KEY);
  const skippedViaFlag = skipFlag === 'true';
  window.sessionStorage.removeItem(LOGIN_SKIP_ONBOARDING_KEY);
  window.localStorage.removeItem(LOGIN_SKIP_ONBOARDING_KEY);

  const lastTarget = consumeMigratedStorageValue(LOGIN_LAST_TARGET_KEY);
  const normalizedLastTarget = lastTarget?.trim() ?? '';
  const lastTargetShouldSkip = Boolean(
    normalizedLastTarget &&
      (normalizedLastTarget.startsWith('/generate') ||
        normalizedLastTarget.startsWith('/app') ||
        normalizedLastTarget.includes('from=') ||
        normalizedLastTarget.includes('engine='))
  );
  window.sessionStorage.removeItem(LOGIN_LAST_TARGET_KEY);
  window.localStorage.removeItem(LOGIN_LAST_TARGET_KEY);

  return {
    shouldSkip: skippedViaFlag || lastTargetShouldSkip || Boolean(fromVideoId),
    skippedViaFlag,
    fromVideoId,
    lastTarget,
    lastTargetShouldSkip,
  };
}

export function parseStoredMultiPromptScenes(
  value: string | null,
  createLocalId: (prefix: string) => string,
  createFallbackScene: () => MultiPromptScene
): MultiPromptScene[] {
  if (!value) return [createFallbackScene()];
  try {
    const parsed = JSON.parse(value) as MultiPromptScene[];
    if (!Array.isArray(parsed) || !parsed.length) return [createFallbackScene()];
    const sanitized = parsed
      .map((scene) => ({
        id: typeof scene.id === 'string' ? scene.id : createLocalId('scene'),
        prompt: typeof scene.prompt === 'string' ? scene.prompt : '',
        duration: typeof scene.duration === 'number' && Number.isFinite(scene.duration) ? Math.round(scene.duration) : 5,
      }))
      .filter((scene) => scene.prompt.length || scene.duration);
    return sanitized.length ? sanitized : [createFallbackScene()];
  } catch {
    return [createFallbackScene()];
  }
}

export function readStoredWorkspaceForm(storageScope: string, formValue: string | null): StoredFormState | null {
  if (typeof window === 'undefined') return formValue ? parseStoredForm(formValue) : null;
  try {
    const scoped = window.localStorage.getItem(buildWorkspaceStorageKey(STORAGE_KEYS.form, storageScope));
    const base = window.localStorage.getItem(STORAGE_KEYS.form);
    const scopedParsed = scoped ? parseStoredForm(scoped) : null;
    const baseParsed = base ? parseStoredForm(base) : null;
    if (storageScope === 'anon') {
      return baseParsed ?? scopedParsed ?? (formValue ? parseStoredForm(formValue) : null);
    }
    if (scopedParsed && baseParsed) {
      const scopedAt = typeof scopedParsed.updatedAt === 'number' ? scopedParsed.updatedAt : 0;
      const baseAt = typeof baseParsed.updatedAt === 'number' ? baseParsed.updatedAt : 0;
      return baseAt > scopedAt ? baseParsed : scopedParsed;
    }
    return scopedParsed ?? baseParsed ?? (formValue ? parseStoredForm(formValue) : null);
  } catch {
    return formValue ? parseStoredForm(formValue) : null;
  }
}

function buildRequestedEngineFallbackForm(engineId: string, mode: Mode): FormState {
  return {
    engineId,
    mode,
    durationSec: 4,
    durationOption: 4,
    numFrames: undefined,
    resolution: '720p',
    aspectRatio: '16:9',
    fps: 24,
    iterations: 1,
    seedLocked: false,
    audio: true,
    seed: null,
    cameraFixed: false,
    safetyChecker: true,
    extraInputValues: {},
  };
}

function findEngineByIdOrToken(engines: EngineCaps[], engineId: string | null, token?: string | null): EngineCaps | null {
  if (!engineId && !token) return null;
  return (
    (engineId ? engines.find((entry) => entry.id === engineId) : null) ??
    (token ? engines.find((entry) => matchesEngineToken(entry, token)) : null) ??
    null
  );
}

export function buildInitialWorkspaceFormState({
  engines,
  storedFormRaw,
  effectiveRequestedEngineId,
  effectiveRequestedEngineToken,
  effectiveRequestedMode,
}: {
  engines: EngineCaps[];
  storedFormRaw: StoredFormState | null;
  effectiveRequestedEngineId: string | null;
  effectiveRequestedEngineToken: string;
  effectiveRequestedMode: Mode | null;
}): InitialWorkspaceFormResult {
  let nextForm: FormState | null = null;
  let formToPersist: FormState | null = null;
  let debugEngineOverride: InitialWorkspaceFormResult['debugEngineOverride'] = null;
  const preserveStoredDraft = Boolean(effectiveRequestedEngineId && storedFormRaw);

  if (storedFormRaw) {
    const storedToken = normalizeEngineToken(storedFormRaw.engineId);
    const engine = findEngineByIdOrToken(engines, storedFormRaw.engineId, storedToken) ?? engines[0] ?? null;
    if (engine) {
      const mode = getPreferredEngineMode(engine, storedFormRaw.mode);
      const base = coerceFormState(engine, mode, null);
      const candidate: FormState = {
        ...base,
        engineId: engine.id,
        mode,
        durationSec:
          typeof storedFormRaw.durationSec === 'number' && Number.isFinite(storedFormRaw.durationSec)
            ? storedFormRaw.durationSec
            : base.durationSec,
        durationOption:
          typeof storedFormRaw.durationOption === 'number' || typeof storedFormRaw.durationOption === 'string'
            ? storedFormRaw.durationOption
            : base.durationOption,
        numFrames:
          typeof storedFormRaw.numFrames === 'number' && Number.isFinite(storedFormRaw.numFrames)
            ? storedFormRaw.numFrames
            : base.numFrames,
        resolution: typeof storedFormRaw.resolution === 'string' ? storedFormRaw.resolution : base.resolution,
        aspectRatio: typeof storedFormRaw.aspectRatio === 'string' ? storedFormRaw.aspectRatio : base.aspectRatio,
        fps: typeof storedFormRaw.fps === 'number' && Number.isFinite(storedFormRaw.fps) ? storedFormRaw.fps : base.fps,
        iterations:
          typeof storedFormRaw.iterations === 'number' && Number.isFinite(storedFormRaw.iterations)
            ? storedFormRaw.iterations
            : base.iterations,
        seedLocked: typeof storedFormRaw.seedLocked === 'boolean' ? storedFormRaw.seedLocked : base.seedLocked,
        loop: typeof storedFormRaw.loop === 'boolean' ? storedFormRaw.loop : base.loop,
        audio: typeof storedFormRaw.audio === 'boolean' ? storedFormRaw.audio : base.audio,
        seed: typeof storedFormRaw.seed === 'number' ? storedFormRaw.seed : base.seed,
        cameraFixed: typeof storedFormRaw.cameraFixed === 'boolean' ? storedFormRaw.cameraFixed : base.cameraFixed,
        safetyChecker:
          typeof storedFormRaw.safetyChecker === 'boolean' ? storedFormRaw.safetyChecker : base.safetyChecker,
        extraInputValues: storedFormRaw.extraInputValues ?? base.extraInputValues,
      };
      nextForm = coerceFormState(engine, mode, candidate);
    }
  }

  const hadStoredForm = Boolean(nextForm);

  if (effectiveRequestedEngineId) {
    const requestedEngine = findEngineByIdOrToken(engines, effectiveRequestedEngineId, effectiveRequestedEngineToken);
    if (requestedEngine) {
      const preferredMode = getPreferredEngineMode(requestedEngine, effectiveRequestedMode ?? nextForm?.mode ?? null);
      const normalizedPrevious = nextForm ? { ...nextForm, engineId: requestedEngine.id, mode: preferredMode } : null;
      nextForm = normalizedPrevious
        ? coerceFormState(requestedEngine, preferredMode, normalizedPrevious)
        : buildRequestedEngineFallbackForm(requestedEngine.id, preferredMode);
      debugEngineOverride = {
        from: storedFormRaw?.engineId ?? null,
        to: nextForm.engineId,
        preserveStoredDraft,
      };
      const shouldPersistRequestedEngine =
        !storedFormRaw || storedFormRaw.engineId !== nextForm.engineId || storedFormRaw.mode !== nextForm.mode;
      if (!preserveStoredDraft || shouldPersistRequestedEngine) {
        formToPersist = nextForm;
      }
    } else if (!storedFormRaw) {
      const preferredMode: Mode = effectiveRequestedMode ?? 't2v';
      nextForm = buildRequestedEngineFallbackForm(effectiveRequestedEngineId, preferredMode);
      formToPersist = nextForm;
      debugEngineOverride = {
        from: null,
        to: nextForm.engineId,
      };
    }
  }

  if (!nextForm && engines[0]) {
    nextForm = coerceFormState(engines[0], getPreferredEngineMode(engines[0], effectiveRequestedMode), null);
  }

  return {
    form: nextForm,
    preserveStoredDraft,
    hasStoredForm: hadStoredForm && (!effectiveRequestedEngineId || preserveStoredDraft),
    formToPersist,
    debugEngineOverride,
  };
}

export function buildPendingRenderHydrationState(value: string | null): PendingRenderHydrationState {
  const pendingRenders = deserializePendingRenders(value);
  const batchHeroes: Record<string, string> = {};
  pendingRenders.forEach((render) => {
    if (render.batchId && render.localKey && !batchHeroes[render.batchId]) {
      batchHeroes[render.batchId] = render.localKey;
    }
  });
  const first = pendingRenders[0];
  const batchId = first ? first.batchId ?? first.groupId ?? first.localKey ?? null : null;
  return {
    pendingRenders,
    batchHeroes,
    activeBatchId: batchId,
    activeGroupId: first ? first.groupId ?? batchId : null,
    serialized: serializePendingRenders(pendingRenders),
  };
}
