import { readOwnedLibraryAssetsByIds } from '@/server/media-library/assets';
import type { MediaAssetRecord } from '@/server/media-library-records';
import { ownedMediaStorageKeyForUrl } from '@/server/storage';
import { readStudioProject, readStudioSequence } from '@/server/studio/repository';
import {
  buildWorkspaceTimelineRenderManifest,
  type WorkspaceTimelineRenderManifest,
} from '../../../app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-render';
import type {
  WorkspaceAssetRecord,
  WorkspaceGraphNode,
  WorkspaceProjectSettings,
  WorkspaceTimelineItem,
} from '../../../app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';
import type { WorkspaceTimelineVideoExportRequest } from '../../../app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-export';
import { normalizeWorkspaceTimelineSourceMetadata } from '../../../app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-source-metadata';
import { parseTimelineExportManifest } from './render-request';
import { validateTimelineExportManifestMediaUrls } from './media-security';
import { timelineExportManifestHash } from './estimate-token';

type PersistedWorkspaceState = {
  nodes?: unknown;
  projectAssets?: unknown;
};

type PersistedTimelineState = {
  timelineItems?: unknown;
};

type StudioProjectRecord = NonNullable<Awaited<ReturnType<typeof readStudioProject>>>;
type StudioSequenceRecord = NonNullable<Awaited<ReturnType<typeof readStudioSequence>>>;

export type TimelineExportResolverDependencies = {
  readStudioProject: (params: { userId: string; projectId: string }) => Promise<StudioProjectRecord | null>;
  readStudioSequence: (params: {
    userId: string;
    projectId: string;
    sequenceId: string;
  }) => Promise<StudioSequenceRecord | null>;
  readOwnedLibraryAssetsByIds: (params: {
    userId: string;
    assetIds: readonly string[];
  }) => Promise<MediaAssetRecord[]>;
  isOwnedStorageUrl: (params: { url: string; userId: string; projectId: string }) => boolean;
  validateManifestMediaUrls: typeof validateTimelineExportManifestMediaUrls;
};

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function persistedProjectAssets(value: unknown): WorkspaceAssetRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    const asset = objectRecord(candidate);
    if (!asset || typeof asset.id !== 'string' || typeof asset.kind !== 'string') return [];
    if (!['image', 'video', 'audio', 'logo', 'text'].includes(asset.kind)) return [];
    return [{
      ...asset,
      id: asset.id,
      kind: asset.kind,
      filename: typeof asset.filename === 'string' ? asset.filename : asset.id,
      subtitle: typeof asset.subtitle === 'string' ? asset.subtitle : '',
    } as WorkspaceAssetRecord];
  }).slice(0, 200);
}

function persistedGraphNodes(value: unknown): WorkspaceGraphNode[] {
  if (!Array.isArray(value)) return [];
  return value.filter((candidate): candidate is WorkspaceGraphNode => {
    const node = objectRecord(candidate);
    return Boolean(node && typeof node.id === 'string' && objectRecord(node.data));
  }).slice(0, 500);
}

function persistedTimelineItems(value: unknown): WorkspaceTimelineItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    const item = objectRecord(candidate);
    if (
      !item
      || typeof item.id !== 'string'
      || typeof item.outputNodeId !== 'string'
      || typeof item.track !== 'string'
      || typeof item.title !== 'string'
      || !finiteNumber(item.durationSec)
      || item.durationSec <= 0
      || !finiteNumber(item.startSec)
      || item.startSec < 0
    ) return [];
    return [normalizeWorkspaceTimelineSourceMetadata(item as WorkspaceTimelineItem)];
  }).slice(0, 200);
}

function projectSettings(value: unknown): WorkspaceProjectSettings | undefined {
  const settings = objectRecord(value);
  if (!settings) return undefined;
  if (!['16:9', '9:16', '1:1', '4:5', '21:9'].includes(String(settings.aspectRatio))) return undefined;
  if (!['720p', '1080p', '1440p', '4k'].includes(String(settings.resolution))) return undefined;
  if (![24, 25, 30, 60].includes(Number(settings.fps))) return undefined;
  return settings as WorkspaceProjectSettings;
}

function mediaKindForItem(item: WorkspaceTimelineItem): 'video' | 'audio' | 'image' {
  if (item.mediaKind === 'audio' || item.mediaKind === 'image') return item.mediaKind;
  return item.track.startsWith('audio') ? 'audio' : 'video';
}

function dedicatedAudioUrlForProjectAsset(asset: WorkspaceAssetRecord | undefined): string | null {
  return asset?.audioUrl ?? (asset?.kind === 'audio' ? asset.url ?? null : null);
}

