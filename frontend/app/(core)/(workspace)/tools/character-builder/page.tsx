'use client';

/* eslint-disable @next/next/no-img-element */

import deepmerge from 'deepmerge';
import clsx from 'clsx';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
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
import { suggestDownloadFilename, triggerAppDownload } from '@/lib/download';
import { useI18n } from '@/lib/i18n/I18nProvider';
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

type BillingProductResponse = {
  ok: boolean;
  product?: {
    productKey: string;
    currency: string;
    unitPriceCents: number;
  };
  error?: string;
};

const DEFAULT_CHARACTER_COPY = {
  "auto": "Auto",
  "notSet": "Not set",
  "open": "Open",
  "choose": "Choose",
  "done": "Done",
  "add": "Add",
  "on": "On",
  "off": "Off",
  "disabledTitle": "Tools are disabled",
  "disabledBody": "Enable `FEATURES.workflows.toolsSection` to access this area.",
  "back": "Back to Tools",
  "uploadIdentityStart": "Uploading identity reference…",
  "uploadStyleStart": "Uploading style reference…",
  "uploadIdentityDone": "Identity reference uploaded.",
  "uploadStyleDone": "Style reference uploaded.",
  "uploadFailed": "Upload failed.",
  "uploadTooLarge": "Image exceeds {maxMB} MB. Compress it or choose a smaller file.",
  "loadFromJobDone": "Loaded character builder settings from the selected job.",
  "duplicateDone": "Builder settings copied from that result.",
  "missingRun": "Character builder run is missing.",
  "runGenerateOneDone": "Generated a new character reference.",
  "runGenerateFourDone": "Generated 4 character reference options.",
  "runFullBodyDone": "Generated a full-body correction from the selected result.",
  "runLightingDone": "Generated a lighting variation from the selected result.",
  "runFailed": "Generation failed.",
  "savedToLibrary": "Saved to Library.",
  "saveToLibraryFailed": "Failed to save to Library.",
  "pricingError": "Unable to load tool pricing",
  "top": {
    "start": "Start",
    "buildLook": "Build the look",
    "generate": "Generate",
    "resultsEyebrow": "Results",
    "resultsTitle": "Review outputs"
  },
  "sourceMode": {
    "scratchTitle": "Start from scratch",
    "scratchBody": "Build the character visually.",
    "imageTitle": "Start from image",
    "imageBody": "Infer the look from a reference.",
    "autoTraits": "Auto traits",
    "scratchNote": "Start from visual traits only. You can switch to image mode any time."
  },
  "references": {
    "identityTitle": "Identity reference",
    "identityBody": "Upload the face or character you want to anchor.",
    "styleTitle": "Style inspiration",
    "styleBody": "Optional. Use a second image for outfit or style direction.",
    "addInspiration": "Add inspiration image",
    "addInspirationBody": "Optional outfit or styling reference.",
    "remove": "Remove"
  },
  "sections": {
    "gender": "Gender presentation",
    "age": "Age",
    "customGenderPlaceholder": "Describe the presentation you want to preserve",
    "hair": "Hair",
    "hairOpenEditor": "Open the hair editor",
    "hairEdit": "Edit",
    "hairClose": "Close",
    "outfit": "Outfit",
    "moreOutfits": "More outfits",
    "customHair": "Custom hair prompt",
    "customHairPlaceholder": "Describe the hair you want to preserve or generate",
    "customOutfit": "Custom outfit prompt",
    "customOutfitPlaceholder": "Describe the clothes or wardrobe you want to see",
    "realism": "Realism style",
    "moreControls": "More controls",
    "optional": "Optional",
    "setCount": "{count} set",
    "skinTone": "Skin tone",
    "faceCues": "Face cues",
    "eyeColor": "Eye color",
    "bodyBuild": "Body build",
    "consistency": "Consistency",
    "referenceStrength": "Reference strength",
    "accessories": "Accessories",
    "distinctiveFeatures": "Distinctive features",
    "advancedNotes": "Advanced notes",
    "advancedNotesPlaceholder": "Optional extra notes",
    "mustRemainVisible": "Must remain visible",
    "mustRemainPlaceholder": "Add a detail"
  },
  "outputOptions": {
    "fullBodyRequired": "Full body required",
    "includeCloseUps": "4 close-ups below",
    "neutralStudioBackground": "Neutral background",
    "preserveFacialDetails": "Preserve facial details",
    "avoid3dRenderLook": "Avoid 3D look"
  },
  "generatePanel": {
    "portraitTitle": "Portrait reference",
    "portraitBody": "Clean face-first anchor",
    "sheetTitle": "Character sheet",
    "sheetBody": "Multi-angle full-body sheet",
    "quality": "Quality",
    "qualityBody": "Draft uses Nano Banana 2. Final uses Nano Banana Pro.",
    "pricePerImage": "{price} per image",
    "generateReference": "Generate reference",
    "generateFour": "Generate 4 options"
  },
  "summary": {
    "dna": "Character DNA",
    "snapshot": "Live snapshot",
    "builderBadge": "Builder",
    "noReferenceImage": "No reference image",
    "identity": "Identity",
    "hair": "Hair",
    "outfit": "Outfit",
    "style": "Style",
    "output": "Output",
    "quality": "Quality",
    "autoFromReference": "Auto from reference",
    "photoreal": "Photoreal"
  },
  "hairEditor": {
    "title": "Hair editor",
    "body": "Pick only what matters.",
    "color": "Color",
    "length": "Length",
    "style": "Style"
  },
  "followUp": {
    "selectedEyebrow": "Selected result",
    "selectedTitle": "Current reference",
    "selectedAlt": "Selected character reference",
    "baseReference": "Base reference output",
    "fullBodyRefinement": "Full-body refinement",
    "lightingRefinement": "Lighting refinement",
    "importNote": "Import this reference manually into a video model when you are ready.",
    "pinnedEyebrow": "Pinned base",
    "pinnedTitle": "Refinement base",
    "pinnedAlt": "Pinned base reference",
    "pinnedLabel": "Pinned base",
    "unpin": "Unpin",
    "pinEmpty": "Select a result, then pin it if you want a stable base for refinements.",
    "refineTitle": "Refine",
    "fixFullBody": "Fix full body",
    "createLighting": "Create lighting variant",
    "refineFootnote": "This tool stops at reusable reference image creation."
  },
  "resultCard": {
    "generatedAlt": "Generated character reference",
    "referenceOutput": "Reference output",
    "fullBodyFix": "Full-body fix",
    "lightingVariant": "Lighting variant",
    "selected": "Selected",
    "base": "Base",
    "unpinBase": "Unpin base",
    "useAsBase": "Use as base",
    "download": "Download",
    "save": "Save",
    "duplicate": "Duplicate",
    "select": "Select"
  },
  "options": {
    "gender": {
      "woman": "Woman",
      "man": "Man",
      "androgynous": "Androgynous",
      "custom": "Custom"
    },
    "age": {
      "teen": "Teen",
      "young-adult": "Young adult",
      "adult": "Adult",
      "mature": "Mature",
      "senior": "Senior"
    },
    "skinTone": {
      "fair": "Fair",
      "light": "Light",
      "medium": "Medium",
      "olive": "Olive",
      "deep": "Deep",
      "rich": "Rich"
    },
    "faceCues": {
      "soft": "Soft",
      "angular": "Angular",
      "round": "Round",
      "defined": "Defined",
      "strong-jaw": "Strong jaw"
    },
    "hairColor": {
      "black": "Black",
      "dark-brown": "Dark brown",
      "brown": "Brown",
      "blonde": "Blonde",
      "red": "Red",
      "gray": "Gray",
      "fantasy": "Fantasy"
    },
    "hairLength": {
      "short": "Short",
      "medium": "Medium",
      "long": "Long",
      "very-long": "Very long"
    },
    "hairstyle": {
      "straight": "Straight",
      "wavy-bob": "Wavy bob",
      "curly": "Curly",
      "ponytail": "Ponytail",
      "braids": "Braids",
      "buzz-cut": "Buzz cut",
      "afro": "Afro",
      "tied-back": "Tied back"
    },
    "eyeColor": {
      "brown": "Brown",
      "hazel": "Hazel",
      "blue": "Blue",
      "green": "Green",
      "gray": "Gray",
      "amber": "Amber"
    },
    "bodyBuild": {
      "slim": "Slim",
      "average": "Average",
      "athletic": "Athletic",
      "strong": "Strong",
      "curvy": "Curvy"
    },
    "outfit": {
      "casual": "Casual",
      "business": "Business",
      "streetwear": "Streetwear",
      "formal": "Formal",
      "luxury": "Luxury",
      "sci-fi": "Sci-fi",
      "fantasy": "Fantasy",
      "tactical": "Tactical"
    },
    "realism": {
      "photoreal": "Photoreal",
      "cinematic": "Cinematic",
      "stylized": "Stylized",
      "animated": "Animated"
    },
    "accessories": {
      "glasses": "Glasses",
      "sunglasses": "Sunglasses",
      "earrings": "Earrings",
      "necklace": "Necklace",
      "hat": "Hat",
      "headscarf": "Headscarf"
    },
    "distinctive": {
      "freckles": "Freckles",
      "scar": "Scar",
      "tattoo": "Tattoo",
      "piercing": "Piercing",
      "beard": "Beard",
      "beauty-mark": "Beauty mark",
      "makeup": "Makeup",
      "wrinkles": "Wrinkles"
    },
    "outputMode": {
      "portrait-reference": {
        "label": "Portrait reference",
        "description": "Centered face-forward anchor for later reuse."
      },
      "character-sheet": {
        "label": "Character sheet",
        "description": "Full-body turnaround with clean multi-angle coverage."
      }
    },
    "consistency": {
      "exploratory": {
        "label": "Exploratory",
        "description": "Keep identity recognizable while allowing more variation."
      },
      "balanced": {
        "label": "Balanced",
        "description": "Aim for stable identity with a little creative flexibility."
      },
      "strict": {
        "label": "Strict",
        "description": "Bias strongly toward identity preservation across outputs."
      }
    },
    "referenceStrength": {
      "loose": {
        "label": "Loose",
        "description": "Use the reference for general vibe and broad identity cues."
      },
      "balanced": {
        "label": "Balanced",
        "description": "Preserve the core face and styling while allowing cleanup."
      },
      "strong": {
        "label": "Strong",
        "description": "Stay close to the uploaded identity and key visible markers."
      }
    },
    "quality": {
      "draft": {
        "label": "Draft",
        "description": "Fast exploratory passes on Nano Banana 2."
      },
      "final": {
        "label": "Final",
        "description": "Cleaner export-ready references on Nano Banana Pro."
      }
    }
  }
} as const;

