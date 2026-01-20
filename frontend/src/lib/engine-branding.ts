type EngineIdentity = {
  id?: string | null;
  brandId?: string | null;
  label?: string | null;
};

export interface EnginePictogram {
  code: string;
  backgroundColor: string;
  textColor: string;
}

const DEFAULT_TEXT_COLOR = '#1F2633';

function brandColorVar(brandId: string, tone: 'bg' | 'ink'): string {
  return `var(--engine-${brandId}-${tone})`;
}

const BRAND_PICTOGRAMS: Record<string, EnginePictogram> = {
  'google-veo': { code: 'Ve', backgroundColor: brandColorVar('google-veo', 'bg'), textColor: brandColorVar('google-veo', 'ink') },
  openai: { code: 'So', backgroundColor: brandColorVar('openai', 'bg'), textColor: brandColorVar('openai', 'ink') },
  pika: { code: 'Pi', backgroundColor: brandColorVar('pika', 'bg'), textColor: brandColorVar('pika', 'ink') },
  minimax: { code: 'Mi', backgroundColor: brandColorVar('minimax', 'bg'), textColor: brandColorVar('minimax', 'ink') },
  kling: { code: 'Kl', backgroundColor: brandColorVar('kling', 'bg'), textColor: brandColorVar('kling', 'ink') },
  wan: { code: 'Wa', backgroundColor: brandColorVar('wan', 'bg'), textColor: brandColorVar('wan', 'ink') },
  luma: { code: 'Lu', backgroundColor: brandColorVar('luma', 'bg'), textColor: brandColorVar('luma', 'ink') },
  runway: { code: 'Rw', backgroundColor: brandColorVar('runway', 'bg'), textColor: brandColorVar('runway', 'ink') },
  lightricks: { code: 'Lt', backgroundColor: brandColorVar('lightricks', 'bg'), textColor: brandColorVar('lightricks', 'ink') },
  google: { code: 'Go', backgroundColor: brandColorVar('google', 'bg'), textColor: brandColorVar('google', 'ink') },
};

const ENGINE_PICTOGRAMS: Record<string, EnginePictogram> = {
  'veo-3-1': BRAND_PICTOGRAMS['google-veo'],
  'veo-3-1-fast': BRAND_PICTOGRAMS['google-veo'],
  'sora-2': BRAND_PICTOGRAMS.openai,
  'sora-2-pro': BRAND_PICTOGRAMS.openai,
  'pika-text-to-video': BRAND_PICTOGRAMS.pika,
  'minimax-hailuo-02-text': BRAND_PICTOGRAMS.minimax,
};

const FALLBACK_COLORS = ['#E8EDFF', '#FFE6F1', '#E6F5EB', '#FFF2DC', '#F2E9FF', '#E2F7F4', '#FFECE1', '#E9EEF5'];

function normaliseKey(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.trim().toLowerCase();
}

function deriveLetters(label: string | null | undefined, brandId: string | null | undefined, id: string | null | undefined): string {
  const source = label?.trim() || brandId?.trim() || id?.trim();
  if (!source) {
    return 'Mv';
  }

  const tokens = source.split(/[\s-_]+/).filter(Boolean);
  if (tokens.length >= 2) {
    return `${capitalise(tokens[0][0])}${tokens[1][0].toLowerCase()}`;
  }

  const word = tokens[0];
  if (word.length >= 2) {
    return `${capitalise(word[0])}${word[1].toLowerCase()}`;
  }

  return `${capitalise(word[0])}${word[0].toLowerCase()}`;
}

function capitalise(char: string): string {
  return char.toUpperCase();
}

function pickFallbackColor(key: string): string {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) % 0xffffffff;
  }
  const colorIndex = Math.abs(hash) % FALLBACK_COLORS.length;
  return FALLBACK_COLORS[colorIndex];
}

export function getEnginePictogram(identity: EngineIdentity, explicitLabel?: string | null): EnginePictogram {
  const explicitId = normaliseKey(identity.id);
  const explicitBrand = normaliseKey(identity.brandId);
  const keyLabel = explicitLabel ?? identity.label ?? null;

  if (explicitId && ENGINE_PICTOGRAMS[explicitId]) {
    return ENGINE_PICTOGRAMS[explicitId];
  }

  if (explicitBrand && BRAND_PICTOGRAMS[explicitBrand]) {
    return BRAND_PICTOGRAMS[explicitBrand];
  }

  const letters = deriveLetters(keyLabel, identity.brandId ?? null, identity.id ?? null);
  const backgroundColor = pickFallbackColor((explicitId ?? explicitBrand ?? letters).toString());
  return {
    code: letters,
    backgroundColor,
    textColor: DEFAULT_TEXT_COLOR,
  };
}
