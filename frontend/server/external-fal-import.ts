import { isTransactionQueryExecutor, type QueryExecutor, type TransactionQueryExecutor } from '@/lib/db';
import { readGeneratedVideoFacts, type GeneratedVideoFacts } from '@/lib/generated-video-media-facts';
import type { ExternalReferenceProof } from './external-fal-import/reference-copies';
import { upsertJobOutputs } from './media-library/job-outputs';
import { EXTERNAL_FAL_IMPORT_ORIGIN } from './app-job-origin';
import { klingV4ImportSettings } from './external-fal-import/kling-v4';
import { externalFalImportPlan, importDigest, parseExternalFalImport, type ExternalFalImport } from './external-fal-import/contract';

export type ImportAsset = { preview_url?: string | null; id: string; public_id: string; user_id: string; kind: string; url: string; thumb_url: string | null;
  mime_type: string | null; width: number | null; height: number | null; size_bytes: number | string | null;
  source_job_id: string | null; source_output_id: string | null; status: string; deleted_at: string | null };
export type ImportEvidence = { referenceProofs?: ExternalReferenceProof[]; providerResultSha256: string; providerVideoUrl: string; verifiedAt: string; resolvedSeed?: number;
  display?: { poster: { url: string; sha256: string; sizeBytes: number; width: number; height: number };
    preview: { url: string; sha256: string; sizeBytes: number; width: number; height: number; durationSec: number; hasAudio: boolean } };
  video: { sha256: string; sizeBytes: number; width: number; height: number; hasAudio: boolean; mediaFacts: GeneratedVideoFacts } };
type VerifiedImport = { input: ExternalFalImport; actorUserId: string; assets: ImportAsset[]; evidence: ImportEvidence;
  plan: ReturnType<typeof externalFalImportPlan>; planSha256: string; migrationReady: boolean };
const verifiedPlans = new WeakSet<VerifiedImport>();
function stableAssetFacts(assets: ImportAsset[]) {
  return assets.map(({ source_job_id: _job, source_output_id: _output, ...facts }) => facts);
}
function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freezeDeep); Object.freeze(value); }
  return value;
}