type CharacterCopy = typeof DEFAULT_CHARACTER_COPY;
type LoadingRequestKey = 'generate-1' | 'generate-4' | 'full-body-fix' | 'lighting-variant';

const DEFAULT_UPLOAD_LIMIT_MB = Number.isFinite(Number(process.env.NEXT_PUBLIC_ASSET_MAX_IMAGE_MB ?? '25'))
  ? Number(process.env.NEXT_PUBLIC_ASSET_MAX_IMAGE_MB ?? '25')
  : 25;

function formatTemplate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((result, [key, value]) => {
    return result.replaceAll(`{${key}}`, String(value));
  }, template);
}

function getLoadingRequestKey(action: CharacterBuilderAction, generateCount?: 1 | 4): LoadingRequestKey {
  if (action === 'generate') {
    return generateCount === 4 ? 'generate-4' : 'generate-1';
  }
  return action;
}


function getCharacterBillingProductKey(qualityMode: CharacterBuilderState['qualityMode']): string {
  return qualityMode === 'final' ? 'character-final' : 'character-draft';
}

function formatUsd(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'n/a';
  return `$${value.toFixed(2)}`;
}

function getUploadTooLargeMessage(copy: CharacterCopy, maxMB: number): string {
  return formatTemplate(copy.uploadTooLarge, { maxMB });
}

async function uploadImage(file: File, copy: CharacterCopy): Promise<UploadedAsset> {
  if (file.size > DEFAULT_UPLOAD_LIMIT_MB * 1024 * 1024) {
    throw new Error(getUploadTooLargeMessage(copy, DEFAULT_UPLOAD_LIMIT_MB));
  }

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
    if (payload?.error === 'FILE_TOO_LARGE' || response.status === 413) {
      throw new Error(getUploadTooLargeMessage(copy, payload?.maxMB ?? DEFAULT_UPLOAD_LIMIT_MB));
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

function describeTraitValue(
  options: Array<{ id: string; label: string }>,
  value: string | null | undefined,
  copy: CharacterCopy
): string {
  if (value === 'auto') return copy.auto;
  return findChoiceLabel(options, value) ?? copy.notSet;
}

function summarizeCustomText(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '';
  return trimmed.length > 44 ? `${trimmed.slice(0, 41).trim()}...` : trimmed;
}

function findChoiceSwatch(
  options: Array<{ id: string; swatch?: string }>,
  value: string | null | undefined
): string | null {
  if (!value || value === 'auto') return null;
  return options.find((option) => option.id === value)?.swatch ?? null;
}

function getHairSummary(
  traits: CharacterBuilderTraits,
  options: {
    hairColor: Array<{ id: string; label: string }>;
    hairLength: Array<{ id: string; label: string }>;
    hairstyle: Array<{ id: string; label: string }>;
  },
  copy: CharacterCopy
): string {
  if (traits.hairEnabled === false) {
    return copy.off;
  }

  const customSummary = summarizeCustomText(traits.customHairDescription);
  if (customSummary) {
    return customSummary;
  }

  const values = [
    describeTraitValue(options.hairColor, traits.hairColor.value, copy),
    describeTraitValue(options.hairLength, traits.hairLength.value, copy),
    describeTraitValue(options.hairstyle, traits.hairstyle.value, copy),
  ];

  if (values.every((value) => value === copy.auto)) {
    return copy.summary.autoFromReference;
  }

  const filteredValues = values.filter(
    (value, index, array) => value !== copy.notSet || array.every((entry) => entry === copy.notSet)
  );

  const meaningfulValues = filteredValues.filter((value) => value !== copy.notSet);
  if (!meaningfulValues.length) return copy.notSet;
  return meaningfulValues.join(' / ');
}

function getOutfitSummary(
  traits: CharacterBuilderTraits,
  options: Array<{ id: string; label: string }>,
  copy: CharacterCopy
): string {
  if (traits.outfitEnabled === false) {
    return copy.off;
  }

  const customSummary = summarizeCustomText(traits.customOutfitDescription);
  if (customSummary) {
    return customSummary;
  }

  return describeTraitValue(options, traits.outfitStyle.value, copy);
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
  if (state.outputMode === 'character-sheet' && !state.outputOptions.includeCloseUps) count += 1;
  if (state.outputOptions.fullBodyRequired && state.outputMode !== 'character-sheet') count += 1;
  if (!state.outputOptions.neutralStudioBackground) count += 1;
  if (!state.outputOptions.preserveFacialDetails) count += 1;
  if (!state.outputOptions.avoid3dRenderLook) count += 1;

  return count;
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
          ? 'border-brand bg-brand/5 shadow-card'
          : 'border-border bg-surface hover:border-border-hover hover:bg-surface-hover hover:shadow-card',
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
          className="flex h-16 items-center justify-between rounded-[18px] border border-border/80 bg-surface-2/80 px-4"
          style={{ background }}
        >
          <div
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold"
            style={{ backgroundColor: `${accent}1f`, color: accent }}
          >
            {glyph}
          </div>
          <div className="flex items-end gap-1">
            <span className="h-6 w-6 rounded-full bg-surface shadow-sm" />
            <span className="h-8 w-8 rounded-[14px] bg-surface/80 shadow-sm" />
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
          className="relative h-20 overflow-hidden rounded-[18px] border border-border/80 bg-surface-2/80"
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
            <div className="h-2.5 w-10 rounded-full bg-surface/85" />
            <div className="h-2.5 w-8 rounded-full bg-surface/65" />
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
      <div className="relative h-24 overflow-hidden rounded-[18px] border border-border/80 bg-surface-2/80">
        <div className="absolute inset-x-5 top-4 h-14 rounded-[16px] border border-border/80 bg-surface/80" />
        <div className="absolute left-1/2 top-6 h-8 w-8 -translate-x-1/2 rounded-full bg-brand/15" />
        <div className="absolute left-1/2 top-12 h-8 w-10 -translate-x-1/2 rounded-[14px] bg-brand/20" />
      </div>
    ) : (
      <div className="grid h-24 grid-cols-4 gap-2 rounded-[18px] border border-border/80 bg-surface-2/80 p-3">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="relative overflow-hidden rounded-[14px] border border-border bg-surface/75">
            <div className="absolute left-1/2 top-2 h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-brand/15" />
            <div className="absolute left-1/2 top-6 h-8 w-4 -translate-x-1/2 rounded-full bg-brand/20" />
          </div>
        ))}
      </div>
    );

  return <VisualChoiceCard selected={selected} onClick={onClick} title={title} subtitle={subtitle} media={preview} />;
}

