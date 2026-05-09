export type MultiPromptEntry = {
  prompt: string;
  duration: number;
};

export type GenerationElement = {
  frontalImageUrl?: string;
  referenceImageUrls?: string[];
  videoUrl?: string;
};

export function normalizeMultiPrompt(value: unknown): MultiPromptEntry[] | null {
  if (!Array.isArray(value)) return null;
  const entries = value
    .map((entry: unknown) => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as Record<string, unknown>;
      const promptValue = typeof record.prompt === 'string' ? record.prompt.trim() : '';
      const durationValue =
        typeof record.duration === 'number'
          ? Math.round(record.duration)
          : typeof record.duration === 'string'
            ? Math.round(Number(record.duration.replace(/[^\d.]/g, '')))
            : 0;
      if (!promptValue) return null;
      return { prompt: promptValue, duration: durationValue };
    })
    .filter((entry: MultiPromptEntry | null): entry is MultiPromptEntry => Boolean(entry));

  return entries.length ? entries : null;
}

export function normalizeSeed(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string' && value.trim().length && Number.isFinite(Number(value))) {
    return Math.trunc(Number(value));
  }
  return null;
}

export function normalizeStringArray(value: unknown): string[] {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : null;
  return values
    ? values.map((entry: unknown) => (typeof entry === 'string' ? entry.trim() : '')).filter(isPresentString)
    : [];
}

export function normalizeGenerationElements(value: unknown): GenerationElement[] | null {
  if (!Array.isArray(value)) return null;
  const elements = value
    .map((entry: unknown) => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as Record<string, unknown>;
      const frontalImageUrl =
        typeof record.frontalImageUrl === 'string' && record.frontalImageUrl.trim().length
          ? record.frontalImageUrl.trim()
          : null;
      const referenceImageUrls = Array.isArray(record.referenceImageUrls)
        ? record.referenceImageUrls
            .map((item: unknown) => (typeof item === 'string' ? item.trim() : ''))
            .filter(isPresentString)
        : [];
      const videoUrl =
        typeof record.videoUrl === 'string' && record.videoUrl.trim().length ? record.videoUrl.trim() : null;
      if (!frontalImageUrl && referenceImageUrls.length === 0 && !videoUrl) return null;
      const element: GenerationElement = {};
      if (frontalImageUrl) element.frontalImageUrl = frontalImageUrl;
      if (referenceImageUrls.length) element.referenceImageUrls = referenceImageUrls;
      if (videoUrl) element.videoUrl = videoUrl;
      return element;
    })
    .filter((entry: GenerationElement | null): entry is GenerationElement => Boolean(entry));

  return elements.length ? elements : null;
}

export function trimString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length ? value.trim() : null;
}

function isPresentString(value: string | null): value is string {
  return typeof value === 'string' && value.length > 0;
}
