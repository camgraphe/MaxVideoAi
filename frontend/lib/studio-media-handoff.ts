import { toolAssetRefSchema, type ToolAssetRef } from '@/lib/toolbox/contract';

export const STUDIO_MEDIA_HANDOFF_KEY = 'maxvideoai:studio-media-handoff:v1';
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type StudioMediaHandoff = { ref: ToolAssetRef; intent: 'project' };

/** Producer interface: the user chooses a project and confirms the supported destination in Studio. */
export function stageStudioMediaHandoff(storage: StorageLike, account: string, handoff: StudioMediaHandoff, token: string, now = Date.now()) {
  const ref = toolAssetRefSchema.parse(handoff.ref);
  if (!account || !token || token.length > 256 || handoff.intent !== 'project') throw new Error('Invalid Studio handoff');
  storage.setItem(STUDIO_MEDIA_HANDOFF_KEY, JSON.stringify({ account, ref, intent: handoff.intent, token, createdAt: now }));
  return `/app/studio/projects?studioMedia=${encodeURIComponent(token)}`;
}

export function consumeStudioMediaHandoff(storage: StorageLike, account: string, token: string, now = Date.now()): StudioMediaHandoff | null {
  const raw = storage.getItem(STUDIO_MEDIA_HANDOFF_KEY);
  if (!raw) return null;
  storage.removeItem(STUDIO_MEDIA_HANDOFF_KEY);
  try {
    if (raw.length > 4000) return null;
    const value = JSON.parse(raw);
    const parsed = toolAssetRefSchema.safeParse(value.ref);
    if (!parsed.success || value.account !== account || value.token !== token || value.intent !== 'project' || typeof value.createdAt !== 'number' || now < value.createdAt || now - value.createdAt > 600_000) return null;
    return { ref: parsed.data, intent: 'project' };
  } catch { return null; }
}

export function studioProjectWithMediaHandoff(projectId: string, search: string) {
  const token = new URLSearchParams(search).get('studioMedia');
  return `/app/studio/workspace/${encodeURIComponent(projectId)}${token ? `?studioMedia=${encodeURIComponent(token)}` : ''}`;
}
