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

const BRAND_PICTOGRAMS: Record<string, EnginePictogram> = {
  'google-veo': { code: 'Ve', backgroundColor: '#CDE7FF', textColor: DEFAULT_TEXT_COLOR },
  openai: { code: 'So', backgroundColor: '#E4D7FF', textColor: DEFAULT_TEXT_COLOR },
  runway: { code: 'Ru', backgroundColor: '#FFD8C7', textColor: DEFAULT_TEXT_COLOR },
  pika: { code: 'Pi', backgroundColor: '#FADCE6', textColor: DEFAULT_TEXT_COLOR },
  luma: { code: 'Lu', backgroundColor: '#DFF5E2', textColor: DEFAULT_TEXT_COLOR },
  kling: { code: 'Kl', backgroundColor: '#FFF3C4', textColor: DEFAULT_TEXT_COLOR },
  haiper: { code: 'Ha', backgroundColor: '#E3EAF5', textColor: DEFAULT_TEXT_COLOR },
  stability: { code: 'St', backgroundColor: '#F4F4F6', textColor: DEFAULT_TEXT_COLOR },
};

const ENGINE_PICTOGRAMS: Record<string, EnginePictogram> = {
  'veo-3': BRAND_PICTOGRAMS['google-veo'],
  veo3: BRAND_PICTOGRAMS['google-veo'],
  veo3fast: BRAND_PICTOGRAMS['google-veo'],
  'veo-3-fast': BRAND_PICTOGRAMS['google-veo'],
  'sora-2': BRAND_PICTOGRAMS.openai,
  'sora-2-pro': BRAND_PICTOGRAMS.openai,
  sora2: BRAND_PICTOGRAMS.openai,
  sora2pro: BRAND_PICTOGRAMS.openai,
  runwayg3: BRAND_PICTOGRAMS.runway,
  'runway-gen-3': BRAND_PICTOGRAMS.runway,
  'runway-gen3': BRAND_PICTOGRAMS.runway,
  'pika-22': BRAND_PICTOGRAMS.pika,
  pika22: BRAND_PICTOGRAMS.pika,
  'luma-dm': BRAND_PICTOGRAMS.luma,
  lumadm: BRAND_PICTOGRAMS.luma,
  'luma-dream-machine': BRAND_PICTOGRAMS.luma,
  lumadm_fast: BRAND_PICTOGRAMS.luma,
  kling25: BRAND_PICTOGRAMS.kling,
  'kling-2-5': BRAND_PICTOGRAMS.kling,
  kling25_turbo: BRAND_PICTOGRAMS.kling,
  haiper_video: BRAND_PICTOGRAMS.haiper,
  'haiper-video': BRAND_PICTOGRAMS.haiper,
  svd_xt: BRAND_PICTOGRAMS.stability,
  'svd-x0': BRAND_PICTOGRAMS.stability,
  hunyuan_video: { code: 'Hy', backgroundColor: '#E1E8FF', textColor: DEFAULT_TEXT_COLOR },
  minimax: { code: 'Mi', backgroundColor: '#FFE7F0', textColor: DEFAULT_TEXT_COLOR },
  minimax_video_01: { code: 'Mi', backgroundColor: '#FFE7F0', textColor: DEFAULT_TEXT_COLOR },
  minimax_hailuo_02_pro: { code: 'Mi', backgroundColor: '#FFE7F0', textColor: DEFAULT_TEXT_COLOR },
  lumaRay2: BRAND_PICTOGRAMS.luma,
  lumaRay2_flash: BRAND_PICTOGRAMS.luma,
  lumaRay2_modify: BRAND_PICTOGRAMS.luma,
  lumaRay2_reframe: BRAND_PICTOGRAMS.luma,
  lumaRay2_flash_reframe: BRAND_PICTOGRAMS.luma
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