function dedicatedAudioUrlForNode(node: WorkspaceGraphNode | undefined): string | null {
  if (node?.data.output?.kind === 'audio') return node.data.output.audioUrl ?? node.data.output.url ?? null;
  if (node?.data.asset?.kind === 'audio') return node.data.asset.audioUrl ?? node.data.asset.url ?? null;
  return node?.data.output?.audioUrl ?? node?.data.asset?.audioUrl ?? null;
}

function primarySourceUrlForProjectAsset(asset: WorkspaceAssetRecord, item: WorkspaceTimelineItem): string | null {
  const kind = mediaKindForItem(item);
  if (kind === 'image') return asset.url ?? asset.thumbUrl ?? null;
  return asset.url ?? null;
}

function primarySourceUrlForNode(node: WorkspaceGraphNode | undefined, item: WorkspaceTimelineItem): string | null {
  const kind = mediaKindForItem(item);
  if (kind === 'image') {
    return node?.data.output?.url ?? node?.data.output?.thumbUrl ?? node?.data.asset?.url ?? node?.data.asset?.thumbUrl ?? null;
  }
  return node?.data.output?.url ?? node?.data.asset?.url ?? null;
}

function ownedLibrarySourceUrl(asset: MediaAssetRecord | undefined, item: WorkspaceTimelineItem): string | null {
  if (!asset) return null;
  const kind = mediaKindForItem(item);
  if (kind === 'audio') {
    if (asset.kind === 'audio') return asset.url;
    return asset.kind === 'video' && item.audioProvenance === 'embedded' ? asset.url : null;
  }
  if (kind === 'image') return asset.kind === 'image' ? asset.url : null;
  return asset.kind === 'video' ? asset.url : null;
}

function isOwnedStorageUrl(params: { url: string; userId: string; projectId: string }): boolean {
  return Boolean(ownedMediaStorageKeyForUrl({ url: params.url, userId: params.userId }));
}

function ownedLegacySourceUrl(params: {
  candidates: Array<string | null | undefined>;
  userId: string;
  projectId: string;
  dependencies: TimelineExportResolverDependencies;
}): string | null {
  for (const candidate of params.candidates) {
    if (!candidate) continue;
    if (params.dependencies.isOwnedStorageUrl({
      url: candidate,
      userId: params.userId,
      projectId: params.projectId,
    })) return candidate;
  }
  return null;
}

function manifestIntent(manifest: WorkspaceTimelineRenderManifest): unknown {
  return {
    sequenceId: manifest.sequenceId,
    projectSettings: manifest.projectSettings ?? null,
    durationSec: manifest.durationSec,
    exportRange: manifest.exportRange,
    tracks: manifest.tracks.map((track) => ({
      id: track.id,
      durationSec: track.durationSec,
      clips: track.clips.map((clip) => ({
        id: clip.id,
        assetId: clip.assetId ?? null,
        outputNodeId: clip.outputNodeId,
        track: clip.track,
        mediaKind: clip.mediaKind,
        startSec: clip.startSec,
        endSec: clip.endSec,
        durationSec: clip.durationSec,
        sourceStartSec: clip.sourceStartSec,
        sourceEndSec: clip.sourceEndSec,
        sourceDurationSec: clip.sourceDurationSec,
        linkedGroupId: clip.linkedGroupId ?? null,
        hasEmbeddedAudio: clip.hasEmbeddedAudio ?? null,
        audioProvenance: clip.audioProvenance ?? null,
        transform: clip.transform ?? null,
        audioMix: clip.audioMix ?? null,
        transitionOut: clip.transitionOut ?? null,
      })),
    })),
  };
}

