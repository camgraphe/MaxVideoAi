import { createHash, randomUUID } from 'node:crypto';

import {
  parseCreateStudioMontageInput,
  STUDIO_MONTAGE_COMMAND_KIND,
  STUDIO_MONTAGE_COMMAND_VERSION,
  type CreateStudioMontageInput,
} from '@/lib/studio/montage-contract';
import { buildMontageEditPlan } from '@/server/agent-api/montage-plan';
import type { StudioResolvedMedia } from './media-resolver';
import { resolveStudioMedia } from './media-resolver';
import { assertStudioConnectedSchemaReady } from './connected-schema';
import { withDbTransaction, type QueryExecutor } from '@/lib/db';
import { buildWorkspaceTimelineItemsForAsset } from '@/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-builders';
import { buildWorkspaceClipComposition } from '@/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-clip-composition';
import { workspaceProjectDimensions } from '@/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-project-settings';
import { projectAssetTimelineNodeId } from '@/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-drops';
import type {
  WorkspaceAssetRecord,
  WorkspaceTimelineItem,
} from '@/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';
import {
  createWorkspaceSequenceRecord,
  type PersistedWorkspaceState,
  type WorkspaceSequenceRecord,
} from '@/app/(core)/(workspace)/app/studio/workspace/_state/workspace-state';

export type StudioMontageProjectState = {
  workspaceState: PersistedWorkspaceState;
  sequence: WorkspaceSequenceRecord;
};

export type StudioConnectedPersistenceErrorCode =
  | 'STUDIO_MONTAGE_CREATION_DISABLED'
  | 'STUDIO_IDEMPOTENCY_CONFLICT'
  | 'STUDIO_MONTAGE_PROJECT_GONE'
  | 'STUDIO_REVISION_CONFLICT'
  | 'STUDIO_CONNECTED_PROJECT_REQUIRED'
  | 'STUDIO_CONNECTED_PROJECT_REVISION_REQUIRED';

export class StudioConnectedPersistenceError extends Error {
  constructor(public readonly code: StudioConnectedPersistenceErrorCode, public readonly status: number) {
    super(code);
    this.name = 'StudioConnectedPersistenceError';
  }
}

export type StudioMontageTransactionStage = 'project' | 'sequence' | 'receipt';

export type CreateStudioMontageResult = {
  schemaVersion: 1;
  status: 'studio_project';
  persisted: true;
  title: string;
  projectId: string;
  sequenceId: string;
  revision: number;
  studioUrl: string;
  clipCount: number;
  totalFrames: number;
  totalSeconds: number;
  orderingBasis: 'caller_supplied';
};

type TransactionRunner = <T>(callback: (executor: QueryExecutor) => Promise<T>) => Promise<T>;

type CreateStudioMontageDependencies = {
  withTransaction?: TransactionRunner;
  featureEnabled?: boolean;
  createIds?: typeof createStudioMontageIds;
  now?: () => Date;
  afterStage?: (stage: StudioMontageTransactionStage) => void;
};

const defaultTransactionRunner: TransactionRunner = (callback) => withDbTransaction((executor) => callback(executor));

export type StudioMontageResolvedVideo = Omit<StudioResolvedMedia, 'ref' | 'kind'> & {
  ref: Extract<StudioResolvedMedia['ref'], { type: 'asset' }>;
  kind: 'video';
};

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function canonicalStudioMontageRequestHash(input: CreateStudioMontageInput): string {
  const parsed = parseCreateStudioMontageInput(input);
  return createHash('sha256').update(canonicalJson({
    command: STUDIO_MONTAGE_COMMAND_KIND,
    version: STUDIO_MONTAGE_COMMAND_VERSION,
    title: parsed.title,
    settings: parsed.settings,
    clips: parsed.clips,
  })).digest('hex');
}

