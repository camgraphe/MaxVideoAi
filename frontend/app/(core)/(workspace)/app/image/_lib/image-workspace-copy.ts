export interface ImageWorkspaceCopy {
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
  };
  preview: {
    eyebrow: string;
    title: string;
    emptyTitle: string;
    emptyDescription: string;
    download: string;
    copy: string;
    copied: string;
    cta: string;
  };
  engine: {
    eyebrow: string;
    priceCalculating: string;
    priceLabel: string;
  };
  modeTabs: {
    generate: string;
    edit: string;
  };
  composer: {
    promptLabel: string;
    promptPlaceholder: string;
    promptPlaceholderWithImage: string;
    charCount: string;
    presetsHint: string;
    numImagesLabel: string;
    numImagesCount: string;
    numImagesUnit: {
      singular: string;
      plural: string;
    };
    aspectRatioLabel: string;
    aspectRatioHint: string;
    aspectRatioAutoNote: string;
    resolutionLabel: string;
    resolutionHint: string;
    resolutionLockedLabel: string;
    seedLabel: string;
    seedPlaceholder: string;
    outputFormatLabel: string;
    outputFormatHint: string;
    qualityLabel: string;
    qualityHint: string;
    customWidthLabel: string;
    customHeightLabel: string;
    maskUrlLabel: string;
    maskUrlPlaceholder: string;
    enableWebSearchLabel: string;
    enableWebSearchHint: string;
    thinkingLevelLabel: string;
    thinkingLevelHint: string;
    limitGenerationsLabel: string;
    limitGenerationsHint: string;
    toggleEnabled: string;
    toggleDisabled: string;
    estimatedCost: string;
    referenceLabel: string;
    referenceHelper: string;
    referenceNote: string;
    referenceButton: string;
    characterButton: string;
    characterNote: string;
    characterHiddenNotice: string;
    characterLimitNotice: string;
    referenceExpand: string;
    referenceCollapse: string;
    referenceSlotLabel: string;
    referenceSlotHint: string;
    referenceSlotNameFallback: string;
    referenceSlotActions: {
      upload: string;
      library: string;
      replace: string;
      remove: string;
    };
  };
  history: {
    eyebrow: string;
    empty: string;
    runsLabel: {
      zero: string;
      other: string;
    };
    noPreview: string;
    loadMore: string;
    refreshing: string;
  };
  runButton: {
    idle: string;
    running: string;
  };
  errors: {
    onlyImages: string;
    unsupportedFormat: string;
    uploadFailed: string;
    fileTooLarge: string;
    unauthorized: string;
    promptMissing: string;
    referenceMissing: string;
    generic: string;
  };
  messages: {
    success: string;
    generatingInProgress: string;
    savedToLibrary: string;
    removedFromLibrary: string;
  };
  general: {
    uploading: string;
    cancelUpload: string;
    emptyEngines: string;
  };
  library: {
    button: string;
    empty: string;
    overlay: string;
    unsupported: string;
    supportedFormats: string;
    assetFallback: string;
    tabs: {
      all: string;
      upload: string;
      generated: string;
      character: string;
      angle: string;
      upscale: string;
    };
    modal: {
      title: string;
      description: string;
      close: string;
      error: string;
      empty: string;
      emptyCompatible: string;
      emptyUploads: string;
      emptyGenerated: string;
      emptyCharacter: string;
      emptyAngle: string;
      emptyUpscale: string;
    };
  };
  characterPicker: {
    title: string;
    description: string;
    selected: string;
    select: string;
    done: string;
    empty: string;
    limitLabel: string;
  };
  authGate: {
    title: string;
    body: string;
    primary: string;
    secondary: string;
    close: string;
  };
}

