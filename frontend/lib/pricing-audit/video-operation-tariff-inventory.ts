import { getFalEngineById } from '@/config/falEngines';
import type { PricingContext } from '@/lib/pricing-context';
import { resolveVideoOperationEngine } from '@/lib/video-operation';
import type { VideoOperation } from '@/lib/video-operation';

/** Reviewed additions only. Legacy Standard/Pro Reference (including explicit
 * Reference) deliberately retains its historical selector and customer amounts. */
export function newVideoTariffFamily(context: PricingContext): string | null {
  const id = context.engine.id, mode = context.mode, operation = context.operation;
  if (id === 'veo-3-1' && mode === 'i2v' && [4, 6].includes(context.durationSec)) return 'veo-standard-i2v';
  if (id === 'kling-o3-4k' && mode === 'v2v' && operation !== 'kling-edit') return 'kling-reference';
  if (['kling-o3-standard','kling-o3-pro','kling-o3-4k'].includes(id) && mode === 'v2v' && operation === 'kling-edit') return operation;
  if (id === 'luma-ray-3-2' && mode === 'extend') return 'luma-extend';
  if (id === 'minimax-h3-max' && mode === 'v2v' && ['h3-recast','h3-relight'].includes(operation ?? '')) return operation!;
  if (['flux-3','flux-3-draft'].includes(id) && mode === 'ref2v') return 'flux-keyframes';
  if (id === 'flux-3' && mode === 'v2v' && operation === 'flux-fast-edit') return operation;
  if (id === 'flux-3-draft' && mode === 'v2v' && operation === 'flux-draft-enhance') return operation;
  if (id === 'ltx-2-3' && mode === 'reframe') return 'ltx23-reframe';
  return null;
}

/** These modes have operation-specific controls; the generic mode cartesian
 * product cannot invent a default source operation or fractional duration list. */
export function hasOperationTariffInventory(engineId: string, mode: string): boolean {
  return (['kling-o3-4k','minimax-h3-max','flux-3','flux-3-draft'].includes(engineId) && mode === 'v2v')
    || (engineId === 'luma-ray-3-2' && mode === 'extend')
    || (['flux-3','flux-3-draft'].includes(engineId) && mode === 'ref2v')
    || (engineId === 'ltx-2-3' && mode === 'reframe');
}

export function videoOperationTariffContexts(scope: { modelId?: string; mode?: string } = {}): PricingContext[] {
  const result: PricingContext[] = [];
  const add = (id: string, mode: 'v2v' | 'extend' | 'ref2v' | 'reframe', operation: VideoOperation,
    resolutions: readonly string[], durations: readonly number[]) => {
    if ((scope.modelId && scope.modelId !== id) || (scope.mode && scope.mode !== mode)) return;
    const engine = resolveVideoOperationEngine(getFalEngineById(id)!.engine, mode, operation);
    for (const resolution of resolutions) for (const durationSec of durations) result.push({ engine, mode, operation,
      resolution, durationSec, hasVideoInput: mode !== 'ref2v',
      ...(mode === 'ref2v' ? { inputImageCount: 2 } : { inputVideoDurationSec: durationSec }) });
  };
  add('kling-o3-4k', 'v2v', 'kling-reference', ['4k'], Array.from({ length: 13 }, (_, i) => i + 3));
  for (const [id, resolution] of [['kling-o3-standard','720p'],['kling-o3-pro','1080p'],['kling-o3-4k','4k']])
    add(id, 'v2v', 'kling-edit', [resolution], [5]);
  add('minimax-h3-max', 'v2v', 'h3-recast', ['768P','1080P'], [5]);
  add('minimax-h3-max', 'v2v', 'h3-relight', ['480P','768P','1080P','2K'], [124 / 24]);
  add('luma-ray-3-2', 'extend', 'luma-extend', ['540p','720p','1080p'], [5]);
  const durations = Array.from({ length: 16 }, (_, i) => i + 5);
  add('flux-3', 'ref2v', 'flux-keyframes', ['720p','1080p'], durations);
  add('flux-3-draft', 'ref2v', 'flux-keyframes', ['720p'], durations);
  add('flux-3', 'v2v', 'flux-fast-edit', ['720p'], [5]);
  add('flux-3-draft', 'v2v', 'flux-draft-enhance', ['1080p'], [5]);
  add('ltx-2-3', 'reframe', 'ltx23-reframe', ['720p','1080p'], [5]);
  return result;
}
