import { isKlingV4EngineId } from '@/lib/kling-v4';

/**
 * Closed preparation gate, independent of UI visibility and provider credentials.
 * The 2026-10-25 T2V access trial succeeded; reviewed customer tariffs and product QA are still required.
 * Remove only with the signed-off qualification in docs/launch/kling-v4/PLAN.md.
 */
export function isKlingV4ReleaseBlocked(engineId: string | null | undefined): boolean {
  return isKlingV4EngineId(engineId);
}

export function assertKlingV4ReleaseReady(engineId: string): void {
  if (isKlingV4ReleaseBlocked(engineId)) {
    throw new Error('KLING_V4_NOT_QUALIFIED: reviewed customer tariffs and App/Studio/MCP release qualification are required.');
  }
}
