import type { TransactionQueryExecutor } from '@/lib/db';
import { parseImageDisplay } from '@/lib/image-display';
import { initialSourceSql } from './organization-source-sql';
import { sourceIdentity, sourceReference, type OrganizationSource } from './organization-sources';
import { discoverPreparedPurgeSources, type PreparedPurgeEdge, type RetainedPreparedSource } from './purge-prepared-sources';

export type PurgeSourceFile = { url: string; sizeBytes: number | null; role: 'original' | 'thumbnail' | 'preview' };
type Json = Record<string, unknown>;
type MediaRow = { id: string; kind: string; job_id?: string; url: string; storage_url?: string | null; thumb_url?: string | null; preview_url?: string | null; size_bytes?: string | number | null; metadata?: Json | null; status?: string };
type JobProjection = { jobId: string; before: Json; after: Json };
type CharacterProjection = { table: 'character_studio_characters' | 'character_studio_looks'; id: string; before: Json; after: Json };
export type PurgeSourcePlan = { version: 1; sources: OrganizationSource[]; files: PurgeSourceFile[]; jobs: JobProjection[]; characters: CharacterProjection[]; prepared: PreparedPurgeEdge[]; retainedPrepared: RetainedPreparedSource[] };
const PLACEHOLDER = '/assets/frames/thumb-1x1.svg';
export const PURGE_JOB_FIELDS = ['video_url', 'audio_url', 'thumb_url', 'preview_video_url', 'preview_frame', 'keyframe_urls', 'render_ids', 'hero_render_id'] as const;
const json = (value: unknown): Json => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Json : {};
const text = (value: unknown): string | null => typeof value === 'string' && value.length > 0 ? value : null;
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  return value !== null && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)])) : value;
}
export const purgeSourcePlanFingerprint = (plan: PurgeSourcePlan): string => JSON.stringify(canonical(plan));
const sourceProof = (source: OrganizationSource) => [source.type, source.id, source.publicId, source.kind, source.url, source.original, source.provenance, source.jobId, source.outputId];
const lockedPlans = new WeakMap<PurgeSourcePlan, { userId: string; tx: TransactionQueryExecutor }>();

/** Applying a persisted or foreign-transaction plan would bypass its source locks. */
export function consumeLockedPurgeSourcePlan(userId: string, plan: PurgeSourcePlan, tx: TransactionQueryExecutor): void {
  const locked = lockedPlans.get(plan);
  if (locked?.userId !== userId || locked.tx !== tx) throw new Error('PURGE_SOURCE_PLAN_NOT_LOCKED');
  lockedPlans.delete(plan);
}

/** Discover technical children before taking any source lock. Lock the full union
 * in canonical/legacy/output/job order, then repeat the proof in this transaction. */
