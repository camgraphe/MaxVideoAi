'use client';

/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  Camera,
  Check,
  Download,
  Loader2,
  Pin,
  PinOff,
  Sparkles,
  Upload,
  WandSparkles,
} from 'lucide-react';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { authFetch } from '@/lib/authFetch';
import {
  ACCESSORY_OPTIONS,
  AGE_RANGE_OPTIONS,
  AUTO_TRAIT_KEYS,
  BODY_BUILD_OPTIONS,
  CHARACTER_BUILDER_MAX_REFERENCE_IMAGES,
  CHARACTER_BUILDER_STORAGE_KEY,
  CHARACTER_BUILDER_STORAGE_VERSION,
  CHARACTER_CONSISTENCY_OPTIONS,
  CHARACTER_OUTPUT_OPTIONS,
  CHARACTER_QUALITY_OPTIONS,
  CHARACTER_REFERENCE_STRENGTH_OPTIONS,
  createDefaultCharacterBuilderState,
  DISTINCTIVE_FEATURE_OPTIONS,
  EYE_COLOR_OPTIONS,
  FACE_CUES_OPTIONS,
  GENDER_PRESENTATION_OPTIONS,
  HAIR_COLOR_OPTIONS,
  HAIR_LENGTH_OPTIONS,
  HAIRSTYLE_OPTIONS,
  normalizeTraitsForSourceMode,
  OUTFIT_STYLE_OPTIONS,
  REALISM_STYLE_OPTIONS,
  SKIN_TONE_OPTIONS,
} from '@/lib/character-builder';
import { runCharacterBuilderTool, saveImageToLibrary } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { FEATURES } from '@/content/feature-flags';
import type {
  CharacterBuilderAction,
  CharacterBuilderResult,
  CharacterBuilderRun,
  CharacterBuilderSettingsSnapshot,
  CharacterBuilderState,
  CharacterBuilderTraitSource,
  CharacterBuilderTraits,
  CharacterBuilderReferenceImage,
} from '@/types/character-builder';

type UploadedAsset = {
  url: string;
  width?: number | null;
  height?: number | null;
  name?: string | null;
};

type PersistedCharacterBuilderState = {
  version: number;
  state: CharacterBuilderState;
};

type ChoiceOption = {
  id: string;
  label: string;
  description?: string;
  swatch?: string;
};

type ToggleItem = {
  id: string;
  label: string;
};

function triggerDownload(url: string, fileName: string) {
  if (typeof window === 'undefined') return;
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

async function uploadImage(file: File): Promise<UploadedAsset> {
  const formData = new FormData();
  formData.set('file', file);

  const response = await authFetch('/api/uploads/image', {
    method: 'POST',
    body: formData,
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        ok?: boolean;
        error?: string;
        maxMB?: number;
        asset?: {
          url: string;
          width?: number | null;
          height?: number | null;
          name?: string | null;
        };
      }
    | null;

  if (!response.ok || !payload?.ok || !payload.asset?.url) {
    if (payload?.error === 'FILE_TOO_LARGE') {
      throw new Error(`Image exceeds ${payload.maxMB ?? 25} MB.`);
    }
    throw new Error(payload?.error ?? `Upload failed (${response.status})`);
  }

  return {
    url: payload.asset.url,
    width: payload.asset.width,
    height: payload.asset.height,
    name: payload.asset.name,
  };
}

function readPersistedState(): CharacterBuilderState | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(CHARACTER_BUILDER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedCharacterBuilderState | null;
    if (!parsed || parsed.version !== CHARACTER_BUILDER_STORAGE_VERSION || !parsed.state) return null;
    const base = createDefaultCharacterBuilderState(parsed.state.sourceMode === 'reference-image' ? 'reference-image' : 'scratch');
    return {
      ...base,
      ...parsed.state,
      traits: {
        ...base.traits,
        ...parsed.state.traits,
      },
      outputOptions: {
        ...base.outputOptions,
        ...parsed.state.outputOptions,
      },
    };
  } catch {
    return null;
  }
}

function writePersistedState(state: CharacterBuilderState) {
  if (typeof window === 'undefined') return;
  const payload: PersistedCharacterBuilderState = {
    version: CHARACTER_BUILDER_STORAGE_VERSION,
    state,
  };
  window.localStorage.setItem(CHARACTER_BUILDER_STORAGE_KEY, JSON.stringify(payload));
}

function normalizeTag(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function getFlattenedResults(runs: CharacterBuilderRun[]): CharacterBuilderResult[] {
  return runs.flatMap((run) => run.results);
}

function findResultById(runs: CharacterBuilderRun[], resultId: string | null): CharacterBuilderResult | null {
  if (!resultId) return null;
  return getFlattenedResults(runs).find((result) => result.id === resultId) ?? null;
}

function buildReferenceImage(
  role: CharacterBuilderReferenceImage['role'],
  asset: UploadedAsset
): CharacterBuilderReferenceImage {
  return {
    id: `${role}_${Date.now()}`,
    role,
    url: asset.url,
    width: asset.width ?? null,
    height: asset.height ?? null,
    name: asset.name ?? null,
  };
}

function getRefByRole(
  referenceImages: CharacterBuilderReferenceImage[],
  role: CharacterBuilderReferenceImage['role']
) {
  return referenceImages.find((image) => image.role === role) ?? null;
}

function updateReferenceImage(
  referenceImages: CharacterBuilderReferenceImage[],
  nextImage: CharacterBuilderReferenceImage
) {
  const filtered = referenceImages.filter((image) => image.role !== nextImage.role);
  return [...filtered, nextImage].slice(0, CHARACTER_BUILDER_MAX_REFERENCE_IMAGES);
}

function removeReferenceImage(
  referenceImages: CharacterBuilderReferenceImage[],
  role: CharacterBuilderReferenceImage['role']
) {
  return referenceImages.filter((image) => image.role !== role);
}

function parseCharacterBuilderSnapshot(snapshot: unknown): Partial<CharacterBuilderState> | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const record = snapshot as {
    schemaVersion?: unknown;
    surface?: unknown;
    builder?: unknown;
    lineage?: unknown;
  };
  if (record.schemaVersion !== 1 || record.surface !== 'character-builder') return null;

  const builder = record.builder as CharacterBuilderSettingsSnapshot['builder'] | undefined;
  const lineage = record.lineage as CharacterBuilderSettingsSnapshot['lineage'] | undefined;
  if (!builder) return null;
  const base = createDefaultCharacterBuilderState(builder.sourceMode);

  return {
    sourceMode: builder.sourceMode ?? base.sourceMode,
    referenceImages: Array.isArray(builder.referenceImages) ? builder.referenceImages : [],
    traits: {
      ...base.traits,
      ...builder.traits,
    },
    outputMode: builder.outputMode ?? base.outputMode,
    consistencyMode: builder.consistencyMode ?? base.consistencyMode,
    referenceStrength: builder.referenceStrength ?? base.referenceStrength,
    qualityMode: builder.qualityMode ?? base.qualityMode,
    outputOptions: {
      ...base.outputOptions,
      ...builder.outputOptions,
    },
    advancedNotes: builder.advancedNotes ?? '',
    mustRemainVisible: Array.isArray(builder.mustRemainVisible) ? builder.mustRemainVisible : [],
    selectedResultId: typeof lineage?.parentResultId === 'string' ? lineage.parentResultId : null,
    pinnedReferenceResultId:
      typeof lineage?.pinnedReferenceResultId === 'string' ? lineage.pinnedReferenceResultId : null,
  };
}

function findChoiceLabel(options: Array<{ id: string; label: string }>, value: string | null | undefined): string | null {
  if (!value) return null;
  return options.find((option) => option.id === value)?.label ?? null;
}

function describeTraitValue(options: Array<{ id: string; label: string }>, value: string | null | undefined): string {
  if (value === 'auto') return 'Auto';
  return findChoiceLabel(options, value) ?? 'Not set';
}

function findChoiceSwatch(
  options: Array<{ id: string; swatch?: string }>,
  value: string | null | undefined
): string | null {
  if (!value || value === 'auto') return null;
  return options.find((option) => option.id === value)?.swatch ?? null;
}

function getHairSummary(traits: CharacterBuilderTraits): string {
  const values = [
    describeTraitValue(HAIR_COLOR_OPTIONS, traits.hairColor.value),
    describeTraitValue(HAIR_LENGTH_OPTIONS, traits.hairLength.value),
    describeTraitValue(HAIRSTYLE_OPTIONS, traits.hairstyle.value),
  ];

  if (values.every((value) => value === 'Auto')) {
    return 'Auto from reference';
  }

  const filteredValues = values.filter(
    (value, index, array) => value !== 'Not set' || array.every((entry) => entry === 'Not set')
  );

  const meaningfulValues = filteredValues.filter((value) => value !== 'Not set');
  if (!meaningfulValues.length) return 'Not set';
  return meaningfulValues.join(' / ');
}

function countConfiguredSecondaryControls(state: CharacterBuilderState, hasIdentityReference: boolean): number {
  let count = 0;

  const traitValues: Array<string | null> = [
    state.traits.skinTone.value,
    state.traits.faceCues.value,
    state.traits.eyeColor.value,
    state.traits.bodyBuild.value,
  ];
  count += traitValues.filter((value) => value != null && value !== 'auto').length;
  count += state.traits.accessories.length;
  count += state.traits.distinctiveFeatures.length;
  count += state.mustRemainVisible.length;
  if (state.consistencyMode !== 'balanced') count += 1;
  if (hasIdentityReference && state.referenceStrength && state.referenceStrength !== 'balanced') count += 1;
  if (state.advancedNotes.trim().length) count += 1;
  if (state.outputOptions.includeCloseUps) count += 1;
  if (state.outputOptions.fullBodyRequired && state.outputMode !== 'character-sheet') count += 1;
  if (!state.outputOptions.neutralStudioBackground) count += 1;
  if (!state.outputOptions.preserveFacialDetails) count += 1;
  if (!state.outputOptions.avoid3dRenderLook) count += 1;

  return count;
}

function StepMarker({ number, title, subtitle }: { number: string; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[20px] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(246,248,251,0.9))] px-3 py-2 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(11,107,255,0.18),rgba(11,107,255,0.06))] text-xs font-semibold text-brand">
        {number}
      </span>
      <div>
        <p className="text-sm font-semibold text-text-primary">{title}</p>
        {subtitle ? <p className="text-[11px] text-text-secondary">{subtitle}</p> : null}
      </div>
    </div>
  );
}

