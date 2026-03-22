'use client';

/* eslint-disable @next/next/no-img-element */

import deepmerge from 'deepmerge';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Download,
  Images,
  Loader2,
  Sparkles,
  Upload,
  WandSparkles,
} from 'lucide-react';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { MediaLightbox, type MediaLightboxEntry } from '@/components/MediaLightbox';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { authFetch } from '@/lib/authFetch';
import { prepareImageFileForUpload } from '@/lib/client-image-upload';
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
  getAvailableCharacterFormatOptions,
  getCharacterFormatMultiplier,
  normalizeCharacterFormatMode,
  normalizeTraitsForSourceMode,
  OUTFIT_STYLE_OPTIONS,
  REALISM_STYLE_OPTIONS,
  SKIN_TONE_OPTIONS,
} from '@/lib/character-builder';
import { runCharacterBuilderTool, saveImageToLibrary, useInfiniteJobs } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { FEATURES } from '@/content/feature-flags';
import type {
  CharacterBuilderAction,
  CharacterBuilderFormatMode,
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

type CharacterLibraryAsset = {
  id: string;
  url: string;
  mime?: string | null;
  width?: number | null;
  height?: number | null;
  size?: number | null;
  source?: string | null;
  createdAt?: string;
};

type CharacterLibraryAssetsResponse = {
  ok?: boolean;
  assets?: CharacterLibraryAsset[];
  error?: string;
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
  "custom": "Custom",
  "notSet": "Not set",
  "open": "Open",
  "choose": "Choose",
  "done": "Done",
  "close": "Close",
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
  "authGate": {
    "title": "Create an account to generate characters",
    "body": "Guests can browse the builder and inspect public examples, but generation, uploads, and Library actions require an account.",
    "primary": "Create account",
    "secondary": "Sign in",
    "close": "Close"
  },
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
  "library": {
    "open": "Library",
    "choose": "Choose from Library",
    "body": "Use an uploaded or saved image as a reference.",
    "error": "Failed to load library images",
    "empty": "No images available in your library yet.",
    "tabs": {
      "all": "All",
      "upload": "Uploads",
      "generated": "Generated",
      "character": "Character",
      "angle": "Angle"
    }
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
    "accessoriesFeatures": "Accessories & features",
    "realism": "Realism style",
    "moreControls": "Advanced controls",
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
    "customDetails": "Custom details prompt",
    "customDetailsPlaceholder": "Describe accessories, marks, features, or visible identity details",
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
      "portraitBody": "Face-forward portrait anchor",
    "sheetTitle": "Character sheet",
    "sheetBody": "Multi-angle full-body sheet",
    "quality": "Quality",
    "format": "Format",
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
    "format": "Format",
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
    "pending": "Rendering",
    "pendingBody": "This output will appear here as soon as it is ready.",
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
        "label": "Standard",
        "description": "Fast exploratory passes on Nano Banana 2."
      },
      "final": {
        "label": "Pro",
        "description": "Cleaner export-ready references on Nano Banana Pro."
      }
    },
    "format": {
      "standard": {
        "label": "1K",
        "description": "Base render size."
      },
      "2k": {
        "label": "2K",
        "description": "Sharper output. 2x price."
      },
      "4k": {
        "label": "4K",
        "description": "Final-grade output. 3x price."
      }
    }
  }
} as const;

type CharacterCopy = typeof DEFAULT_CHARACTER_COPY;
type LoadingRequestKey = 'generate-1' | 'generate-4' | 'full-body-fix' | 'lighting-variant';
type LoadingRequestCounts = Record<LoadingRequestKey, number>;
type PendingCharacterRun = {
  id: string;
  action: CharacterBuilderAction;
  outputMode: CharacterBuilderRun['outputMode'];
  qualityMode: CharacterBuilderRun['qualityMode'];
  formatMode: CharacterBuilderFormatMode;
  generateCount: 1 | 4;
};

type HistoricalCharacterGalleryItem = {
  id: string;
  jobId: string;
  imageUrl: string;
  thumbUrl: string;
  engineLabel: string;
  createdAt: string;
  prompt: string | null;
};

const INITIAL_LOADING_REQUEST_COUNTS: LoadingRequestCounts = {
  'generate-1': 0,
  'generate-4': 0,
  'full-body-fix': 0,
  'lighting-variant': 0,
};

const DEFAULT_UPLOAD_LIMIT_MB = Number.isFinite(Number(process.env.NEXT_PUBLIC_ASSET_MAX_IMAGE_MB ?? '25'))
  ? Number(process.env.NEXT_PUBLIC_ASSET_MAX_IMAGE_MB ?? '25')
  : 25;

function isAuthRequiredError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as { status?: number; code?: string };
  return record.status === 401 || record.code === 'auth_required' || record.code === 'UNAUTHORIZED';
}

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

function incrementLoadingRequestCount(
  counts: LoadingRequestCounts,
  key: LoadingRequestKey
): LoadingRequestCounts {
  return {
    ...counts,
    [key]: (counts[key] ?? 0) + 1,
  };
}

function decrementLoadingRequestCount(
  counts: LoadingRequestCounts,
  key: LoadingRequestKey
): LoadingRequestCounts {
  return {
    ...counts,
    [key]: Math.max(0, (counts[key] ?? 0) - 1),
  };
}

function getResultActionLabel(copy: CharacterCopy, action: CharacterBuilderAction): string {
  if (action === 'full-body-fix') return copy.resultCard.fullBodyFix;
  if (action === 'lighting-variant') return copy.resultCard.lightingVariant;
  return copy.resultCard.referenceOutput;
}

