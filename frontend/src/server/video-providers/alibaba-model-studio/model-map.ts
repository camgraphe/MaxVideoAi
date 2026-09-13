export const ALIBABA_MODEL_STUDIO_PROVIDER = 'alibaba_model_studio' as const;

export type AlibabaVideoMode = 't2v' | 'i2v' | 'ref2v' | 'v2v' | 'extend';

export type AlibabaModelRoute = {
  model:
    | 'wan3.0-video'
    | 'wan3.0-video-prime'
    | 'happyhorse-1.1-t2v'
    | 'happyhorse-1.1-i2v'
    | 'happyhorse-1.1-r2v';
  family: 'wan3' | 'happyhorse11';
  mode: AlibabaVideoMode;
  fallbackCompatible: boolean;
};

const WAN_MODELS = new Map<string, AlibabaModelRoute['model']>([
  ['wan-3', 'wan3.0-video'],
  ['wan-3-prime', 'wan3.0-video-prime'],
]);

const WAN_MODES = new Set<AlibabaVideoMode>(['t2v', 'i2v', 'ref2v', 'v2v', 'extend']);
const HAPPY_HORSE_MODELS: Partial<Record<AlibabaVideoMode, AlibabaModelRoute['model']>> = {
  t2v: 'happyhorse-1.1-t2v',
  i2v: 'happyhorse-1.1-i2v',
  ref2v: 'happyhorse-1.1-r2v',
};

export function resolveAlibabaModelRoute(engineId: string, mode: string): AlibabaModelRoute | null {
  const normalizedMode = mode as AlibabaVideoMode;
  const wanModel = WAN_MODELS.get(engineId);
  if (wanModel && WAN_MODES.has(normalizedMode)) {
    return {
      model: wanModel,
      family: 'wan3',
      mode: normalizedMode,
      fallbackCompatible: normalizedMode === 't2v' || normalizedMode === 'i2v' || normalizedMode === 'ref2v',
    };
  }

  if (engineId === 'happy-horse-1-1') {
    const model = HAPPY_HORSE_MODELS[normalizedMode];
    if (model) {
      return {
        model,
        family: 'happyhorse11',
        mode: normalizedMode,
        fallbackCompatible: true,
      };
    }
  }

  return null;
}

export function isAlibabaDirectEngine(engineId: string): boolean {
  return WAN_MODELS.has(engineId) || engineId === 'happy-horse-1-1';
}

export function isAlibabaDirectModeSupported(engineId: string, mode: string): boolean {
  return resolveAlibabaModelRoute(engineId, mode) !== null;
}

export function isAlibabaFalFallbackCompatible(engineId: string, mode: string): boolean {
  return resolveAlibabaModelRoute(engineId, mode)?.fallbackCompatible === true;
}
