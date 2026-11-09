/** Read-only attribution of root's real synthetic upload run. Never touches runtime controls. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { sha, storageEnvironment } from './s3-signature';
async function main() {
  const root = resolve('.'), req = createRequire(join(root, 'package.json'));
  const c = JSON.parse(await readFile(join(root, '.superpowers/sdd/2026-11-09-media-library-integration/task-8-connection-candidate.json'), 'utf8'));
  const evidence = dirname(c.runDir), url = new URL(c.databaseUrl);
  assert.equal(url.hostname, 'localhost');
  assert.ok(url.searchParams.get('host')?.includes('/libqa-'));
  url.searchParams.set('options', '-c default_transaction_read_only=on');
  const { Pool } = req('pg'), pool = new Pool({ connectionString: url.toString() });
  const sharp = createRequire(join(root, 'frontend/package.json'))('sharp');
  const names = ['queue-image-fresh.png', 'chunk-upload-6s-720p-cbr.mp4', 'ambient.wav', 'queue-invalid.png'];
  try {
    assert.equal((await pool.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
    const rows = (await pool.query(`SELECT public_id,kind,url,thumb_url,preview_url,mime_type,width,height,
      size_bytes,source,status,metadata,created_at,updated_at FROM media_assets
      WHERE user_id=$1 AND metadata->>'originalName'=ANY($2) ORDER BY created_at`, [c.owners.a, names])).rows;
    const legacy = (await pool.query(`SELECT url,count(*)::int AS rows FROM user_assets WHERE user_id=$1
      AND metadata->>'originalName'=ANY($2) GROUP BY url`, [c.owners.a, names])).rows;
    const manifest = JSON.parse(await readFile(c.manifestPath, 'utf8'));
    const objects = new Map<string, any>(manifest.objects.map((o: any) => [o.key, o]));
    const journal = (await readFile(c.storageJournalPath, 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line));
    const writes = journal.filter((r: any) => r.method === 'PUT' || r.method === 'DELETE');
    const keyFor = (value: string) => new URL(value).pathname.slice('/fixture-bucket/'.length);
    const inspect = async (value: string | null, image: boolean) => {
      if (!value) return null;
      const key = keyFor(value), record = objects.get(key); assert.ok(record, 'Referenced object exists');
      const bytes = await readFile(record.path); assert.equal(bytes.length, record.bytes); assert.equal(sha(bytes), record.sha256);
      const info = image ? await sharp(bytes).metadata() : undefined;
      return { keyHash: sha(key), sha256: record.sha256, bytes: record.bytes, mimeType: record.mimeType,
        ...(info ? { width: info.width, height: info.height } : {}),
        writes: writes.filter((r: any) => r.keyHash === sha(key)) };
    };
    const assets = [];
    for (const row of rows) {
      const original = await inspect(row.url, row.kind === 'image');
      assert.equal(Number(row.size_bytes), original!.bytes);
      const thumbnail = await inspect(row.thumb_url, true), display = await inspect(row.preview_url, true);
      const imageDisplay = row.metadata.imageDisplay;
      if (imageDisplay) {
        assert.equal(imageDisplay.sourceUrl, row.url); assert.equal(imageDisplay.sourceSha256, original!.sha256);
        assert.equal(imageDisplay.sizeBytes, display!.bytes); assert.equal(imageDisplay.width, display!.width); assert.equal(imageDisplay.height, display!.height);
      }
      assets.push({ name: row.metadata.originalName, reference: { type:'asset', assetId:row.public_id, kind:row.kind },
        status:row.status, source:row.source, createdAt:row.created_at, updatedAt:row.updated_at,
        facts:row.metadata.mediaFacts, compatibilityRows:legacy.find((r:any)=>r.url===row.url)?.rows ?? 0,
        original, thumbnail, display, ...(imageDisplay ? {displayProfile:imageDisplay.profile, displayOriginalBindingVerified:true} : {}) });
    }
    const image = assets.find(a=>a.name===names[0])!;
    const input = await readFile(join(evidence,names[0]));
    const normalized = await sharp(input).rotate().png().toBuffer();
    assert.equal(sha(normalized),image.original!.sha256);
    assert.deepEqual(await sharp(input).rotate().raw().toBuffer(),await sharp(normalized).raw().toBuffer());
    const video = assets.find(a=>a.name===names[1])!;
    assert.equal(sha(await readFile(join(evidence,names[1]))),video.original!.sha256);
    const audio = assets.find(a=>a.name===names[2])!;
    assert.equal(sha(await readFile(join(root,'experiments/media-library/prototype/public/fixtures/originals/ambient.wav'))),audio.original!.sha256);
    const deleted = [...new Set(writes.filter((r:any)=>r.method==='DELETE'&&r.status===204).map((r:any)=>r.keyHash))];
    const chunks = deleted.map(keyHash=>({keyHash,events:journal.filter((r:any)=>r.keyHash===keyHash)}));
    const chunkBytes = chunks.flatMap(c=>c.events.filter((r:any)=>r.method==='GET'&&r.status===200)).reduce((n:number,r:any)=>n+r.bodyBytesQueued,0);
    assert.equal(chunks.length,2); assert.equal(chunkBytes,video.original!.bytes);
    assert.equal([...objects.keys()].filter(k=>k.startsWith('user-assets/video-upload-parts/')).length,0);
    const retryAt = image.original!.writes.find((r:any)=>r.method==='PUT'&&r.status===200).at;
    const siblingWritesAfterRetry = assets.filter(a=>a.name!==names[0]).flatMap(a=>[a.original,a.thumbnail,a.display].filter(Boolean).flatMap(o=>o!.writes.filter((r:any)=>r.at>=retryAt&&r.method==='PUT')));
    assert.equal(siblingWritesAfterRetry.length,0);
    const retryWrites = writes.filter((r:any)=>r.at>=retryAt&&r.method==='PUT');
    const imageKeys = new Set([image.original,image.thumbnail,image.display].filter(Boolean).map(o=>o!.keyHash));
    assert.equal(retryWrites.length,3);
    assert.ok(retryWrites.every((r:any)=>imageKeys.has(r.keyHash)),'No new-key sibling reupload or extra PUT during this retry window');
    // Real browse owner from the exported snapshot, with a fake-only child environment.
    const code = `import {browseLibrary} from ${JSON.stringify(join(c.temporaryRoot,'frontend/server/media-library/browse.ts'))};import{getDb}from ${JSON.stringify(join(c.temporaryRoot,'frontend/src/lib/db.ts'))};async function main(){const p=await browseLibrary({userId:${JSON.stringify(c.owners.a)},scope:{view:'all',sort:'recent'},limit:30});console.log(JSON.stringify({total:p.totalCount,imports:p.assets.filter(a=>${JSON.stringify(rows.map((r:any)=>r.url))}.includes(a.url)).map(a=>({name:a.name,libraryRef:a.libraryRef,hasReadAccessRef:Boolean(a.readAccessRef)}))}));await getDb().end();}main().catch(e=>{console.error(e.message);process.exitCode=1;});`;
    const workerDirectory=await mkdtemp(join(tmpdir(),'library-import-analysis-'));
    const worker=join(workerDirectory,'browse.ts'); await writeFile(worker,code);
    const child=spawnSync(process.execPath,[req.resolve('tsx/cli'),'--tsconfig',join(c.temporaryRoot,'frontend/tsconfig.json'),worker],{cwd:c.temporaryRoot,encoding:'utf8',env:{PATH:`${dirname(process.execPath)}:/opt/homebrew/bin:/usr/bin:/bin`,NODE_ENV:'test',DATABASE_URL:url.toString(),...storageEnvironment,AWS_ENDPOINT_URL_S3:c.storageOrigin}});
    await rm(workerDirectory,{recursive:true,force:true});
    assert.equal(child.status,0,child.stderr);
    assert.ok(child.stdout.trim(), `Browse child returned empty output; stderr=${child.stderr}`);
    const browse=JSON.parse(child.stdout.trim());
    const report={analyzedAt:new Date().toISOString(),revision:c.revision,mode:'production',readOnly:true,
      journalLastEvent:journal.at(-1)?.at, inputImage:{bytes:input.length,sha256:sha(input),normalizedBytes:normalized.length,normalizedSha256:sha(normalized),decodedPixelsEqual:true},
      assets,canonicalAssetCount:assets.length,compatibilityRowCount:legacy.reduce((n:number,r:any)=>n+r.rows,0),browse,
      invalidFileCanonicalRows:rows.filter((r:any)=>r.metadata.originalName===names[3]).length,
      chunks,chunkBytes,remainingChunkObjects:0,retryAt,retryWrites,siblingWritesAfterRetry,storageWrites:writes,
      limits:['PUT journal bytes are RESPONSE body bytes, not uploaded bytes; stored byte/hash facts establish persisted originals.','Chunk GET body bytes are queued complete responses; not TCP transfer measurements.','CDP empty requests after reload do not prove zero requests; sibling no-reupload conclusion uses S3 key-hash journal and SQL.','Compatibility user_assets rows are projections, not additional imported media.','The input PNG is normalized by the existing real upload owner; hashes of selected input and stored original are deliberately distinct.']};
    const output=join(evidence,'connected-import-analysis.json');await writeFile(output,JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({output,canonicalAssets:assets.length,compatibilityRows:report.compatibilityRowCount,browseTotal:browse.total,browseImports:browse.imports.length,chunks:chunks.length,chunkBytes,noSiblingReupload:siblingWritesAfterRetry.length===0}));
  } finally {await pool.end();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
