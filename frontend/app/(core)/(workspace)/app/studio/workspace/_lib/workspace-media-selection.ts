import { authFetch } from '@/lib/authFetch';
import { workspaceLibraryAssetFromLibraryAsset, type WorkspaceLibraryAsset } from './workspace-library-assets';

/** Validate connected refs at the moment of acceptance, ignoring browser URLs/facts. */
export async function resolveWorkspaceMediaSelection(assets: WorkspaceLibraryAsset[], signal?: AbortSignal): Promise<WorkspaceLibraryAsset[]> {
  if (!assets.length || assets.some((asset) => !asset.ref)) throw new Error('MEDIA_REFERENCE_REQUIRED');
  const response = await authFetch('/api/studio/media/resolve', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
    body: JSON.stringify({ refs: assets.map((asset) => asset.ref) }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok || payload.assets?.length !== assets.length) throw new Error('MEDIA_NOT_AVAILABLE');
  return payload.assets.map((value: unknown, index: number) => {
    const resolved = workspaceLibraryAssetFromLibraryAsset(value, null);
    if (!resolved || JSON.stringify(resolved.ref) !== JSON.stringify(assets[index].ref)) throw new Error('MEDIA_NOT_AVAILABLE');
    return { ...resolved, id: assets[index].id, name: assets[index].origin ? assets[index].name : resolved.name, origin: assets[index].origin };
  });
}
