import { isKlingV4EngineId } from '@/lib/kling-v4';
import { getRuntimeModelById } from '@/config/model-runtime';

/**
 * App publication owns the reviewed functional release for every actor.
 * Marketing/indexation remains independent; credentials never bypass this gate.
 * The authored App flag stays closed until tariffs and product QA are signed off.
 */
export function isKlingV4ReleaseBlocked(engineId: string | null | undefined): boolean {
  return isKlingV4EngineId(engineId)
    && getRuntimeModelById('kling-v4')?.publication.app.published !== true;
}

export function assertKlingV4ReleaseReady(engineId: string): void {
  if (isKlingV4ReleaseBlocked(engineId)) {
    throw new Error('KLING_V4_NOT_QUALIFIED: reviewed customer tariffs and App/Studio/MCP release qualification are required.');
  }
}