const GENDER_CARD_META: Record<string, { glyph: string; background: string; accent: string }> = {
  woman: {
    glyph: 'W',
    background: 'linear-gradient(135deg, rgba(255,233,241,1), rgba(255,255,255,0.94))',
    accent: '#f472b6',
  },
  man: {
    glyph: 'M',
    background: 'linear-gradient(135deg, rgba(224,242,254,1), rgba(255,255,255,0.94))',
    accent: '#38bdf8',
  },
  androgynous: {
    glyph: 'A',
    background: 'linear-gradient(135deg, rgba(233,244,255,1), rgba(255,255,255,0.94))',
    accent: '#6366f1',
  },
  custom: {
    glyph: '+',
    background: 'linear-gradient(135deg, rgba(241,245,249,1), rgba(255,255,255,0.94))',
    accent: '#64748b',
  },
};

const OUTFIT_CARD_META: Record<string, { background: string; accent: string }> = {
  casual: {
    background: 'linear-gradient(135deg, rgba(255,247,237,1), rgba(255,255,255,0.94))',
    accent: '#c2410c',
  },
  business: {
    background: 'linear-gradient(135deg, rgba(226,232,240,1), rgba(255,255,255,0.94))',
    accent: '#0f172a',
  },
  streetwear: {
    background: 'linear-gradient(135deg, rgba(236,253,245,1), rgba(255,255,255,0.94))',
    accent: '#047857',
  },
  fantasy: {
    background: 'linear-gradient(135deg, rgba(243,232,255,1), rgba(255,255,255,0.94))',
    accent: '#7c3aed',
  },
  'sci-fi': {
    background: 'linear-gradient(135deg, rgba(224,242,254,1), rgba(255,255,255,0.94))',
    accent: '#0284c7',
  },
  formal: {
    background: 'linear-gradient(135deg, rgba(250,245,255,1), rgba(255,255,255,0.94))',
    accent: '#6d28d9',
  },
  luxury: {
    background: 'linear-gradient(135deg, rgba(254,249,195,1), rgba(255,255,255,0.94))',
    accent: '#ca8a04',
  },
  tactical: {
    background: 'linear-gradient(135deg, rgba(236,253,245,1), rgba(255,255,255,0.94))',
    accent: '#15803d',
  },
};

const REALISM_CARD_META: Record<string, { background: string; accent: string }> = {
  photoreal: {
    background: 'linear-gradient(135deg, rgba(226,232,240,1), rgba(255,255,255,0.96))',
    accent: '#0f172a',
  },
  cinematic: {
    background: 'linear-gradient(135deg, rgba(254,242,242,1), rgba(255,255,255,0.96))',
    accent: '#b91c1c',
  },
  stylized: {
    background: 'linear-gradient(135deg, rgba(243,232,255,1), rgba(255,255,255,0.96))',
    accent: '#7c3aed',
  },
  animated: {
    background: 'linear-gradient(135deg, rgba(224,242,254,1), rgba(255,255,255,0.96))',
    accent: '#0284c7',
  },
};

const FEATURED_OUTFIT_IDS = ['casual', 'business', 'streetwear', 'fantasy', 'sci-fi'] as const;

function VisualChoiceCard({
  selected,
  onClick,
  title,
  subtitle,
  media,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
  media?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'group relative overflow-hidden rounded-[24px] border p-4 text-left transition',
        selected
          ? 'border-brand bg-[linear-gradient(180deg,rgba(11,107,255,0.08),rgba(255,255,255,0.98))] shadow-[0_18px_36px_rgba(11,107,255,0.14)]'
          : 'border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,248,251,0.96))] hover:border-border-hover hover:shadow-[0_18px_36px_rgba(15,23,42,0.06)]',
        className
      )}
    >
      {selected ? (
        <span className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand text-on-brand">
          <Check className="h-3.5 w-3.5" />
        </span>
      ) : null}
      {media ? <div className="mb-4">{media}</div> : null}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-text-primary">{title}</p>
        {subtitle ? <p className="text-xs text-text-secondary">{subtitle}</p> : null}
      </div>
    </button>
  );
}

function IconChoiceCard({
  selected,
  title,
  glyph,
  background,
  accent,
  onClick,
}: {
  selected: boolean;
  title: string;
  glyph: string;
  background: string;
  accent: string;
  onClick: () => void;
}) {
  return (
    <VisualChoiceCard
      selected={selected}
      onClick={onClick}
      title={title}
      media={
        <div
          className="flex h-16 items-center justify-between rounded-[18px] border border-white/60 px-4"
          style={{ background }}
        >
          <div
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold"
            style={{ backgroundColor: `${accent}1f`, color: accent }}
          >
            {glyph}
          </div>
          <div className="flex items-end gap-1">
            <span className="h-6 w-6 rounded-full bg-white/90 shadow-sm" />
            <span className="h-8 w-8 rounded-[14px] bg-white/75 shadow-sm" />
          </div>
        </div>
      }
      className="min-h-[134px]"
    />
  );
}

function StyleChoiceCard({
  selected,
  title,
  background,
  accent,
  onClick,
}: {
  selected: boolean;
  title: string;
  background: string;
  accent: string;
  onClick: () => void;
}) {
  return (
    <VisualChoiceCard
      selected={selected}
      onClick={onClick}
      title={title}
      media={
        <div
          className="relative h-20 overflow-hidden rounded-[18px] border border-white/60"
          style={{ background }}
        >
          <div
            className="absolute left-4 top-4 h-10 w-10 rounded-full"
            style={{ backgroundColor: `${accent}22` }}
          />
          <div
            className="absolute bottom-4 left-5 h-10 w-12 rounded-[16px]"
            style={{ backgroundColor: `${accent}cc` }}
          />
          <div className="absolute right-3 top-3 space-y-1">
            <div className="h-2.5 w-10 rounded-full bg-white/80" />
            <div className="h-2.5 w-8 rounded-full bg-white/60" />
          </div>
        </div>
      }
      className="min-w-[140px]"
    />
  );
}

function OutputPreviewCard({
  selected,
  title,
  subtitle,
  mode,
  onClick,
}: {
  selected: boolean;
  title: string;
  subtitle: string;
  mode: CharacterBuilderState['outputMode'];
  onClick: () => void;
}) {
  const preview =
    mode === 'portrait-reference' ? (
      <div className="relative h-24 overflow-hidden rounded-[18px] border border-white/60 bg-[linear-gradient(180deg,rgba(239,246,255,1),rgba(255,255,255,0.96))]">
        <div className="absolute inset-x-5 top-4 h-14 rounded-[16px] border border-white/80 bg-white/70" />
        <div className="absolute left-1/2 top-6 h-8 w-8 -translate-x-1/2 rounded-full bg-brand/15" />
        <div className="absolute left-1/2 top-12 h-8 w-10 -translate-x-1/2 rounded-[14px] bg-brand/20" />
      </div>
    ) : (
      <div className="grid h-24 grid-cols-4 gap-2 rounded-[18px] border border-white/60 bg-[linear-gradient(180deg,rgba(248,250,252,1),rgba(255,255,255,0.96))] p-3">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="relative overflow-hidden rounded-[14px] border border-border bg-white/70">
            <div className="absolute left-1/2 top-2 h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-brand/15" />
            <div className="absolute left-1/2 top-6 h-8 w-4 -translate-x-1/2 rounded-full bg-brand/20" />
          </div>
        ))}
      </div>
    );

  return <VisualChoiceCard selected={selected} onClick={onClick} title={title} subtitle={subtitle} media={preview} />;
}

function HeroPreviewCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-[24px] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(246,248,251,0.96))] p-4 shadow-[0_20px_36px_rgba(15,23,42,0.06)]">
      <div className="overflow-hidden rounded-[20px] border border-border bg-white/80 p-3">{children}</div>
      <div>
        <p className="text-sm font-semibold text-text-primary">{title}</p>
        <p className="mt-1 text-[11px] text-text-secondary">{subtitle}</p>
      </div>
    </div>
  );
}

function HeroPreviewStrip() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <HeroPreviewCard title="Portrait reference" subtitle="Clear face-first anchor">
        <div className="relative h-36 rounded-[18px] bg-[linear-gradient(180deg,rgba(224,242,254,0.9),rgba(255,255,255,0.92))]">
          <div className="absolute inset-x-4 bottom-4 top-4 rounded-[16px] border border-white/80 bg-white/40" />
          <div className="absolute left-1/2 top-7 h-12 w-12 -translate-x-1/2 rounded-full bg-brand/15" />
          <div className="absolute left-1/2 top-20 h-12 w-16 -translate-x-1/2 rounded-[18px] bg-brand/18" />
          <div className="absolute bottom-4 left-4 inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold text-text-secondary">
            <Camera className="h-3 w-3" />
            Portrait
          </div>
        </div>
      </HeroPreviewCard>
      <HeroPreviewCard title="Character sheet" subtitle="Clean turnaround views">
        <div className="grid h-36 grid-cols-4 gap-2 rounded-[18px] bg-[linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,0.92))] p-2">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="relative overflow-hidden rounded-[14px] border border-border bg-white/75">
              <div className="absolute left-1/2 top-3 h-4 w-4 -translate-x-1/2 rounded-full bg-slate-300" />
              <div className="absolute left-1/2 top-8 h-14 w-5 -translate-x-1/2 rounded-full bg-slate-200" />
            </div>
          ))}
        </div>
      </HeroPreviewCard>
      <HeroPreviewCard title="Reusable asset" subtitle="Saved and ready to reuse">
        <div className="relative h-36 rounded-[18px] bg-[linear-gradient(180deg,rgba(240,253,250,1),rgba(255,255,255,0.92))]">
          <div className="absolute left-5 top-5 h-20 w-16 rounded-[16px] border border-white/80 bg-white/85 shadow-sm" />
          <div className="absolute left-9 top-10 h-8 w-8 rounded-full bg-emerald-100" />
          <div className="absolute left-7 top-20 h-8 w-12 rounded-[14px] bg-emerald-200" />
          <div className="absolute right-4 top-4 rounded-full bg-emerald-500 px-2 py-1 text-[10px] font-semibold text-white">
            Ready to reuse
          </div>
          <div className="absolute bottom-4 right-4 inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold text-text-secondary">
            <Pin className="h-3 w-3" />
            Saved reference
          </div>
        </div>
      </HeroPreviewCard>
    </div>
  );
}

