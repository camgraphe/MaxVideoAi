import type { WorkspaceAssetRecord, WorkspaceGraphNode } from './workspace-types';
import { resolveWorkspaceAudioProvenance } from './workspace-audio-provenance';

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
  const audioProvenance = resolveWorkspaceAudioProvenance(output);
  const measuredDurationSec = output.sourceMetadata?.measurementStatus === 'measured'
    ? output.sourceMetadata.durationSec ?? undefined
    : undefined;
  const measuredDimensions = output.sourceMetadata?.measurementStatus === 'measured'
    && output.sourceMetadata.width
    && output.sourceMetadata.height
    ? `${output.sourceMetadata.width}x${output.sourceMetadata.height}`
    : undefined;
  return {
    id: generatedNodeProjectAssetId(node.id),
    kind,
    filename: `${node.data.title || 'Generated output'}.${generatedAssetExtension(kind)}`,
    subtitle: [output.modelLabel, measuredDurationSec ? `${measuredDurationSec}s` : null, measuredDimensions]
      .filter(Boolean)
      .join(' • '),
    url: output.url,
    folderId: output.projectMediaFolderId ?? null,
    audioUrl: output.kind === 'video' ? output.audioUrl ?? undefined : undefined,
    thumbUrl: output.thumbUrl ?? undefined,
    hasAudio: output.kind === 'video'
      ? audioProvenance === 'unknown'
        ? undefined
        : audioProvenance === 'embedded' || audioProvenance === 'external'
      : undefined,
    audioProvenance: output.kind === 'video' ? audioProvenance : undefined,
    durationSec: measuredDurationSec,
    dimensions: measuredDimensions,
  };
}

export function upsertWorkspaceProjectAsset(
  assets: WorkspaceAssetRecord[],
  asset: WorkspaceAssetRecord
): WorkspaceAssetRecord[] {
  const existing = assets.find((candidate) => candidate.id === asset.id);
  const resolvedAsset = existing && asset.folderId == null && existing.folderId != null
    ? { ...asset, folderId: existing.folderId }
    : asset;
  const next = [resolvedAsset, ...assets.filter((candidate) => candidate.id !== asset.id)];
  if (!asset.id.startsWith('asset-output-')) return next;
  const generated = next
    .filter((candidate) => candidate.id.startsWith('asset-output-'))
    .sort((left, right) => left.id.localeCompare(right.id));
  const other = next.filter((candidate) => !candidate.id.startsWith('asset-output-'));
  return [...generated, ...other];
}