function projectAssetForResolvedMedia(asset: StudioMontageResolvedVideo): WorkspaceAssetRecord {
  const durationSec = asset.mediaFacts?.durationSec;
  const width = asset.mediaFacts?.width;
  const height = asset.mediaFacts?.height;
  const hasAudio = asset.mediaFacts?.hasAudio;
  return {
    id: `studio-media-${asset.ref.assetId}`,
    ref: asset.ref,
    mediaFacts: asset.mediaFacts,
    mediaAccessRequired: true,
    kind: 'video',
    filename: asset.originalName ?? 'Video clip',
    subtitle: 'Video',
    url: asset.url,
    thumbUrl: asset.thumbUrl ?? undefined,
    previewUrl: asset.previewUrl ?? undefined,
    mimeType: asset.mime,
    durationSec,
    width,
    height,
    dimensions: width && height ? `${width}x${height}` : undefined,
    hasAudio,
    audioProvenance: hasAudio === true ? 'embedded' : hasAudio === false ? 'none' : 'unknown',
  };
}

export function buildStudioMontageProjectState(params: {
  input: CreateStudioMontageInput;
  assets: readonly StudioMontageResolvedVideo[];
  projectId: string;
  sequenceId: string;
  now?: string;
}): StudioMontageProjectState {
  const input = parseCreateStudioMontageInput(params.input);
  const plan = buildMontageEditPlan(input, params.assets.map((asset) => ({
    assetId: asset.ref.assetId,
    mediaKind: 'video' as const,
    storageUrl: asset.url,
    width: asset.mediaFacts?.width ?? null,
    height: asset.mediaFacts?.height ?? null,
    durationSec: asset.mediaFacts?.durationSec ?? null,
    mimeType: asset.mime,
    originalName: asset.originalName,
  })));
  const projectAssetsByCanonicalId = new Map<string, WorkspaceAssetRecord>();
  params.assets.forEach((asset) => {
    if (!projectAssetsByCanonicalId.has(asset.ref.assetId)) {
      projectAssetsByCanonicalId.set(asset.ref.assetId, projectAssetForResolvedMedia(asset));
    }
  });
  const projectAssets = Array.from(projectAssetsByCanonicalId.values());
  const projectSettings = {
    fps: input.settings.fps,
    aspectRatio: input.settings.aspectRatio,
    resolution: input.settings.resolution,
  };
  const programDimensions = workspaceProjectDimensions(projectSettings);
  const timelineItems: WorkspaceTimelineItem[] = plan.clips.map((clip, index) => {
    const projectAsset = projectAssetsByCanonicalId.get(clip.assetId);
    if (!projectAsset) throw new Error('Every montage clip must resolve to owned media.');
    const [draft] = buildWorkspaceTimelineItemsForAsset({
      assetNodeId: projectAssetTimelineNodeId(projectAsset),
      title: projectAsset.filename,
      asset: projectAsset,
      startSec: clip.timelineStartFrame / input.settings.fps,
      idSeed: `montage-${index + 1}`,
    });
    if (!draft || draft.mediaKind !== 'video') throw new Error('Every montage clip must resolve to owned video media.');
    const sourceWidth = projectAsset.mediaFacts?.width;
    const sourceHeight = projectAsset.mediaFacts?.height;
    const transform = sourceWidth && sourceHeight
      ? {
        opacity: 1,
        positionX: 0,
        positionY: 0,
        rotation: 0,
        scale: buildWorkspaceClipComposition({
          sequenceHeight: programDimensions.height,
          sequenceWidth: programDimensions.width,
          sourceHeight,
          sourceWidth,
          transform: { opacity: 1, rotation: 0, scale: 1, x: 0, y: 0 },
        }).fitScale,
      }
      : undefined;
    return {
      ...draft,
      id: `montage-clip-${String(index + 1).padStart(2, '0')}`,
      mediaAccessRequired: true,
      linkedGroupId: null,
      linkedGroupKind: null,
      startSec: clip.timelineStartFrame / input.settings.fps,
      sourceStartSec: clip.sourceInFrame / input.settings.fps,
      durationSec: clip.durationFrames / input.settings.fps,
      sourceDurationSec: projectAsset.mediaFacts?.durationSec,
      transform,
      audioMix: { volume: 100, muted: input.settings.audioMode === 'mute' },
      montageSource: {
        commandKind: STUDIO_MONTAGE_COMMAND_KIND,
        commandVersion: STUDIO_MONTAGE_COMMAND_VERSION,
        orderIndex: index,
        assetId: clip.assetId,
        sourceInFrame: clip.sourceInFrame,
        durationFrames: clip.durationFrames,
        fps: input.settings.fps,
      },
    };
  });
  const now = params.now ?? new Date().toISOString();
  const sequence = createWorkspaceSequenceRecord({
    id: params.sequenceId,
    name: 'Main sequence',
    timelineItems,
    projectSettings,
    createdAt: now,
    updatedAt: now,
  });
  return {
    sequence,
    workspaceState: {
      nodes: [],
      edges: [],
      projectAssets,
      projectMediaFolders: [],
      timelineItems: [],
      sequences: [],
      activeSequenceId: params.sequenceId,
      activeTemplateId: 'minimal-start',
      projectSettings,
      focusMode: 'viewer',
      audioTrackCount: sequence.audioTrackCount,
      hiddenVideoTracks: [],
      lockedTimelineTracks: [],
      mutedAudioTracks: [],
      videoTrackCount: sequence.videoTrackCount,
      timelinePanelHeight: null,
      timelineInPointSec: null,
      timelineOutPointSec: null,
    },
  };
}