function CharacterSummaryCard({
  identityReference,
  hairSummary,
  outfitSummary,
  traits,
  outputMode,
  qualityMode,
}: {
  identityReference: CharacterBuilderReferenceImage | null;
  hairSummary: string;
  outfitSummary: string;
  traits: CharacterBuilderTraits;
  outputMode: CharacterBuilderState['outputMode'];
  qualityMode: CharacterBuilderState['qualityMode'];
}) {
  const hairSwatch = findChoiceSwatch(HAIR_COLOR_OPTIONS, traits.hairColor.value);
  const genderLabel = findChoiceLabel(GENDER_PRESENTATION_OPTIONS, traits.genderPresentation.value) ?? 'Open';
  const ageLabel = findChoiceLabel(AGE_RANGE_OPTIONS, traits.ageRange.value) ?? 'Open';
  const realismLabel = findChoiceLabel(
    REALISM_STYLE_OPTIONS.map((option) => ({ id: option.id, label: option.label })),
    traits.realismStyle
  );
  const outputLabel = findChoiceLabel(CHARACTER_OUTPUT_OPTIONS, outputMode);
  const qualityLabel = findChoiceLabel(CHARACTER_QUALITY_OPTIONS, qualityMode);

  return (
    <Card className="overflow-hidden border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,248,251,0.96))] p-5">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Character DNA</p>
            <h3 className="mt-2 text-lg font-semibold text-text-primary">Live snapshot</h3>
          </div>
          <span className="rounded-full border border-border bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
            Builder
          </span>
        </div>

        {identityReference ? (
          <img
            src={identityReference.url}
            alt="Identity reference"
            className="h-28 w-full rounded-[20px] object-cover"
          />
        ) : (
          <div className="relative h-28 overflow-hidden rounded-[20px] border border-border bg-[linear-gradient(180deg,rgba(241,245,249,1),rgba(255,255,255,0.96))]">
            <div className="absolute left-1/2 top-5 h-10 w-10 -translate-x-1/2 rounded-full bg-slate-300" />
            <div className="absolute left-1/2 top-14 h-12 w-16 -translate-x-1/2 rounded-[18px] bg-slate-200" />
            <div className="absolute bottom-3 left-3 rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold text-text-secondary">
              No reference image
            </div>
          </div>
        )}

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3 rounded-[18px] border border-border bg-white/80 px-3 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">Identity</span>
            <span className="text-sm font-medium text-text-primary">
              {genderLabel} · {ageLabel}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-[18px] border border-border bg-white/80 px-3 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">Hair</span>
            <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
              {hairSwatch ? (
                <span
                  className="h-3 w-3 rounded-full border border-black/10"
                  style={{ backgroundColor: hairSwatch }}
                />
              ) : null}
              {hairSummary === 'Not set' ? 'Open' : hairSummary}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-[18px] border border-border bg-white/80 px-3 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">Outfit</span>
            <span className="text-sm font-medium text-text-primary">
              {outfitSummary === 'Not set' ? 'Open' : outfitSummary}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-[18px] border border-border bg-white/80 px-3 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">Style</span>
            <span className="text-sm font-medium text-text-primary">{realismLabel ?? 'Photoreal'}</span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-[18px] border border-border bg-white/80 px-3 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">Output</span>
            <span className="text-sm font-medium text-text-primary">{outputLabel}</span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-[18px] border border-border bg-white/80 px-3 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">Quality</span>
            <span className="text-sm font-medium text-text-primary">{qualityLabel}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function HairEditorPanel({
  open,
  onClose,
  sourceMode,
  traits,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  sourceMode: CharacterBuilderState['sourceMode'];
  traits: CharacterBuilderTraits;
  onChange: (key: 'hairColor' | 'hairLength' | 'hairstyle', value: string | 'auto') => void;
}) {
  if (!open) return null;

  const autoEnabled = sourceMode === 'reference-image';
  const autoButton = (key: 'hairColor' | 'hairLength' | 'hairstyle') =>
    autoEnabled ? (
      <button
        type="button"
        onClick={() => onChange(key, 'auto')}
        className={clsx(
          'rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-micro transition',
          traits[key].value === 'auto'
            ? 'border-brand bg-brand text-on-brand'
            : 'border-border bg-white text-text-secondary hover:border-border-hover'
        )}
      >
        Auto
      </button>
    ) : null;

  const panel = (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-primary">Hair editor</p>
          <p className="text-[11px] text-text-secondary">Pick only what matters.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Done
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Color</p>
        <div className="flex flex-wrap gap-2">
          {autoButton('hairColor')}
          {HAIR_COLOR_OPTIONS.map((option) => {
            const selected = traits.hairColor.value === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onChange('hairColor', option.id)}
                className={clsx(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                  selected
                    ? 'border-brand bg-brand/10 text-text-primary'
                    : 'border-border bg-white text-text-secondary hover:border-border-hover'
                )}
              >
                {option.swatch ? (
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-black/10"
                    style={{ backgroundColor: option.swatch }}
                  />
                ) : null}
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Length</p>
        <div className="flex flex-wrap gap-2">
          {autoButton('hairLength')}
          {HAIR_LENGTH_OPTIONS.map((option) => {
            const selected = traits.hairLength.value === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onChange('hairLength', option.id)}
                className={clsx(
                  'rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-micro transition',
                  selected
                    ? 'border-brand bg-brand text-on-brand'
                    : 'border-border bg-white text-text-secondary hover:border-border-hover'
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Style</p>
        <div className="flex flex-wrap gap-2">
          {autoButton('hairstyle')}
          {HAIRSTYLE_OPTIONS.map((option) => {
            const selected = traits.hairstyle.value === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onChange('hairstyle', option.id)}
                className={clsx(
                  'rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-micro transition',
                  selected
                    ? 'border-brand bg-brand text-on-brand'
                    : 'border-border bg-white text-text-secondary hover:border-border-hover'
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={onClose} aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-[28px] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,248,251,0.98))] p-5 shadow-[0_-24px_48px_rgba(15,23,42,0.18)] lg:absolute lg:inset-x-0 lg:bottom-auto lg:top-[calc(100%+12px)] lg:z-30 lg:rounded-[24px] lg:border lg:p-5 lg:shadow-[0_24px_48px_rgba(15,23,42,0.12)]">
        {panel}
      </div>
    </>
  );
}

function SegmentedControl({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ id: string; label: string; description?: string }>;
  value: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-text-primary">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={clsx(
                'rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-micro transition',
                active
                  ? 'border-brand bg-brand text-on-brand'
                  : 'border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-hover'
              )}
              title={option.description}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CompactSelectField({
  label,
  value,
  options,
  onChange,
  placeholder = 'Choose',
  autoEnabled = false,
}: {
  label: string;
  value: string | null;
  options: ChoiceOption[];
  onChange: (value: string | 'auto') => void;
  placeholder?: string;
  autoEnabled?: boolean;
}) {
  const selectOptions = [
    { value: '', label: placeholder },
    ...(autoEnabled ? [{ value: 'auto', label: 'Auto' }] : []),
    ...options.map((option) => ({ value: option.id, label: option.label })),
  ];

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-text-primary">{label}</label>
      <SelectMenu
        options={selectOptions}
        value={value ?? ''}
        onChange={(next) => onChange(String(next) as string | 'auto')}
        buttonClassName="min-h-[40px]"
      />
    </div>
  );
}

function SummaryRow({
  label,
  value,
  buttonLabel,
  onToggle,
}: {
  label: string;
  value: string;
  buttonLabel: string;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-card border border-border bg-bg/40 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text-primary">{label}</p>
        <p className="truncate text-xs text-text-secondary">{value}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={onToggle}>
        {buttonLabel}
      </Button>
    </div>
  );
}

function OptionGrid({
  label,
  description,
  options,
  value,
  onChange,
  autoEnabled = false,
  autoSelected = false,
}: {
  label: string;
  description?: string;
  options: ChoiceOption[];
  value: string | null;
  onChange: (value: string | 'auto') => void;
  autoEnabled?: boolean;
  autoSelected?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-text-primary">{label}</p>
        {description ? <p className="mt-1 text-xs text-text-secondary">{description}</p> : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {autoEnabled ? (
          <button
            type="button"
            onClick={() => onChange('auto')}
            className={clsx(
              'rounded-card border px-3 py-3 text-left transition',
              autoSelected
                ? 'border-brand bg-brand/10 text-text-primary'
                : 'border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-hover'
            )}
          >
            <span className="block text-sm font-semibold">Auto</span>
            <span className="mt-1 block text-xs text-text-muted">Infer this from the reference image.</span>
          </button>
        ) : null}
        {options.map((option) => {
          const selected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={clsx(
                'rounded-card border px-3 py-3 text-left transition',
                selected
                  ? 'border-brand bg-brand/10 text-text-primary'
                  : 'border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-hover'
              )}
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                {option.swatch ? (
                  <span
                    className="h-4 w-4 rounded-full border border-black/10"
                    style={{ backgroundColor: option.swatch }}
                    aria-hidden
                  />
                ) : null}
                {option.label}
              </span>
              {option.description ? <span className="mt-1 block text-xs text-text-muted">{option.description}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MultiToggleGroup({
  label,
  description,
  items,
  values,
  onToggle,
}: {
  label: string;
  description?: string;
  items: ToggleItem[];
  values: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-text-primary">{label}</p>
        {description ? <p className="mt-1 text-xs text-text-secondary">{description}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const selected = values.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              className={clsx(
                'rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-micro transition',
                selected
                  ? 'border-brand bg-brand text-on-brand'
                  : 'border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-hover'
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SectionTitle({ eyebrow, title, body, children }: { eyebrow: string; title: string; body?: string; children?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{eyebrow}</p>
        <h2 className="mt-2 text-xl font-semibold text-text-primary">{title}</h2>
        {body ? <p className="mt-2 max-w-2xl text-sm text-text-secondary">{body}</p> : null}
      </div>
      {children}
    </div>
  );
}

function ReferenceSlot({
  title,
  subtitle,
  image,
  onUpload,
  onRemove,
  disabled = false,
}: {
  title: string;
  subtitle: string;
  image: CharacterBuilderReferenceImage | null;
  onUpload: () => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={clsx(
        'w-full rounded-card border border-dashed p-4 text-left transition',
        image
          ? 'border-border bg-surface'
          : 'border-border bg-bg/50 hover:border-border-hover hover:bg-surface-hover',
        disabled && 'cursor-not-allowed opacity-60'
      )}
    >
      {image ? (
        <div className="space-y-3">
          <button type="button" onClick={onUpload} disabled={disabled} className="block w-full text-left">
            <img src={image.url} alt={title} className="h-40 w-full rounded-input object-cover" />
            <div className="mt-3">
              <p className="text-sm font-semibold text-text-primary">{title}</p>
              <p className="mt-1 text-xs text-text-secondary">{image.name ?? subtitle}</p>
            </div>
          </button>
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            Remove
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onUpload}
          disabled={disabled}
          className="flex min-h-[180px] w-full flex-col items-center justify-center gap-3 text-center"
        >
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
            <Upload className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-text-primary">{title}</p>
            <p className="mt-1 text-xs text-text-secondary">{subtitle}</p>
          </div>
        </button>
      )}
    </div>
  );
}

function ResultCard({
  result,
  selected,
  pinned,
  allowPinning,
  onSelect,
  onPin,
  onDownload,
  onSave,
  onDuplicateSettings,
  saving,
}: {
  result: CharacterBuilderResult;
  selected: boolean;
  pinned: boolean;
  allowPinning: boolean;
  onSelect: () => void;
  onPin: () => void;
  onDownload: () => void;
  onSave: () => void;
  onDuplicateSettings: () => void;
  saving: boolean;
}) {
  return (
    <Card
      className={clsx(
        'overflow-hidden border p-0 transition',
        selected ? 'border-brand shadow-[0_0_0_1px_rgba(11,107,255,0.2)]' : 'border-border'
      )}
    >
      <button type="button" onClick={onSelect} className="block w-full text-left">
        <img src={result.thumbUrl ?? result.url} alt="Generated character reference" className="h-48 w-full object-cover" />
      </button>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{result.engineLabel}</p>
            <p className="mt-1 text-sm font-semibold text-text-primary">
              {result.action === 'generate' ? 'Reference output' : result.action === 'full-body-fix' ? 'Full-body fix' : 'Lighting variant'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selected ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-1 text-[11px] font-semibold text-brand">
                <Check className="h-3.5 w-3.5" />
                Selected
              </span>
            ) : null}
            {pinned ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-primary">
                <Pin className="h-3.5 w-3.5" />
                Base
              </span>
            ) : null}
          </div>
        </div>
        {selected ? (
          <div className="flex flex-wrap gap-2">
            {allowPinning ? (
              <Button variant="outline" size="sm" onClick={onPin} className="gap-2">
                {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                {pinned ? 'Unpin base' : 'Use as base'}
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={onDownload} className="gap-2">
              <Download className="h-4 w-4" />
              Download
            </Button>
            <Button variant="outline" size="sm" onClick={onSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={onDuplicateSettings} className="gap-2">
              <WandSparkles className="h-4 w-4" />
              Duplicate
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={onSelect}>
            Select
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function CharacterBuilderPage() {
  const { loading: authLoading, user } = useRequireAuth();
  const searchParams = useSearchParams();
  const [state, setState] = useState<CharacterBuilderState>(() => createDefaultCharacterBuilderState());
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [hairOpen, setHairOpen] = useState(false);
  const [showStyleReferenceSlot, setShowStyleReferenceSlot] = useState(false);
  const [mustRemainDraft, setMustRemainDraft] = useState('');
  const [loadingAction, setLoadingAction] = useState<CharacterBuilderAction | null>(null);
  const [savingResultId, setSavingResultId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const identityFileRef = useRef<HTMLInputElement | null>(null);
  const styleFileRef = useRef<HTMLInputElement | null>(null);

  const flattenedResults = getFlattenedResults(state.runs);
  const selectedResult = findResultById(state.runs, state.selectedResultId);
  const pinnedResult = findResultById(state.runs, state.pinnedReferenceResultId);
  const identityReference = getRefByRole(state.referenceImages, 'identity');
  const styleReference = getRefByRole(state.referenceImages, 'style');
  const hasIdentityReference = Boolean(identityReference);
  const hasResults = flattenedResults.length > 0;
  const hasMultipleResults = flattenedResults.length > 1;
  const secondaryControlsCount = countConfiguredSecondaryControls(state, hasIdentityReference);
  const hairSummary = getHairSummary(state.traits);
  const outfitSummary = describeTraitValue(OUTFIT_STYLE_OPTIONS, state.traits.outfitStyle.value);
  const jobIdFromQuery = searchParams?.get('job')?.trim() ?? null;
  const featuredOutfits = OUTFIT_STYLE_OPTIONS.filter((option) => FEATURED_OUTFIT_IDS.includes(option.id as (typeof FEATURED_OUTFIT_IDS)[number]));
  const overflowOutfits = OUTFIT_STYLE_OPTIONS.filter(
    (option) => !FEATURED_OUTFIT_IDS.includes(option.id as (typeof FEATURED_OUTFIT_IDS)[number])
  );
  const overflowOutfitValue =
    state.traits.outfitStyle.value && !FEATURED_OUTFIT_IDS.includes(state.traits.outfitStyle.value as (typeof FEATURED_OUTFIT_IDS)[number])
      ? state.traits.outfitStyle.value
      : '__more_outfits__';

  useEffect(() => {
    const persisted = readPersistedState();
    if (persisted) {
      setState(persisted);
      setAdvancedOpen(Boolean(persisted.advancedNotes));
      setShowStyleReferenceSlot(Boolean(getRefByRole(persisted.referenceImages, 'style')));
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (styleReference) {
      setShowStyleReferenceSlot(true);
    }
  }, [styleReference]);

  useEffect(() => {
    if (!hydrated) return;
    writePersistedState(state);
  }, [hydrated, state]);

  useEffect(() => {
    const requestedJobId = jobIdFromQuery;
    if (!hydrated || !requestedJobId) return;
    const activeJobId: string = requestedJobId;
    let cancelled = false;

    async function loadFromJob() {
      try {
        const response = await authFetch(`/api/jobs/${encodeURIComponent(activeJobId)}`);
        const payload = (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              settingsSnapshot?: unknown;
            }
          | null;
        if (!response.ok || !payload?.ok || !payload.settingsSnapshot || cancelled) return;
        const snapshotState = parseCharacterBuilderSnapshot(payload.settingsSnapshot);
        if (!snapshotState) return;
        setState((previous) => ({
          ...previous,
          ...snapshotState,
        }));
        setShowStyleReferenceSlot(Boolean(snapshotState.referenceImages?.some((image) => image.role === 'style')));
        setStatusMessage('Loaded character builder settings from the selected job.');
      } catch (loadError) {
        if (!cancelled) {
          console.warn('[character-builder] failed to load job snapshot', loadError);
        }
      }
    }

    void loadFromJob();

    return () => {
      cancelled = true;
    };
  }, [hydrated, jobIdFromQuery]);

  function updateTrait<K extends keyof Pick<
    CharacterBuilderTraits,
    | 'genderPresentation'
    | 'ageRange'
    | 'skinTone'
    | 'faceCues'
    | 'hairColor'
    | 'hairLength'
    | 'hairstyle'
    | 'eyeColor'
    | 'bodyBuild'
    | 'outfitStyle'
  >>(key: K, value: string | 'auto') {
    setState((previous) => ({
      ...previous,
      traits: {
        ...previous.traits,
        [key]: {
          value,
          source: (value === 'auto' ? 'auto' : 'manual') as CharacterBuilderTraitSource,
        },
      },
    }));
  }

  function toggleListValue(key: 'accessories' | 'distinctiveFeatures', value: string) {
    setState((previous) => {
      const current = previous.traits[key];
      const nextValues = current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value];
      return {
        ...previous,
        traits: {
          ...previous.traits,
          [key]: nextValues,
        },
      };
    });
  }

  function updateSourceMode(sourceMode: CharacterBuilderState['sourceMode']) {
    setState((previous) => ({
      ...previous,
      sourceMode,
      referenceStrength: sourceMode === 'reference-image' ? previous.referenceStrength ?? 'balanced' : null,
      traits: normalizeTraitsForSourceMode(previous.traits, sourceMode),
    }));
    if (sourceMode !== 'reference-image' && !styleReference) {
      setShowStyleReferenceSlot(false);
    }
  }

  async function handleUpload(role: CharacterBuilderReferenceImage['role'], file: File) {
    setError(null);
    setStatusMessage(role === 'identity' ? 'Uploading identity reference…' : 'Uploading style reference…');

    try {
      const asset = await uploadImage(file);
      const nextImage = buildReferenceImage(role, asset);
      if (role === 'style') {
        setShowStyleReferenceSlot(true);
      }
      setState((previous) => ({
        ...previous,
        sourceMode: role === 'identity' ? 'reference-image' : previous.sourceMode,
        referenceStrength:
          role === 'identity'
            ? previous.referenceStrength ?? 'balanced'
            : previous.referenceStrength,
        referenceImages: updateReferenceImage(previous.referenceImages, nextImage),
        traits: role === 'identity' ? normalizeTraitsForSourceMode(previous.traits, 'reference-image') : previous.traits,
      }));
      setStatusMessage(role === 'identity' ? 'Identity reference uploaded.' : 'Style reference uploaded.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed.');
      setStatusMessage(null);
    }
  }

  async function triggerUpload(role: CharacterBuilderReferenceImage['role'], fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    await handleUpload(role, file);
  }

  function addMustRemainTag() {
    const tag = normalizeTag(mustRemainDraft);
    if (!tag) return;
    setState((previous) => ({
      ...previous,
      mustRemainVisible: previous.mustRemainVisible.includes(tag)
        ? previous.mustRemainVisible
        : [...previous.mustRemainVisible, tag],
    }));
    setMustRemainDraft('');
  }

  function removeMustRemainTag(tag: string) {
    setState((previous) => ({
      ...previous,
      mustRemainVisible: previous.mustRemainVisible.filter((entry) => entry !== tag),
    }));
  }

  function applySettingsSnapshot(snapshot: CharacterBuilderSettingsSnapshot, selectedId?: string) {
    setState((previous) => ({
      ...previous,
      sourceMode: snapshot.builder.sourceMode,
      referenceImages: snapshot.builder.referenceImages,
      traits: snapshot.builder.traits,
      outputMode: snapshot.builder.outputMode,
      consistencyMode: snapshot.builder.consistencyMode,
      referenceStrength: snapshot.builder.referenceStrength,
      qualityMode: snapshot.builder.qualityMode,
      outputOptions: snapshot.builder.outputOptions,
      advancedNotes: snapshot.builder.advancedNotes,
      mustRemainVisible: snapshot.builder.mustRemainVisible,
      selectedResultId: selectedId ?? previous.selectedResultId,
    }));
    setAdvancedOpen(Boolean(snapshot.builder.advancedNotes));
    setStatusMessage('Builder settings copied from that result.');
  }

  async function handleRun(action: CharacterBuilderAction, generateCount?: 1 | 4) {
    setError(null);
    setStatusMessage(null);
    setLoadingAction(action);

    try {
      const response = await runCharacterBuilderTool({
        action,
        sourceMode: state.sourceMode,
        outputMode: state.outputMode,
        consistencyMode: state.consistencyMode,
        referenceStrength: hasIdentityReference ? state.referenceStrength : null,
        qualityMode: state.qualityMode,
        referenceImages: state.referenceImages,
        traits: state.traits,
        outputOptions: state.outputOptions,
        advancedNotes: state.advancedNotes,
        mustRemainVisible: state.mustRemainVisible,
        generateCount: generateCount ?? 1,
        selectedResultId: selectedResult?.id ?? null,
        selectedResultUrl: selectedResult?.url ?? null,
        pinnedReferenceResultId: pinnedResult?.id ?? null,
        pinnedReferenceResultUrl: pinnedResult?.url ?? null,
        lineage: {
          parentResultId: selectedResult?.id ?? null,
          parentRunId: selectedResult?.runId ?? null,
          pinnedReferenceResultId: pinnedResult?.id ?? null,
        },
      });

      if (!response.run) {
        throw new Error('Character builder run is missing.');
      }

      setState((previous) => {
        const nextRuns = [response.run!, ...previous.runs].slice(0, 12);
        const firstResultId = response.run!.results[0]?.id ?? null;
        const refinementHistory =
          action === 'generate' || !selectedResult
            ? previous.refinementHistory
            : [
                {
                  id: `refinement_${Date.now()}`,
                  action,
                  parentResultId: selectedResult.id,
                  childRunId: response.run!.id,
                  childResultIds: response.run!.results.map((result) => result.id),
                  createdAt: response.run!.createdAt,
                },
                ...previous.refinementHistory,
              ].slice(0, 24);

        return {
          ...previous,
          runs: nextRuns,
          selectedResultId: firstResultId,
          pinnedReferenceResultId:
            previous.pinnedReferenceResultId ?? (action === 'generate' ? firstResultId : previous.pinnedReferenceResultId),
          refinementHistory,
        };
      });

      setStatusMessage(
        action === 'generate'
          ? generateCount === 4
            ? 'Generated 4 character reference options.'
            : 'Generated a new character reference.'
          : action === 'full-body-fix'
            ? 'Generated a full-body correction from the selected result.'
            : 'Generated a lighting variation from the selected result.'
      );
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Generation failed.');
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleSaveResult(result: CharacterBuilderResult) {
    setSavingResultId(result.id);
    setError(null);
    setStatusMessage(null);
    try {
      await saveImageToLibrary({
        url: result.url,
        jobId: result.jobId,
        label: 'Character reference',
      });
      setStatusMessage('Saved to Library.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save to Library.');
    } finally {
      setSavingResultId(null);
    }
  }

  function renderFollowUpPanels() {
    if (!hasResults) return null;

    return (
      <div className="space-y-6">
        {selectedResult ? (
          <Card className="border border-border p-6">
            <SectionTitle eyebrow="Selected result" title="Current reference" />
            <img
              src={selectedResult.thumbUrl ?? selectedResult.url}
              alt="Selected character reference"
              className="mt-5 h-72 w-full rounded-card object-cover"
            />
            <div className="mt-4 space-y-2">
              <p className="text-sm font-semibold text-text-primary">{selectedResult.engineLabel}</p>
              <p className="text-xs text-text-secondary">
                {selectedResult.action === 'generate'
                  ? 'Base reference output'
                  : selectedResult.action === 'full-body-fix'
                    ? 'Full-body refinement'
                    : 'Lighting refinement'}
              </p>
            </div>
            <div className="mt-4 rounded-card border border-border bg-bg/40 p-4 text-sm text-text-secondary">
              Import this reference manually into a video model when you are ready.
            </div>
          </Card>
        ) : null}

        {hasMultipleResults ? (
          <Card className="border border-border p-6">
            <SectionTitle eyebrow="Pinned base" title="Refinement base" />
            {pinnedResult ? (
              <div className="mt-5 space-y-4">
                <img
                  src={pinnedResult.thumbUrl ?? pinnedResult.url}
                  alt="Pinned base reference"
                  className="h-64 w-full rounded-card object-cover"
                />
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Pinned base</p>
                    <p className="mt-1 text-xs text-text-secondary">{pinnedResult.engineLabel}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setState((previous) => ({
                        ...previous,
                        pinnedReferenceResultId: null,
                      }))
                    }
                  >
                    <PinOff className="h-4 w-4" />
                    Unpin
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-card border border-dashed border-border bg-bg/40 p-5 text-sm text-text-secondary">
                Select a result, then pin it if you want a stable base for refinements.
              </div>
            )}
          </Card>
        ) : null}

        {selectedResult ? (
          <Card className="border border-border p-6">
            <SectionTitle eyebrow="Step 4" title="Refine" />
            <div className="mt-5 grid gap-3">
              <Button
                variant="outline"
                onClick={() => void handleRun('full-body-fix')}
                disabled={loadingAction !== null}
                className="justify-start gap-2"
              >
                {loadingAction === 'full-body-fix' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <WandSparkles className="h-4 w-4" />
                )}
                Fix full body
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleRun('lighting-variant')}
                disabled={loadingAction !== null}
                className="justify-start gap-2"
              >
                {loadingAction === 'lighting-variant' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Create lighting variant
              </Button>
            </div>
            <p className="mt-4 text-xs text-text-secondary">
              This tool stops at reusable reference image creation.
            </p>
          </Card>
        ) : null}
      </div>
    );
  }

  if (authLoading || !hydrated) {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <HeaderBar />
        <div className="flex flex-1 min-w-0 flex-col md:flex-row">
          <AppSidebar />
          <main className="flex-1 min-w-0 overflow-y-auto p-5 lg:p-7">
            <div className="space-y-4 animate-pulse">
              <div className="h-40 rounded-card border border-border bg-surface" />
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_360px]">
                <div className="h-[720px] rounded-card border border-border bg-surface" />
                <div className="h-[560px] rounded-card border border-border bg-surface" />
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!FEATURES.workflows.toolsSection) {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <HeaderBar />
        <div className="flex flex-1 min-w-0 flex-col md:flex-row">
          <AppSidebar />
          <main className="flex-1 min-w-0 overflow-y-auto p-5 lg:p-7">
            <Card className="border border-border p-6">
              <h1 className="text-2xl font-semibold text-text-primary">Tools are disabled</h1>
              <p className="mt-2 text-sm text-text-secondary">
                Enable `FEATURES.workflows.toolsSection` to access this area.
              </p>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex flex-1 min-w-0 flex-col md:flex-row">
        <AppSidebar />
        <main className="flex-1 min-w-0 overflow-y-auto p-5 lg:p-7">
          <div className="mx-auto w-full max-w-[1500px] space-y-6">
            <section className="relative overflow-hidden rounded-[32px] border border-border bg-surface p-6 lg:p-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(11,107,255,0.14),transparent_42%),linear-gradient(135deg,rgba(16,24,40,0.03),rgba(255,255,255,0))]" />
              <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_520px] xl:items-center">
                <div className="space-y-4">
                  <ButtonLink href="/tools" variant="ghost" size="sm" linkComponent={Link} className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Tools
                  </ButtonLink>
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,rgba(11,107,255,0.14),rgba(255,255,255,0.92))] shadow-[0_14px_28px_rgba(11,107,255,0.14)]">
                    <div className="relative">
                      <Sparkles className="h-6 w-6 text-brand" />
                      <Camera className="absolute -bottom-2 -right-2 h-4 w-4 text-text-primary" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Image-only tool</p>
                    <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">Consistent Character Builder</h1>
                    <p className="max-w-xl text-sm text-text-secondary">
                      Build a reusable character reference before moving to video.
                    </p>
                  </div>
                </div>
                <HeroPreviewStrip />
              </div>
            </section>

            {error ? (
              <Card className="border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Card>
            ) : null}
            {statusMessage ? (
              <Card className="border border-border bg-surface p-4 text-sm text-text-secondary">{statusMessage}</Card>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_340px]">
              <div className="space-y-6">
                <Card className="overflow-visible border border-border p-6 lg:p-7">
                  <div className="space-y-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">3-step builder</p>
                        <h2 className="mt-2 text-2xl font-semibold text-text-primary">Preview, choose, generate</h2>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <StepMarker number="1" title="Start" subtitle="Choose the base" />
                        <StepMarker number="2" title="Build" subtitle="Pick the look" />
                        <StepMarker number="3" title="Generate" subtitle="Run the reference" />
                      </div>
                    </div>

                    <div className="xl:hidden">
                      <CharacterSummaryCard
                        identityReference={identityReference}
                        hairSummary={hairSummary}
                        outfitSummary={outfitSummary}
                        traits={state.traits}
                        outputMode={state.outputMode}
                        qualityMode={state.qualityMode}
                      />
                    </div>

                    <section className="space-y-4 border-t border-border pt-6">
                      <SectionTitle eyebrow="Step 1" title="Start" />
                      <div className="grid gap-4 md:grid-cols-2">
                        <VisualChoiceCard
                          selected={state.sourceMode === 'scratch'}
                          onClick={() => updateSourceMode('scratch')}
                          title="Start from scratch"
                          subtitle="Build the character visually."
                          media={
                            <div className="flex h-20 items-center justify-between rounded-[18px] border border-white/60 bg-[linear-gradient(135deg,rgba(224,242,254,1),rgba(255,255,255,0.96))] px-4">
                              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand/15 text-brand">
                                <Sparkles className="h-4 w-4" />
                              </div>
                              <div className="flex items-end gap-1">
                                <span className="h-7 w-7 rounded-full bg-white/85 shadow-sm" />
                                <span className="h-9 w-9 rounded-[16px] bg-white/70 shadow-sm" />
                              </div>
                            </div>
                          }
                        />
                        <VisualChoiceCard
                          selected={state.sourceMode === 'reference-image'}
                          onClick={() => updateSourceMode('reference-image')}
                          title="Start from image"
                          subtitle="Infer the look from a reference."
                          media={
                            <div className="flex h-20 items-center justify-between rounded-[18px] border border-white/60 bg-[linear-gradient(135deg,rgba(240,253,250,1),rgba(255,255,255,0.96))] px-4">
                              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                                <Upload className="h-4 w-4" />
                              </div>
                              <div className="rounded-[16px] border border-dashed border-emerald-300 bg-white/80 px-3 py-2 text-[11px] font-semibold text-text-secondary">
                                Auto traits
                              </div>
                            </div>
                          }
                        />
                      </div>

                      {state.sourceMode === 'reference-image' ? (
                        <div className="grid gap-4 lg:grid-cols-2">
                          <ReferenceSlot
                            title="Identity reference"
                            subtitle="Upload the face or character you want to anchor."
                            image={identityReference}
                            onUpload={() => identityFileRef.current?.click()}
                            onRemove={() =>
                              setState((previous) => ({
                                ...previous,
                                sourceMode: previous.sourceMode === 'reference-image' ? 'scratch' : previous.sourceMode,
                                referenceStrength: previous.sourceMode === 'reference-image' ? null : previous.referenceStrength,
                                referenceImages: removeReferenceImage(previous.referenceImages, 'identity'),
                                traits:
                                  previous.sourceMode === 'reference-image'
                                    ? normalizeTraitsForSourceMode(previous.traits, 'scratch')
                                    : previous.traits,
                              }))
                            }
                          />
                          {showStyleReferenceSlot || styleReference ? (
                            <ReferenceSlot
                              title="Style inspiration"
                              subtitle="Optional. Use a second image for outfit or style direction."
                              image={styleReference}
                              onUpload={() => styleFileRef.current?.click()}
                              onRemove={() => {
                                setShowStyleReferenceSlot(false);
                                setState((previous) => ({
                                  ...previous,
                                  referenceImages: removeReferenceImage(previous.referenceImages, 'style'),
                                }));
                              }}
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => setShowStyleReferenceSlot(true)}
                              className="flex min-h-[180px] flex-col items-center justify-center rounded-card border border-dashed border-border bg-bg/40 px-4 py-6 text-center transition hover:border-border-hover hover:bg-surface-hover"
                            >
                              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
                                <Upload className="h-5 w-5" />
                              </span>
                              <p className="mt-3 text-sm font-semibold text-text-primary">Add inspiration image</p>
                              <p className="mt-1 text-xs text-text-secondary">Optional outfit or styling reference.</p>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-card border border-border bg-bg/40 px-4 py-3 text-sm text-text-secondary">
                          Start from visual traits only. You can switch to image mode any time.
                        </div>
                      )}
                    </section>

                    <section className="space-y-4 border-t border-border pt-6">
                      <SectionTitle eyebrow="Step 2" title="Build the look" />
                      <div className="space-y-3">
                        <label className="block text-sm font-semibold text-text-primary">Gender presentation</label>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          {GENDER_PRESENTATION_OPTIONS.map((option) => {
                            const meta = GENDER_CARD_META[option.id] ?? GENDER_CARD_META.custom;
                            return (
                              <IconChoiceCard
                                key={option.id}
                                selected={state.traits.genderPresentation.value === option.id}
                                title={option.label}
                                glyph={meta.glyph}
                                background={meta.background}
                                accent={meta.accent}
                                onClick={() => updateTrait('genderPresentation', option.id)}
                              />
                            );
                          })}
                        </div>
                      </div>

                      <div className="max-w-xl">
                        <SegmentedControl
                          label="Age"
                          options={AGE_RANGE_OPTIONS}
                          value={state.traits.ageRange.value}
                          onChange={(value) => updateTrait('ageRange', value)}
                        />
                      </div>

                      {state.traits.genderPresentation.value === 'custom' ? (
                        <Input
                          value={state.traits.customGenderDescription ?? ''}
                          onChange={(event) =>
                            setState((previous) => ({
                              ...previous,
                              traits: {
                                ...previous.traits,
                                customGenderDescription: event.target.value,
                              },
                            }))
                          }
                          placeholder="Describe the presentation you want to preserve"
                        />
                      ) : null}

                      <div className="relative space-y-3">
                        <label className="block text-sm font-semibold text-text-primary">Hair</label>
                        <button
                          type="button"
                          onClick={() => setHairOpen((previous) => !previous)}
                          className="flex w-full items-center justify-between gap-4 rounded-[24px] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,248,251,0.96))] px-4 py-4 text-left transition hover:border-border-hover hover:shadow-[0_18px_36px_rgba(15,23,42,0.05)]"
                        >
                          <div className="flex min-w-0 items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,rgba(15,23,42,0.08),rgba(255,255,255,0.96))]">
                              <div className="space-y-1">
                                <div className="h-2 w-7 rounded-full bg-slate-500" />
                                <div className="h-2 w-5 rounded-full bg-slate-400" />
                                <div className="h-2 w-6 rounded-full bg-slate-300" />
                              </div>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-text-primary">Hair</p>
                              <p className="truncate text-xs text-text-secondary">
                                {hairSummary === 'Not set' ? 'Open the hair editor' : hairSummary}
                              </p>
                            </div>
                          </div>
                          <span className="rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-text-secondary">
                            {hairOpen ? 'Close' : 'Edit'}
                          </span>
                        </button>
                        <HairEditorPanel
                          open={hairOpen}
                          onClose={() => setHairOpen(false)}
                          sourceMode={state.sourceMode}
                          traits={state.traits}
                          onChange={(key, value) => updateTrait(key, value)}
                        />
                      </div>

                      <div className="space-y-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <label className="block text-sm font-semibold text-text-primary">Outfit</label>
                          <div className="w-full sm:w-[180px]">
                            <SelectMenu
                              options={[
                                { value: '__more_outfits__', label: 'More outfits' },
                                ...overflowOutfits.map((option) => ({ value: option.id, label: option.label })),
                              ]}
                              value={overflowOutfitValue}
                              onChange={(value) => {
                                if (value === '__more_outfits__') return;
                                updateTrait('outfitStyle', String(value));
                              }}
                              buttonClassName="min-h-[40px]"
                            />
                          </div>
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-1">
                          {featuredOutfits.map((option) => {
                            const meta = OUTFIT_CARD_META[option.id] ?? OUTFIT_CARD_META.casual;
                            return (
                              <div key={option.id} className="min-w-[150px] flex-1">
                                <StyleChoiceCard
                                  selected={state.traits.outfitStyle.value === option.id}
                                  title={option.label}
                                  background={meta.background}
                                  accent={meta.accent}
                                  onClick={() => updateTrait('outfitStyle', option.id)}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="block text-sm font-semibold text-text-primary">Realism style</label>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          {REALISM_STYLE_OPTIONS.map((option) => {
                            const meta = REALISM_CARD_META[option.id];
                            return (
                              <StyleChoiceCard
                                key={option.id}
                                selected={state.traits.realismStyle === option.id}
                                title={option.label}
                                background={meta.background}
                                accent={meta.accent}
                                onClick={() =>
                                  setState((previous) => ({
                                    ...previous,
                                    traits: {
                                      ...previous.traits,
                                      realismStyle: option.id,
                                    },
                                  }))
                                }
                              />
                            );
                          })}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setAdvancedOpen((previous) => !previous)}
                        className="flex w-full items-center justify-between rounded-[20px] border border-border bg-bg/40 px-4 py-3 text-left transition hover:border-border-hover"
                      >
                        <div>
                          <p className="text-sm font-semibold text-text-primary">More controls</p>
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">
                          {secondaryControlsCount ? `${secondaryControlsCount} set` : 'Optional'}
                        </span>
                      </button>

                      {advancedOpen ? (
                        <div className="space-y-5 rounded-card border border-border bg-bg/40 p-4">
                          <div className="grid gap-4 lg:grid-cols-2">
                            <CompactSelectField
                              label="Skin tone"
                              value={state.traits.skinTone.value}
                              options={SKIN_TONE_OPTIONS}
                              onChange={(value) => updateTrait('skinTone', value)}
                              autoEnabled={state.sourceMode === 'reference-image' && AUTO_TRAIT_KEYS.has('skinTone')}
                            />
                            <CompactSelectField
                              label="Face cues"
                              value={state.traits.faceCues.value}
                              options={FACE_CUES_OPTIONS}
                              onChange={(value) => updateTrait('faceCues', value)}
                              autoEnabled={state.sourceMode === 'reference-image' && AUTO_TRAIT_KEYS.has('faceCues')}
                            />
                            <CompactSelectField
                              label="Eye color"
                              value={state.traits.eyeColor.value}
                              options={EYE_COLOR_OPTIONS}
                              onChange={(value) => updateTrait('eyeColor', value)}
                              autoEnabled={state.sourceMode === 'reference-image' && AUTO_TRAIT_KEYS.has('eyeColor')}
                            />
                            <CompactSelectField
                              label="Body build"
                              value={state.traits.bodyBuild.value}
                              options={BODY_BUILD_OPTIONS}
                              onChange={(value) => updateTrait('bodyBuild', value)}
                              autoEnabled={state.sourceMode === 'reference-image' && AUTO_TRAIT_KEYS.has('bodyBuild')}
                            />
                            <CompactSelectField
                              label="Consistency"
                              value={state.consistencyMode}
                              options={CHARACTER_CONSISTENCY_OPTIONS}
                              onChange={(value) =>
                                setState((previous) => ({
                                  ...previous,
                                  consistencyMode: value as CharacterBuilderState['consistencyMode'],
                                }))
                              }
                            />
                            {hasIdentityReference ? (
                              <CompactSelectField
                                label="Reference strength"
                                value={state.referenceStrength}
                                options={CHARACTER_REFERENCE_STRENGTH_OPTIONS}
                                onChange={(value) =>
                                  setState((previous) => ({
                                    ...previous,
                                    referenceStrength: value as CharacterBuilderState['referenceStrength'],
                                  }))
                                }
                              />
                            ) : null}
                          </div>

                          <MultiToggleGroup
                            label="Accessories"
                            items={ACCESSORY_OPTIONS}
                            values={state.traits.accessories}
                            onToggle={(value) => toggleListValue('accessories', value)}
                          />
                          <MultiToggleGroup
                            label="Distinctive features"
                            items={DISTINCTIVE_FEATURE_OPTIONS}
                            values={state.traits.distinctiveFeatures}
                            onToggle={(value) => toggleListValue('distinctiveFeatures', value)}
                          />

                          <div className="grid gap-3 md:grid-cols-2">
                            {[
                              ['fullBodyRequired', 'Full body required'],
                              ['includeCloseUps', '4 close-ups below'],
                              ['neutralStudioBackground', 'Neutral background'],
                              ['preserveFacialDetails', 'Preserve facial details'],
                              ['avoid3dRenderLook', 'Avoid 3D look'],
                            ].map(([key, label]) => {
                              const typedKey = key as keyof CharacterBuilderState['outputOptions'];
                              const active = state.outputOptions[typedKey];
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() =>
                                    setState((previous) => ({
                                      ...previous,
                                      outputOptions: {
                                        ...previous.outputOptions,
                                        [typedKey]: !previous.outputOptions[typedKey],
                                      },
                                    }))
                                  }
                                  className={clsx(
                                    'flex items-center justify-between rounded-card border px-4 py-3 text-left transition',
                                    active
                                      ? 'border-brand bg-brand/10'
                                      : 'border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-hover'
                                  )}
                                >
                                  <span className="text-sm font-semibold text-text-primary">{label}</span>
                                  <span className="text-xs font-semibold uppercase tracking-micro">
                                    {active ? 'On' : 'Off'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          <div className="space-y-3">
                            <label className="block text-sm font-semibold text-text-primary">Advanced notes</label>
                            <Textarea
                              rows={3}
                              value={state.advancedNotes}
                              onChange={(event) =>
                                setState((previous) => ({
                                  ...previous,
                                  advancedNotes: event.target.value,
                                }))
                              }
                              placeholder="Optional extra notes"
                            />
                          </div>

                          <div className="space-y-3">
                            <label className="block text-sm font-semibold text-text-primary">Must remain visible</label>
                            <div className="flex gap-2">
                              <Input
                                value={mustRemainDraft}
                                onChange={(event) => setMustRemainDraft(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault();
                                    addMustRemainTag();
                                  }
                                }}
                                placeholder="Add a detail"
                              />
                              <Button onClick={addMustRemainTag}>Add</Button>
                            </div>
                            {state.mustRemainVisible.length ? (
                              <div className="flex flex-wrap gap-2">
                                {state.mustRemainVisible.map((tag) => (
                                  <button
                                    key={tag}
                                    type="button"
                                    onClick={() => removeMustRemainTag(tag)}
                                    className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold uppercase tracking-micro text-text-secondary hover:border-border-hover"
                                  >
                                    {tag}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </section>

                    <section className="space-y-4 border-t border-border pt-6">
                      <SectionTitle eyebrow="Step 3" title="Generate" />
                      <div className="grid gap-4 lg:grid-cols-2">
                        <OutputPreviewCard
                          selected={state.outputMode === 'portrait-reference'}
                          title="Portrait reference"
                          subtitle="Clean face-first anchor"
                          mode="portrait-reference"
                          onClick={() =>
                            setState((previous) => ({
                              ...previous,
                              outputMode: 'portrait-reference',
                            }))
                          }
                        />
                        <OutputPreviewCard
                          selected={state.outputMode === 'character-sheet'}
                          title="Character sheet"
                          subtitle="Multi-angle full-body sheet"
                          mode="character-sheet"
                          onClick={() =>
                            setState((previous) => ({
                              ...previous,
                              outputMode: 'character-sheet',
                              outputOptions: {
                                ...previous.outputOptions,
                                fullBodyRequired: true,
                              },
                            }))
                          }
                        />
                      </div>

                      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-end">
                        <SegmentedControl
                          label="Quality"
                          options={CHARACTER_QUALITY_OPTIONS}
                          value={state.qualityMode}
                          onChange={(value) =>
                            setState((previous) => ({
                              ...previous,
                              qualityMode: value as CharacterBuilderState['qualityMode'],
                            }))
                          }
                        />

                        <div className="rounded-[24px] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,248,251,0.96))] p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <p className="text-sm text-text-secondary">
                              Draft uses Nano Banana 2. Final uses Nano Banana Pro.
                            </p>
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <Button
                                onClick={() => void handleRun('generate', 1)}
                                disabled={loadingAction !== null}
                                className="gap-2"
                              >
                                {loadingAction === 'generate' ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Sparkles className="h-4 w-4" />
                                )}
                                Generate reference
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => void handleRun('generate', 4)}
                                disabled={loadingAction !== null}
                                className="gap-2"
                              >
                                {loadingAction === 'generate' ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <WandSparkles className="h-4 w-4" />
                                )}
                                Generate 4 options
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>

                  <input
                    ref={identityFileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => void triggerUpload('identity', event.target.files)}
                  />
                  <input
                    ref={styleFileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => void triggerUpload('style', event.target.files)}
                  />
                </Card>

                {hasResults ? (
                  <Card className="border border-border p-6">
                    <SectionTitle eyebrow="Results" title="Review outputs" />
                    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {flattenedResults.map((result) => {
                        const run = state.runs.find((entry) => entry.id === result.runId);
                        return (
                          <ResultCard
                            key={result.id}
                            result={result}
                            selected={state.selectedResultId === result.id}
                            pinned={state.pinnedReferenceResultId === result.id}
                            allowPinning={hasMultipleResults}
                            saving={savingResultId === result.id}
                            onSelect={() =>
                              setState((previous) => ({
                                ...previous,
                                selectedResultId: result.id,
                              }))
                            }
                            onPin={() =>
                              setState((previous) => ({
                                ...previous,
                                pinnedReferenceResultId:
                                  previous.pinnedReferenceResultId === result.id ? null : result.id,
                              }))
                            }
                            onDownload={() =>
                              triggerDownload(result.url, `character-reference-${result.id.replace(/[^a-z0-9]+/gi, '-')}.png`)
                            }
                            onSave={() => void handleSaveResult(result)}
                            onDuplicateSettings={() => {
                              if (run?.settingsSnapshot) {
                                applySettingsSnapshot(run.settingsSnapshot, result.id);
                              }
                            }}
                          />
                        );
                      })}
                    </div>
                  </Card>
                ) : null}
                <div className="xl:hidden">{renderFollowUpPanels()}</div>
              </div>

              <div className="hidden xl:block">
                <div className="sticky top-6 space-y-6">
                  <CharacterSummaryCard
                    identityReference={identityReference}
                    hairSummary={hairSummary}
                    outfitSummary={outfitSummary}
                    traits={state.traits}
                    outputMode={state.outputMode}
                    qualityMode={state.qualityMode}
                  />
                  {renderFollowUpPanels()}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
