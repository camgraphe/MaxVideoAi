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
import { GalleryRail } from '@/components/GalleryRail';
import type { PriceFactorKind } from '@/components/PriceFactorsBar';
import { CURRENCY_LOCALE } from '@/lib/intl';

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
}

const DEFAULT_PROMPT = 'A quiet cinematic shot of neon-lit Tokyo streets in the rain';
const STORAGE_KEYS = {
  prompt: 'maxvideoai.generate.prompt.v1',
  negativePrompt: 'maxvideoai.generate.negativePrompt.v1',
  form: 'maxvideoai.generate.form.v1',
} as const;

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
  };

  const [renders, setRenders] = useState<LocalRender[]>([]);
  const [selectedPreview, setSelectedPreview] = useState<{
    id?: string;
    videoUrl?: string;
    aspectRatio?: string;
    thumbUrl?: string;
    progress?: number;
    message?: string;
    priceCents?: number;
    currency?: string;
  } | null>(null);
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

  const durationRef = useRef<HTMLInputElement>(null);
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
    const id = `local_${Date.now()}`;
    const ar = form.aspectRatio;
    const thumb = ar === '9:16'
      ? '/assets/frames/thumb-9x16.svg'
      : ar === '1:1'
        ? '/assets/frames/thumb-1x1.svg'
        : '/assets/frames/thumb-16x9.svg';

    const initial: LocalRender = {
      id,
      engineId: selectedEngine.id,
      engineLabel: selectedEngine.label,
      createdAt: new Date().toISOString(),
      aspectRatio: form.aspectRatio,
      durationSec: form.durationSec,
      prompt,
      progress: 5,
      message: FRIENDLY_MESSAGES[Math.floor(Math.random() * FRIENDLY_MESSAGES.length)],
      thumbUrl: thumb,
      priceCents: preflight?.pricing?.totalCents ?? undefined,
      currency: preflight?.pricing?.currency ?? preflight?.currency ?? 'USD',
      pricingSnapshot: preflight?.pricing,
      paymentStatus: 'pending_payment',
    };

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

    setRenders((prev) => [initial, ...prev]);
    setSelectedPreview({
      id,
      aspectRatio: form.aspectRatio,
      thumbUrl: thumb,
      progress: initial.progress,
      message: initial.message,
      priceCents: initial.priceCents,
      currency: initial.currency,
    });

    // Kick off backend generate; keep optimistic UI
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
        },
        token ? { token } : undefined
      );
      if (res?.jobId) {
        // Replace temporary id with backend jobId and start polling
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
          cur && cur.id === id
                ? {
                    ...cur,
                    id: res.jobId!,
                    thumbUrl: res.thumbUrl ?? cur.thumbUrl,
                    priceCents: res.pricing?.totalCents ?? cur.priceCents,
                    currency: res.pricing?.currency ?? cur.currency,
                  }
                : cur
        );

        const jobId = res.jobId;
        const poll = async () => {
          try {
            const status = await getJobStatus(jobId!);
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
              cur && cur.id === jobId
                ? {
                    ...cur,
                    progress: status.progress ?? cur.progress,
                    videoUrl: status.videoUrl ?? cur.videoUrl,
                    thumbUrl: status.thumbUrl ?? cur.thumbUrl,
                    priceCents: status.finalPriceCents ?? status.pricing?.totalCents ?? cur.priceCents,
                    currency: status.currency ?? status.pricing?.currency ?? cur.currency,
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
      setRenders((prev) => prev.filter((r) => r.id !== id));
      setSelectedPreview((cur) => (cur && cur.id === id ? null : cur));
      if (isInsufficientFundsError(error)) {
        const shortfallCents = error.details?.requiredCents;
        const currencyCode = preflight?.pricing?.currency ?? preflight?.currency ?? 'USD';
        let friendlyMessage = 'Insufficient wallet balance. Please add funds to continue generating.';
        let formattedShortfall: string | undefined;
        if (typeof shortfallCents === 'number' && shortfallCents > 0) {
          try {
            formattedShortfall = new Intl.NumberFormat(CURRENCY_LOCALE, {
              style: 'currency',
              currency: currencyCode,
            }).format(shortfallCents / 100);
            friendlyMessage = `Insufficient wallet balance. Add at least ${formattedShortfall} to continue generating.`;
          } catch {
            formattedShortfall = `${currencyCode} ${(shortfallCents / 100).toFixed(
              2
            )}`;
            friendlyMessage = `Insufficient wallet balance. Add at least ${formattedShortfall} to continue generating.`;
          }
        }
        showNotice(friendlyMessage);
        setTopUpModal({
          message: friendlyMessage,
          amountLabel: formattedShortfall,
          shortfallCents: typeof shortfallCents === 'number' ? shortfallCents : undefined,
        });
        setPreflightError(friendlyMessage);
        return;
      }
      setPreflightError(error instanceof Error ? error.message : 'Generate failed');
    }

    // Simulate progress locally for UX even while backend processes
    const totalMs = 6000 + Math.floor(Math.random() * 4000);
    const started = Date.now();
    const interval = window.setInterval(() => {
      setRenders((prev) => {
        const now = Date.now();
        const elapsed = now - started;
        const pct = Math.min(100, Math.round((elapsed / totalMs) * 100));
        const updated = prev.map((r) =>
          r.id === id
            ? {
                ...r,
                progress: pct < 5 ? 5 : pct,
                message: FRIENDLY_MESSAGES[Math.floor(Math.random() * FRIENDLY_MESSAGES.length)]
              }
            : r
        );
        setSelectedPreview((cur) => (cur && cur.id === id ? { ...cur, progress: pct < 5 ? 5 : pct, message: FRIENDLY_MESSAGES[Math.floor(Math.random() * FRIENDLY_MESSAGES.length)] } : cur));
        return updated;
      });
    }, 400);
    window.setTimeout(() => window.clearInterval(interval), totalMs + 1000);
  }, [form, prompt, negativePrompt, selectedEngine, preflight, memberTier, showNotice, inputSchemaSummary, inputAssets]);

  useEffect(() => {
    if (!selectedEngine) return;
    setForm((current) => {
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
  const previewSource = selectedPreview ??
    (currentRender
      ? {
          id: currentRender.id,
          videoUrl: currentRender.videoUrl,
          aspectRatio: currentRender.aspectRatio,
          progress: currentRender.progress,
          message: currentRender.message,
          priceCents: currentRender.priceCents,
          currency: currentRender.currency,
        }
      : null);

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
                        setForm((current) => (current ? { ...current, iterations } : current))
                      }
                      seedLocked={form.seedLocked}
                      onSeedLockedChange={(seedLocked) =>
                        setForm((current) => (current ? { ...current, seedLocked } : current))
                      }
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
                  <PreviewCard
                    engine={selectedEngine}
                    price={price}
                    currency={currency}
                    preflight={preflight}
                    isPricing={isPricing}
                    onNavigateFactor={handleNavigateFactor}
                    iterations={form.iterations}
                    renderPending={Boolean(previewSource && !previewSource.videoUrl)}
                    renderProgress={previewSource?.progress ?? 0}
                    renderMessage={previewSource?.message}
                    renderVideoUrl={previewSource?.videoUrl}
                    aspectRatio={previewSource?.aspectRatio || form.aspectRatio}
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
          currentPrompt={prompt}
          onReplacePrompt={handleReplacePrompt}
          onAppendPrompt={handleAppendPrompt}
          onFocusComposer={focusComposer}
          onRequestEngineSwitch={handleRequestEngineSwitch}
          pendingItems={renders}
          onSelectPreview={(payload) => {
            setSelectedPreview(payload);
          }}
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