function CharacterSummaryCard({
  identityReference,
  hairSummary,
  outfitSummary,
  traits,
  outputMode,
  qualityMode,
  genderOptions,
  ageOptions,
  realismOptions,
  outputOptions,
  qualityOptions,
  copy,
}: {
  identityReference: CharacterBuilderReferenceImage | null;
  hairSummary: string;
  outfitSummary: string;
  traits: CharacterBuilderTraits;
  outputMode: CharacterBuilderState['outputMode'];
  qualityMode: CharacterBuilderState['qualityMode'];
  genderOptions: Array<{ id: string; label: string }>;
  ageOptions: Array<{ id: string; label: string }>;
  realismOptions: Array<{ id: string; label: string }>;
  outputOptions: Array<{ id: string; label: string }>;
  qualityOptions: Array<{ id: string; label: string }>;
  copy: CharacterCopy;
}) {
  const hairSwatch =
    traits.hairEnabled === false || Boolean(traits.customHairDescription?.trim())
      ? null
      : findChoiceSwatch(HAIR_COLOR_OPTIONS, traits.hairColor.value);
  const genderLabel = findChoiceLabel(genderOptions, traits.genderPresentation.value) ?? copy.open;
  const ageLabel = findChoiceLabel(ageOptions, traits.ageRange.value) ?? copy.open;
  const realismLabel = findChoiceLabel(realismOptions, traits.realismStyle);
  const outputLabel = findChoiceLabel(outputOptions, outputMode);
  const qualityLabel = findChoiceLabel(qualityOptions, qualityMode);

  return (
    <Card className="overflow-hidden border border-border bg-surface p-5 shadow-card">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{copy.summary.dna}</p>
            <h3 className="mt-2 text-lg font-semibold text-text-primary">{copy.summary.snapshot}</h3>
          </div>
          <span className="rounded-full border border-border bg-surface-2/80 px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
            {copy.summary.builderBadge}
          </span>
        </div>

        {identityReference ? (
          <img
            src={identityReference.url}
            alt={copy.references.identityTitle}
            className="h-28 w-full rounded-[20px] object-cover"
          />
        ) : (
          <div className="relative h-28 overflow-hidden rounded-[20px] border border-border bg-surface-2/80">
            <div className="absolute left-1/2 top-5 h-10 w-10 -translate-x-1/2 rounded-full bg-slate-300" />
            <div className="absolute left-1/2 top-14 h-12 w-16 -translate-x-1/2 rounded-[18px] bg-slate-200" />
            <div className="absolute bottom-3 left-3 rounded-full bg-surface/85 px-2 py-1 text-[10px] font-semibold text-text-secondary">
              {copy.summary.noReferenceImage}
            </div>
          </div>
        )}

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3 rounded-[18px] border border-border bg-surface-2/80 px-3 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.summary.identity}</span>
            <span className="text-sm font-medium text-text-primary">
              {genderLabel} · {ageLabel}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-[18px] border border-border bg-surface-2/80 px-3 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.summary.hair}</span>
            <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
              {hairSwatch ? (
                <span
                  className="h-3 w-3 rounded-full border border-black/10"
                  style={{ backgroundColor: hairSwatch }}
                />
              ) : null}
              {hairSummary === copy.notSet ? copy.open : hairSummary}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-[18px] border border-border bg-surface-2/80 px-3 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.summary.outfit}</span>
            <span className="text-sm font-medium text-text-primary">
              {outfitSummary === copy.notSet ? copy.open : outfitSummary}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-[18px] border border-border bg-surface-2/80 px-3 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.summary.style}</span>
            <span className="text-sm font-medium text-text-primary">{realismLabel ?? copy.summary.photoreal}</span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-[18px] border border-border bg-surface-2/80 px-3 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.summary.output}</span>
            <span className="text-sm font-medium text-text-primary">{outputLabel}</span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-[18px] border border-border bg-surface-2/80 px-3 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.summary.quality}</span>
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
  hairColorOptions,
  hairLengthOptions,
  hairstyleOptions,
  copy,
}: {
  open: boolean;
  onClose: () => void;
  sourceMode: CharacterBuilderState['sourceMode'];
  traits: CharacterBuilderTraits;
  onChange: (key: 'hairColor' | 'hairLength' | 'hairstyle', value: string | 'auto') => void;
  hairColorOptions: ChoiceOption[];
  hairLengthOptions: ChoiceOption[];
  hairstyleOptions: ChoiceOption[];
  copy: CharacterCopy;
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
            : 'border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-hover'
        )}
      >
        {copy.auto}
      </button>
    ) : null;

  const panel = (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-primary">{copy.hairEditor.title}</p>
          <p className="text-[11px] text-text-secondary">{copy.hairEditor.body}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {copy.done}
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.hairEditor.color}</p>
        <div className="flex flex-wrap gap-2">
          {autoButton('hairColor')}
          {hairColorOptions.map((option) => {
            const selected = traits.hairColor.value === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onChange('hairColor', selected ? '' : option.id)}
                className={clsx(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                  selected
                    ? 'border-brand bg-brand/10 text-text-primary'
                    : 'border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-hover'
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
        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.hairEditor.length}</p>
        <div className="flex flex-wrap gap-2">
          {autoButton('hairLength')}
          {hairLengthOptions.map((option) => {
            const selected = traits.hairLength.value === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onChange('hairLength', selected ? '' : option.id)}
                className={clsx(
                  'rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-micro transition',
                  selected
                    ? 'border-brand bg-brand text-on-brand'
                    : 'border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-hover'
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.hairEditor.style}</p>
        <div className="flex flex-wrap gap-2">
          {autoButton('hairstyle')}
          {hairstyleOptions.map((option) => {
            const selected = traits.hairstyle.value === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onChange('hairstyle', selected ? '' : option.id)}
                className={clsx(
                  'rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-micro transition',
                  selected
                    ? 'border-brand bg-brand text-on-brand'
                    : 'border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-hover'
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
      <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-[28px] border border-border bg-surface-glass-95 p-5 shadow-[0_-24px_48px_rgba(15,23,42,0.18)] lg:absolute lg:inset-x-0 lg:bottom-auto lg:top-[calc(100%+12px)] lg:z-30 lg:rounded-[24px] lg:border lg:p-5 lg:shadow-[0_24px_48px_rgba(15,23,42,0.12)]">
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
  placeholder,
  autoEnabled = false,
  autoLabel,
}: {
  label: string;
  value: string | null;
  options: ChoiceOption[];
  onChange: (value: string | 'auto') => void;
  placeholder: string;
  autoEnabled?: boolean;
  autoLabel: string;
}) {
  const selectOptions = [
    { value: '', label: placeholder },
    ...(autoEnabled ? [{ value: 'auto', label: autoLabel }] : []),
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

function SectionTitle({ eyebrow, title, body, children }: { eyebrow?: string; title: string; body?: string; children?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{eyebrow}</p> : null}
        <h2 className={clsx('text-xl font-semibold text-text-primary', eyebrow ? 'mt-2' : '')}>{title}</h2>
        {body ? <p className="mt-2 max-w-2xl text-sm text-text-secondary">{body}</p> : null}
      </div>
      {children}
    </div>
  );
}

function BuilderAccordionSection({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary?: string | null;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-border bg-surface shadow-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left sm:px-5"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary">{title}</p>
          {summary ? <p className="mt-1 truncate text-xs text-text-secondary">{summary}</p> : null}
        </div>
        <ChevronDown
          className={clsx(
            'h-4 w-4 shrink-0 text-text-muted transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>
      {open ? <div className="border-t border-border px-4 py-4 sm:px-5">{children}</div> : null}
    </section>
  );
}

function ReferenceSlot({
  title,
  subtitle,
  image,
  onUpload,
  onRemove,
  disabled = false,
  removeLabel,
}: {
  title: string;
  subtitle: string;
  image: CharacterBuilderReferenceImage | null;
  onUpload: () => void;
  onRemove: () => void;
  disabled?: boolean;
  removeLabel: string;
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
            {removeLabel}
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
  copy,
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
  copy: CharacterCopy;
}) {
  return (
    <Card
      className={clsx(
        'overflow-hidden border p-0 transition',
        selected ? 'border-brand shadow-[0_0_0_1px_rgba(11,107,255,0.2)]' : 'border-border'
      )}
    >
      <button type="button" onClick={onSelect} className="block w-full text-left">
        <img src={result.thumbUrl ?? result.url} alt={copy.resultCard.generatedAlt} className="h-48 w-full object-cover" />
      </button>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{result.engineLabel}</p>
            <p className="mt-1 text-sm font-semibold text-text-primary">
              {result.action === 'generate'
                ? copy.resultCard.referenceOutput
                : result.action === 'full-body-fix'
                  ? copy.resultCard.fullBodyFix
                  : copy.resultCard.lightingVariant}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selected ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-1 text-[11px] font-semibold text-brand">
                <Check className="h-3.5 w-3.5" />
                {copy.resultCard.selected}
              </span>
            ) : null}
            {pinned ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-primary">
                <Pin className="h-3.5 w-3.5" />
                {copy.resultCard.base}
              </span>
            ) : null}
          </div>
        </div>
        {selected ? (
          <div className="flex flex-wrap gap-2">
            {allowPinning ? (
              <Button variant="outline" size="sm" onClick={onPin} className="gap-2">
                {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                {pinned ? copy.resultCard.unpinBase : copy.resultCard.useAsBase}
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={onDownload} className="gap-2">
              <Download className="h-4 w-4" />
              {copy.resultCard.download}
            </Button>
            <Button variant="outline" size="sm" onClick={onSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {copy.resultCard.save}
            </Button>
            <Button variant="ghost" size="sm" onClick={onDuplicateSettings} className="gap-2">
              <WandSparkles className="h-4 w-4" />
              {copy.resultCard.duplicate}
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={onSelect}>
            {copy.resultCard.select}
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function CharacterBuilderPage() {
  const { loading: authLoading, user } = useRequireAuth();
  const { t } = useI18n();
  const rawCopy = t('workspace.characterBuilder', DEFAULT_CHARACTER_COPY);
  const copy = useMemo<CharacterCopy>(() => {
    return deepmerge(DEFAULT_CHARACTER_COPY, (rawCopy ?? {}) as Partial<CharacterCopy>);
  }, [rawCopy]);
  const searchParams = useSearchParams();
  const [state, setState] = useState<CharacterBuilderState>(() => createDefaultCharacterBuilderState());
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [hairOpen, setHairOpen] = useState(false);
  const [buildSectionsOpen, setBuildSectionsOpen] = useState({
    identity: true,
    hair: false,
    outfit: false,
    style: false,
  });
  const [showStyleReferenceSlot, setShowStyleReferenceSlot] = useState(false);
  const [mustRemainDraft, setMustRemainDraft] = useState('');
  const [loadingAction, setLoadingAction] = useState<LoadingRequestKey | null>(null);
  const [savingResultId, setSavingResultId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const identityFileRef = useRef<HTMLInputElement | null>(null);
  const styleFileRef = useRef<HTMLInputElement | null>(null);

  const genderOptions = useMemo(
    () => GENDER_PRESENTATION_OPTIONS.map((option) => ({ ...option, label: copy.options.gender[option.id as keyof typeof copy.options.gender] ?? option.label })),
    [copy]
  );
  const ageOptions = useMemo(
    () => AGE_RANGE_OPTIONS.map((option) => ({ ...option, label: copy.options.age[option.id as keyof typeof copy.options.age] ?? option.label })),
    [copy]
  );
  const skinToneOptions = useMemo(
    () => SKIN_TONE_OPTIONS.map((option) => ({ ...option, label: copy.options.skinTone[option.id as keyof typeof copy.options.skinTone] ?? option.label })),
    [copy]
  );
  const faceCueOptions = useMemo(
    () => FACE_CUES_OPTIONS.map((option) => ({ ...option, label: copy.options.faceCues[option.id as keyof typeof copy.options.faceCues] ?? option.label })),
    [copy]
  );
  const hairColorOptions = useMemo(
    () => HAIR_COLOR_OPTIONS.map((option) => ({ ...option, label: copy.options.hairColor[option.id as keyof typeof copy.options.hairColor] ?? option.label })),
    [copy]
  );
  const hairLengthOptions = useMemo(
    () => HAIR_LENGTH_OPTIONS.map((option) => ({ ...option, label: copy.options.hairLength[option.id as keyof typeof copy.options.hairLength] ?? option.label })),
    [copy]
  );
  const hairstyleOptions = useMemo(
    () => HAIRSTYLE_OPTIONS.map((option) => ({ ...option, label: copy.options.hairstyle[option.id as keyof typeof copy.options.hairstyle] ?? option.label })),
    [copy]
  );
  const eyeColorOptions = useMemo(
    () => EYE_COLOR_OPTIONS.map((option) => ({ ...option, label: copy.options.eyeColor[option.id as keyof typeof copy.options.eyeColor] ?? option.label })),
    [copy]
  );
  const bodyBuildOptions = useMemo(
    () => BODY_BUILD_OPTIONS.map((option) => ({ ...option, label: copy.options.bodyBuild[option.id as keyof typeof copy.options.bodyBuild] ?? option.label })),
    [copy]
  );
  const outfitOptions = useMemo(
    () => OUTFIT_STYLE_OPTIONS.map((option) => ({ ...option, label: copy.options.outfit[option.id as keyof typeof copy.options.outfit] ?? option.label })),
    [copy]
  );
  const realismOptions = useMemo(
    () => REALISM_STYLE_OPTIONS.map((option) => ({ ...option, label: copy.options.realism[option.id as keyof typeof copy.options.realism] ?? option.label })),
    [copy]
  );
  const accessoryOptions = useMemo(
    () => ACCESSORY_OPTIONS.map((option) => ({ ...option, label: copy.options.accessories[option.id as keyof typeof copy.options.accessories] ?? option.label })),
    [copy]
  );
  const distinctiveOptions = useMemo(
    () => DISTINCTIVE_FEATURE_OPTIONS.map((option) => ({ ...option, label: copy.options.distinctive[option.id as keyof typeof copy.options.distinctive] ?? option.label })),
    [copy]
  );
  const outputModeOptions = useMemo(
    () =>
      CHARACTER_OUTPUT_OPTIONS.map((option) => ({
        ...option,
        label: copy.options.outputMode[option.id].label,
        description: copy.options.outputMode[option.id].description,
      })),
    [copy]
  );
  const consistencyOptions = useMemo(
    () =>
      CHARACTER_CONSISTENCY_OPTIONS.map((option) => ({
        ...option,
        label: copy.options.consistency[option.id].label,
        description: copy.options.consistency[option.id].description,
      })),
    [copy]
  );
  const referenceStrengthOptions = useMemo(
    () =>
      CHARACTER_REFERENCE_STRENGTH_OPTIONS.map((option) => ({
        ...option,
        label: copy.options.referenceStrength[option.id].label,
        description: copy.options.referenceStrength[option.id].description,
      })),
    [copy]
  );
  const qualityOptions = useMemo(
    () =>
      CHARACTER_QUALITY_OPTIONS.map((option) => ({
        ...option,
        label: copy.options.quality[option.id].label,
        description: copy.options.quality[option.id].description,
      })),
    [copy]
  );

  const flattenedResults = getFlattenedResults(state.runs);
  const selectedResult = findResultById(state.runs, state.selectedResultId);
  const pinnedResult = findResultById(state.runs, state.pinnedReferenceResultId);
  const identityReference = getRefByRole(state.referenceImages, 'identity');
  const styleReference = getRefByRole(state.referenceImages, 'style');
  const hasIdentityReference = Boolean(identityReference);
  const hasResults = flattenedResults.length > 0;
  const hasMultipleResults = flattenedResults.length > 1;
  const secondaryControlsCount = countConfiguredSecondaryControls(state, hasIdentityReference);
  const hairSummary = getHairSummary(state.traits, { hairColor: hairColorOptions, hairLength: hairLengthOptions, hairstyle: hairstyleOptions }, copy);
  const outfitSummary = getOutfitSummary(state.traits, outfitOptions, copy);
  const identitySummary = `${findChoiceLabel(genderOptions, state.traits.genderPresentation.value) ?? copy.open} · ${findChoiceLabel(ageOptions, state.traits.ageRange.value) ?? copy.open}`;
  const realismSummary = findChoiceLabel(realismOptions, state.traits.realismStyle) ?? copy.summary.photoreal;
  const jobIdFromQuery = searchParams?.get('job')?.trim() ?? null;
  const featuredOutfits = outfitOptions.filter((option) => FEATURED_OUTFIT_IDS.includes(option.id as (typeof FEATURED_OUTFIT_IDS)[number]));
  const overflowOutfits = outfitOptions.filter(
    (option) => !FEATURED_OUTFIT_IDS.includes(option.id as (typeof FEATURED_OUTFIT_IDS)[number])
  );
  const billingProductKey = getCharacterBillingProductKey(state.qualityMode);
  const overflowOutfitValue =
    state.traits.outfitEnabled &&
    !state.traits.customOutfitDescription?.trim() &&
    state.traits.outfitStyle.value &&
    !FEATURED_OUTFIT_IDS.includes(state.traits.outfitStyle.value as (typeof FEATURED_OUTFIT_IDS)[number])
      ? state.traits.outfitStyle.value
      : '__more_outfits__';
  const { data: billingProductData } = useSWR(
    `/api/billing-products?productKey=${encodeURIComponent(billingProductKey)}`,
    async (url: string) => {
      const response = await authFetch(url);
      const payload = (await response.json().catch(() => null)) as BillingProductResponse | null;
      if (!response.ok || !payload?.ok || !payload.product) {
        throw new Error(payload?.error ?? copy.pricingError);
      }
      return payload.product;
    },
    { keepPreviousData: true }
  );
  const estimatedImageCostUsd =
    billingProductData?.unitPriceCents != null ? Number((billingProductData.unitPriceCents / 100).toFixed(2)) : null;
  const qualityLabel = findChoiceLabel(
    qualityOptions.map((option) => ({ id: option.id, label: option.label })),
    state.qualityMode
  );
  const outputLabel = findChoiceLabel(
    outputModeOptions.map((option) => ({ id: option.id, label: option.label })),
    state.outputMode
  );

  const toggleBuildSection = (section: keyof typeof buildSectionsOpen) => {
    setBuildSectionsOpen((previous) => ({
      ...previous,
      [section]: !previous[section],
    }));
  };

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
        setStatusMessage(copy.loadFromJobDone);
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
  }, [copy.loadFromJobDone, hydrated, jobIdFromQuery]);

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

  function setHairEnabled(enabled: boolean) {
    setState((previous) => ({
      ...previous,
      traits: {
        ...previous.traits,
        hairEnabled: enabled,
      },
    }));
    if (!enabled) {
      setHairOpen(false);
    }
  }

  function setOutfitEnabled(enabled: boolean) {
    setState((previous) => ({
      ...previous,
      traits: {
        ...previous.traits,
        outfitEnabled: enabled,
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
    setStatusMessage(role === 'identity' ? copy.uploadIdentityStart : copy.uploadStyleStart);

    try {
      const asset = await uploadImage(file, copy);
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
      setStatusMessage(role === 'identity' ? copy.uploadIdentityDone : copy.uploadStyleDone);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : copy.uploadFailed);
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
    setStatusMessage(copy.duplicateDone);
  }

  async function handleRun(action: CharacterBuilderAction, generateCount?: 1 | 4) {
    setError(null);
    setStatusMessage(null);
    setLoadingAction(getLoadingRequestKey(action, generateCount));

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
        throw new Error(copy.missingRun);
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
            ? copy.runGenerateFourDone
            : copy.runGenerateOneDone
          : action === 'full-body-fix'
            ? copy.runFullBodyDone
            : copy.runLightingDone
      );
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : copy.runFailed);
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
        label: copy.generatePanel.portraitTitle,
        source: 'character',
      });
      setStatusMessage(copy.savedToLibrary);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : copy.saveToLibraryFailed);
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
            <SectionTitle eyebrow={copy.followUp.selectedEyebrow} title={copy.followUp.selectedTitle} />
            <img
              src={selectedResult.thumbUrl ?? selectedResult.url}
              alt={copy.followUp.selectedAlt}
              className="mt-5 h-72 w-full rounded-card object-cover"
            />
            <div className="mt-4 space-y-2">
              <p className="text-sm font-semibold text-text-primary">{selectedResult.engineLabel}</p>
              <p className="text-xs text-text-secondary">
                {selectedResult.action === 'generate'
                  ? copy.followUp.baseReference
                  : selectedResult.action === 'full-body-fix'
                    ? copy.followUp.fullBodyRefinement
                    : copy.followUp.lightingRefinement}
              </p>
            </div>
            <div className="mt-4 rounded-card border border-border bg-bg/40 p-4 text-sm text-text-secondary">
              {copy.followUp.importNote}
            </div>
          </Card>
        ) : null}

        {hasMultipleResults ? (
          <Card className="border border-border p-6">
            <SectionTitle eyebrow={copy.followUp.pinnedEyebrow} title={copy.followUp.pinnedTitle} />
            {pinnedResult ? (
              <div className="mt-5 space-y-4">
                <img
                  src={pinnedResult.thumbUrl ?? pinnedResult.url}
                  alt={copy.followUp.pinnedAlt}
                  className="h-64 w-full rounded-card object-cover"
                />
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{copy.followUp.pinnedLabel}</p>
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
                    {copy.followUp.unpin}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-card border border-dashed border-border bg-bg/40 p-5 text-sm text-text-secondary">
                {copy.followUp.pinEmpty}
              </div>
            )}
          </Card>
        ) : null}

        {selectedResult ? (
          <Card className="border border-border p-6">
            <SectionTitle title={copy.followUp.refineTitle} />
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
                {copy.followUp.fixFullBody}
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
                {copy.followUp.createLighting}
              </Button>
            </div>
            <p className="mt-4 text-xs text-text-secondary">
              {copy.followUp.refineFootnote}
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
        <div className="flex flex-1 min-w-0 flex-col xl:flex-row">
          <div className="hidden xl:block">
            <AppSidebar />
          </div>
          <main className="flex-1 min-w-0 overflow-y-auto p-5 pb-28 lg:p-7 lg:pb-32 xl:pb-7">
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
        <div className="flex flex-1 min-w-0 flex-col xl:flex-row">
          <div className="hidden xl:block">
            <AppSidebar />
          </div>
          <main className="flex-1 min-w-0 overflow-y-auto p-5 pb-28 lg:p-7 lg:pb-32 xl:pb-7">
            <Card className="border border-border p-6">
              <h1 className="text-2xl font-semibold text-text-primary">{copy.disabledTitle}</h1>
              <p className="mt-2 text-sm text-text-secondary">{copy.disabledBody}</p>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex flex-1 min-w-0 flex-col xl:flex-row">
        <div className="hidden xl:block">
          <AppSidebar />
        </div>
        <main className="flex-1 min-w-0 overflow-y-auto p-5 pb-28 lg:p-7 lg:pb-32 xl:pb-7">
          <div className="mx-auto w-full max-w-[1500px] space-y-6">
            <div>
              <ButtonLink
                href="/tools"
                variant="ghost"
                size="sm"
                linkComponent={Link}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                {copy.back}
              </ButtonLink>
            </div>

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
                    <div className="xl:hidden">
                      <CharacterSummaryCard
                        identityReference={identityReference}
                        hairSummary={hairSummary}
                        outfitSummary={outfitSummary}
                        traits={state.traits}
                        outputMode={state.outputMode}
                        qualityMode={state.qualityMode}
                        genderOptions={genderOptions}
                        ageOptions={ageOptions}
                        realismOptions={realismOptions.map((option) => ({ id: option.id, label: option.label }))}
                        outputOptions={outputModeOptions.map((option) => ({ id: option.id, label: option.label }))}
                        qualityOptions={qualityOptions.map((option) => ({ id: option.id, label: option.label }))}
                        copy={copy}
                      />
                    </div>

                    <section className="space-y-4">
                      <SectionTitle title={copy.top.start} />
                      <div className="grid gap-4 md:grid-cols-2">
                        <VisualChoiceCard
                          selected={state.sourceMode === 'scratch'}
                          onClick={() => updateSourceMode('scratch')}
                          title={copy.sourceMode.scratchTitle}
                          subtitle={copy.sourceMode.scratchBody}
                          media={
                            <div className="flex h-20 items-center justify-between rounded-[18px] border border-border/80 bg-surface-2/80 px-4">
                              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand/15 text-brand">
                                <Sparkles className="h-4 w-4" />
                              </div>
                              <div className="flex items-end gap-1">
                                <span className="h-7 w-7 rounded-full bg-surface shadow-sm" />
                                <span className="h-9 w-9 rounded-[16px] bg-surface/80 shadow-sm" />
                              </div>
                            </div>
                          }
                        />
                        <VisualChoiceCard
                          selected={state.sourceMode === 'reference-image'}
                          onClick={() => updateSourceMode('reference-image')}
                          title={copy.sourceMode.imageTitle}
                          subtitle={copy.sourceMode.imageBody}
                          media={
                            <div className="flex h-20 items-center justify-between rounded-[18px] border border-border/80 bg-surface-2/80 px-4">
                              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                                <Upload className="h-4 w-4" />
                              </div>
                              <div className="rounded-[16px] border border-dashed border-emerald-300 bg-surface/85 px-3 py-2 text-[11px] font-semibold text-text-secondary">
                                {copy.sourceMode.autoTraits}
                              </div>
                            </div>
                          }
                        />
                      </div>

                      {state.sourceMode === 'reference-image' ? (
                        <div className="grid gap-4 lg:grid-cols-2">
                          <ReferenceSlot
                            title={copy.references.identityTitle}
                            subtitle={copy.references.identityBody}
                            image={identityReference}
                            onUpload={() => identityFileRef.current?.click()}
                            removeLabel={copy.references.remove}
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
                              title={copy.references.styleTitle}
                              subtitle={copy.references.styleBody}
                              image={styleReference}
                              onUpload={() => styleFileRef.current?.click()}
                              removeLabel={copy.references.remove}
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
                              <p className="mt-3 text-sm font-semibold text-text-primary">{copy.references.addInspiration}</p>
                              <p className="mt-1 text-xs text-text-secondary">{copy.references.addInspirationBody}</p>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-card border border-border bg-bg/40 px-4 py-3 text-sm text-text-secondary">
                          {copy.sourceMode.scratchNote}
                        </div>
                      )}
                    </section>

                    <section className="space-y-4 border-t border-border pt-6">
                      <SectionTitle title={copy.top.buildLook} />
                      <div className="space-y-4">
                        <BuilderAccordionSection
                          title={copy.sections.gender}
                          summary={identitySummary}
                          open={buildSectionsOpen.identity}
                          onToggle={() => toggleBuildSection('identity')}
                        >
                          <div className="space-y-4">
                            <div className="space-y-3">
                              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                {genderOptions.map((option) => {
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
                                label={copy.sections.age}
                                options={ageOptions}
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
                                placeholder={copy.sections.customGenderPlaceholder}
                              />
                            ) : null}
                          </div>
                        </BuilderAccordionSection>

                        <BuilderAccordionSection
                          title={copy.sections.hair}
                          summary={hairSummary === copy.notSet ? copy.sections.hairOpenEditor : hairSummary}
                          open={buildSectionsOpen.hair}
                          onToggle={() => toggleBuildSection('hair')}
                        >
                          <div className="relative space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-text-primary">{copy.sections.hair}</p>
                              <div className="inline-flex rounded-full border border-border bg-bg p-1">
                                {[true, false].map((enabled) => (
                                  <button
                                    key={enabled ? 'on' : 'off'}
                                    type="button"
                                    onClick={() => setHairEnabled(enabled)}
                                    className={clsx(
                                      'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                                      state.traits.hairEnabled === enabled
                                        ? 'bg-brand text-on-brand'
                                        : 'text-text-secondary hover:text-text-primary'
                                    )}
                                  >
                                    {enabled ? copy.on : copy.off}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {state.traits.hairEnabled ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setHairOpen((previous) => !previous)}
                                  className="flex w-full items-center justify-between gap-4 rounded-[24px] border border-border bg-surface px-4 py-4 text-left transition hover:border-border-hover hover:bg-surface-hover hover:shadow-card"
                                >
                                  <div className="flex min-w-0 items-center gap-4">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-surface-2/80">
                                      <div className="space-y-1">
                                        <div className="h-2 w-7 rounded-full bg-slate-500" />
                                        <div className="h-2 w-5 rounded-full bg-slate-400" />
                                        <div className="h-2 w-6 rounded-full bg-slate-300" />
                                      </div>
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold text-text-primary">{copy.sections.hair}</p>
                                      <p className="truncate text-xs text-text-secondary">
                                        {hairSummary === copy.notSet ? copy.sections.hairOpenEditor : hairSummary}
                                      </p>
                                    </div>
                                  </div>
                                  <span className="rounded-full border border-border bg-surface-2/80 px-3 py-1 text-xs font-semibold text-text-secondary">
                                    {hairOpen ? copy.sections.hairClose : copy.sections.hairEdit}
                                  </span>
                                </button>
                                <div className="space-y-2">
                                  <label className="block text-sm font-semibold text-text-primary">{copy.sections.customHair}</label>
                                  <Textarea
                                    value={state.traits.customHairDescription ?? ''}
                                    onChange={(event) =>
                                      setState((previous) => ({
                                        ...previous,
                                        traits: {
                                          ...previous.traits,
                                          customHairDescription: event.target.value,
                                        },
                                      }))
                                    }
                                    placeholder={copy.sections.customHairPlaceholder}
                                  />
                                </div>
                                <HairEditorPanel
                                  open={hairOpen}
                                  onClose={() => setHairOpen(false)}
                                  sourceMode={state.sourceMode}
                                  traits={state.traits}
                                  onChange={(key, value) => updateTrait(key, value)}
                                  hairColorOptions={hairColorOptions}
                                  hairLengthOptions={hairLengthOptions}
                                  hairstyleOptions={hairstyleOptions}
                                  copy={copy}
                                />
                              </>
                            ) : (
                              <div className="rounded-[20px] border border-dashed border-border bg-bg/40 px-4 py-4 text-sm text-text-secondary">
                                {copy.off}
                              </div>
                            )}
                          </div>
                        </BuilderAccordionSection>

                        <BuilderAccordionSection
                          title={copy.sections.outfit}
                          summary={outfitSummary === copy.notSet ? copy.open : outfitSummary}
                          open={buildSectionsOpen.outfit}
                          onToggle={() => toggleBuildSection('outfit')}
                        >
                          <div className="space-y-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <label className="block text-sm font-semibold text-text-primary">{copy.sections.outfit}</label>
                              <div className="inline-flex rounded-full border border-border bg-bg p-1">
                                {[true, false].map((enabled) => (
                                  <button
                                    key={enabled ? 'on' : 'off'}
                                    type="button"
                                    onClick={() => setOutfitEnabled(enabled)}
                                    className={clsx(
                                      'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                                      state.traits.outfitEnabled === enabled
                                        ? 'bg-brand text-on-brand'
                                        : 'text-text-secondary hover:text-text-primary'
                                    )}
                                  >
                                    {enabled ? copy.on : copy.off}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {state.traits.outfitEnabled ? (
                              <>
                                <div className="w-full sm:w-[180px]">
                                  <SelectMenu
                                    options={[
                                      { value: '__more_outfits__', label: copy.sections.moreOutfits },
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
                                <div className="space-y-2">
                                  <label className="block text-sm font-semibold text-text-primary">{copy.sections.customOutfit}</label>
                                  <Textarea
                                    value={state.traits.customOutfitDescription ?? ''}
                                    onChange={(event) =>
                                      setState((previous) => ({
                                        ...previous,
                                        traits: {
                                          ...previous.traits,
                                          customOutfitDescription: event.target.value,
                                        },
                                      }))
                                    }
                                    placeholder={copy.sections.customOutfitPlaceholder}
                                  />
                                </div>
                              </>
                            ) : (
                              <div className="rounded-[20px] border border-dashed border-border bg-bg/40 px-4 py-4 text-sm text-text-secondary">
                                {copy.off}
                              </div>
                            )}
                          </div>
                        </BuilderAccordionSection>

                        <BuilderAccordionSection
                          title={copy.sections.realism}
                          summary={realismSummary}
                          open={buildSectionsOpen.style}
                          onToggle={() => toggleBuildSection('style')}
                        >
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            {realismOptions.map((option) => {
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
                        </BuilderAccordionSection>
                      </div>

                      <button
                        type="button"
                        onClick={() => setAdvancedOpen((previous) => !previous)}
                        className="flex w-full items-center justify-between rounded-[20px] border border-border bg-bg/40 px-4 py-3 text-left transition hover:border-border-hover"
                      >
                        <div>
                          <p className="text-sm font-semibold text-text-primary">{copy.sections.moreControls}</p>
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">
                          {secondaryControlsCount
                            ? copy.sections.setCount.replace('{count}', String(secondaryControlsCount))
                            : copy.sections.optional}
                        </span>
                      </button>

                      {advancedOpen ? (
                        <div className="space-y-5 rounded-card border border-border bg-bg/40 p-4">
                          <div className="grid gap-4 lg:grid-cols-2">
                            <CompactSelectField
                              label={copy.sections.skinTone}
                              value={state.traits.skinTone.value}
                              options={skinToneOptions}
                              onChange={(value) => updateTrait('skinTone', value)}
                              placeholder={copy.choose}
                              autoLabel={copy.auto}
                              autoEnabled={state.sourceMode === 'reference-image' && AUTO_TRAIT_KEYS.has('skinTone')}
                            />
                            <CompactSelectField
                              label={copy.sections.faceCues}
                              value={state.traits.faceCues.value}
                              options={faceCueOptions}
                              onChange={(value) => updateTrait('faceCues', value)}
                              placeholder={copy.choose}
                              autoLabel={copy.auto}
                              autoEnabled={state.sourceMode === 'reference-image' && AUTO_TRAIT_KEYS.has('faceCues')}
                            />
                            <CompactSelectField
                              label={copy.sections.eyeColor}
                              value={state.traits.eyeColor.value}
                              options={eyeColorOptions}
                              onChange={(value) => updateTrait('eyeColor', value)}
                              placeholder={copy.choose}
                              autoLabel={copy.auto}
                              autoEnabled={state.sourceMode === 'reference-image' && AUTO_TRAIT_KEYS.has('eyeColor')}
                            />
                            <CompactSelectField
                              label={copy.sections.bodyBuild}
                              value={state.traits.bodyBuild.value}
                              options={bodyBuildOptions}
                              onChange={(value) => updateTrait('bodyBuild', value)}
                              placeholder={copy.choose}
                              autoLabel={copy.auto}
                              autoEnabled={state.sourceMode === 'reference-image' && AUTO_TRAIT_KEYS.has('bodyBuild')}
                            />
                            <CompactSelectField
                              label={copy.sections.consistency}
                              value={state.consistencyMode}
                              options={consistencyOptions}
                              onChange={(value) =>
                                setState((previous) => ({
                                  ...previous,
                                  consistencyMode: value as CharacterBuilderState['consistencyMode'],
                                }))
                              }
                              placeholder={copy.choose}
                              autoLabel={copy.auto}
                            />
                            {hasIdentityReference ? (
                              <CompactSelectField
                                label={copy.sections.referenceStrength}
                                value={state.referenceStrength}
                                options={referenceStrengthOptions}
                                onChange={(value) =>
                                  setState((previous) => ({
                                    ...previous,
                                    referenceStrength: value as CharacterBuilderState['referenceStrength'],
                                  }))
                                }
                                placeholder={copy.choose}
                                autoLabel={copy.auto}
                              />
                            ) : null}
                          </div>

                          <MultiToggleGroup
                            label={copy.sections.accessories}
                            items={accessoryOptions}
                            values={state.traits.accessories}
                            onToggle={(value) => toggleListValue('accessories', value)}
                          />
                          <MultiToggleGroup
                            label={copy.sections.distinctiveFeatures}
                            items={distinctiveOptions}
                            values={state.traits.distinctiveFeatures}
                            onToggle={(value) => toggleListValue('distinctiveFeatures', value)}
                          />

                          <div className="grid gap-3 md:grid-cols-2">
                            {[
                              ['fullBodyRequired', copy.outputOptions.fullBodyRequired],
                              ['includeCloseUps', copy.outputOptions.includeCloseUps],
                              ['neutralStudioBackground', copy.outputOptions.neutralStudioBackground],
                              ['preserveFacialDetails', copy.outputOptions.preserveFacialDetails],
                              ['avoid3dRenderLook', copy.outputOptions.avoid3dRenderLook],
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
                                    {active ? copy.on : copy.off}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          <div className="space-y-3">
                            <label className="block text-sm font-semibold text-text-primary">{copy.sections.advancedNotes}</label>
                            <Textarea
                              rows={3}
                              value={state.advancedNotes}
                              onChange={(event) =>
                                setState((previous) => ({
                                  ...previous,
                                  advancedNotes: event.target.value,
                                }))
                              }
                              placeholder={copy.sections.advancedNotesPlaceholder}
                            />
                          </div>

                          <div className="space-y-3">
                            <label className="block text-sm font-semibold text-text-primary">{copy.sections.mustRemainVisible}</label>
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
                                placeholder={copy.sections.mustRemainPlaceholder}
                              />
                              <Button onClick={addMustRemainTag}>{copy.add}</Button>
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
                      <SectionTitle title={copy.top.generate} />
                      <div className="grid gap-4 lg:grid-cols-2">
                        <OutputPreviewCard
                          selected={state.outputMode === 'portrait-reference'}
                          title={copy.generatePanel.portraitTitle}
                          subtitle={copy.generatePanel.portraitBody}
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
                          title={copy.generatePanel.sheetTitle}
                          subtitle={copy.generatePanel.sheetBody}
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
                          label={copy.generatePanel.quality}
                          options={qualityOptions}
                          value={state.qualityMode}
                          onChange={(value) =>
                            setState((previous) => ({
                              ...previous,
                              qualityMode: value as CharacterBuilderState['qualityMode'],
                            }))
                          }
                        />

                        <div className="rounded-[24px] border border-border bg-surface p-4 shadow-card">
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="space-y-1">
                              <p className="text-sm text-text-secondary">{copy.generatePanel.qualityBody}</p>
                              <p className="text-sm font-medium text-text-primary">
                                {copy.generatePanel.pricePerImage.replace('{price}', formatUsd(estimatedImageCostUsd))}
                              </p>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <Button
                                onClick={() => void handleRun('generate', 1)}
                                disabled={loadingAction !== null}
                                className="gap-2"
                              >
                                {loadingAction === 'generate-1' ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Sparkles className="h-4 w-4" />
                                )}
                                {copy.generatePanel.generateReference}
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => void handleRun('generate', 4)}
                                disabled={loadingAction !== null}
                                className="gap-2"
                              >
                                {loadingAction === 'generate-4' ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <WandSparkles className="h-4 w-4" />
                                )}
                                {copy.generatePanel.generateFour}
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
                    <SectionTitle eyebrow={copy.top.resultsEyebrow} title={copy.top.resultsTitle} />
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
                              triggerAppDownload(
                                result.url,
                                suggestDownloadFilename(result.url, `character-reference-${result.id.replace(/[^a-z0-9]+/gi, '-')}`)
                              )
                            }
                            onSave={() => void handleSaveResult(result)}
                            onDuplicateSettings={() => {
                              if (run?.settingsSnapshot) {
                                applySettingsSnapshot(run.settingsSnapshot, result.id);
                              }
                            }}
                            copy={copy}
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
                    genderOptions={genderOptions}
                    ageOptions={ageOptions}
                    realismOptions={realismOptions.map((option) => ({ id: option.id, label: option.label }))}
                    outputOptions={outputModeOptions.map((option) => ({ id: option.id, label: option.label }))}
                    qualityOptions={qualityOptions.map((option) => ({ id: option.id, label: option.label }))}
                    copy={copy}
                  />
                  {renderFollowUpPanels()}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur xl:hidden">
        <div className="mx-auto flex w-full max-w-[960px] flex-col gap-3 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary">
                {outputLabel ?? copy.generatePanel.portraitTitle} · {qualityLabel ?? copy.options.quality.draft.label}
              </p>
              <p className="text-xs text-text-secondary">
                {copy.generatePanel.pricePerImage.replace('{price}', formatUsd(estimatedImageCostUsd))}
              </p>
            </div>
            <div className="inline-flex rounded-full border border-border bg-bg p-1">
              {qualityOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() =>
                    setState((previous) => ({
                      ...previous,
                      qualityMode: option.id as CharacterBuilderState['qualityMode'],
                    }))
                  }
                  className={clsx(
                    'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                    state.qualityMode === option.id
                      ? 'bg-brand text-on-brand'
                      : 'text-text-secondary hover:text-text-primary'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => void handleRun('generate', 1)}
              disabled={loadingAction !== null}
              className="flex-1 gap-2"
            >
              {loadingAction === 'generate-1' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {copy.generatePanel.generateReference}
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleRun('generate', 4)}
              disabled={loadingAction !== null}
              className="gap-2 px-4"
            >
              {loadingAction === 'generate-4' ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
              4x
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
