import type { VideoOperationCaps } from '@/lib/video-operation';
import type { EngineCaps } from '@/types/engines';

/** Exact source-operation facts override broad historical v2v benchmark labels.
 * This describes the executable contract; live source eligibility and quotes stay authenticated. */
export function resolveOperationVideoSupport(engine: EngineCaps | undefined): string | undefined {
  if (!engine?.modes.includes('v2v')) return undefined;
  const operations = Object.values(engine.operationCaps ?? {}).filter((operation): operation is VideoOperationCaps => operation?.mode === 'v2v');
  if (!operations.length) return undefined;
  const labels = operations.map(operation => operation.label).join(' / ');
  const qualifier = operations.some(operation => operation.operation === 'flux-draft-enhance')
    ? 'owned paired Draft cache'
    : operations.some(operation => operation.operation === 'h3-recast' || operation.operation === 'h3-relight')
      ? 'specialized source tools'
      : operations.some(operation => operation.operation === 'kling-edit')
        ? 'source timing and framing for Edit'
        : 'source timing and framing';
  return `Supported (${labels}; ${qualifier})`;
}
