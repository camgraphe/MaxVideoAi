import * as z from 'zod/v4';

import { withDbTransaction, type QueryExecutor } from '@/lib/db';
import { createSignedDownloadUrl } from '@/server/storage';
import { assertStudioConnectedSchemaReady } from './connected-schema';
import { resolveStudioMedia, type StudioResolvedMedia } from './media-resolver';

const MEDIA_ACCESS_TTL_SECONDS = 300;
const accessInputSchema = z.object({
  projectId: z.string().min(1).max(200).refine((value) => value === value.trim()),
  assetIds: z.array(z.string().regex(/^ma_[a-f0-9]{32}$/u)).min(1).max(60),
}).strict();

type TransactionRunner = <T>(callback: (executor: QueryExecutor) => Promise<T>) => Promise<T>;
type ResolveMedia = (
  userId: string,
  input: { type: 'asset'; assetId: string; kind: 'video' },
  execute: (sql: string, values: string[]) => Promise<never[]>,
) => Promise<StudioResolvedMedia>;

export type StudioMediaAccessResult = {
  projectId: string;
  assets: Array<{ assetId: string; url: string; expiresAt: string | null }>;
};

function canonicalVideoAssetIds(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values.flatMap((asset) => {
    if (!asset || typeof asset !== 'object' || Array.isArray(asset)) return [];
    const ref = (asset as Record<string, unknown>).ref;
    if (!ref || typeof ref !== 'object' || Array.isArray(ref)) return [];
    const record = ref as Record<string, unknown>;
    return record.type === 'asset' && record.kind === 'video' && typeof record.assetId === 'string'
      ? [record.assetId]
      : [];
  });
}

function projectBinAssetIds(workspaceState: unknown): string[] {
  if (!workspaceState || typeof workspaceState !== 'object' || Array.isArray(workspaceState)) return [];
  return canonicalVideoAssetIds((workspaceState as Record<string, unknown>).projectAssets);
}

function sequenceAssetIds(timelineState: unknown): string[] {
  if (!timelineState || typeof timelineState !== 'object' || Array.isArray(timelineState)) return [];
  return canonicalVideoAssetIds((timelineState as Record<string, unknown>).timelineItems);
}

export async function renewStudioProjectMediaAccess(
  actor: { userId: string },
  rawInput: unknown,
  dependencies: {
    withTransaction?: TransactionRunner;
    resolveMedia?: ResolveMedia;
    createSignedDownloadUrl?: typeof createSignedDownloadUrl;
    now?: () => Date;
  } = {},
): Promise<StudioMediaAccessResult> {
  if (!actor.userId || actor.userId !== actor.userId.trim()) throw new Error('UNAUTHORIZED');
  const parsed = accessInputSchema.safeParse(rawInput);
  if (!parsed.success) throw new Error('Invalid Studio media access input.');
  const input = parsed.data;
  const assetIds = [...new Set(input.assetIds)];
  const runTransaction = dependencies.withTransaction ?? ((callback) => withDbTransaction(callback));
  const resolveMedia = dependencies.resolveMedia ?? resolveStudioMedia;
  const sign = dependencies.createSignedDownloadUrl ?? createSignedDownloadUrl;
  const now = dependencies.now ?? (() => new Date());

  return runTransaction(async (executor) => {
    await assertStudioConnectedSchemaReady(executor);
    const projects = await executor.query<{ persistence_mode: string; workspace_state: unknown }>(`
      SELECT persistence_mode, workspace_state
        FROM studio_projects
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
       FOR SHARE
    `, [input.projectId, actor.userId]);
    const project = projects[0];
    if (!project) throw new Error('STUDIO_PROJECT_NOT_FOUND');
    if (project.persistence_mode !== 'connected') throw new Error('STUDIO_CONNECTED_PROJECT_REQUIRED');
    const sequenceRows = await executor.query<{ timeline_state: unknown }>(`
      SELECT timeline_state
        FROM studio_sequences
       WHERE project_id = $1 AND user_id = $2 AND deleted_at IS NULL
    `, [input.projectId, actor.userId]);
    const members = new Set([
      ...projectBinAssetIds(project.workspace_state),
      ...sequenceRows.flatMap((sequence) => sequenceAssetIds(sequence.timeline_state)),
    ]);
    if (assetIds.some((assetId) => !members.has(assetId))) throw new Error('MEDIA_NOT_AVAILABLE');

    const assets = [] as StudioMediaAccessResult['assets'];
    for (const assetId of assetIds) {
      const resolved = await resolveMedia(
        actor.userId,
        { type: 'asset', assetId, kind: 'video' },
        async (sql, values) => executor.query(sql, values) as Promise<never[]>,
      );
      if (resolved.ref.type !== 'asset' || resolved.ref.assetId !== assetId || resolved.kind !== 'video') {
        throw new Error('MEDIA_NOT_AVAILABLE');
      }
      if (resolved.originalAccess.type === 'owned-storage') {
        const signedAt = now();
        const url = await sign(resolved.originalAccess.storageKey, { expiresInSeconds: MEDIA_ACCESS_TTL_SECONDS });
        assets.push({
          assetId,
          url,
          expiresAt: new Date(signedAt.getTime() + MEDIA_ACCESS_TTL_SECONDS * 1_000).toISOString(),
        });
      } else {
        assets.push({ assetId, url: resolved.url, expiresAt: null });
      }
    }
    return { projectId: input.projectId, assets };
  });
}