function getFormatDisplayLabel(
  copy: CharacterCopy,
  formatMode: CharacterBuilderFormatMode,
  qualityMode: CharacterBuilderState['qualityMode']
): string {
  if (formatMode === '4k') return copy.options.format['4k'].label;
  if (formatMode === '2k') return copy.options.format['2k'].label;
  return qualityMode === 'final' ? '2K' : '1K';
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
  const preparedFile = await prepareImageFileForUpload(file, {
    maxBytes: DEFAULT_UPLOAD_LIMIT_MB * 1024 * 1024,
  });

  const formData = new FormData();
  formData.set('file', preparedFile, preparedFile.name);

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
      traits: normalizeHairAndOutfitModes({
        ...base.traits,
        ...parsed.state.traits,
      }),
      formatMode: normalizeCharacterFormatMode(parsed.state.formatMode, parsed.state.qualityMode ?? base.qualityMode),
      outputOptions: {
        ...base.outputOptions,
        ...parsed.state.outputOptions,
        fullBodyRequired:
          (parsed.state.outputMode ?? base.outputMode) === 'character-sheet'
            ? (parsed.state.outputOptions?.fullBodyRequired ?? base.outputOptions.fullBodyRequired)
            : false,
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

function hasCustomHairSettings(traits: CharacterBuilderTraits): boolean {
  if (typeof traits.customHairDescription === 'string' && traits.customHairDescription.trim().length > 0) {
    return true;
  }
  return [traits.hairColor.value, traits.hairLength.value, traits.hairstyle.value].some(
    (value) => typeof value === 'string' && value !== 'auto'
  );
}

function hasCustomOutfitSettings(traits: CharacterBuilderTraits): boolean {
  if (typeof traits.customOutfitDescription === 'string' && traits.customOutfitDescription.trim().length > 0) {
    return true;
  }
  return typeof traits.outfitStyle.value === 'string' && traits.outfitStyle.value !== 'auto';
}

function normalizeHairAndOutfitModes(traits: CharacterBuilderTraits): CharacterBuilderTraits {
  return {
    ...traits,
    hairEnabled: traits.hairEnabled !== false && hasCustomHairSettings(traits),
    outfitEnabled: traits.outfitEnabled !== false && hasCustomOutfitSettings(traits),
  };
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
    traits: normalizeHairAndOutfitModes({
      ...base.traits,
      ...builder.traits,
    }),
    outputMode: builder.outputMode ?? base.outputMode,
    consistencyMode: builder.consistencyMode ?? base.consistencyMode,
    referenceStrength: builder.referenceStrength ?? base.referenceStrength,
    qualityMode: builder.qualityMode ?? base.qualityMode,
    formatMode: normalizeCharacterFormatMode(builder.formatMode, builder.qualityMode ?? base.qualityMode),
    outputOptions: {
      ...base.outputOptions,
      ...builder.outputOptions,
      fullBodyRequired:
        (builder.outputMode ?? base.outputMode) === 'character-sheet'
          ? (builder.outputOptions?.fullBodyRequired ?? base.outputOptions.fullBodyRequired)
          : false,
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
    return copy.auto;
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
    return copy.auto;
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
  if (state.traits.customDetailsDescription?.trim().length) count += 1;
  count += state.mustRemainVisible.length;
  if (state.consistencyMode !== 'balanced') count += 1;
  if (hasIdentityReference && state.referenceStrength && state.referenceStrength !== 'balanced') count += 1;
  if (state.advancedNotes.trim().length) count += 1;
  if (state.outputMode === 'character-sheet' && !state.outputOptions.includeCloseUps) count += 1;
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

const CHARACTER_SHEET_PREVIEW_URL =
  'https://v3b.fal.media/files/b/0a933bb7/R64-QF4-arWq1SzqnpC3r_DPAtirIT.png';
const PORTRAIT_REFERENCE_PREVIEW_URL =
  'https://v3b.fal.media/files/b/0a933bb6/ZPDNLhxRWTb-BWCYSw4b2_MV73KIfo.png';

function VisualChoiceCard({
  selected,
  onClick,
  title,
  subtitle,
  media,
  backgroundMedia,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
  media?: ReactNode;
  backgroundMedia?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'group isolate relative overflow-hidden rounded-[24px] border p-4 text-left transition',
        selected
          ? 'z-10 border-brand bg-brand/5 shadow-card'
          : 'border-border bg-surface hover:border-border-hover hover:bg-surface-hover hover:shadow-card',
        className
      )}
    >
      {backgroundMedia ? <div className="absolute inset-0">{backgroundMedia}</div> : null}
      {backgroundMedia ? (
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[rgba(0,0,0,0.82)] via-[rgba(0,0,0,0.42)] to-transparent" />
      ) : null}
      {selected ? (
        <span className="absolute right-3 top-3 z-20 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand text-on-brand shadow-[0_8px_18px_rgba(58,123,213,0.28)]">
          <Check className="h-3.5 w-3.5" />
        </span>
      ) : null}
      {media ? <div className="relative z-10 mb-4">{media}</div> : null}
      <div
        className={clsx(
          backgroundMedia
            ? 'absolute inset-x-0 bottom-0 z-10 space-y-1 px-6 py-4'
            : 'relative z-10 space-y-1'
        )}
      >
        <p className={clsx('text-sm font-semibold', backgroundMedia ? 'text-white' : 'text-text-primary')}>
          {title}
        </p>
        {subtitle ? (
          <p className={clsx('text-xs', backgroundMedia ? 'text-white' : 'text-text-secondary')}>
            {subtitle}
          </p>
        ) : null}
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
          className="flex h-14 items-center justify-between rounded-[18px] border border-border/80 bg-surface-2/80 px-3.5"
          style={{ background }}
        >
          <div
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold"
            style={{ backgroundColor: `${accent}1f`, color: accent }}
          >
            {glyph}
          </div>
          <div className="flex items-end gap-1">
            <span className="h-5 w-5 rounded-full bg-surface shadow-sm" />
            <span className="h-7 w-7 rounded-[14px] bg-surface/80 shadow-sm" />
          </div>
        </div>
      }
      className="min-h-[120px] w-full max-w-[172px]"
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
          className="relative h-[72px] overflow-hidden rounded-[18px] border border-border/80 bg-surface-2/80"
          style={{ background }}
        >
          <div
            className="absolute left-3 top-3 h-8 w-8 rounded-full"
            style={{ backgroundColor: `${accent}22` }}
          />
          <div
            className="absolute bottom-3 left-4 h-8 w-10 rounded-[16px]"
            style={{ backgroundColor: `${accent}cc` }}
          />
          <div className="absolute right-3 top-3 space-y-1">
            <div className="h-2 w-9 rounded-full bg-surface/85" />
            <div className="h-2 w-7 rounded-full bg-surface/65" />
          </div>
        </div>
      }
      className="min-h-[120px] w-full max-w-[172px]"
    />
  );
}

function OutputPreviewCard({
  selected,
  title,
  subtitle,
  mode,
  onClick,
  compact = false,
}: {
  selected: boolean;
  title: string;
  subtitle: string;
  mode: CharacterBuilderState['outputMode'];
  onClick: () => void;
  compact?: boolean;
}) {
  return (
      <VisualChoiceCard
        selected={selected}
        onClick={onClick}
        title={title}
        subtitle={subtitle}
        backgroundMedia={
          mode === 'character-sheet' ? (
            <img
              src={CHARACTER_SHEET_PREVIEW_URL}
              alt={title}
              className="h-full w-full object-cover object-top"
              loading="lazy"
            />
          ) : mode === 'portrait-reference' ? (
            <img
              src={PORTRAIT_REFERENCE_PREVIEW_URL}
              alt={title}
              className="h-full w-full object-cover object-center"
              loading="lazy"
            />
          ) : undefined
        }
        className={clsx(
          compact ? 'min-w-0' : undefined,
          mode === 'character-sheet' || mode === 'portrait-reference'
            ? compact
              ? 'flex h-[150px] flex-col justify-end bg-black/5'
              : 'flex h-[260px] flex-col justify-end bg-black/5 md:h-[320px]'
            : undefined
        )}
      />
    );
}