export function createStudioMontageIds(): { projectId: string; sequenceId: string } {
  return { projectId: `project_${randomUUID()}`, sequenceId: `sequence_${randomUUID()}` };
}

function timelineStateForSequence(sequence: WorkspaceSequenceRecord): Record<string, unknown> {
  return {
    timelineItems: sequence.timelineItems,
    audioTrackCount: sequence.audioTrackCount,
    hiddenVideoTracks: sequence.hiddenVideoTracks,
    lockedTimelineTracks: sequence.lockedTimelineTracks,
    mutedAudioTracks: sequence.mutedAudioTracks,
    videoTrackCount: sequence.videoTrackCount,
    timelinePanelHeight: sequence.timelinePanelHeight,
    timelineInPointSec: sequence.timelineInPointSec,
    timelineOutPointSec: sequence.timelineOutPointSec,
  };
}

function safeCreateResult(params: {
  input: CreateStudioMontageInput;
  projectId: string;
  sequenceId: string;
  revision: number;
}): CreateStudioMontageResult {
  const totalFrames = params.input.clips.reduce((total, clip) => total + clip.durationFrames, 0);
  return {
    schemaVersion: 1,
    status: 'studio_project',
    persisted: true,
    title: params.input.title,
    projectId: params.projectId,
    sequenceId: params.sequenceId,
    revision: params.revision,
    studioUrl: `/app/studio/workspace/${encodeURIComponent(params.projectId)}`,
    clipCount: params.input.clips.length,
    totalFrames,
    totalSeconds: totalFrames / params.input.settings.fps,
    orderingBasis: 'caller_supplied',
  };
}

