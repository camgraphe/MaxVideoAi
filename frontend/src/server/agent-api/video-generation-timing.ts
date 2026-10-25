import type { TransactionQueryExecutor } from '@/lib/db';
import { getRenderEta } from '@/lib/render-eta';
import { fetchGenerationTimingMatrix } from '@/server/generation-timing';
import type { EngineCaps } from '@/types/engines';
import { toEngineGenerationMode } from './generation-mode-aliases';
import type { CanonicalGenerationRequest } from './generation-types';

export type ReservedVideoTiming = { etaSeconds: number; etaLabel: string };

/** Optional observations must not abort the quote/wallet reservation transaction. */
export async function resolveReservedVideoTiming(
  engine: EngineCaps,
  request: CanonicalGenerationRequest,
  durationSec: number,
  executor: TransactionQueryExecutor,
): Promise<ReservedVideoTiming> {
  let timingEngine = engine;
  await executor.query('SAVEPOINT generation_timing_estimate');
  try {
    const matrix = await fetchGenerationTimingMatrix({
      databaseConfigured: true,
      queryFn: executor.query.bind(executor),
    });
    timingEngine = { ...engine, timingCells: matrix[engine.id] ?? [] };
    await executor.query('RELEASE SAVEPOINT generation_timing_estimate');
  } catch {
    await executor.query('ROLLBACK TO SAVEPOINT generation_timing_estimate');
    await executor.query('RELEASE SAVEPOINT generation_timing_estimate');
    console.warn('[generation-timing] reservation observations unavailable; using approximate estimate');
  }
  const estimate = getRenderEta(timingEngine, durationSec, {
    mode: toEngineGenerationMode(engine.id, request.mode),
    resolution: typeof request.settings.resolution === 'string' ? request.settings.resolution : undefined,
  });
  return { etaSeconds: estimate.seconds, etaLabel: estimate.label };
}
