import assert from 'node:assert/strict';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';
test('common SQL identity agrees with materialized promotion, old output versions, mixed kinds and proof limits', { timeout: 120000 }, async (t) => {
    const pg = await startDisposablePostgres('browse-parity');
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = pg.databaseUrl;
    const db = await import('../frontend/src/lib/db');
    t.after(async () => { await db.getDb().end(); process.env.DATABASE_URL = previous; await pg.cleanup(); });
    const schema = await import('../frontend/src/lib/schema');
    await schema.ensureAssetSchema();
    await schema.ensureMediaLibrarySchema();
    await schema.ensureMediaLibraryOrganizationSchema();
    await pg.pool.query(`CREATE TABLE app_jobs(job_id text PRIMARY KEY,user_id text,hidden boolean DEFAULT false,prompt text,surface text,settings_snapshot jsonb,duration_sec integer,aspect_ratio text,created_at timestamptz DEFAULT now());`);
    const { browseLibrary } = await import('../frontend/server/media-library/browse');
    const { resolveLibraryOrganizationReferences: resolve } = await import('../frontend/server/media-library/organization-resolver');
    const { mutateLibraryOrganization: mutate } = await import('../frontend/server/media-library/organization');
    const { createLibrarySelectionSnapshot } = await import('../frontend/server/media-library/selection');
    const scope = { view: 'all', kind: 'all', sort: 'recent' } as const;
    await t.test('coincident record IDs without correspondence retain two versions through browse, snapshot and Trash', async () => {
        await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,source,created_at)
          VALUES('reused-id','ma_reused','reused','image','https://test/new','upload','2026-02-01');
          INSERT INTO user_assets(asset_id,user_id,url,mime_type,source,metadata,created_at)
          VALUES('reused-id','reused','https://test/old','image/png','upload','{}','2026-01-01')`);
        const canonical = { type: 'asset', assetId: 'ma_reused', kind: 'image' } as const;
        const legacy = { type: 'legacy', assetId: 'reused-id', kind: 'image' } as const;
        const resolved = await resolve('reused', [canonical, legacy]);
        assert.equal(new Set(resolved.map(row => row.key)).size, 2);
        const page = await browseLibrary({ userId: 'reused', scope });
        assert.equal(page.totalCount, 2);
        assert.deepEqual(new Set(page.assets.map(row => row.organization.key)), new Set(resolved.map(row => row.key)));
        const snapshot = await createLibrarySelectionSnapshot({ userId: 'reused', scope });
        assert.equal(snapshot.totalCount, 2);
        assert.deepEqual(new Set(snapshot.keys), new Set(resolved.map(row => row.key)));
        await mutate({ userId: 'reused', operation: 'trash', references: [legacy] });
        const active = await browseLibrary({ userId: 'reused', scope });
        assert.equal(active.totalCount, 1);
        assert.equal(active.assets[0].url, 'https://test/new');
        assert.equal(active.assets[0].organization.key, resolved[0].key);
        const trashed = await browseLibrary({ userId: 'reused', scope: { ...scope, trash: true } });
        assert.equal(trashed.totalCount, 1);
        assert.equal(trashed.assets[0].organization.key, resolved[1].key);
        const { listLibraryAssetPage, findLibraryAssetByOrigin } = await import('../frontend/server/media-library/asset-listing');
        assert.equal((await listLibraryAssetPage({ userId: 'reused' }, { ensureSchema: false })).items.length, 1);
        assert.equal((await findLibraryAssetByOrigin({ userId: 'reused', kind: 'image', originUrl: 'https://test/new' }, { ensureSchema: false }))?.url, 'https://test/new');
    });
    await t.test('proven copied projections remain one component when stored original URLs differ', async () => {
        await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,source,metadata,created_at)
          VALUES('copied-id','ma_copied','copied','image','https://test/copied','upload','{"originUrl":"https://test/copied-origin"}','2026-02-01');
          INSERT INTO user_assets(asset_id,user_id,url,mime_type,source,metadata,created_at)
          VALUES('copied-id','copied','https://test/copied-origin','image/png','upload','{}','2026-01-01')`);
        const refs = [{ type: 'asset', assetId: 'ma_copied', kind: 'image' }, { type: 'legacy', assetId: 'copied-id', kind: 'image' }] as const;
        const resolved = await resolve('copied', refs);
        assert.equal(resolved[0].key, resolved[1].key);
        const page = await browseLibrary({ userId: 'copied', scope });
        assert.equal(page.totalCount, 1);
        assert.equal(page.assets[0].organization.key, resolved[0].key);
        assert.equal((await createLibrarySelectionSnapshot({ userId: 'copied', scope })).totalCount, 1);
        await mutate({ userId: 'copied', operation: 'trash', references: [refs[1]] });
        assert.equal((await browseLibrary({ userId: 'copied', scope })).totalCount, 0);
    });
    await t.test('record anchor ties use UTF-8 byte order and preserve previously materialized aliases', async () => {
        const { organizationHash } = await import('../frontend/server/media-library/organization-identity');
        for (const [owner, canonicalId, legacyId, expectedId, canonicalAt = '2026-02-01', legacyAt = '2026-02-01'] of [
            ['tie-case', 'Z', 'a', 'Z'],
            ['tie-punctuation', 'tie.Z', 'tie_a', 'tie.Z'],
            ['tie-unicode', 'tie-é', 'tie-z', 'tie-z'],
            ['time-priority', 'time-z', 'time-Z', 'time-z', '2026-02-01 00:00:00.000001+00', '2026-01-31 19:00:00.000002-05'],
        ]) {
            const url = `https://test/${owner}`, publicId = `ma_${owner}`;
            await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,source,created_at) VALUES($1,$2,$3,'image',$4,'upload',$5);`, [canonicalId, publicId, owner, url, canonicalAt]);
            await pg.pool.query(`INSERT INTO user_assets(asset_id,user_id,url,mime_type,source,metadata,created_at) VALUES($1,$2,$3,'image/png','upload','{}',$4)`, [legacyId, owner, url, legacyAt]);
            const refs = [{ type: 'asset', assetId: publicId, kind: 'image' }, { type: 'legacy', assetId: legacyId, kind: 'image' }] as const;
            const expected = `lo_${organizationHash(['v1', owner, 'image', ['record', expectedId, `sr_${organizationHash(['v1', 'image', url])}`]])}`;
            const page = await browseLibrary({ userId: owner, scope });
            for (const requested of [[refs[0]], [refs[1]], [...refs]]) {
                const result = await resolve(owner, requested);
                assert.ok(result.every(row => row.key === expected), `resolver UTF-8 anchor for ${owner}`);
                assert.equal(page.assets[0].organization.key, expected);
            }
            assert.equal(page.totalCount, 1);
            assert.deepEqual((await createLibrarySelectionSnapshot({ userId: owner, scope })).keys, [expected]);
        }
        await pg.pool.query(`INSERT INTO user_assets(asset_id,user_id,url,mime_type,source,metadata,created_at)
          VALUES('persist-a','persist-tie','https://test/persist-tie','image/png','upload','{}','2026-02-01')`);
        const legacy = { type: 'legacy', assetId: 'persist-a', kind: 'image' } as const;
        const before = await mutate({ userId: 'persist-tie', operation: 'favorite', references: [legacy] });
        const retainedKey = before.results[0].key;
        await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,source,created_at)
          VALUES('persist-Z','ma_persist_tie','persist-tie','image','https://test/persist-tie','upload','2026-02-01')`);
        const canonical = { type: 'asset', assetId: 'ma_persist_tie', kind: 'image' } as const;
        assert.ok((await resolve('persist-tie', [canonical, legacy])).every(row => row.key === retainedKey));
        const after = await browseLibrary({ userId: 'persist-tie', scope });
        assert.equal(after.assets[0].organization.key, retainedKey);
        assert.equal(after.assets[0].organization.favorite, true);
        assert.deepEqual((await createLibrarySelectionSnapshot({ userId: 'persist-tie', scope })).keys, [retainedKey]);
    });
    await pg.pool.query(`INSERT INTO user_assets(asset_id,user_id,url,mime_type,source,metadata,created_at) VALUES('old','alice','https://test/promotion','image/png','upload','{}','2026-01-01');`);
    const old = { type: 'legacy', assetId: 'old', kind: 'image' } as const;
    const favorite = await mutate({ userId: 'alice', operation: 'favorite', references: [old] });
    const key = favorite.results[0].key;
    await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,source,created_at) VALUES('new','ma_new','alice','image','https://test/promotion','upload','2026-01-02')`);
    const promoted = await browseLibrary({ userId: 'alice', scope });
    assert.equal(promoted.assets.length, 1);
    assert.equal(promoted.assets[0].organization.key, key);
    assert.equal(promoted.assets[0].organization.favorite, true);
    await pg.pool.query(`INSERT INTO app_jobs(job_id,user_id) VALUES('mixed','alice');
    INSERT INTO job_outputs(id,job_id,user_id,kind,url) VALUES('video-out','mixed','alice','video','https://test/mixed');
    INSERT INTO media_assets(id,public_id,user_id,kind,url,source,source_job_id,source_output_id) VALUES('mixed-image','ma_mixed','alice','image','https://test/mixed','upload','mixed','video-out');`);
    const mixed = await browseLibrary({ userId: 'alice', scope });
    for (const item of mixed.assets)
        assert.equal((await resolve('alice', [item.libraryRef]))[0].key, item.organization.key);
    // A large exact ancestry proof cannot be silently converted to ordinary/default organization state.
    await pg.pool.query(`INSERT INTO app_jobs(job_id,user_id) VALUES('proof-job','proof');
    INSERT INTO job_outputs(id,job_id,user_id,kind,url) VALUES('proof-out','proof-job','proof','image','https://test/proof');
    INSERT INTO media_assets(id,public_id,user_id,kind,url,source,source_job_id,source_output_id) VALUES('proof','ma_proof','proof','image','https://test/proof','saved_job_output','proof-job','proof-out');
    INSERT INTO user_assets(asset_id,user_id,url,mime_type,source,metadata) SELECT 'proof-'||i,'proof','https://test/proof','image/png','generated','{"jobId":"proof-job","sourceOutputId":"proof-out"}' FROM generate_series(1,1001)i;`);
    assert.equal((await resolve('proof', [{ type: 'asset', assetId: 'ma_proof', kind: 'image' }]))[0].error, 'IDENTITY_PROOF_LIMIT');
    await assert.rejects(browseLibrary({ userId: 'proof', scope }), /IDENTITY_PROOF_LIMIT/);
    await assert.rejects(createLibrarySelectionSnapshot({ userId: 'proof', scope }), /IDENTITY_PROOF_LIMIT/);
    assert.equal((await pg.pool.query("SELECT count(*) FROM library_selection_snapshots WHERE user_id='proof'")).rows[0].count, '0');
    await pg.pool.query(`DELETE FROM user_assets WHERE asset_id='proof-1001'`);
    const accepted = await browseLibrary({ userId: 'proof', scope });
    assert.equal(accepted.totalCount, 1);
    assert.equal(accepted.assets[0].organization.key, (await resolve('proof', [accepted.assets[0].libraryRef]))[0].key);
    const frozen = await createLibrarySelectionSnapshot({ userId: 'proof', scope });
    await pg.pool.query(`INSERT INTO user_assets(asset_id,user_id,url,mime_type,source,metadata) VALUES('proof-1001','proof','https://test/proof','image/png','generated','{"jobId":"proof-job","sourceOutputId":"proof-out"}')`);
    const { mutateLibrarySelectionSnapshot } = await import('../frontend/server/media-library/selection');
    const proofFailure = await mutateLibrarySelectionSnapshot({ userId: 'proof', snapshotId: frozen.id, operation: 'favorite' });
    assert.deepEqual(proofFailure.failed, [{ key: frozen.keys[0], errorCode: 'IDENTITY_PROOF_LIMIT' }]);
    assert.equal(proofFailure.succeededCount, 0);
    await pg.pool.query(`DELETE FROM user_assets WHERE asset_id='proof-1001';
    INSERT INTO user_assets(asset_id,user_id,url,mime_type,source,metadata) SELECT 'output-noise-'||i,'proof','https://test/proof','image/png','upload','{}' FROM generate_series(1,1001)i;`);
    const stableOutput = await browseLibrary({ userId: 'proof', scope });
    assert.equal(stableOutput.totalCount, 1);
    assert.equal(stableOutput.assets[0].organization.key, frozen.keys[0]);
    await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,source,created_at) VALUES('ambiguous','ma_ambiguous','wide','image','https://test/wide','upload','2026-02-01');
    INSERT INTO user_assets(asset_id,user_id,url,mime_type,source,metadata,created_at) SELECT 'legacy-'||i,'wide','https://test/wide','image/png','upload','{}','2026-01-01' FROM generate_series(1,1001)i;`);
    const wideAsset = { type: 'asset', assetId: 'ma_ambiguous', kind: 'image' } as const, wideLegacy = { type: 'legacy', assetId: 'legacy-1001', kind: 'image' } as const;
    for (const refs of [[wideAsset], [wideLegacy], [wideAsset, wideLegacy]]) {
        const result = await resolve('wide', refs);
        assert.ok(result.every(row => row.error === 'IDENTITY_PROOF_LIMIT'));
        assert.ok(result.every(row => !row.key && !row.state));
    }
    await assert.rejects(browseLibrary({ userId: 'wide', scope }), /IDENTITY_PROOF_LIMIT/);
    const unresolved = await mutate({ userId: 'wide', operation: 'favorite', references: [wideAsset, wideLegacy] });
    assert.equal(unresolved.failedCount, 2);
    assert.equal((await pg.pool.query("SELECT count(*) FROM library_organization WHERE user_id='wide'")).rows[0].count, '0');
    // Exact shared-ID proof remains usable despite unrelated similarity rows.
    await pg.pool.query(`INSERT INTO user_assets(asset_id,user_id,url,mime_type,source,metadata,created_at) VALUES('ambiguous','wide','https://test/wide','image/png','upload','{}','2026-02-01')`);
    const exact = await resolve('wide', [wideAsset]);
    assert.ok(exact[0].key);
    assert.equal(exact[0].error, undefined);
    await pg.pool.query("UPDATE media_assets SET source='character' WHERE id='ambiguous'");
    const exactPage = await browseLibrary({ userId: 'wide', scope: { ...scope, source: 'character' } });
    assert.equal(exactPage.assets[0].organization.key, exact[0].key);
    // Known persisted anchor from an earlier small component must survive later similarity arrivals.
    await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,source,metadata,created_at) VALUES('known','ma_known','known','image','https://test/known','upload','{"label":"known"}','2026-02-01');
    INSERT INTO user_assets(asset_id,user_id,url,mime_type,source,metadata,created_at) VALUES('old-known','known','https://test/known','image/png','upload','{}','2026-01-01')`);
    const knownRef = { type: 'asset', assetId: 'ma_known', kind: 'image' } as const;
    const known = await mutate({ userId: 'known', operation: 'favorite', references: [knownRef] });
    await pg.pool.query(`INSERT INTO user_assets(asset_id,user_id,url,mime_type,source,metadata,created_at) SELECT 'noise-'||i,'known','https://test/known','image/png','upload','{}','2025-01-01' FROM generate_series(1,1001)i;`);
    assert.equal((await resolve('known', [knownRef]))[0].key, known.results[0].key);
    const knownPage = await browseLibrary({ userId: 'known', scope });
    assert.equal(knownPage.totalCount, 1);
    assert.equal(knownPage.assets[0].organization.key, known.results[0].key);
    assert.equal(knownPage.assets[0].organization.favorite, true);
    const { randomBytes } = await import('node:crypto');
    const { readFileSync } = await import('node:fs');
    const longUrl = 'https://test/long/' + randomBytes(9000).toString('hex');
    await pg.pool.query('DROP INDEX user_assets_owner_url_lookup_idx;DROP INDEX user_assets_owner_origin_lookup_idx;DROP INDEX media_assets_owner_url_lookup_idx;DROP INDEX media_assets_owner_origin_lookup_idx');
    await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,source,metadata) VALUES('long-canonical','ma_long','long','image','https://test/durable','import',jsonb_build_object('originUrl',$1::text))`, [longUrl]);
    await pg.pool.query(`INSERT INTO user_assets(asset_id,user_id,url,mime_type,source,metadata) VALUES('long-legacy','long',$1,'image/png','upload','{}')`, [longUrl]);
    await pg.pool.query(readFileSync('neon/migrations/97_media_library_organization.sql', 'utf8'));
    assert.equal((await pg.pool.query("SELECT count(*) FROM pg_indexes WHERE indexname IN('user_assets_owner_url_lookup_idx','user_assets_owner_origin_lookup_idx','media_assets_owner_origin_lookup_idx','media_assets_owner_url_lookup_idx')")).rows[0].count, '4');
    const longRows = await resolve('long', [{ type: 'legacy', assetId: 'long-legacy', kind: 'image' }, { type: 'asset', assetId: 'ma_long', kind: 'image' }]);
    assert.ok(longRows.every(row => row.key && !row.error));
    assert.equal(longRows[0].key, longRows[1].key);
    await pg.pool.query(`INSERT INTO app_jobs(job_id,user_id,hidden) VALUES('retained-job','retained',true);
      INSERT INTO job_outputs(id,job_id,user_id,kind,url,status) VALUES('retained-out','retained-job','retained','image','https://test/retained','deleted');
      INSERT INTO media_assets(id,public_id,user_id,kind,url,source,source_job_id,source_output_id,metadata) VALUES('retained-copy','ma_retained','retained','image','https://test/retained-copy','saved_job_output','retained-job','retained-out','{"originUrl":"https://test/retained"}')`);
    const retained = await browseLibrary({ userId: 'retained', scope });
    assert.equal(retained.totalCount, 1);
    assert.equal(retained.assets[0].organization.key, (await resolve('retained', [retained.assets[0].libraryRef]))[0].key);
    assert.equal((await browseLibrary({ userId: 'retained', scope: { ...scope, view: 'review' } })).totalCount, 0);
});