export async function resolveOwnedTimelineExportRequestWithDependencies(params: {
  userId: string;
  request: WorkspaceTimelineVideoExportRequest;
  requestOrigin: string;
  fetchImpl?: typeof fetch;
}, dependencies: TimelineExportResolverDependencies): Promise<WorkspaceTimelineVideoExportRequest> {
  const [project, sequence] = await Promise.all([
    dependencies.readStudioProject({ userId: params.userId, projectId: params.request.projectId }),
    dependencies.readStudioSequence({
      userId: params.userId,
      projectId: params.request.projectId,
      sequenceId: params.request.manifest.sequenceId,
    }),
  ]);
  if (!project) throw new Error('STUDIO_PROJECT_NOT_FOUND');
  if (!sequence) throw new Error('STUDIO_SEQUENCE_NOT_FOUND');

  const workspaceState = (objectRecord(project.workspaceState) ?? {}) as PersistedWorkspaceState;
  const timelineState = (objectRecord(sequence.timelineState) ?? {}) as PersistedTimelineState;
  const projectAssets = persistedProjectAssets(workspaceState.projectAssets);
  const projectAssetsById = new Map(projectAssets.map((asset) => [asset.id, asset]));
  const nodes = persistedGraphNodes(workspaceState.nodes);
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const timelineItems = persistedTimelineItems(timelineState.timelineItems);
  if (!timelineItems.length) throw new Error('EXPORT_SEQUENCE_NOT_PERSISTED');

  const resolvedItems = timelineItems.map((item) => ({
    ...item,
    assetId: item.assetId?.trim() || `asset-${item.outputNodeId}`,
  }));
  const ownedLibraryAssets = await dependencies.readOwnedLibraryAssetsByIds({
    userId: params.userId,
    assetIds: resolvedItems.map((item) => item.assetId).filter((assetId): assetId is string => Boolean(assetId)),
  });
  const ownedLibraryAssetsById = new Map(ownedLibraryAssets.map((asset) => [asset.id, asset]));

  const canonicalItems = resolvedItems.map((item) => {
    const ownedLibraryAssetCandidate = item.assetId ? ownedLibraryAssetsById.get(item.assetId) : undefined;
    const ownedLibraryAsset = ownedLibraryAssetCandidate
      && ownedLibraryAssetCandidate.userId === params.userId
      && dependencies.isOwnedStorageUrl({
        url: ownedLibraryAssetCandidate.url,
        userId: params.userId,
        projectId: project.id,
      })
      ? ownedLibraryAssetCandidate
      : undefined;
    const projectAsset = item.assetId ? projectAssetsById.get(item.assetId) : undefined;
    const node = nodesById.get(item.outputNodeId);
    const kind = mediaKindForItem(item);
    const dedicatedAudioUrl = kind === 'audio'
      ? ownedLegacySourceUrl({
          candidates: [
            dedicatedAudioUrlForProjectAsset(projectAsset),
            dedicatedAudioUrlForNode(node),
            item.audioProvenance === 'external' ? item.mediaUrl : null,
          ],
          userId: params.userId,
          projectId: project.id,
          dependencies,
        })
      : null;
    const sourceUrl = dedicatedAudioUrl
      ?? ownedLibrarySourceUrl(ownedLibraryAsset, item)
      ?? ownedLegacySourceUrl({
        candidates: [
          projectAsset ? primarySourceUrlForProjectAsset(projectAsset, item) : null,
          primarySourceUrlForNode(node, item),
          item.mediaUrl,
        ],
        userId: params.userId,
        projectId: project.id,
        dependencies,
      });
    if (!sourceUrl) throw new Error('EXPORT_MEDIA_NOT_OWNED');
    return {
      ...item,
      mediaUrl: sourceUrl,
      sourceWidth: sourceUrl === ownedLibraryAsset?.url ? ownedLibraryAsset.width ?? item.sourceWidth ?? undefined : item.sourceWidth,
      sourceHeight: sourceUrl === ownedLibraryAsset?.url ? ownedLibraryAsset.height ?? item.sourceHeight ?? undefined : item.sourceHeight,
      sourceDurationSec: sourceUrl === ownedLibraryAsset?.url
        ? ownedLibraryAsset.durationSec ?? item.sourceDurationSec ?? undefined
        : item.sourceDurationSec,
    };
  });

  const manifest = buildWorkspaceTimelineRenderManifest({
    items: canonicalItems,
    nodes,
    projectName: project.name,
    sequenceId: sequence.id,
    sequenceName: sequence.name,
    projectSettings: projectSettings(sequence.settings),
    createdAt: params.request.manifest.createdAt,
    exportRange: params.request.manifest.exportRange,
  });
  const canonicalManifest = parseTimelineExportManifest(manifest);
  if (timelineExportManifestHash(manifestIntent(canonicalManifest)) !== timelineExportManifestHash(manifestIntent(params.request.manifest))) {
    throw new Error('EXPORT_PROJECT_STATE_STALE');
  }
  const validatedManifest = parseTimelineExportManifest(await dependencies.validateManifestMediaUrls({
    manifest: canonicalManifest,
    requestOrigin: params.requestOrigin,
    fetchImpl: params.fetchImpl,
  }));
  return {
    ...params.request,
    projectId: project.id,
    status: validatedManifest.status,
    manifest: validatedManifest,
  };
}

const resolverDependencies: TimelineExportResolverDependencies = {
  readStudioProject,
  readStudioSequence,
  readOwnedLibraryAssetsByIds,
  isOwnedStorageUrl,
  validateManifestMediaUrls: validateTimelineExportManifestMediaUrls,
};

export async function resolveOwnedTimelineExportRequest(params: {
  userId: string;
  request: WorkspaceTimelineVideoExportRequest;
  requestOrigin: string;
  fetchImpl?: typeof fetch;
}): Promise<WorkspaceTimelineVideoExportRequest> {
  return resolveOwnedTimelineExportRequestWithDependencies(params, resolverDependencies);
}
