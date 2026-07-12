import type { FalEngineEntry } from '@/config/falEngines';
import { isRuntimeModelPagePublished } from '@/config/model-runtime';

export function isPublishedModelPage<T extends Pick<FalEngineEntry, 'id' | 'surfaces'>>(
  engine: T | null | undefined
): engine is T {
  return Boolean(engine && isRuntimeModelPagePublished(engine.id));
}
