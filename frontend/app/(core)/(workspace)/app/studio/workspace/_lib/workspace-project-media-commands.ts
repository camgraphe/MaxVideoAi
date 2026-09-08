import type { WorkspaceAssetRecord } from './workspace-types';

export function mergeProjectMedia(current: WorkspaceAssetRecord[], incoming: WorkspaceAssetRecord[]) {
  const result = [...current];
  for (const asset of incoming) {
    const key = asset.ref ? JSON.stringify(asset.ref) : null;
    const index = result.findIndex((candidate) => candidate.id === asset.id || (key && JSON.stringify(candidate.ref) === key));
    if (index < 0) result.unshift(asset);
    else {
      const previous = result[index];
      const defined = Object.fromEntries(Object.entries(asset).filter(([, value]) => value !== undefined));
      result[index] = { ...previous, ...defined, id: previous.id, filename: previous.filename, folderId: previous.folderId };
    }
  }
  return result;
}

export type ProjectMediaUndo = { before: WorkspaceAssetRecord[]; affectedIds: string[] };
export function projectMediaUndoEntry(before: WorkspaceAssetRecord[], after: WorkspaceAssetRecord[]): ProjectMediaUndo {
  const previous = new Map(before.map((asset) => [asset.id, asset]));
  const next = new Map(after.map((asset) => [asset.id, asset]));
  const affectedIds = [...new Set([...previous.keys(), ...next.keys()])].filter((id) => previous.get(id) !== next.get(id));
  return { before: before.filter((asset) => affectedIds.includes(asset.id)), affectedIds };
}
export function undoProjectMedia(current: WorkspaceAssetRecord[], entry: ProjectMediaUndo) {
  return [...entry.before, ...current.filter((asset) => !entry.affectedIds.includes(asset.id))];
}
