import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { completeFixtureJobs } from './job-fixture';
import { pathToFileURL } from 'node:url';
async function main() {
    const [root, seedPath] = process.argv.slice(2);
    const load = (path: string) => import(pathToFileURL(join(root, path)).href);
    const db = await load('frontend/src/lib/db.ts');
    const sql = async (name: string) => db.query(await readFile(join(root, 'neon/migrations', name), 'utf8'));
    await sql('00_create_profiles.sql');
    for (const [file, fn] of [['billing-core-schema', 'ensureBillingCoreSchema'], ['billing-receipts-schema', 'ensureBillingReceiptsSchema'], ['billing-user-admin-schema', 'ensureBillingUserAdminSchema'], ['asset-schema', 'ensureAssetSchema'], ['media-library-schema', 'ensureMediaLibrarySchema']])
        await (await load(`frontend/src/lib/schema/${file}.ts`))[fn]();
    for (const file of ['01_legal_documents.sql', '02_user_consents.sql', '03_profiles_extensions.sql', '04_profiles_timestamps.sql', '08_admin_controls.sql', '12_app_settings.sql', '32_mcp_reference_uploads.sql', '34_mcp_reference_upload_media_kind.sql', '35_mcp_reference_upload_hardening.sql', '36_mcp_reference_upload_replay_safety.sql', '37_mcp_reference_upload_recovery_state.sql', '43_mcp_reference_asset_deletion.sql', '44_mcp_reference_staging_storage_namespace.sql'])
        await sql(file);
    const schema = await load('frontend/src/lib/schema.ts');
    if (schema.ensureMediaLibraryOrganizationSchema)
        await schema.ensureMediaLibraryOrganizationSchema();
    const seed = JSON.parse(await readFile(seedPath, 'utf8'));
    for (const id of Object.values(seed.owners))
        await db.query(`INSERT INTO profiles(id,preferred_currency,tos_version,privacy_version,cookies_version,age_verified) VALUES($1,'USD',(SELECT version FROM legal_documents WHERE key='terms'),(SELECT version FROM legal_documents WHERE key='privacy'),(SELECT version FROM legal_documents WHERE key='cookies'),true)`, [id]);
    for (const row of seed.outputs) {
        await db.query(`INSERT INTO app_jobs(job_id,user_id,engine_id,engine_label,duration_sec,prompt,thumb_url,surface,status,hidden,progress,settings_snapshot,aspect_ratio,visibility,indexable,created_at,updated_at) VALUES($1,$2,'veo-3-1','Synthetic fixture',$3,$4,$5,$6,'completed',false,100,'{}','16:9','private',false,$7,$7) ON CONFLICT(job_id) DO NOTHING`, [row.jobId, row.userId, row.durationSec ?? 5, `Synthetic ${row.jobId}`, row.thumbUrl ?? '', row.kind === 'image' ? 'image' : 'video', row.createdAt]);
        await db.query(`INSERT INTO job_outputs(id,job_id,user_id,kind,url,storage_url,thumb_url,preview_url,mime_type,width,height,duration_sec,position,status,metadata,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$10,$11,$12,'ready',$13,$14,$14)`, [row.id, row.jobId, row.userId, row.kind, row.url, row.thumbUrl, row.previewUrl, row.mimeType, row.width, row.height, row.durationSec ?? null, row.position, JSON.stringify(row.metadata), row.createdAt]);
    }
    await completeFixtureJobs(root, seed, db, join(dirname(seedPath),'jobs-complement.json'));
    for (const row of seed.assets)
        await db.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,thumb_url,preview_url,mime_type,width,height,size_bytes,source,source_job_id,source_output_id,status,metadata,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'ready',$15,$16,$16)`, [row.id, row.publicId, row.userId, row.kind, row.url, row.thumbUrl, row.previewUrl, row.mimeType, row.width, row.height, row.sizeBytes, row.source, row.sourceJobId ?? null, row.sourceOutputId ?? null, JSON.stringify(row.metadata), row.createdAt]);
    for (const row of seed.legacy)
        await db.query(`INSERT INTO user_assets(asset_id,user_id,url,mime_type,width,height,size_bytes,source,metadata,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,'upload',$8,$9)`, [row.assetId, row.userId, row.url, row.mimeType, row.width, row.height, row.sizeBytes, JSON.stringify({ ...row.metadata, thumbUrl: row.thumbUrl, previewUrl: row.previewUrl }), row.createdAt]);
    console.log(JSON.stringify({ schema: 'actual owners and authored migrations', assets: seed.assets.length, outputs: seed.outputs.length, legacy: seed.legacy.length, adminGrants: 0 }));
    await db.getDb().end();
}
main().catch(error => { console.error(error); process.exitCode = 1; });