async function assertImportAdmin(executor: QueryExecutor, actorUserId: string, lock = false) {
  // Match canonical admin precedence, including the deployed legacy roster.
  // Apply freezes role populations for the transaction; read-only verification never locks them.
  if (lock) await executor.query('LOCK TABLE user_roles IN SHARE MODE');
  const admins = await executor.query<{ user_id: string }>("SELECT user_id FROM user_roles WHERE role='admin'");
  if (admins.length) {
    if (!admins.some(row => row.user_id === actorUserId)) throw new Error('IMPORT_ADMIN_REQUIRED');
    return;
  }
  if (lock) await executor.query('LOCK TABLE app_admins IN SHARE MODE');
  const legacy = await executor.query('SELECT user_id FROM app_admins WHERE user_id=$1', [actorUserId]);
  if (legacy.length !== 1) throw new Error('IMPORT_ADMIN_REQUIRED');
}
async function migrationReady(executor: QueryExecutor): Promise<boolean> {
  const [row] = await executor.query<{ ready: boolean }>(`SELECT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
    WHERE t.tgrelid='app_jobs'::regclass AND t.tgname='app_jobs_capture_generation_timing' AND t.tgenabled <> 'D'
      AND pg_get_functiondef(p.oid) LIKE '%external_fal_import%'
    ) AND to_regclass('app_jobs_external_fal_request_unique') IS NOT NULL
      AND EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='app_jobs'::regclass AND conname='app_jobs_external_fal_import_contract' AND convalidated)
      AND EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
        WHERE t.tgrelid='app_jobs'::regclass AND t.tgname='app_jobs_preserve_external_fal_import' AND t.tgenabled <> 'D'
          AND p.proname='preserve_external_fal_import_origin' AND pg_get_functiondef(p.oid) LIKE '%external_fal_import%') AS ready`);
  return row?.ready === true;
}
async function assertMigration(executor: QueryExecutor) {
  if (!await migrationReady(executor)) throw new Error('IMPORT_MIGRATION_76_REQUIRED');
}
async function loadAssets(input: ExternalFalImport, executor: QueryExecutor, lock = false): Promise<ImportAsset[]> {
  const ids = [...new Set([input.videoAssetId, ...input.references.map(ref => ref.assetId)])];
  const rows = await executor.query<ImportAsset>(`SELECT id,public_id,user_id,kind,url,thumb_url,${input.engineId === 'kling-v4' ? 'preview_url,' : ''}mime_type,width,height,size_bytes,
    source_job_id,source_output_id,status,deleted_at FROM media_assets WHERE public_id=ANY($1::text[]) ${lock ? 'FOR UPDATE' : ''}`, [ids]);
  const ordered = ids.map(id => rows.find(row => row.public_id === id));
  if (ordered.some(row => !row || row.user_id !== input.ownerUserId || row.status !== 'ready' || row.deleted_at)) throw new Error('IMPORT_ASSET_OWNER_OR_READINESS_MISMATCH');
  if (ordered[0]!.kind !== 'video' || input.references.some(ref => ordered.find(row => row?.public_id === ref.assetId)!.kind !== (input.engineId === 'kling-v4' && 'kind' in ref ? ref.kind : 'image'))) throw new Error('IMPORT_ASSET_KIND_MISMATCH');
  for (const row of ordered) {
    for (const value of [row!.url, ...(row!.thumb_url ? [row!.thumb_url] : []), ...(input.engineId === 'kling-v4' && row!.preview_url ? [row!.preview_url] : [])]) {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.hostname !== 'media.maxvideoai.com' || url.search || url.hash || url.username || url.password) throw new Error('IMPORT_DURABLE_MEDIA_REQUIRED');
    }
  }
  if (!ordered[0]!.thumb_url) throw new Error('IMPORT_POSTER_REQUIRED');
  if (input.engineId === 'kling-v4' && (ordered[0]!.thumb_url !== input.media.poster.url || ordered[0]!.preview_url !== input.media.preview.url
    || [input.media.poster.url, input.media.preview.url].includes(ordered[0]!.url))) throw new Error('IMPORT_KLING_DISPLAY_ASSET_MISMATCH');
  const jobId = externalFalImportPlan(input).jobId;
  if (ordered[0]!.source_job_id && ordered[0]!.source_job_id !== jobId
    || ordered[0]!.source_output_id && ordered[0]!.source_output_id !== jobId + '_video_0') throw new Error('IMPORT_ASSET_ALREADY_LINKED');
  return ordered as ImportAsset[];
}
async function inspectExisting(input: ExternalFalImport, plan: ReturnType<typeof externalFalImportPlan>, executor: QueryExecutor) {
  const rows = await executor.query<{ job_id: string; user_id: string; settings_snapshot: Record<string, unknown> }>(
    `SELECT job_id,user_id,settings_snapshot FROM app_jobs WHERE job_id=$1 OR (provider='fal' AND provider_job_id=$2)`, [plan.jobId, input.providerRequestId]);
  if (rows.some(row => row.job_id !== plan.jobId || row.user_id !== input.ownerUserId || row.settings_snapshot?.origin !== EXTERNAL_FAL_IMPORT_ORIGIN
    || (row.settings_snapshot.externalImport as Record<string, unknown>)?.manifestSha256 !== plan.manifestSha256)) throw new Error('IMPORT_EXISTING_JOB_CONFLICT');
  return rows.length > 0;
}

