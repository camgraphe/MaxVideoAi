import type { WorkspaceAssetRecord, WorkspaceGraphNode } from './workspace-types';

export function generatedNodeProjectAssetId(nodeId: string): string {
  return `asset-${nodeId}`;
}

export function synchronizeGeneratedOutputNodeProjectMediaFolder(
  nodes: WorkspaceGraphNode[],
  assetId: string,
  folderId: string | null
): WorkspaceGraphNode[] {
  return nodes.map((node) => {
    if (
      node.data.kind !== 'output' ||
      !node.data.output ||
      generatedNodeProjectAssetId(node.id) !== assetId
    ) return node;

    return {
      ...node,
      data: {
        ...node.data,
        output: {
          ...node.data.output,
          projectMediaFolderId: folderId,
        },
      },
    };
  });
}

function generatedAssetExtension(kind: WorkspaceAssetRecord['kind']): string {
  if (kind === 'video') return 'mp4';
  if (kind === 'audio') return 'mp3';
  if (kind === 'image' || kind === 'logo') return 'png';
  return 'txt';
}

export function workspaceAssetFromOutputNode(node: WorkspaceGraphNode): WorkspaceAssetRecord | null {
  const output = node.data.output;
  if (!output || output.status !== 'ready' || !output.url) return null;

  const kind: WorkspaceAssetRecord['kind'] = output.kind;
  return {
    id: generatedNodeProjectAssetId(node.id),
    kind,
    filename: `${node.data.title || 'Generated output'}.${generatedAssetExtension(kind)}`,
    subtitle: [output.modelLabel, output.durationSec ? `${output.durationSec}s` : null, output.aspectRatio]
      .filter(Boolean)
      .join(' • '),
    url: output.url,
    folderId: output.projectMediaFolderId ?? null,
    audioUrl: output.kind === 'video' ? output.audioUrl ?? undefined : undefined,
    thumbUrl: output.thumbUrl ?? undefined,
    hasAudio: output.kind === 'video' ? output.hasAudio ?? Boolean(output.audioUrl) : undefined,
    durationSec: output.durationSec,
    dimensions: output.resolution && output.aspectRatio ? `${output.resolution} • ${output.aspectRatio}` : undefined,
  };
}

export function upsertWorkspaceProjectAsset(
  assets: WorkspaceAssetRecord[],
  asset: WorkspaceAssetRecord
): WorkspaceAssetRecord[] {
  return [asset, ...assets.filter((candidate) => candidate.id !== asset.id)].slice(0, 120);
}