export async function readPurgeSourcePlan(userId: string, roots: OrganizationSource[], tx: TransactionQueryExecutor): Promise<PurgeSourcePlan> {
  const discovered = await discoverPreparedPurgeSources(userId, roots, tx);
  const ids = (type: string) => discovered.sources.filter(source => source.type === type).map(source => source.id);
  const jobIds = [...new Set(discovered.sources.flatMap(source => source.jobId ? [source.jobId] : []))].sort();
  const assets = await tx.query<MediaRow>('SELECT id,kind,url,thumb_url,preview_url,size_bytes,metadata FROM media_assets WHERE user_id=$1 AND id=ANY($2::text[]) ORDER BY id FOR UPDATE', [userId, [...ids('asset'), ...discovered.retainedPrepared.map(source => source.id)]]);
  const legacy = await tx.query<MediaRow>('SELECT asset_id AS id,url,size_bytes,metadata FROM user_assets WHERE user_id=$1 AND asset_id=ANY($2::text[]) ORDER BY asset_id FOR UPDATE', [userId, ids('legacy')]);
  const outputs = await tx.query<MediaRow>('SELECT id,job_id,kind,url,storage_url,thumb_url,preview_url,metadata,status FROM job_outputs WHERE user_id=$1 AND (id=ANY($2::text[]) OR job_id=ANY($3::text[])) ORDER BY id FOR UPDATE', [userId, ids('job-output'), jobIds]);
  const jobs = await tx.query<{ job_id: string; data: Json }>('SELECT job_id,to_jsonb(j) AS data FROM app_jobs j WHERE user_id=$1 AND job_id=ANY($2::text[]) ORDER BY job_id FOR UPDATE', [userId, jobIds]);
  const current = await tx.query<OrganizationSource>(initialSourceSql(), [userId, JSON.stringify(discovered.sources.map(sourceReference))]);
  const byId = new Map(current.map(source => [sourceIdentity(source), source]));
  if (discovered.sources.some(source => {
    const row = byId.get(sourceIdentity(source));
    return !row?.available || JSON.stringify(sourceProof(row)) !== JSON.stringify(sourceProof(source));
  })) throw new Error('PURGE_SOURCE_CHANGED');
  const checked = await discoverPreparedPurgeSources(userId, roots, tx);
  if (JSON.stringify(canonical(discovered)) !== JSON.stringify(canonical(checked))) throw new Error('PURGE_SOURCE_GRAPH_CHANGED');
  const files = new Map<string, PurgeSourceFile>();
  const add = (value: unknown, role: PurgeSourceFile['role'], size: unknown = null) => {
    const url = text(value); if (!url || url === PLACEHOLDER) return;
    const bytes = Number(size), sizeBytes = size !== null && size !== undefined && Number.isSafeInteger(bytes) && bytes >= 0 ? bytes : null;
    // Preserve contradictory measurements for the object queue's conflict flag.
    const key = JSON.stringify([url, sizeBytes]), previous = files.get(key);
    files.set(key, { url, sizeBytes, role: previous?.role === 'original' ? 'original' : role });
  };
  const addMedia = (row: MediaRow) => {
    const original = row.storage_url || row.url;
    add(original, 'original', row.size_bytes);
    // Both URLs are authored on this exact output version. Storage authority and
    // shared-object retention are checked separately by the deletion worker.
    if (row.storage_url && row.storage_url !== row.url) add(row.url, 'original');
    add(row.thumb_url ?? row.metadata?.thumbUrl, 'thumbnail'); add(row.preview_url ?? row.metadata?.previewUrl, 'preview');
    const display = parseImageDisplay(row.metadata?.imageDisplay, original);
    if (display) add(display.url, 'preview', display.sizeBytes);
  };
  const outputIds = new Set(ids('job-output'));
  const assetIds = new Set(ids('asset'));
  [...assets.filter(row => assetIds.has(row.id)), ...legacy, ...outputs.filter(row => outputIds.has(row.id))].forEach(addMedia);
  const matchesUrl = (output: MediaRow, url: string) => output.url === url || output.storage_url === url;
  const outputById = new Map(outputs.map(output => [output.id, output]));
  const targetVersions = (jobId: string, kind: string, url: string) => discovered.sources.filter(source => {
    if (source.jobId !== jobId || source.kind !== kind) return false;
    if (source.url === url || source.original === url) return true;
    const output = outputById.get(source.type === 'job-output' ? source.id : source.outputId ?? '');
    return output?.job_id === jobId && output.kind === kind && matchesUrl(output, url);
  });
  const selectedVersion = (output: MediaRow, url: string) => targetVersions(output.job_id!, output.kind, url).some(source => source.outputId === output.id || source.type === 'job-output' && source.id === output.id);
  const survivingOutput = (jobId: string, kind: string, url: string) => outputs.some(output => output.job_id === jobId && output.kind === kind && output.status !== 'deleted' && matchesUrl(output, url) && !selectedVersion(output, url));
  const provenProjection = (jobId: string, kind: string, url: string | null, outputId?: string | null) => {
    if (!url) return false;
    const targets = targetVersions(jobId, kind, url); if (!targets.length) return false;
    if (outputId) return targets.some(source => source.outputId === outputId || source.type === 'job-output' && source.id === outputId);
    const siblings = outputs.filter(output => output.job_id === jobId && output.kind === kind && matchesUrl(output, url));
    // This removes an obsolete facade, never merges two output identities. A
    // sibling already tombstoned by a prior request no longer needs that facade.
    return !survivingOutput(jobId, kind, url) && (!siblings.length || siblings.some(output => selectedVersion(output, url)));
  };
  const jobPlans: JobProjection[] = [];
  for (const row of jobs) {
    const before = Object.fromEntries(PURGE_JOB_FIELDS.filter(key => key in row.data).map(key => [key, row.data[key]]));
    const after = structuredClone(before);
    const removeVideo = provenProjection(row.job_id, 'video', text(before.video_url));
    const removeAudio = provenProjection(row.job_id, 'audio', text(before.audio_url));
    let renders: unknown = before.render_ids; const encodedRenders = typeof renders === 'string';
    if (encodedRenders) { try { renders = JSON.parse(renders as string); } catch { renders = null; } }
    if (Array.isArray(renders)) {
      const kept = renders.filter(entry => {
        const value = json(entry), url = typeof entry === 'string' ? entry : text(value.url);
        if (!provenProjection(row.job_id, 'image', url, text(value.sourceOutputId))) return true;
        add(url, 'original'); add(value.thumb_url ?? value.thumbUrl, 'thumbnail'); add(value.preview_url ?? value.previewUrl, 'preview');
        const display = parseImageDisplay(value.imageDisplay, url!); if (display) add(display.url, 'preview', display.sizeBytes);
        return false;
      });
      if (kept.length !== renders.length) after.render_ids = encodedRenders ? JSON.stringify(kept) : kept;
    }
    const removeHero = provenProjection(row.job_id, 'image', text(before.hero_render_id));
    if (removeHero) after.hero_render_id = null;
    if (removeVideo) {
      after.video_url = null;
      for (const key of ['preview_video_url', 'preview_frame'] as const) if (key in before) { add(before[key], key === 'preview_frame' ? 'thumbnail' : 'preview'); after[key] = null; }
      if ('keyframe_urls' in before) { Object.values(json(before.keyframe_urls)).forEach(url => add(url, 'thumbnail')); after.keyframe_urls = null; }
    }
    if (removeAudio) after.audio_url = null;
    if (removeVideo || removeHero || removeAudio && !before.video_url && !before.hero_render_id) {
      if ('thumb_url' in before) { add(before.thumb_url, 'thumbnail'); after.thumb_url = PLACEHOLDER; }
      if ('preview_frame' in before) { add(before.preview_frame, 'thumbnail'); after.preview_frame = null; }
    }
    if (!removeVideo && 'keyframe_urls' in before) {
      const keyframes = json(before.keyframe_urls), kept = Object.fromEntries(Object.entries(keyframes).filter(([, url]) => !provenProjection(row.job_id, 'image', text(url))));
      if (Object.keys(kept).length !== Object.keys(keyframes).length) { after.keyframe_urls = kept; for (const url of Object.values(keyframes)) if (provenProjection(row.job_id, 'image', text(url))) add(url, 'thumbnail'); }
    }
    if (JSON.stringify(canonical(before)) !== JSON.stringify(canonical(after))) jobPlans.push({ jobId: row.job_id, before, after });
  }
  const characters: CharacterProjection[] = [];
  for (const table of ['character_studio_characters', 'character_studio_looks'] as const) {
    const [exists] = await tx.query<{ present: boolean }>('SELECT to_regclass($1) IS NOT NULL AS present', [table]);
    if (!exists.present || !jobIds.length) continue;
    const rows = await tx.query<{ id: string; source_job_id: string; image_url: string; thumb_url: string }>(`SELECT id::text,source_job_id,image_url,thumb_url FROM ${table} WHERE user_id::text=$1 AND source_job_id=ANY($2::text[]) ORDER BY id FOR UPDATE`, [userId, jobIds]);
    for (const character of rows) {
      if (!provenProjection(character.source_job_id, 'image', character.image_url)) continue;
      const before = { source_job_id: character.source_job_id, image_url: character.image_url, thumb_url: character.thumb_url };
      add(character.image_url, 'original'); add(character.thumb_url, 'thumbnail');
      // Looks have UNIQUE(user_id,source_job_id,image_url); retain distinct neutral
      // rows so purging two outputs of one job neither conflicts nor cascades.
      characters.push({ table, id: character.id, before, after: { ...before, image_url: `${PLACEHOLDER}?purged=${table}-${character.id}`, thumb_url: PLACEHOLDER } });
    }
  }
  const plan: PurgeSourcePlan = { version: 1, ...checked, files: [...files.values()].sort((a, b) => a.url.localeCompare(b.url) || (a.sizeBytes ?? -1) - (b.sizeBytes ?? -1)), jobs: jobPlans, characters };
  lockedPlans.set(plan, { userId, tx });
  return plan;
}
