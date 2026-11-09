/** Read-only SQL/byte/journal evidence for the final native queue and tool imports. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { sha } from './s3-signature';

async function main() {
  const root = resolve('.'), req = createRequire(join(root, 'package.json'));
  const c = JSON.parse(await readFile(join(root, '.superpowers/sdd/2026-11-09-media-library-integration/task-8-connection-candidate.json'), 'utf8'));
  const url = new URL(c.databaseUrl);
  assert.equal(url.hostname, 'localhost');
  assert.ok(url.searchParams.get('host')?.includes('/libqa-'));
  url.searchParams.set('options', '-c default_transaction_read_only=on');
  const { Pool } = req('pg'), pool = new Pool({ connectionString: url.toString() });
  const sharp = createRequire(join(root, 'frontend/package.json'))('sharp');
  try {
    assert.equal((await pool.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
    const names = ['same.png', 'chunk-upload-6s-720p-cbr.mp4', 'ambient.wav'];
    const rows = (await pool.query(`SELECT public_id,kind,url,thumb_url,preview_url,size_bytes,status,metadata,created_at,updated_at
      FROM media_assets WHERE user_id=$1 AND metadata->>'originalName'=ANY($2) ORDER BY created_at`, [c.owners.a, names])).rows;
    const legacy = (await pool.query(`SELECT url,count(*)::int AS rows FROM user_assets WHERE user_id=$1
      AND metadata->>'originalName'=ANY($2) GROUP BY url`, [c.owners.a, names])).rows;
    const manifest = JSON.parse(await readFile(c.manifestPath, 'utf8'));
    const objects = new Map<string, any>(manifest.objects.map((o: any) => [o.key, o]));
    const journal = (await readFile(c.storageJournalPath, 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line));
    const inspect = async (value: string | null, image: boolean) => {
      if (!value) return null;
      const path = new URL(value).pathname;
      assert.ok(path.startsWith('/fixture-bucket/'));
      const key = path.slice('/fixture-bucket/'.length), object = objects.get(key);
      assert.ok(object);
      const bytes = await readFile(object.path);
      assert.equal(bytes.length, object.bytes); assert.equal(sha(bytes), object.sha256);
      const info = image ? await sharp(bytes).metadata() : null;
      return { keyHash: sha(key), sha256: sha(bytes), bytes: bytes.length, mimeType: object.mimeType,
        ...(info ? { width: info.width, height: info.height } : {}),
        writes: journal.filter((r: any) => r.keyHash === sha(key) && ['PUT', 'DELETE'].includes(r.method)) };
    };
    const assets = [];
    for (const row of rows) {
      const original = await inspect(row.url, row.kind === 'image');
      assert.equal(Number(row.size_bytes), original!.bytes);
      const thumbnail = await inspect(row.thumb_url, true), display = await inspect(row.preview_url, true);
      if (row.metadata.imageDisplay) {
        assert.equal(row.metadata.imageDisplay.sourceUrl, row.url);
        assert.equal(row.metadata.imageDisplay.sourceSha256, original!.sha256);
        assert.equal(row.metadata.imageDisplay.sizeBytes, display!.bytes);
      }
      assets.push({ name: row.metadata.originalName, ref: { type: 'asset', assetId: row.public_id, kind: row.kind },
        status: row.status, createdAt: row.created_at, updatedAt: row.updated_at, facts: row.metadata.mediaFacts,
        compatibilityRows: legacy.find((r: any) => r.url === row.url)?.rows ?? 0,
        original, thumbnail, display });
    }
    const collisionInputs = [];
    for (const variant of ['a', 'b']) {
      const input = await readFile(join(dirname(c.runDir), `collision-${variant}`, 'same.png'));
      const normalized = await sharp(input).rotate().png().toBuffer();
      const match = assets.find(a => a.original?.sha256 === sha(normalized));
      assert.ok(match, 'Each different PNG survives as its own exact normalized stored source');
      collisionInputs.push({ variant, inputBytes: input.length, inputSha256: sha(input), normalizedSha256: sha(normalized), assetId: match.ref.assetId });
    }
    assert.notEqual(collisionInputs[0].assetId, collisionInputs[1].assetId);
    const deletedKeys = [...new Set(journal.filter((r: any) => r.method === 'DELETE' && r.status === 204).map((r: any) => r.keyHash))];
    const chunks = deletedKeys.map(keyHash => ({ keyHash, events: journal.filter((r: any) => r.keyHash === keyHash) }));
    const remainingChunks = [...objects.keys()].filter(key => key.startsWith('user-assets/video-upload-parts/')).length;
    assert.equal(remainingChunks, 0);
    const output = join(dirname(c.runDir), 'connected-final-import-analysis.json');
    const report = { revision: c.revision, analyzedAt: new Date().toISOString(), readOnly: true, journalCutoff: journal.at(-1)?.at,
      assets, collisionInputs, canonicalAssets: assets.length, compatibilityRows: assets.reduce((n, a) => n + a.compatibilityRows, 0), chunks, remainingChunks,
      limits: ['Native chooser lastModified not read; exact equal metadata collision is established separately by the real SDK test.',
        'Images are normalized by the real upload owner before storage; input hashes differ from normalized original hashes.',
        'Explicitly reselected video has distinct final URLs and canonical identities despite equal content; no video content-dedup claim.',
        'PUT bytes in journal are response body bytes, not upload transfer sizes. Chunk GET queued bytes are not TCP measurements.'] };
    await writeFile(output, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ output, canonicalAssets: assets.length, compatibilityRows: report.compatibilityRows,
      differentImageAssets: true, videoAssets: assets.filter(a => a.ref.kind === 'video').length, audioAssets: assets.filter(a => a.ref.kind === 'audio').length,
      chunks: chunks.length, remainingChunks }));
  } finally { await pool.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