export async function createStudioMontageProject(
  actor: { userId: string },
  rawInput: unknown,
  dependencies: CreateStudioMontageDependencies = {},
): Promise<CreateStudioMontageResult> {
  if (dependencies.featureEnabled !== true) {
    throw new StudioConnectedPersistenceError('STUDIO_MONTAGE_CREATION_DISABLED', 404);
  }
  if (!actor.userId || actor.userId !== actor.userId.trim() || actor.userId.length > 128) {
    throw new Error('UNAUTHORIZED');
  }
  const input = parseCreateStudioMontageInput(rawInput);
  const requestHash = canonicalStudioMontageRequestHash(input);
  const ids = (dependencies.createIds ?? createStudioMontageIds)();
  const now = (dependencies.now ?? (() => new Date()))().toISOString();
  const runTransaction = dependencies.withTransaction ?? defaultTransactionRunner;

  return runTransaction(async (executor) => {
    await assertStudioConnectedSchemaReady(executor);
    const receiptScope = `${actor.userId}|${STUDIO_MONTAGE_COMMAND_KIND}|${STUDIO_MONTAGE_COMMAND_VERSION}|${input.idempotencyKey}`;
    await executor.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [receiptScope]);
    const receipts = await executor.query<{
      request_hash: string;
      project_id: string;
      sequence_id: string;
      safe_result: CreateStudioMontageResult;
      revision: string | number | null;
      deleted_at: string | null;
    }>(`
      SELECT command.request_hash, command.project_id, command.sequence_id, command.safe_result,
             project.revision, project.deleted_at
        FROM studio_project_commands command
        LEFT JOIN studio_projects project
          ON project.id = command.project_id AND project.user_id = command.user_id
       WHERE command.user_id = $1 AND command.command_kind = $2
         AND command.command_version = $3 AND command.idempotency_key = $4
       LIMIT 1
    `, [actor.userId, STUDIO_MONTAGE_COMMAND_KIND, STUDIO_MONTAGE_COMMAND_VERSION, input.idempotencyKey]);
    const receipt = receipts[0];
    if (receipt) {
      if (receipt.request_hash !== requestHash) {
        throw new StudioConnectedPersistenceError('STUDIO_IDEMPOTENCY_CONFLICT', 409);
      }
      if (receipt.revision === null || receipt.deleted_at !== null) {
        throw new StudioConnectedPersistenceError('STUDIO_MONTAGE_PROJECT_GONE', 410);
      }
      return { ...receipt.safe_result, revision: Number(receipt.revision) };
    }

    const resolvedById = new Map<string, StudioMontageResolvedVideo>();
    for (const clip of input.clips) {
      if (resolvedById.has(clip.assetId)) continue;
      const resolved = await resolveStudioMedia(
        actor.userId,
        { type: 'asset', assetId: clip.assetId, kind: 'video' },
        async (sql, values) => executor.query(sql, values),
        { lockAsset: true },
      );
      if (resolved.ref.type !== 'asset' || resolved.kind !== 'video') throw new Error('MEDIA_NOT_AVAILABLE');
      resolvedById.set(clip.assetId, resolved as StudioMontageResolvedVideo);
    }
    const assets = input.clips.map((clip) => resolvedById.get(clip.assetId));
    if (assets.some((asset) => !asset)) throw new Error('MEDIA_NOT_AVAILABLE');
    const state = buildStudioMontageProjectState({
      input,
      assets: assets as StudioMontageResolvedVideo[],
      projectId: ids.projectId,
      sequenceId: ids.sequenceId,
      now,
    });
    const result = safeCreateResult({ input, ...ids, revision: 0 });

    await executor.query(`
      INSERT INTO studio_projects (
        id, user_id, name, canvas_template_id, settings, workspace_state, revision, persistence_mode
      ) VALUES ($1, $2, $3, 'minimal-start', $4::jsonb, $5::jsonb, 0, 'connected')
    `, [ids.projectId, actor.userId, input.title, JSON.stringify(state.sequence.projectSettings), JSON.stringify(state.workspaceState)]);
    dependencies.afterStage?.('project');
    await executor.query(`
      INSERT INTO studio_sequences (id, user_id, project_id, name, settings, timeline_state)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
    `, [
      ids.sequenceId,
      actor.userId,
      ids.projectId,
      state.sequence.name,
      JSON.stringify(state.sequence.projectSettings),
      JSON.stringify(timelineStateForSequence(state.sequence)),
    ]);
    dependencies.afterStage?.('sequence');
    await executor.query(`
      INSERT INTO studio_project_commands (
        user_id, command_kind, command_version, idempotency_key, request_hash,
        project_id, sequence_id, request_payload, safe_result
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb)
    `, [
      actor.userId,
      STUDIO_MONTAGE_COMMAND_KIND,
      STUDIO_MONTAGE_COMMAND_VERSION,
      input.idempotencyKey,
      requestHash,
      ids.projectId,
      ids.sequenceId,
      JSON.stringify(input),
      JSON.stringify(result),
    ]);
    dependencies.afterStage?.('receipt');
    return result;
  });
}