/** Read-only: caller may enforce BEGIN READ ONLY. No schema bootstrap, uploads or provider submission. */
export async function verifyExternalFalImport(value: unknown, deps: { actorUserId: string; executor: QueryExecutor;
  verifyEvidence(input: ExternalFalImport, assets: ImportAsset[]): Promise<ImportEvidence> }): Promise<VerifiedImport> {
  const input = parseExternalFalImport(value);
  const plan = externalFalImportPlan(input);
  await assertImportAdmin(deps.executor, deps.actorUserId);
  const ready = await migrationReady(deps.executor);
  const assets = await loadAssets(input, deps.executor);
  await inspectExisting(input, plan, deps.executor);
  const evidence = await deps.verifyEvidence(input, assets);
  const video = evidence.video;
  const proofIdentity = (evidence.referenceProofs ?? []).map(proof => ({ assetId: proof.assetId, providerSha256: proof.providerSha256,
    durableSha256: proof.durableSha256, transform: proof.transform }));
  const expectedProofs = input.references.map(ref => ({ assetId: ref.assetId, providerSha256: ref.sha256,
    durableSha256: ref.storedRepresentation?.sha256 ?? ref.sha256, transform: ref.storedRepresentation?.transform ?? 'none' }));
  if (importDigest(proofIdentity) !== importDigest(expectedProofs)) throw new Error('IMPORT_REFERENCE_EVIDENCE_MISMATCH');
  if (!/^[a-f0-9]{64}$/.test(evidence.providerResultSha256) || !Number.isFinite(Date.parse(evidence.verifiedAt))
    || video.sha256 !== input.videoSha256 || video.sizeBytes !== Number(assets[0].size_bytes)
    || !readGeneratedVideoFacts(video.mediaFacts, assets[0].url) || video.mediaFacts.original.sha256 !== input.videoSha256
    || video.mediaFacts.original.sizeBytes !== video.sizeBytes || video.width !== assets[0].width || video.height !== assets[0].height
    || typeof video.hasAudio !== 'boolean') throw new Error('IMPORT_VIDEO_EVIDENCE_MISMATCH');
  if (input.engineId === 'kling-v4' && (!evidence.display || evidence.display.poster.url !== input.media.poster.url
    || evidence.display.poster.sha256 !== input.media.poster.sha256 || evidence.display.preview.url !== input.media.preview.url
    || evidence.display.preview.sha256 !== input.media.preview.sha256 || evidence.display.preview.hasAudio !== false
    || !(evidence.display.preview.durationSec > 0 && evidence.display.preview.durationSec <= Math.min(6, video.mediaFacts.durationSec + 0.1)))) throw new Error('IMPORT_KLING_DISPLAY_EVIDENCE_MISMATCH');
  const verified = { input, plan, actorUserId: deps.actorUserId, assets, evidence, migrationReady: ready,
    planSha256: importDigest({ plan, actorUserId: deps.actorUserId, assets: stableAssetFacts(assets), providerResultSha256: evidence.providerResultSha256, video, ...(evidence.display ? { display: evidence.display } : {}), ...(input.references.length ? { referenceProofs: evidence.referenceProofs } : {}) }) };
  verifiedPlans.add(verified);
  return freezeDeep(verified);
}

function settingsForImport(verified: VerifiedImport) {
  const { input, plan, assets, evidence } = verified;
  const externalImport = { schemaVersion: 1, manifestSha256: plan.manifestSha256, evidenceSha256: input.evidenceSha256,
    provider: 'fal', endpoint: input.endpoint, providerRequestId: input.providerRequestId, providerInput: input.providerInput,
    providerResultSha256: evidence.providerResultSha256, providerVideoUrl: evidence.providerVideoUrl,
    requestedSeed: 'seed' in input.providerInput ? input.providerInput.seed ?? null : null, resolvedSeed: evidence.resolvedSeed ?? null,
    verifiedAt: evidence.verifiedAt, importedAt: new Date().toISOString(), importedBy: verified.actorUserId,
    videoAssetId: input.videoAssetId, videoSha256: input.videoSha256, references: input.references, referenceProofs: evidence.referenceProofs ?? [],
    ...(input.engineId === 'kling-v4' ? { media: input.media, display: evidence.display } : {}), billing: 'external-no-maxvideoai-charge' };
  if (input.engineId === 'kling-v4') return { schemaVersion: 1, surface: 'video', engineId: input.engineId, inputMode: input.mode,
    origin: EXTERNAL_FAL_IMPORT_ORIGIN, ...klingV4ImportSettings(input, assets), externalImport };
  const provider = input.providerInput;
  const refs = input.references.map(ref => assets.find(asset => asset.public_id === ref.assetId)!);
  return { schemaVersion: 1, surface: 'video', engineId: input.engineId, inputMode: input.mode, prompt: provider.prompt,
    negativePrompt: null, origin: EXTERNAL_FAL_IMPORT_ORIGIN,
    core: { durationSec: provider.duration, durationOption: String(provider.duration), resolution: provider.resolution,
      aspectRatio: provider.aspect_ratio, audio: provider.generate_audio, fps: 24, iterationCount: 1, numFrames: null },
    advanced: { seed: provider.seed ?? evidence.resolvedSeed ?? null, extraInputValues: { reasoning_level: provider.reasoning_level,
      ...(provider.keyframes ? { keyframe_indexes: provider.keyframes.map(frame => frame.frame_index).join(',') } : {}) } },
    refs: { ...(input.mode === 'ref2v' ? { referenceImages: refs.map(ref => ref.url) } : {}),
      ...(provider.image_url ? { imageUrl: refs[0].url } : {}), ...(provider.end_image_url ? { endImageUrl: refs[1].url } : {}),
      inputs: refs.map((ref, index) => ({ slotId: input.mode === 'ref2v' ? 'reference_image_urls' : index === 0 ? 'image_url' : 'end_image_url',
        kind: 'image', url: ref.url, assetId: ref.public_id, name: `reference-${index + 1}`, type: ref.mime_type ?? 'image/*', size: Number(ref.size_bytes) })) },
    externalImport };
}