function CharacterSummaryCard({
  identityReference,
  hairSummary,
  outfitSummary,
  traits,
  outputMode,
  qualityMode,
  formatMode,
  genderOptions,
  ageOptions,
  realismOptions,
  outputOptions,
  qualityOptions,
  formatOptions,
  copy,
}: {
  identityReference: CharacterBuilderReferenceImage | null;
  hairSummary: string;
  outfitSummary: string;
  traits: CharacterBuilderTraits;
  outputMode: CharacterBuilderState['outputMode'];
  qualityMode: CharacterBuilderState['qualityMode'];
  formatMode: CharacterBuilderState['formatMode'];
  genderOptions: Array<{ id: string; label: string }>;
  ageOptions: Array<{ id: string; label: string }>;
  realismOptions: Array<{ id: string; label: string }>;
  outputOptions: Array<{ id: string; label: string }>;
  qualityOptions: Array<{ id: string; label: string }>;
  formatOptions: Array<{ id: string; label: string }>;
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
  const formatLabel = getFormatDisplayLabel(copy, formatMode, qualityMode);

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
          <div className="flex items-center justify-between gap-3 rounded-[18px] border border-border bg-surface-2/80 px-3 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.summary.format}</span>
            <span className="text-sm font-medium text-text-primary">{formatLabel ?? copy.options.format.standard.label}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function CharacterSnapshotDock({
  identityReference,
  hairSummary,
  outfitSummary,
  traits,
  outputMode,
  qualityMode,
  formatMode,
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
  formatMode: CharacterBuilderState['formatMode'];
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
  const realismLabel = findChoiceLabel(realismOptions, traits.realismStyle) ?? copy.summary.photoreal;
  const outputLabel = findChoiceLabel(outputOptions, outputMode) ?? copy.open;
  const qualityLabel = findChoiceLabel(qualityOptions, qualityMode) ?? copy.open;
  const formatLabel = getFormatDisplayLabel(copy, formatMode, qualityMode);

  const chips = [
    { label: copy.summary.identity, value: `${genderLabel} · ${ageLabel}` },
    {
      label: copy.summary.hair,
      value: hairSummary === copy.notSet ? copy.open : hairSummary,
      swatch: hairSwatch,
    },
    {
      label: copy.summary.outfit,
      value: outfitSummary === copy.notSet ? copy.open : outfitSummary,
    },
    { label: copy.summary.style, value: realismLabel },
    { label: copy.summary.output, value: outputLabel },
    { label: copy.summary.quality, value: qualityLabel },
    { label: copy.summary.format, value: formatLabel ?? copy.options.format.standard.label },
  ];

  return (
    <Card className="overflow-hidden border border-border bg-surface/95 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.18)] backdrop-blur">
      <div className="flex items-center gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {identityReference ? (
            <img
              src={identityReference.url}
              alt={copy.references.identityTitle}
              className="h-14 w-14 shrink-0 rounded-[18px] object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] border border-border bg-surface-2/80 text-[11px] font-semibold text-text-muted">
              {copy.summary.builderBadge}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{copy.summary.dna}</p>
            <p className="mt-1 truncate text-sm font-semibold text-text-primary">{copy.summary.snapshot}</p>
          </div>
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="flex min-w-max items-center gap-2">
            {chips.map((chip) => (
              <div
                key={chip.label}
                className="flex items-center gap-2 rounded-full border border-border bg-surface-2/80 px-3 py-2"
              >
                <span className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">{chip.label}</span>
                <span className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
                  {'swatch' in chip && chip.swatch ? (
                    <span
                      className="h-3 w-3 rounded-full border border-black/10"
                      style={{ backgroundColor: chip.swatch }}
                    />
                  ) : null}
                  {chip.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function CharacterActionDock({
  outputLabel,
  qualityLabel,
  formatLabel,
  estimatedImageCostUsd,
  qualityOptions,
  selectedQuality,
  onQualityChange,
  onGenerateOne,
  onGenerateFour,
  loadingGenerateOne,
  loadingGenerateFour,
  copy,
  compact = false,
}: {
  outputLabel: string;
  qualityLabel: string;
  formatLabel: string;
  estimatedImageCostUsd: number | null;
  qualityOptions: Array<{ id: string; label: string }>;
  selectedQuality: CharacterBuilderState['qualityMode'];
  onQualityChange: (value: CharacterBuilderState['qualityMode']) => void;
  onGenerateOne: () => void;
  onGenerateFour: () => void;
  loadingGenerateOne: boolean;
  loadingGenerateFour: boolean;
  copy: CharacterCopy;
  compact?: boolean;
}) {
  return (
    <Card
      className={clsx(
        'border border-border bg-surface/95 shadow-[0_18px_48px_rgba(15,23,42,0.18)] backdrop-blur',
        compact ? 'p-4' : 'p-4'
      )}
    >
      <div className={clsx('flex gap-3', compact ? 'flex-col' : 'flex-col xl:flex-row xl:items-center xl:justify-between')}>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text-primary">
            {outputLabel} · {qualityLabel} · {formatLabel}
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            {copy.generatePanel.pricePerImage.replace('{price}', formatUsd(estimatedImageCostUsd))}
          </p>
        </div>
        <div className="inline-flex rounded-full border border-border bg-bg p-1">
          {qualityOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onQualityChange(option.id as CharacterBuilderState['qualityMode'])}
              className={clsx(
                'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                selectedQuality === option.id
                  ? 'bg-brand text-on-brand'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button onClick={onGenerateOne} className="flex-1 gap-2">
          {loadingGenerateOne ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {copy.generatePanel.generateReference}
        </Button>
        <Button variant="outline" onClick={onGenerateFour} className="gap-2 px-4">
          {loadingGenerateFour ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
          4x
        </Button>
      </div>
    </Card>
  );
}

function CharacterBuilderStickyDock({
  hairSummary,
  outfitSummary,
  traits,
  outputMode,
  qualityMode,
  formatMode,
  genderOptions,
  ageOptions,
  realismOptions,
  outputOptions,
  qualityOptions,
  formatOptions,
  estimatedImageCostUsd,
  onQualityChange,
  onFormatChange,
  onGenerateOne,
  onGenerateFour,
  loadingGenerateOne,
  loadingGenerateFour,
  copy,
  compact = false,
}: {
  identityReference: CharacterBuilderReferenceImage | null;
  hairSummary: string;
  outfitSummary: string;
  traits: CharacterBuilderTraits;
  outputMode: CharacterBuilderState['outputMode'];
  qualityMode: CharacterBuilderState['qualityMode'];
  formatMode: CharacterBuilderState['formatMode'];
  genderOptions: Array<{ id: string; label: string }>;
  ageOptions: Array<{ id: string; label: string }>;
  realismOptions: Array<{ id: string; label: string }>;
  outputOptions: Array<{ id: string; label: string }>;
  qualityOptions: Array<{ id: string; label: string }>;
  formatOptions: Array<{ id: string; label: string }>;
  estimatedImageCostUsd: number | null;
  onQualityChange: (value: CharacterBuilderState['qualityMode']) => void;
  onFormatChange: (value: CharacterBuilderState['formatMode']) => void;
  onGenerateOne: () => void;
  onGenerateFour: () => void;
  loadingGenerateOne: boolean;
  loadingGenerateFour: boolean;
  copy: CharacterCopy;
  compact?: boolean;
}) {
  const hairSwatch =
    traits.hairEnabled === false || Boolean(traits.customHairDescription?.trim())
      ? null
      : findChoiceSwatch(HAIR_COLOR_OPTIONS, traits.hairColor.value);
  const genderLabel = findChoiceLabel(genderOptions, traits.genderPresentation.value) ?? copy.open;
  const ageLabel = findChoiceLabel(ageOptions, traits.ageRange.value) ?? copy.open;
  const realismLabel = findChoiceLabel(realismOptions, traits.realismStyle) ?? copy.summary.photoreal;
  const chips = [
    { label: copy.summary.identity, value: `${genderLabel} · ${ageLabel}` },
    { label: copy.summary.hair, value: hairSummary === copy.notSet ? copy.open : hairSummary, swatch: hairSwatch },
    { label: copy.summary.outfit, value: outfitSummary === copy.notSet ? copy.open : outfitSummary },
    { label: copy.summary.style, value: realismLabel },
  ];

  const renderInlineSegment = (
    label: string,
    options: Array<{ id: string; label: string }>,
    value: string,
    onChange: (value: string) => void
  ) => (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{label}</p>
      <div className="inline-flex flex-wrap rounded-full border border-border/80 bg-bg/55 p-1">
        {options.map((option) => {
          const active = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={clsx(
                'rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-micro transition',
                active
                  ? 'bg-brand text-on-brand shadow-[0_10px_24px_rgba(58,123,213,0.18)]'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={clsx(compact ? 'space-y-3' : 'space-y-4')}>
      <div className="rounded-[22px] border border-border/80 bg-bg/45 p-2.5 sm:p-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {chips.map((chip, index) => (
            <div
              key={chip.label}
              className={clsx(
                'min-w-0 rounded-[18px] px-3 py-2',
                index > 0 && 'xl:border-l xl:border-border/70'
              )}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">{chip.label}</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-text-primary">
                {'swatch' in chip && chip.swatch ? (
                  <span className="h-2.5 w-2.5 rounded-full border border-black/10" style={{ backgroundColor: chip.swatch }} />
                ) : null}
                <span className="truncate">{chip.value}</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      <div
        className={clsx(
          compact
            ? 'space-y-3'
            : 'flex items-end justify-between gap-6'
        )}
      >
        <div className={clsx(compact ? 'space-y-3' : 'flex flex-wrap items-end gap-6')}>
          {renderInlineSegment(
            copy.generatePanel.quality,
            qualityOptions,
            qualityMode,
            (value) => onQualityChange(value as CharacterBuilderState['qualityMode'])
          )}
          {renderInlineSegment(
            copy.generatePanel.format,
            formatOptions,
            formatMode,
            (value) => onFormatChange(value as CharacterBuilderState['formatMode'])
          )}
        </div>

        <div
          className={clsx(
            compact
              ? 'space-y-3'
              : 'ml-auto flex shrink-0 items-center gap-4'
          )}
        >
          <div className={clsx(compact ? 'flex items-baseline justify-between' : 'text-right')}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
              {copy.generatePanel.pricePerImage.replace('{price}', '').trim()}
            </p>
            <p className={clsx('font-semibold text-text-primary', compact ? 'text-lg' : 'mt-1 text-xl')}>
              {formatUsd(estimatedImageCostUsd)}
            </p>
          </div>
          <div className={clsx('flex items-center gap-2', compact ? 'justify-stretch' : '')}>
            <Button onClick={onGenerateOne} className={clsx('gap-2', compact ? 'flex-1' : 'min-w-[220px] px-5')}>
              {loadingGenerateOne ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {copy.generatePanel.generateReference}
            </Button>
            <Button
              variant="outline"
              onClick={onGenerateFour}
              className={clsx('gap-2', compact ? 'px-3' : 'min-w-[76px] px-4')}
            >
              {loadingGenerateFour ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
              4x
            </Button>
          </div>
        </div>
      </div>
    </div>
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
  headerAction,
  children,
}: {
  title: string;
  summary?: string | null;
  open: boolean;
  onToggle: () => void;
  headerAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-border bg-surface shadow-card">
      <div className="flex items-center gap-3 px-4 py-4 sm:px-5">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center justify-between gap-4 text-left"
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
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </div>
      {open ? <div className="border-t border-border px-4 py-4 sm:px-5">{children}</div> : null}
    </section>
  );
}

type BuildLookSectionKey = 'identity' | 'hair' | 'outfit' | 'details' | 'style';

function BuildLookCarouselCard({
  title,
  summary,
  active,
  accessory,
  onClick,
}: {
  title: string;
  summary: string;
  active: boolean;
  accessory?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex min-h-[82px] w-[220px] flex-col justify-between border-r border-border px-4 py-3 text-left transition last:border-r-0 md:min-w-0 md:flex-1',
        active
          ? 'bg-brand/[0.08]'
          : 'bg-surface hover:bg-surface-hover'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-text-primary">{title}</p>
        {accessory ? <div className="shrink-0" onClick={(event) => event.stopPropagation()}>{accessory}</div> : null}
      </div>
      <p className="mt-2 line-clamp-2 text-xs text-text-secondary">{summary}</p>
    </button>
  );
}

function ReferenceSlot({
  title,
  subtitle,
  image,
  onUpload,
  onOpenLibrary,
  onRemove,
  disabled = false,
  removeLabel,
  libraryLabel,
  optionalLabel,
}: {
  title: string;
  subtitle: string;
  image: CharacterBuilderReferenceImage | null;
  onUpload: () => void;
  onOpenLibrary: () => void;
  onRemove: () => void;
  disabled?: boolean;
  removeLabel: string;
  libraryLabel: string;
  optionalLabel?: string;
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
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onUpload}>
              <Upload className="h-4 w-4" />
              {title}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onOpenLibrary}>
              <Images className="h-4 w-4" />
              {libraryLabel}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
              {removeLabel}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex min-h-[180px] w-full flex-col items-center justify-center gap-3 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
            <Upload className="h-5 w-5" />
          </span>
          <div>
            <div className="flex items-center justify-center gap-2">
              <p className="text-sm font-semibold text-text-primary">{title}</p>
              {optionalLabel ? (
                <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-micro text-text-secondary">
                  {optionalLabel}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-text-secondary">{subtitle}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" size="sm" onClick={onUpload} disabled={disabled}>
              <Upload className="h-4 w-4" />
              {title}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onOpenLibrary} disabled={disabled}>
              <Images className="h-4 w-4" />
              {libraryLabel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function isImageLibraryAsset(asset: CharacterLibraryAsset): boolean {
  if (typeof asset.mime === 'string' && asset.mime.toLowerCase().startsWith('image/')) return true;
  return /\.(png|jpe?g|webp|gif|avif)(?:[?#].*)?$/i.test(asset.url);
}

function CharacterReferenceLibraryModal({
  open,
  onClose,
  onSelect,
  copy,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (asset: CharacterLibraryAsset) => void;
  copy: CharacterCopy;
}) {
  const [activeSource, setActiveSource] = useState<'all' | 'upload' | 'generated' | 'character' | 'angle'>('all');
  const swrKey = open
    ? activeSource === 'all'
      ? '/api/user-assets?limit=60'
      : `/api/user-assets?limit=60&source=${encodeURIComponent(activeSource)}`
    : null;
  const { data, error, isLoading } = useSWR<CharacterLibraryAssetsResponse>(swrKey, async (url: string) => {
    const response = await authFetch(url);
    const payload = (await response.json().catch(() => null)) as CharacterLibraryAssetsResponse | null;
    if (!response.ok || !payload?.ok) {
      throw new Error(copy.library.error);
    }
    return payload ?? { ok: true, assets: [] };
  });

  const assets = (data?.assets ?? []).filter(isImageLibraryAsset);

  if (!open) return null;

  const handleBackdropClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-surface-on-media-dark-60 px-3 py-6 sm:px-6"
      role="dialog"
      aria-modal="true"
      onMouseDown={handleBackdropClick}
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-modal border border-border bg-surface shadow-float">
        <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{copy.library.choose}</h2>
            <p className="text-xs text-text-secondary">{copy.library.body}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="self-start rounded-full border-border px-3 text-sm font-medium text-text-secondary hover:bg-bg sm:self-auto"
          >
            {copy.close}
          </Button>
        </div>
        <div className="border-b border-border px-4 py-3 sm:px-6">
          <div
            role="tablist"
            aria-label={copy.library.open}
            className="flex w-full overflow-hidden rounded-full border border-border bg-surface-glass-70 text-xs font-semibold text-text-secondary"
          >
            {([
              ['all', copy.library.tabs.all],
              ['upload', copy.library.tabs.upload],
              ['generated', copy.library.tabs.generated],
              ['character', copy.library.tabs.character],
              ['angle', copy.library.tabs.angle],
            ] as const).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                role="tab"
                variant="ghost"
                size="sm"
                aria-selected={activeSource === value}
                onClick={() => setActiveSource(value)}
                className={clsx(
                  'flex-1 rounded-none px-4 py-2',
                  activeSource === value ? 'bg-brand text-on-brand hover:bg-brand' : 'text-text-secondary hover:bg-surface'
                )}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-4 py-4 sm:px-6">
          {error ? (
            <div className="rounded-card border border-state-warning/40 bg-state-warning/10 px-4 py-6 text-sm text-state-warning">
              {error instanceof Error ? error.message : copy.library.error}
            </div>
          ) : isLoading && !assets.length ? (
            <div className="grid grid-gap-sm sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={`character-library-skeleton-${index}`} className="rounded-card border border-border bg-surface-glass-60 p-0" aria-hidden>
                  <div className="relative aspect-square overflow-hidden rounded-t-card bg-placeholder">
                    <div className="skeleton absolute inset-0" />
                  </div>
                  <div className="border-t border-border px-4 py-3">
                    <div className="h-3 w-24 rounded-full bg-skeleton" />
                  </div>
                </div>
              ))}
            </div>
          ) : assets.length === 0 ? (
            <div className="rounded-card border border-dashed border-border px-4 py-6 text-center text-sm text-text-secondary">
              {copy.library.empty}
            </div>
          ) : (
            <div className="grid grid-gap-sm sm:grid-cols-2 lg:grid-cols-3">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => onSelect(asset)}
                  className="overflow-hidden rounded-card border border-border bg-surface text-left transition hover:border-border-hover hover:shadow-card"
                >
                  <div className="relative aspect-square overflow-hidden bg-bg/50">
                    <img src={asset.url} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="border-t border-border px-4 py-3">
                    <p className="truncate text-xs font-medium text-text-primary">
                      {asset.source ?? copy.library.tabs.all}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultCard({
  result,
  selected,
  title,
  subtitle,
  badge,
  onOpen,
  onSelect,
  onDownload,
  onSave,
  onDuplicateSettings,
  saving,
  copy,
}: {
  result: CharacterBuilderResult;
  selected: boolean;
  title: string;
  subtitle: string;
  badge?: string | null;
  onOpen: () => void;
  onSelect: () => void;
  onDownload: () => void;
  onSave: () => void;
  onDuplicateSettings: () => void;
  saving: boolean;
  copy: CharacterCopy;
}) {
  return (
    <Card
      className={clsx(
        'overflow-hidden border bg-surface p-0 transition',
        selected ? 'border-brand shadow-[0_0_0_1px_rgba(11,107,255,0.2)]' : 'border-border'
      )}
    >
      <div className="relative">
        <button type="button" onClick={onOpen} className="block w-full text-left">
          <img src={result.thumbUrl ?? result.url} alt={copy.resultCard.generatedAlt} className="h-44 w-full object-cover" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-micro text-white/70">{subtitle}</p>
            <p className="mt-1 text-sm font-semibold text-white">{title}</p>
          </div>
        </button>
        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          {selected ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-slate-900 shadow-sm">
              <Check className="h-3.5 w-3.5" />
              {copy.resultCard.selected}
            </span>
          ) : <span />}
          {badge ? (
            <span className="inline-flex items-center rounded-full bg-brand/90 px-2 py-1 text-[11px] font-semibold text-on-brand shadow-sm">
              {badge}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 p-3">
        <Button variant={selected ? 'primary' : 'outline'} size="sm" onClick={onSelect} className="min-w-[92px]">
          {selected ? copy.resultCard.selected : copy.resultCard.select}
        </Button>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDuplicateSettings}
            className="h-9 w-9 px-0"
            aria-label={copy.resultCard.duplicate}
            title={copy.resultCard.duplicate}
          >
            <WandSparkles className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onSave}
            disabled={saving}
            className="h-9 w-9 px-0"
            aria-label={copy.resultCard.save}
            title={copy.resultCard.save}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDownload}
            className="h-9 w-9 px-0"
            aria-label={copy.resultCard.download}
            title={copy.resultCard.download}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function PendingResultCard({
  title,
  subtitle,
  badge,
  copy,
}: {
  title: string;
  subtitle: string;
  badge?: string | null;
  copy: CharacterCopy;
}) {
  return (
    <Card className="overflow-hidden border border-border bg-surface/90 p-0">
      <div className="relative h-44 overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(11,107,255,0.14),_transparent_60%),linear-gradient(180deg,rgba(148,163,184,0.08),transparent)]">
        <div className="absolute inset-0 animate-pulse bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_40%,rgba(11,107,255,0.08)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/70 via-slate-900/20 to-transparent px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-micro text-white/70">{subtitle}</p>
          <p className="mt-1 text-sm font-semibold text-white">{title}</p>
        </div>
        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-slate-900 shadow-sm">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {copy.resultCard.pending}
          </span>
          {badge ? (
            <span className="inline-flex items-center rounded-full bg-brand/90 px-2 py-1 text-[11px] font-semibold text-on-brand shadow-sm">
              {badge}
            </span>
          ) : null}
        </div>
      </div>
      <div className="p-3">
        <p className="text-xs text-text-secondary">{copy.resultCard.pendingBody}</p>
      </div>
    </Card>
  );
}

function EmptyResultsRail({ copy }: { copy: CharacterCopy }) {
  return (
    <Card className="border border-dashed border-border bg-bg/40 p-5">
      <p className="text-sm font-semibold text-text-primary">{copy.top.resultsTitle}</p>
      <p className="mt-2 text-sm text-text-secondary">{copy.resultCard.pendingBody}</p>
    </Card>
  );
}

export default function CharacterBuilderPage() {
  const { loading: authLoading, user } = useRequireAuth({ redirectIfLoggedOut: false });
  const { t } = useI18n();
  const rawCopy = t('workspace.characterBuilder', DEFAULT_CHARACTER_COPY);
  const copy = useMemo<CharacterCopy>(() => {
    return deepmerge(DEFAULT_CHARACTER_COPY, (rawCopy ?? {}) as Partial<CharacterCopy>);
  }, [rawCopy]);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<CharacterBuilderState>(() => createDefaultCharacterBuilderState());
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [hairOpen, setHairOpen] = useState(false);
  const [activeBuildSection, setActiveBuildSection] = useState<BuildLookSectionKey>('identity');
  const [libraryModalRole, setLibraryModalRole] = useState<CharacterBuilderReferenceImage['role'] | null>(null);
  const [showStyleReferenceSlot, setShowStyleReferenceSlot] = useState(false);
  const [mustRemainDraft, setMustRemainDraft] = useState('');
  const [loadingActions, setLoadingActions] = useState<LoadingRequestCounts>(INITIAL_LOADING_REQUEST_COUNTS);
  const [pendingRuns, setPendingRuns] = useState<PendingCharacterRun[]>([]);
  const [savingResultId, setSavingResultId] = useState<string | null>(null);
  const [lightboxEntry, setLightboxEntry] = useState<MediaLightboxEntry | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const identityFileRef = useRef<HTMLInputElement | null>(null);
  const styleFileRef = useRef<HTMLInputElement | null>(null);
  const resultsScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const resultsSentinelRef = useRef<HTMLDivElement | null>(null);
  const visitorSanitizedRef = useRef(false);
  const loginRedirectTarget = useMemo(() => {
    const base = pathname || '/app/tools/character-builder';
    const search = searchParams?.toString();
    return search ? `${base}?${search}` : base;
  }, [pathname, searchParams]);
  const openAuthGate = useCallback(() => {
    setAuthModalOpen(true);
  }, []);

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
  const formatOptions = useMemo(
    () =>
      getAvailableCharacterFormatOptions(state.qualityMode).map((option) => ({
        ...option,
        label: getFormatDisplayLabel(copy, option.id, state.qualityMode),
        description: copy.options.format[option.id].description,
      })),
    [copy, state.qualityMode]
  );
  const {
    data: historicalJobPages,
    stableJobs: historicalJobs,
    setSize: setHistoricalSize,
    isLoading: historicalJobsLoading,
    isValidating: historicalJobsValidating,
  } = useInfiniteJobs(18, { surface: 'character' });

  const flattenedResults = getFlattenedResults(state.runs);
  const outputModeLabelOptions = useMemo(
    () => outputModeOptions.map((option) => ({ id: option.id, label: option.label })),
    [outputModeOptions]
  );
  const qualityLabelOptions = useMemo(
    () => qualityOptions.map((option) => ({ id: option.id, label: option.label })),
    [qualityOptions]
  );
  const formatLabelOptions = useMemo(
    () => formatOptions.map((option) => ({ id: option.id, label: option.label })),
    [formatOptions]
  );
  const localResultUrls = useMemo(
    () => new Set(flattenedResults.map((result) => result.url).filter((value): value is string => Boolean(value))),
    [flattenedResults]
  );
  const historicalResults = useMemo<HistoricalCharacterGalleryItem[]>(() => {
    return historicalJobs.flatMap<HistoricalCharacterGalleryItem>((job) => {
      const renderIds = Array.isArray(job.renderIds) ? job.renderIds.filter((value): value is string => typeof value === 'string' && value.length > 0) : [];
      if (!renderIds.length) return [];
      const renderThumbUrls = Array.isArray(job.renderThumbUrls)
        ? job.renderThumbUrls.filter((value): value is string => typeof value === 'string' && value.length > 0)
        : [];

      return renderIds.reduce<HistoricalCharacterGalleryItem[]>((acc, imageUrl, index) => {
        if (localResultUrls.has(imageUrl)) return acc;
        acc.push({
          id: `${job.jobId}:historical:${index + 1}`,
          jobId: job.jobId,
          imageUrl,
          thumbUrl: renderThumbUrls[index] ?? imageUrl,
          engineLabel: job.engineLabel,
          createdAt: job.createdAt,
          prompt: job.prompt ?? null,
        });
        return acc;
      }, []);
    });
  }, [historicalJobs, localResultUrls]);
  const identityReference = getRefByRole(state.referenceImages, 'identity');
  const styleReference = getRefByRole(state.referenceImages, 'style');
  const hasIdentityReference = Boolean(identityReference);
  const hasCompletedResults = flattenedResults.length > 0;
  const hasResults = hasCompletedResults || pendingRuns.length > 0 || historicalResults.length > 0;
  const secondaryControlsCount = countConfiguredSecondaryControls(state, hasIdentityReference);
  const hairMode = state.traits.hairEnabled ? 'custom' : 'auto';
  const outfitMode = state.traits.outfitEnabled ? 'custom' : 'auto';
  const hairSummary = getHairSummary(state.traits, { hairColor: hairColorOptions, hairLength: hairLengthOptions, hairstyle: hairstyleOptions }, copy);
  const outfitSummary = getOutfitSummary(state.traits, outfitOptions, copy);
  const accessoriesFeaturesSummary = [
    ...accessoryOptions.filter((option) => state.traits.accessories.includes(option.id)).map((option) => option.label),
    ...distinctiveOptions
      .filter((option) => state.traits.distinctiveFeatures.includes(option.id))
      .map((option) => option.label),
    summarizeCustomText(state.traits.customDetailsDescription),
  ]
    .filter(Boolean)
    .join(' · ');
  const identitySummary = `${findChoiceLabel(genderOptions, state.traits.genderPresentation.value) ?? copy.open} · ${findChoiceLabel(ageOptions, state.traits.ageRange.value) ?? copy.open}`;
  const realismSummary = findChoiceLabel(realismOptions, state.traits.realismStyle) ?? copy.summary.photoreal;
  const jobIdFromQuery = searchParams?.get('job')?.trim() ?? null;
  const billingProductKey = getCharacterBillingProductKey(state.qualityMode);
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
    billingProductData?.unitPriceCents != null
      ? Number(((billingProductData.unitPriceCents * getCharacterFormatMultiplier(state.formatMode, state.qualityMode)) / 100).toFixed(2))
      : null;
  const isActionLoading = (key: LoadingRequestKey): boolean => (loadingActions[key] ?? 0) > 0;
  const historicalLastPage = historicalJobPages?.[historicalJobPages.length - 1];
  const historicalHasMore = Boolean(historicalLastPage?.nextCursor);
  const historicalIsFetchingMore = historicalJobsValidating && Boolean(historicalJobPages?.length);
  const loadMoreHistoricalResults = useCallback(() => {
    if (!historicalHasMore || historicalJobsLoading || historicalIsFetchingMore) return;
    void setHistoricalSize((current) => current + 1);
  }, [historicalHasMore, historicalIsFetchingMore, historicalJobsLoading, setHistoricalSize]);

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
    if (authLoading || !hydrated) return;
    if (user) {
      visitorSanitizedRef.current = false;
      return;
    }
    if (visitorSanitizedRef.current) return;
    visitorSanitizedRef.current = true;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(CHARACTER_BUILDER_STORAGE_KEY);
      } catch {
        // ignore storage failures
      }
    }
    setState(createDefaultCharacterBuilderState());
    setAdvancedOpen(false);
    setHairOpen(false);
    setShowStyleReferenceSlot(false);
    setMustRemainDraft('');
    setLoadingActions(INITIAL_LOADING_REQUEST_COUNTS);
    setPendingRuns([]);
    setSavingResultId(null);
    setLightboxEntry(null);
    setError(null);
    setStatusMessage(null);
  }, [authLoading, hydrated, user]);

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

  useEffect(() => {
    const sentinel = resultsSentinelRef.current;
    if (!sentinel || !historicalHasMore) return;

    let previousY = 0;
    let previousRatio = 0;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (
            entry.isIntersecting &&
            (entry.boundingClientRect.y > previousY || entry.intersectionRatio > previousRatio)
          ) {
            loadMoreHistoricalResults();
          }
          previousY = entry.boundingClientRect.y;
          previousRatio = entry.intersectionRatio;
        });
      },
      {
        root: resultsScrollContainerRef.current,
        threshold: 0.2,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [historicalHasMore, historicalResults.length, loadMoreHistoricalResults]);

  useEffect(() => {
    const scrollContainer = resultsScrollContainerRef.current;
    if (!scrollContainer || !historicalHasMore) return undefined;

    const maybeLoadMore = () => {
      const remainingScroll = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight;
      if (remainingScroll <= 320) {
        loadMoreHistoricalResults();
      }
    };

    maybeLoadMore();
    scrollContainer.addEventListener('scroll', maybeLoadMore, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', maybeLoadMore);
  }, [historicalHasMore, historicalResults.length, loadMoreHistoricalResults]);

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

  function setHairMode(mode: 'auto' | 'custom') {
    const enabled = mode === 'custom';
    setState((previous) => ({
      ...previous,
      traits: {
        ...previous.traits,
        hairEnabled: enabled,
      },
    }));
    if (enabled) {
      setActiveBuildSection('hair');
      return;
    }
    if (!enabled) {
      setHairOpen(false);
    }
  }

  function setOutfitMode(mode: 'auto' | 'custom') {
    const enabled = mode === 'custom';
    setState((previous) => ({
      ...previous,
      traits: {
        ...previous.traits,
        outfitEnabled: enabled,
      },
    }));
    if (enabled) {
      setActiveBuildSection('outfit');
      return;
    }
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

  async function handleUpload(role: CharacterBuilderReferenceImage['role'], file: File) {
    if (!user) {
      openAuthGate();
      return;
    }
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
      if (isAuthRequiredError(uploadError)) {
        openAuthGate();
        return;
      }
      setError(uploadError instanceof Error ? uploadError.message : copy.uploadFailed);
      setStatusMessage(null);
    }
  }

  async function triggerUpload(role: CharacterBuilderReferenceImage['role'], fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    await handleUpload(role, file);
  }

  function handleLibrarySelect(asset: CharacterLibraryAsset) {
    if (!user) {
      openAuthGate();
      return;
    }
    const role = libraryModalRole;
    if (!role) return;

    const nextImage: CharacterBuilderReferenceImage = {
      id: asset.id,
      url: asset.url,
      role,
      width: asset.width ?? null,
      height: asset.height ?? null,
      name: null,
    };

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
    setLibraryModalRole(null);
    setStatusMessage(role === 'identity' ? copy.uploadIdentityDone : copy.uploadStyleDone);
    setError(null);
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
      formatMode: normalizeCharacterFormatMode(snapshot.builder.formatMode, snapshot.builder.qualityMode),
      outputOptions: snapshot.builder.outputOptions,
      advancedNotes: snapshot.builder.advancedNotes,
      mustRemainVisible: snapshot.builder.mustRemainVisible,
      selectedResultId: selectedId ?? previous.selectedResultId,
    }));
    setAdvancedOpen(Boolean(snapshot.builder.advancedNotes));
    setStatusMessage(copy.duplicateDone);
  }

  async function handleRun(action: CharacterBuilderAction, generateCount?: 1 | 4) {
    if (!user) {
      openAuthGate();
      return;
    }
    setError(null);
    setStatusMessage(null);
    const loadingKey = getLoadingRequestKey(action, generateCount);
    const pendingRunId = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const requestTraits = normalizeHairAndOutfitModes(state.traits);
    const pendingRun: PendingCharacterRun = {
      id: pendingRunId,
      action,
      outputMode: state.outputMode,
      qualityMode: state.qualityMode,
      formatMode: state.formatMode,
      generateCount: generateCount ?? 1,
    };

    setLoadingActions((previous) => incrementLoadingRequestCount(previous, loadingKey));
    setPendingRuns((previous) => [pendingRun, ...previous].slice(0, 12));

    try {
      const response = await runCharacterBuilderTool({
        action,
        sourceMode: state.sourceMode,
        outputMode: state.outputMode,
        consistencyMode: state.consistencyMode,
        referenceStrength: hasIdentityReference ? state.referenceStrength : null,
        qualityMode: state.qualityMode,
        formatMode: state.formatMode,
        referenceImages: state.referenceImages,
        traits: requestTraits,
        outputOptions: state.outputOptions,
        advancedNotes: state.advancedNotes,
        mustRemainVisible: state.mustRemainVisible,
        generateCount: generateCount ?? 1,
        selectedResultId: null,
        selectedResultUrl: null,
        pinnedReferenceResultId: null,
        pinnedReferenceResultUrl: null,
        lineage: {
          parentResultId: null,
          parentRunId: null,
          pinnedReferenceResultId: null,
        },
      });

      if (!response.run) {
        throw new Error(copy.missingRun);
      }

      setPendingRuns((previous) => previous.filter((entry) => entry.id !== pendingRunId));
      setState((previous) => {
        const nextRuns = [response.run!, ...previous.runs].slice(0, 12);
        const firstResultId = response.run!.results[0]?.id ?? null;

        return {
          ...previous,
          runs: nextRuns,
          selectedResultId: firstResultId,
          pinnedReferenceResultId: null,
          refinementHistory: previous.refinementHistory,
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
      setPendingRuns((previous) => previous.filter((entry) => entry.id !== pendingRunId));
      if (isAuthRequiredError(runError)) {
        openAuthGate();
        return;
      }
      setError(runError instanceof Error ? runError.message : copy.runFailed);
    } finally {
      setLoadingActions((previous) => decrementLoadingRequestCount(previous, loadingKey));
    }
  }

  async function handleSaveResult(result: CharacterBuilderResult) {
    if (!user) {
      openAuthGate();
      return;
    }
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
      if (isAuthRequiredError(saveError)) {
        openAuthGate();
        return;
      }
      setError(saveError instanceof Error ? saveError.message : copy.saveToLibraryFailed);
    } finally {
      setSavingResultId(null);
    }
  }

  async function handleSaveHistoricalResult(item: HistoricalCharacterGalleryItem) {
    if (!user) {
      openAuthGate();
      return;
    }
    setSavingResultId(item.id);
    setError(null);
    setStatusMessage(null);
    try {
      await saveImageToLibrary({
        url: item.imageUrl,
        jobId: item.jobId,
        label: copy.generatePanel.portraitTitle,
        source: 'character',
      });
      setStatusMessage(copy.savedToLibrary);
    } catch (saveError) {
      if (isAuthRequiredError(saveError)) {
        openAuthGate();
        return;
      }
      setError(saveError instanceof Error ? saveError.message : copy.saveToLibraryFailed);
    } finally {
      setSavingResultId(null);
    }
  }

  async function handleDuplicateHistoricalSettings(item: HistoricalCharacterGalleryItem) {
    if (!user) {
      openAuthGate();
      return;
    }
    setError(null);
    setStatusMessage(null);
    try {
      const response = await authFetch(`/api/jobs/${encodeURIComponent(item.jobId)}`);
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; settingsSnapshot?: unknown; error?: string }
        | null;
      if (!response.ok || !payload?.ok || !payload.settingsSnapshot) {
        throw new Error(payload?.error ?? copy.runFailed);
      }
      const snapshotState = parseCharacterBuilderSnapshot(payload.settingsSnapshot);
      if (!snapshotState) {
        throw new Error(copy.missingRun);
      }
      setState((previous) => ({
        ...previous,
        ...snapshotState,
        selectedResultId: item.id,
      }));
      setAdvancedOpen(Boolean(snapshotState.advancedNotes));
      setShowStyleReferenceSlot(Boolean(snapshotState.referenceImages?.some((image) => image.role === 'style')));
      setStatusMessage(copy.duplicateDone);
    } catch (duplicateError) {
      if (isAuthRequiredError(duplicateError)) {
        openAuthGate();
        return;
      }
      setError(duplicateError instanceof Error ? duplicateError.message : copy.runFailed);
    }
  }

  function renderResultsGallery(variant: 'desktop' | 'mobile') {
    if (!hasResults) {
      return variant === 'desktop' ? <EmptyResultsRail copy={copy} /> : null;
    }
    const itemClassName = variant === 'desktop' ? '' : 'min-w-[280px] shrink-0 snap-start';
    const items = (
      <>
        {pendingRuns.map((pendingRun) => {
          const pendingOutputLabel =
            findChoiceLabel(outputModeLabelOptions, pendingRun.outputMode) ?? copy.generatePanel.portraitTitle;
          const pendingQualityLabel =
            findChoiceLabel(qualityLabelOptions, pendingRun.qualityMode) ?? copy.options.quality.draft.label;
          const pendingFormatLabel = getFormatDisplayLabel(copy, pendingRun.formatMode, pendingRun.qualityMode);
          const subtitle = `${pendingOutputLabel} · ${pendingQualityLabel} · ${pendingFormatLabel}`;
          const badge = pendingRun.generateCount === 4 ? '4x' : null;
          return (
            <div key={pendingRun.id} className={itemClassName}>
              <PendingResultCard
                title={getResultActionLabel(copy, pendingRun.action)}
                subtitle={subtitle}
                badge={badge}
                copy={copy}
              />
            </div>
          );
        })}
        {flattenedResults.map((result) => {
          const run = state.runs.find((entry) => entry.id === result.runId);
          const resultOutputLabel =
            findChoiceLabel(outputModeLabelOptions, result.outputMode) ?? copy.generatePanel.portraitTitle;
          const resultQualityLabel =
            findChoiceLabel(qualityLabelOptions, result.qualityMode) ?? copy.options.quality.draft.label;
          const resultFormatLabel = getFormatDisplayLabel(copy, run?.formatMode ?? 'standard', result.qualityMode);
          const subtitle = `${resultOutputLabel} · ${resultQualityLabel} · ${resultFormatLabel}`;
          const badge = run && run.results.length > 1 ? `${run.results.length}x` : null;

          return (
            <div key={result.id} className={itemClassName}>
              <ResultCard
                result={result}
                selected={state.selectedResultId === result.id}
                title={getResultActionLabel(copy, result.action)}
                subtitle={subtitle}
                badge={badge}
                saving={savingResultId === result.id}
                onOpen={() => {
                  setState((previous) => ({
                    ...previous,
                    selectedResultId: result.id,
                  }));
                  setLightboxEntry({
                    id: result.id,
                    label: getResultActionLabel(copy, result.action),
                    thumbUrl: result.url,
                    mediaType: 'image',
                    status: 'completed',
                    engineLabel: result.engineLabel,
                    createdAt: result.createdAt,
                    jobId: result.jobId,
                    prompt: run?.settingsSnapshot?.prompt ?? null,
                  });
                }}
                onSelect={() =>
                  setState((previous) => ({
                    ...previous,
                    selectedResultId: result.id,
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
            </div>
          );
        })}
        {historicalResults.map((item) => {
          const createdLabel = (() => {
            try {
              return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.createdAt));
            } catch {
              return item.createdAt;
            }
          })();

          return (
            <div key={item.id} className={itemClassName}>
              <ResultCard
                result={{
                  id: item.id,
                  runId: item.jobId,
                  jobId: item.jobId,
                  url: item.imageUrl,
                  thumbUrl: item.thumbUrl,
                  engineId: '',
                  engineLabel: item.engineLabel,
                  action: 'generate',
                  outputMode: 'portrait-reference',
                  qualityMode: state.qualityMode,
                  createdAt: item.createdAt,
                }}
                selected={state.selectedResultId === item.id}
                title={copy.resultCard.referenceOutput}
                subtitle={`${item.engineLabel} · ${createdLabel}`}
                saving={savingResultId === item.id}
                onOpen={() => {
                  setState((previous) => ({
                    ...previous,
                    selectedResultId: item.id,
                  }));
                  setLightboxEntry({
                    id: item.id,
                    label: copy.resultCard.referenceOutput,
                    thumbUrl: item.imageUrl,
                    mediaType: 'image',
                    status: 'completed',
                    engineLabel: item.engineLabel,
                    createdAt: item.createdAt,
                    jobId: item.jobId,
                    prompt: item.prompt,
                  });
                }}
                onSelect={() =>
                  setState((previous) => ({
                    ...previous,
                    selectedResultId: item.id,
                  }))
                }
                onDownload={() =>
                  triggerAppDownload(
                    item.imageUrl,
                    suggestDownloadFilename(item.imageUrl, `character-reference-${item.id.replace(/[^a-z0-9]+/gi, '-')}`)
                  )
                }
                onSave={() => void handleSaveHistoricalResult(item)}
                onDuplicateSettings={() => void handleDuplicateHistoricalSettings(item)}
                copy={copy}
              />
            </div>
          );
        })}
      </>
    );

    if (variant === 'desktop') {
      return (
        <div className="relative flex-1 min-h-0">
          <div ref={resultsScrollContainerRef} className="scrollbar-rail h-full overflow-y-auto space-y-3 pr-4 pt-1">
            {items}
            {historicalHasMore ? <div ref={resultsSentinelRef} className="h-6" /> : null}
            {historicalIsFetchingMore || historicalJobsLoading ? (
              <div className="flex justify-center py-3 text-xs font-medium text-text-secondary">
                {copy.resultCard.pending}
              </div>
            ) : null}
          </div>
        </div>
      );
    }

    return <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">{items}</div>;
  }

  if (authLoading || !hydrated) {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <HeaderBar />
        <div className="flex flex-1 min-w-0 flex-col xl:flex-row">
          <div className="hidden xl:block">
            <AppSidebar />
          </div>
          <main className="flex-1 min-w-0 overflow-y-auto p-5 pb-80 lg:p-7 lg:pb-40 xl:pb-64">
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

  if (!FEATURES.workflows.toolsSection) {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <HeaderBar />
        <div className="flex flex-1 min-w-0 flex-col xl:flex-row">
          <div className="hidden xl:block">
            <AppSidebar />
          </div>
          <main className="flex-1 min-w-0 overflow-y-auto p-5 pb-80 lg:p-7 lg:pb-40 xl:pb-64">
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
        <main className="flex-1 min-w-0 overflow-y-auto p-5 pb-80 lg:p-7 lg:pb-40 xl:pb-64">
          <div className="mx-auto w-full max-w-[1500px] space-y-6">
            <div>
              <ButtonLink
                href="/app/tools"
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

            <div className="flex flex-col gap-6 xl:flex-row">
              <div className="min-w-0 flex-1 space-y-6">
                <Card className="overflow-visible border border-border p-6 lg:p-7">
                  <div className="space-y-6">
                    <section className="space-y-4">
                      <SectionTitle title={copy.top.start} />
                      <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
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
                        <OutputPreviewCard
                          selected={state.outputMode === 'portrait-reference'}
                          title={copy.generatePanel.portraitTitle}
                          subtitle={copy.generatePanel.portraitBody}
                          mode="portrait-reference"
                          onClick={() =>
                            setState((previous) => ({
                              ...previous,
                              outputMode: 'portrait-reference',
                              outputOptions: {
                                ...previous.outputOptions,
                                fullBodyRequired: false,
                              },
                            }))
                          }
                        />
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <ReferenceSlot
                          title={copy.references.identityTitle}
                          subtitle={copy.references.identityBody}
                          image={identityReference}
                          onUpload={() => {
                            if (!user) {
                              openAuthGate();
                              return;
                            }
                            identityFileRef.current?.click();
                          }}
                          onOpenLibrary={() => {
                            if (!user) {
                              openAuthGate();
                              return;
                            }
                            setLibraryModalRole('identity');
                          }}
                          removeLabel={copy.references.remove}
                          libraryLabel={copy.library.open}
                          optionalLabel={copy.sections.optional}
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
                            onUpload={() => {
                              if (!user) {
                                openAuthGate();
                                return;
                              }
                              styleFileRef.current?.click();
                            }}
                            onOpenLibrary={() => {
                              if (!user) {
                                openAuthGate();
                                return;
                              }
                              setShowStyleReferenceSlot(true);
                              setLibraryModalRole('style');
                            }}
                            removeLabel={copy.references.remove}
                            libraryLabel={copy.library.open}
                            optionalLabel={copy.sections.optional}
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
                            <div className="mt-3 flex items-center justify-center gap-2">
                              <p className="text-sm font-semibold text-text-primary">{copy.references.addInspiration}</p>
                              <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-micro text-text-secondary">
                                {copy.sections.optional}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-text-secondary">{copy.references.addInspirationBody}</p>
                          </button>
                        )}
                      </div>
                    </section>

                    <section className="space-y-4 border-t border-border pt-6">
                      <SectionTitle title={copy.top.buildLook} />
                      <div className="space-y-4">
                        <div className="overflow-x-auto pb-2">
                          <div className="flex min-w-max overflow-hidden rounded-[24px] border border-border bg-surface shadow-card md:min-w-0 md:w-full">
                            <BuildLookCarouselCard
                              title={copy.sections.gender}
                              summary={identitySummary}
                              active={activeBuildSection === 'identity'}
                              onClick={() => setActiveBuildSection('identity')}
                            />
                            <BuildLookCarouselCard
                              title={copy.sections.hair}
                              summary={hairSummary === copy.notSet ? copy.sections.hairOpenEditor : hairSummary}
                              accessory={
                                <div className="inline-flex rounded-full border border-border bg-bg p-1">
                                  {(['auto', 'custom'] as const).map((mode) => (
                                    <button
                                      key={mode}
                                      type="button"
                                      onClick={() => setHairMode(mode)}
                                      className={clsx(
                                        'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-micro transition',
                                        hairMode === mode
                                          ? 'bg-brand text-on-brand'
                                          : 'text-text-secondary hover:text-text-primary'
                                      )}
                                    >
                                      {mode === 'auto' ? copy.auto : copy.custom}
                                    </button>
                                  ))}
                                </div>
                              }
                              active={activeBuildSection === 'hair'}
                              onClick={() => setActiveBuildSection('hair')}
                            />
                            <BuildLookCarouselCard
                              title={copy.sections.outfit}
                              summary={outfitSummary === copy.notSet ? copy.open : outfitSummary}
                              accessory={
                                <div className="inline-flex rounded-full border border-border bg-bg p-1">
                                  {(['auto', 'custom'] as const).map((mode) => (
                                    <button
                                      key={mode}
                                      type="button"
                                      onClick={() => setOutfitMode(mode)}
                                      className={clsx(
                                        'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-micro transition',
                                        outfitMode === mode
                                          ? 'bg-brand text-on-brand'
                                          : 'text-text-secondary hover:text-text-primary'
                                      )}
                                    >
                                      {mode === 'auto' ? copy.auto : copy.custom}
                                    </button>
                                  ))}
                                </div>
                              }
                              active={activeBuildSection === 'outfit'}
                              onClick={() => setActiveBuildSection('outfit')}
                            />
                            <BuildLookCarouselCard
                              title={copy.sections.accessoriesFeatures}
                              summary={accessoriesFeaturesSummary || copy.open}
                              active={activeBuildSection === 'details'}
                              onClick={() => setActiveBuildSection('details')}
                            />
                            <BuildLookCarouselCard
                              title={copy.sections.realism}
                              summary={realismSummary}
                              active={activeBuildSection === 'style'}
                              onClick={() => setActiveBuildSection('style')}
                            />
                          </div>
                        </div>

                        <div className="rounded-[24px] border border-border bg-surface shadow-card p-4 sm:p-5">
                          {activeBuildSection === 'identity' ? (
                            <div className="space-y-4">
                              <div className="grid grid-cols-[repeat(auto-fit,minmax(148px,172px))] justify-center gap-3 xl:justify-start">
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
                          ) : null}

                          {activeBuildSection === 'hair' ? (
                            <div className="space-y-4">
                              <div>
                                <p className="text-sm font-semibold text-text-primary">{copy.sections.hair}</p>
                                <p className="mt-1 text-xs text-text-secondary">
                                  {hairSummary === copy.notSet ? copy.sections.hairOpenEditor : hairSummary}
                                </p>
                              </div>

                              {hairMode === 'custom' ? (
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
                              ) : null}
                            </div>
                          ) : null}

                          {activeBuildSection === 'outfit' ? (
                            <div className="space-y-4">
                              <div>
                                <p className="text-sm font-semibold text-text-primary">{copy.sections.outfit}</p>
                                <p className="mt-1 text-xs text-text-secondary">
                                  {outfitSummary === copy.notSet ? copy.open : outfitSummary}
                                </p>
                              </div>

                              {outfitMode === 'custom' ? (
                                <>
                                  <div className="flex flex-wrap gap-2">
                                    {outfitOptions.map((option) => {
                                      const selected = state.traits.outfitStyle.value === option.id;
                                      return (
                                        <button
                                          key={option.id}
                                          type="button"
                                          onClick={() => updateTrait('outfitStyle', selected ? '' : option.id)}
                                          className={clsx(
                                            'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
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
                              ) : null}
                            </div>
                          ) : null}

                          {activeBuildSection === 'style' ? (
                            <div className="grid grid-cols-[repeat(auto-fit,minmax(148px,172px))] justify-center gap-3 xl:justify-start">
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
                          ) : null}

                          {activeBuildSection === 'details' ? (
                            <div className="space-y-4">
                              <div>
                                <p className="text-sm font-semibold text-text-primary">{copy.sections.accessoriesFeatures}</p>
                                <p className="mt-1 text-xs text-text-secondary">
                                  {accessoriesFeaturesSummary || copy.open}
                                </p>
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
                              <div className="space-y-2">
                                <label className="block text-sm font-semibold text-text-primary">{copy.sections.customDetails}</label>
                                <Textarea
                                  value={state.traits.customDetailsDescription ?? ''}
                                  onChange={(event) =>
                                    setState((previous) => ({
                                      ...previous,
                                      traits: {
                                        ...previous.traits,
                                        customDetailsDescription: event.target.value,
                                      },
                                    }))
                                  }
                                  placeholder={copy.sections.customDetailsPlaceholder}
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>
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

                          <div className="grid gap-3 md:grid-cols-2">
                            {[
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

                      <div className="rounded-[24px] border border-border bg-surface/95 p-4 shadow-card">
                        <CharacterBuilderStickyDock
                          identityReference={identityReference}
                          hairSummary={hairSummary}
                          outfitSummary={outfitSummary}
                          traits={state.traits}
                          outputMode={state.outputMode}
                          qualityMode={state.qualityMode}
                          formatMode={state.formatMode}
                          genderOptions={genderOptions}
                          ageOptions={ageOptions}
                          realismOptions={realismOptions.map((option) => ({ id: option.id, label: option.label }))}
                          outputOptions={outputModeOptions.map((option) => ({ id: option.id, label: option.label }))}
                          qualityOptions={qualityOptions.map((option) => ({ id: option.id, label: option.label }))}
                          formatOptions={formatLabelOptions}
                          estimatedImageCostUsd={estimatedImageCostUsd}
                          onQualityChange={(value) =>
                            setState((previous) => ({
                              ...previous,
                              qualityMode: value,
                              formatMode: normalizeCharacterFormatMode(previous.formatMode, value),
                            }))
                          }
                          onFormatChange={(value) =>
                            setState((previous) => ({
                              ...previous,
                              formatMode: normalizeCharacterFormatMode(value, previous.qualityMode),
                            }))
                          }
                          onGenerateOne={() => void handleRun('generate', 1)}
                          onGenerateFour={() => void handleRun('generate', 4)}
                          loadingGenerateOne={isActionLoading('generate-1')}
                          loadingGenerateFour={isActionLoading('generate-4')}
                          copy={copy}
                        />
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
                  <Card className="border border-border p-5 xl:hidden">
                    <SectionTitle eyebrow={copy.top.resultsEyebrow} title={copy.top.resultsTitle} />
                    <div className="mt-4">{renderResultsGallery('mobile')}</div>
                  </Card>
                ) : null}
              </div>

              <div className="hidden xl:flex xl:w-[340px] xl:min-h-0 xl:flex-col">
                <div className="sticky top-6 flex h-[calc(100vh-3rem)] min-h-0 w-full flex-col gap-4">
                  <Card className="flex h-full min-h-0 flex-1 flex-col overflow-hidden border border-border p-5">
                    <SectionTitle eyebrow={copy.top.resultsEyebrow} title={copy.top.resultsTitle} />
                    <div className="mt-4 flex min-h-0 flex-1 flex-col">
                      {renderResultsGallery('desktop')}
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
      {lightboxEntry ? (
        <MediaLightbox
          title={copy.top.resultsTitle}
          subtitle={lightboxEntry.engineLabel ?? undefined}
          prompt={lightboxEntry.prompt ?? null}
          entries={[lightboxEntry]}
          onClose={() => setLightboxEntry(null)}
        />
      ) : null}
      <CharacterReferenceLibraryModal
        open={libraryModalRole !== null}
        onClose={() => setLibraryModalRole(null)}
        onSelect={handleLibrarySelect}
        copy={copy}
      />
      {authModalOpen ? (
        <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-surface-on-media-dark-60 px-3 py-6 sm:px-6">
          <div className="absolute inset-0" role="presentation" onClick={() => setAuthModalOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-modal border border-border bg-surface p-6 shadow-float">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h2 className="text-base font-semibold text-text-primary">{copy.authGate.title}</h2>
                <p className="mt-2 text-sm text-text-secondary">{copy.authGate.body}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAuthModalOpen(false)}
                className="rounded-full border-hairline bg-surface-glass-80 px-3 py-1.5 text-sm text-text-muted hover:bg-surface-2"
                aria-label={copy.authGate.close}
              >
                {copy.authGate.close}
              </Button>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <ButtonLink href={`/login?next=${encodeURIComponent(loginRedirectTarget)}`} size="sm" className="px-4">
                {copy.authGate.primary}
              </ButtonLink>
              <ButtonLink
                href={`/login?mode=signin&next=${encodeURIComponent(loginRedirectTarget)}`}
                variant="outline"
                size="sm"
                className="px-4"
              >
                {copy.authGate.secondary}
              </ButtonLink>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