export const DEFAULT_COPY: ImageWorkspaceCopy = {
  hero: {
    eyebrow: 'Image workspace',
    title: 'Generate Images',
    subtitle: 'Create and edit high-fidelity images.',
  },
  preview: {
    eyebrow: 'Generate preview',
    title: 'Latest output',
    emptyTitle: 'No preview yet.',
    emptyDescription: 'Run a generation to see the latest image here.',
    download: 'Download',
    copy: 'Copy link',
    copied: 'Copied',
    cta: 'Generate image',
  },
  engine: {
    eyebrow: 'Engine',
    priceCalculating: 'Calculating price…',
    priceLabel: '{amount} / run',
  },
  modeTabs: {
    generate: 'Create',
    edit: 'Edit',
  },
  composer: {
    promptLabel: 'Prompt',
    promptPlaceholder: 'Describe the image you’d like to generate...',
    promptPlaceholderWithImage: 'Describe how the image should be edited / transformed…',
    charCount: '{count} chars',
    presetsHint: 'Tap a preset or start from scratch.',
    numImagesLabel: 'Number of images',
    numImagesCount: '{count} {unit}',
    numImagesUnit: {
      singular: 'image',
      plural: 'images',
    },
    aspectRatioLabel: 'Aspect ratio',
    aspectRatioHint: 'Choose a preset to match your frame.',
    aspectRatioAutoNote: 'Auto lets the model decide the final crop.',
    resolutionLabel: 'Resolution',
    resolutionHint: 'Adjust output size here. Pricing updates automatically.',
    resolutionLockedLabel: 'Resolution locked by this engine.',
    seedLabel: 'Seed',
    seedPlaceholder: 'Optional',
    outputFormatLabel: 'Output format',
    outputFormatHint: 'Choose the file type for the final images.',
    qualityLabel: 'Quality',
    qualityHint: 'Controls model fidelity and cost when supported.',
    customWidthLabel: 'Width',
    customHeightLabel: 'Height',
    maskUrlLabel: 'Mask URL',
    maskUrlPlaceholder: 'Optional public mask image URL',
    enableWebSearchLabel: 'Web search',
    enableWebSearchHint: 'Ground the request with current web context when supported.',
    thinkingLevelLabel: 'Thinking level',
    thinkingLevelHint: 'Increase reasoning depth when the engine supports it.',
    limitGenerationsLabel: 'Limit generations',
    limitGenerationsHint: 'Reduce extra exploratory generations when supported.',
    toggleEnabled: 'Enabled',
    toggleDisabled: 'Disabled',
    estimatedCost: 'Estimated cost: {amount}',
    referenceLabel: 'Reference images',
    referenceHelper: 'Optional · up to {count} images',
    referenceNote:
      'Drag & drop, paste, upload from your device, or pull from your Library. These references are required for Edit mode.',
    referenceButton: 'Library',
    characterButton: 'Characters',
    characterNote: 'Pick generated characters to use as identity anchors.',
    characterHiddenNotice: 'Selected characters are saved and will be reused when you switch back to a compatible engine.',
    characterLimitNotice: 'Only the first {count} character reference{suffix} will be used with this engine.',
    referenceExpand: 'Show {count} more slots',
    referenceCollapse: 'Hide extra slots',
    referenceSlotLabel: 'Slot {index}',
    referenceSlotHint: 'Drop image, click to upload, paste, or choose from your library.',
    referenceSlotNameFallback: 'Image',
    referenceSlotActions: {
      upload: 'Upload',
      library: 'Library',
      replace: 'Replace',
      remove: 'Remove',
    },
  },
  history: {
    eyebrow: 'Recent run',
    empty: 'Launch a generation to populate your history. Each image variant appears below.',
    runsLabel: {
      zero: 'No runs yet',
      other: '{count} runs',
    },
    noPreview: 'No preview',
    loadMore: 'Load more',
    refreshing: 'Refreshing history…',
  },
  runButton: {
    idle: 'Generate images',
    running: 'Generating…',
  },
  errors: {
    onlyImages: 'Only image files are supported.',
    unsupportedFormat: 'This engine accepts {formats}.',
    uploadFailed: 'Unable to upload the selected image. Try again.',
    fileTooLarge: 'Image exceeds {maxMB} MB. Compress it or choose a smaller file.',
    unauthorized: 'Session expired — please sign in again and retry the upload.',
    promptMissing: 'Prompt is required.',
    referenceMissing: 'Provide at least one source image for edit mode.',
    generic: 'Image generation failed.',
  },
  messages: {
    success: 'Generated {count} image{suffix}.',
    generatingInProgress: 'Generating in progress ({count})…',
    savedToLibrary: 'Saved to Library.',
    removedFromLibrary: 'Removed from Library.',
  },
  general: {
    uploading: 'Uploading…',
    cancelUpload: 'Cancel upload',
    emptyEngines: 'No image engines available.',
  },
  library: {
    button: 'Library',
    empty: 'No assets saved yet. Upload images from the composer or the Library page.',
    overlay: 'Use this image',
    unsupported: 'Unsupported format',
    supportedFormats: 'Supported formats: {formats}',
    assetFallback: 'Asset',
    tabs: {
      all: 'All images',
      upload: 'Uploaded images',
      generated: 'Generated images',
      character: 'Character assets',
      angle: 'Angle assets',
      upscale: 'Upscale assets',
    },
    modal: {
      title: 'Select from library',
      description: 'Choose an image you previously imported.',
      close: 'Close',
      error: 'Unable to load assets. Please retry.',
      empty: 'No assets saved yet. Upload images from the composer or the Library page.',
      emptyCompatible: 'No compatible assets for this model yet.',
      emptyUploads: 'No uploaded images yet. Upload images from the composer or the Library page.',
      emptyGenerated: 'No generated images saved yet. Save a generated image to see it here.',
      emptyCharacter: 'No character assets saved yet. Generate one in Character Builder first.',
      emptyAngle: 'No angle assets saved yet. Generate one in the Angle tool first.',
      emptyUpscale: 'No upscale assets saved yet. Save an upscale result first.',
    },
  },
  characterPicker: {
    title: 'Select characters',
    description: 'Choose from your Character Builder outputs. Selected characters are added as identity references.',
    selected: 'Selected',
    select: 'Select',
    done: 'Done',
    empty: 'No character references yet. Generate one in the Character Builder first.',
    limitLabel: 'Up to {count} character reference{suffix}',
  },
  authGate: {
    title: 'Create an account to render',
    body: 'You can explore the image workspace, but starting a real image generation requires an account.',
    primary: 'Create account',
    secondary: 'Sign in',
    close: 'Maybe later',
  },
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function mergeCopy<T>(defaults: T, overrides?: Partial<T> | null): T {
  if (!isPlainRecord(defaults) || !isPlainRecord(overrides)) return defaults;
  const next: Record<string, unknown> = { ...defaults };
  Object.entries(overrides).forEach(([key, overrideValue]) => {
    const defaultValue = next[key];
    if (isPlainRecord(defaultValue) && isPlainRecord(overrideValue)) {
      next[key] = mergeCopy(defaultValue, overrideValue);
      return;
    }
    if (overrideValue !== undefined) {
      next[key] = overrideValue;
    }
  });
  return next as T;
}

export function formatTemplate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((result, [key, value]) => {
    return result.replaceAll(`{${key}}`, String(value));
  }, template);
}