/** The only write boundary. Requires current in-process verification plus an exact reviewed plan. */
export async function applyExternalFalImport(verified: VerifiedImport, options: { executor: TransactionQueryExecutor;
  actorUserId: string; approvedPlanSha256: string }): Promise<{ jobId: string; outputId: string; created: boolean }> {
  if (!verifiedPlans.has(verified) || !isTransactionQueryExecutor(options.executor)) throw new Error('IMPORT_VERIFIED_TRANSACTION_REQUIRED');
  if (options.actorUserId !== verified.actorUserId || options.approvedPlanSha256 !== verified.planSha256) throw new Error('IMPORT_PLAN_APPROVAL_REQUIRED');
  const executor = options.executor;
  const { input, plan } = verified;
  await assertImportAdmin(executor, options.actorUserId, true);
  await assertMigration(executor);
  await executor.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['external-fal-import:' + input.providerRequestId]);
  const assets = await loadAssets(input, executor, true);
  if (importDigest(stableAssetFacts(assets)) !== importDigest(stableAssetFacts(verified.assets))) throw new Error('IMPORT_ASSET_CHANGED');
  const outputId = plan.jobId + '_video_0';
  if (await inspectExisting(input, plan, executor)) {
    const rows = await executor.query('SELECT id FROM job_outputs WHERE id=$1 AND job_id=$2 AND user_id=$3 AND url=$4 AND status=\'ready\'',
      [outputId, plan.jobId, input.ownerUserId, assets[0].url]);
    if (rows.length !== 1) throw new Error('IMPORT_EXISTING_OUTPUT_CONFLICT');
    if (input.engineId === 'kling-v4') {
      const display = await executor.query('SELECT id FROM job_outputs WHERE id=$1 AND thumb_url=$2 AND preview_url=$3 AND storage_url=$4',
        [outputId, input.media.poster.url, input.media.preview.url, assets[0].url]);
      if (display.length !== 1) throw new Error('IMPORT_EXISTING_OUTPUT_CONFLICT');
    }
    return { jobId: plan.jobId, outputId, created: false };
  }
  const snapshot = settingsForImport(verified);
  const video = verified.evidence.video;
  await executor.query(`INSERT INTO app_jobs(job_id,user_id,surface,engine_id,engine_label,duration_sec,prompt,thumb_url,video_url,preview_video_url,
    aspect_ratio,has_audio,provider,provider_job_id,status,progress,settings_snapshot,visibility,indexable,provisional,
    payment_status,final_price_cents,pricing_snapshot,cost_breakdown_usd,currency)
    VALUES ($1,$2,'video',$3,$12,$4,$5,$6,$7,$13,$8,$9,'fal',$10,'completed',100,$11::jsonb,'private',false,false,
      'external_not_billed',NULL,NULL,NULL,NULL)`, [plan.jobId,input.ownerUserId,input.engineId,input.providerInput.duration ?? null,
    input.providerInput.prompt ?? '',assets[0].thumb_url,assets[0].url,input.providerInput.aspect_ratio,video.hasAudio,input.providerRequestId,JSON.stringify(snapshot),input.engineId === 'kling-v4' ? 'Kling 4.0' : 'FLUX 3 Max',input.engineId === 'kling-v4' ? input.media.preview.url : null]);
  await upsertJobOutputs([{ id: outputId, jobId: plan.jobId, userId: input.ownerUserId, kind: 'video', url: assets[0].url,
    storageUrl: assets[0].url, thumbUrl: assets[0].thumb_url, previewUrl: input.engineId === 'kling-v4' ? input.media.preview.url : null, mimeType: 'video/mp4',
    width: video.width, height: video.height, durationSec: video.mediaFacts.durationSec, position: 0, status: 'ready',
    metadata: { origin: EXTERNAL_FAL_IMPORT_ORIGIN, mediaFacts: video.mediaFacts, externalImport: snapshot.externalImport } }], { executor });
  // Preserve upload source and public identity; the existing card becomes this output's saved asset.
  await executor.query(`UPDATE media_assets SET metadata=COALESCE(metadata,'{}'::jsonb)||jsonb_build_object('externalImport',$2::jsonb),
    source_job_id=$4, source_output_id=$5, updated_at=now() WHERE public_id=$1 AND user_id=$3`,
    [input.videoAssetId,JSON.stringify({ jobId: plan.jobId, ...snapshot.externalImport }),input.ownerUserId,plan.jobId,outputId]);
  return { jobId: plan.jobId, outputId, created: true };
}
