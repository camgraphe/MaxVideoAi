import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, readFile, rm, chmod, symlink, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import { openStagingBatch, type StoragePorts, type Journal, type Grant } from '../scripts/launch-media/private-staging';
import { loadPrivateRegistry, writePrivateJson } from '../scripts/launch-media/local-registry';
import type { Manifest, Registration } from '../scripts/launch-media/manifest';

const sharp = createRequire(join(process.cwd(), 'frontend/package.json'))('sharp');
const sha = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
const ids = ['NB21-JANITOR-IDENTITY', 'NB21-JANITOR-BANK', 'NB21-FASHION-IDENTITY', 'NB21-FASHION-LOCATION', 'NB21-STORM-WORLD'];
const scenes = [
  { sceneId: 'K4-JANITOR-US', referenceIds: ids.slice(0, 2) },
  { sceneId: 'C06', referenceIds: ids.slice(2, 4) },
  { sceneId: 'C07', referenceIds: ids.slice(4) },
];
const now = new Date('2026-10-26T10:00:00.000Z');

async function fixture(t: test.TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'launch-staging-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const image: Buffer = await sharp({ create: { width: 16, height: 9, channels: 3, background: '#abcdef' } }).png().toBuffer();
  const native = Buffer.from('{"provider":"vertex","fixture":true}');
  const master = join(directory, 'master.png');
  const nativePath = join(directory, 'native.json');
  await writeFile(master, image, { mode: 0o600 });
  await writeFile(nativePath, native, { mode: 0o600 });
  const target = { bucket: 'offline-launch-fixture', region: 'us-east-1' };
  const ownerToken = 'b'.repeat(32);
  const manifest: Manifest = {
    schemaVersion: 1, batchId: 'launch-a', ownerId: 'fixture-owner', ownerToken,
    targetFingerprintSha256: sha(JSON.stringify([target.bucket, target.region])),
    references: ids.map(id => ({
      id, role: id.endsWith('IDENTITY') ? 'identity' : 'environment', key: `editorial/drafts/launch-media/launch-a/${ownerToken}/${id}-${sha(image)}.png`,
      sourcePath: master, sha256: sha(image), size: image.length, mime: 'image/png', width: 16, height: 9,
      disposition: 'create',
      provenance: { provider: 'vertex', model: 'gemini-nano-banana-2.1', nativeResponsePath: nativePath, nativeResponseSha256: sha(native), promptSha256: 'a'.repeat(64) },
    })), dependencies: structuredClone(scenes),
  };
  const registration: Registration = {
    account: 'Camgraph', ownerId: manifest.ownerId, ownerToken, batchId: manifest.batchId,
    targetFingerprintSha256: manifest.targetFingerprintSha256, manifestSha256: sha(JSON.stringify(manifest)),
    referenceCount: 5, dependencyCount: 3,
  };
  const calls: (
    | { kind: 'put'; input: Parameters<StoragePorts['put']>[0] }
    | { kind: 'read' | 'delete'; input: string }
    | { kind: 'sign'; input: { key: string; options: Parameters<StoragePorts['sign']>[1] } }
  )[] = [];
  const saved: Journal[] = [];
  const ports: StoragePorts = {
    target: () => target,
    put: async input => { calls.push({ kind: 'put', input }); },
    read: async key => { calls.push({ kind: 'read', input: key }); return { data: image, mime: 'image/png' }; },
    sign: async (key, options) => {
      calls.push({ kind: 'sign', input: { key, options } });
      return `https://${target.bucket}.s3.${target.region}.amazonaws.com/${key}?X-Amz-Date=20261026T100000Z&X-Amz-Expires=${options.expiresInSeconds}&X-Amz-Signature=offline-fixture`;
    },
    delete: async key => { calls.push({ kind: 'delete', input: key }); },
  };
  let clock = now;
  const open = (state?: Journal) => openStagingBatch({
    manifest, registration, ports, state, now: () => clock,
    save: async state => { saved.push(structuredClone(state)); },
  });
  return { directory, master, image, nativePath, manifest, registration, calls, saved, ports, open,
    repin() { registration.manifestSha256 = sha(JSON.stringify(manifest)); registration.referenceCount = manifest.references.length; registration.dependencyCount = manifest.dependencies.length; }, setNow(value: Date) { clock = value; } };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;

test('validates the complete lot then conditionally stages five exact private originals without creating jobs', async t => {
  const f = await fixture(t);
  const batch = await f.open();
  await batch.stage();
  assert.equal(f.calls.length, 5);
  for (let i = 0; i < 5; i++) {
    assert.equal(f.calls[i].kind, 'put');
    assert.deepEqual(f.calls[i].input, {
      key: f.manifest.references[i].key, data: f.image, mime: 'image/png',
      acl: null, cacheControl: 'private, no-store', conditionalCreate: true,
    });
  }
  assert.equal(f.saved[0].objects[ids[0]].status, 'uncertain', 'intent must be durable before PUT');
  assert.equal(f.saved.at(-1)!.jobs.C06.status, 'not-submitted');
  assert.deepEqual(batch.summary(), { references: 5, created: 5, preexisting: 0, deleted: 0, held: 0, jobsTerminal: 0 });
});

for (const [name, mutate, error] of [
  ['foreign owner', (f: Fixture) => { f.registration.ownerId = 'foreign'; }, 'OWNER'],
  ['foreign account', (f: Fixture) => { Object.assign(f.registration, { account: 'Other' }); }, 'OWNER'],
  ['target mismatch', (f: Fixture) => { f.ports.target = () => ({ bucket: 'other', region: 'us-east-1' }); }, 'TARGET'],
  ['unpinned manifest', (f: Fixture) => { f.manifest.references[0].width = 17; }, 'MANIFEST_DIGEST'],
  ['traversal', (f: Fixture) => { f.manifest.batchId = '../escape'; f.registration.batchId = '../escape'; f.repin(); }, 'PATH'],
  ['encoded token', (f: Fixture) => { f.manifest.ownerToken = '%2f' + 'a'.repeat(32); f.registration.ownerToken = f.manifest.ownerToken; f.repin(); }, 'PATH'],
  ['foreign key', (f: Fixture) => { f.manifest.references[0].key = 'editorial/drafts/other/image.png'; f.repin(); }, 'KEY'],
  ['duplicate key', (f: Fixture) => { f.manifest.references[1].key = f.manifest.references[0].key; f.repin(); }, 'KEY'],
  ['unpinned order', (f: Fixture) => { f.manifest.dependencies[0].referenceIds.reverse(); }, 'MANIFEST_DIGEST'],
  ['missing reference', (f: Fixture) => { f.manifest.references.pop(); f.repin(); }, 'REFERENCES'],
  ['unknown reference', (f: Fixture) => { f.manifest.references[4].id = 'UNLISTED'; f.repin(); }, 'REFERENCES'],
  ['hash mismatch', (f: Fixture) => { f.manifest.references[4].sha256 = 'c'.repeat(64); f.manifest.references[4].key = f.manifest.references[4].key.replace(sha(f.image), 'c'.repeat(64)); f.repin(); }, 'BYTES'],
  ['MIME spoofing', (f: Fixture) => { f.manifest.references[4].mime = 'image/jpeg'; f.manifest.references[4].key = f.manifest.references[4].key.replace('.png', '.jpg'); f.repin(); }, 'BYTES'],
  ['size mismatch', (f: Fixture) => { f.manifest.references[4].size++; f.repin(); }, 'BYTES'],
  ['dimensions mismatch', (f: Fixture) => { f.manifest.references[4].height++; f.repin(); }, 'BYTES'],
  ['native provenance changed', (f: Fixture) => { f.manifest.references[4].provenance.nativeResponseSha256 = 'c'.repeat(64); f.repin(); }, 'PROVENANCE'],
] as const) {
  test(`rejects ${name} before any storage call`, async t => {
    const f = await fixture(t); mutate(f);
    await assert.rejects(f.open, new RegExp(`LAUNCH_${error}`));
    assert.deepEqual(f.calls, []);
  });
}

test('decodes the whole image rather than accepting a valid PNG header with corrupt pixels', async t => {
  const f = await fixture(t);
  const broken = f.image.subarray(0, 40);
  await writeFile(f.master, broken);
  for (const ref of f.manifest.references) {
    ref.sha256 = sha(broken); ref.size = broken.length;
    ref.key = ref.key.replace(sha(f.image), sha(broken));
  }
  f.repin();
  await assert.rejects(f.open, /LAUNCH_BYTES/);
  assert.deepEqual(f.calls, []);
});

test('pins the validated manifest and buffers against caller mutation and rechecks the target before storage', async t => {
  const f = await fixture(t); const batch = await f.open();
  const originalKey = f.manifest.references[0].key;
  f.manifest.references[0].key = 'foreign';
  await writeFile(f.master, 'changed after preflight');
  await batch.stage();
  assert.equal((f.calls[0].input as Parameters<StoragePorts['put']>[0]).key, originalKey);
  assert.deepEqual((f.calls[0].input as Parameters<StoragePorts['put']>[0]).data, f.image);
  f.calls.length = 0;
  f.ports.target = () => ({ bucket: 'changed', region: 'us-east-1' });
  await assert.rejects(() => batch.issueGrants('C06', { expiresInSeconds: 86400, credentialsValidUntil: '2026-10-28T10:00:00Z' }), /LAUNCH_TARGET/);
  assert.deepEqual(f.calls, []);
});

for (const [name, reason, status] of [
  ['collision', { context: { code: 'precondition-conflict' } }, 'collision'],
  ['ambiguous write', new Error('sensitive upstream URL and owner'), 'uncertain'],
] as const) {
  test(`holds ${name} without retry, adoption or deletion`, async t => {
    const f = await fixture(t); const put = f.ports.put;
    f.ports.put = async input => { if (f.calls.length === 1) throw reason; await put(input); };
    const batch = await f.open();
    await assert.rejects(() => batch.stage(), new RegExp(`LAUNCH_${status.toUpperCase()}`));
    assert.equal(f.saved.at(-1)!.objects[ids[1]].status, status);
    await assert.rejects(() => batch.stage(), /LAUNCH_HELD/);
    assert.equal(f.calls.filter(x => x.kind === 'put').length, 1);
    for (const scene of scenes) await batch.recordJob(scene.sceneId, { status: 'abandoned', review: 'abandoned' });
    await batch.cleanup();
    assert.deepEqual(f.calls.filter(x => x.kind === 'delete').map(x => x.input), [f.manifest.references[0].key]);
    assert.deepEqual(await readFile(f.master), f.image);
  });
}

test('does not invoke PUT when durable intent cannot be saved', async t => {
  const f = await fixture(t);
  const batch = await openStagingBatch({ manifest: f.manifest, registration: f.registration, ports: f.ports,
    now: () => now, save: async () => { throw Error('private path'); } });
  await assert.rejects(() => batch.stage(), /LAUNCH_JOURNAL/);
  assert.deepEqual(f.calls, []);
});

test('verifies explicitly preexisting bytes and excludes them from exact idempotent cleanup', async t => {
  const f = await fixture(t); f.manifest.references[0].disposition = 'preexisting'; f.repin();
  const batch = await f.open(); await batch.stage();
  assert.equal(f.calls.filter(x => x.kind === 'read').length, 1);
  assert.equal(f.calls.filter(x => x.kind === 'put').length, 4);
  for (const scene of scenes) await batch.recordJob(scene.sceneId, { status: 'abandoned', review: 'abandoned' });
  f.ports.delete = async key => { f.calls.push({ kind: 'delete', input: key }); throw { name: 'NoSuchKey', $metadata: { httpStatusCode: 404 } }; };
  await batch.cleanup(); await batch.cleanup();
  assert.deepEqual(f.calls.filter(x => x.kind === 'delete').map(x => x.input), f.manifest.references.slice(1).map(x => x.key));
  assert.equal(batch.summary().preexisting, 1);
  assert.equal(batch.summary().deleted, 4);
});

test('refuses to sign a preexisting object with mismatched bytes', async t => {
  const f = await fixture(t); f.manifest.references[0].disposition = 'preexisting'; f.repin();
  f.ports.read = async () => ({ data: Buffer.from('wrong'), mime: 'image/png' });
  const batch = await f.open();
  await assert.rejects(() => batch.stage(), /LAUNCH_BYTES/);
  await assert.rejects(() => batch.issueGrants('K4-JANITOR-US', { expiresInSeconds: 300, credentialsValidUntil: '2026-10-28T10:00:00Z' }), /LAUNCH_NOT_STAGED/);
});

test('issues explicit ordered GET grants with a 24-hour bound and keeps URLs out of the journal and public summary', async t => {
  const f = await fixture(t); const batch = await f.open(); await batch.stage();
  const grants = await batch.issueGrants('K4-JANITOR-US', { expiresInSeconds: 86400, credentialsValidUntil: '2026-10-28T10:00:00Z' });
  assert.deepEqual(grants.map(g => g.referenceId), ids.slice(0, 2));
  assert.deepEqual(f.calls.filter(x => x.kind === 'sign').map(x => x.input), f.manifest.references.slice(0, 2).map(x => ({ key: x.key, options: { method: 'GET', expiresInSeconds: 86400 } })));
  assert.equal(grants[0].issuedAt, '2026-10-26T10:00:00.000Z');
  assert.equal(grants[0].expiresAt, '2026-10-27T10:00:00.000Z');
  batch.assertGrants('K4-JANITOR-US', grants);
  assert.doesNotMatch(JSON.stringify(f.saved), /X-Amz-|https:/);
  assert.doesNotMatch(JSON.stringify(batch.summary()), /fixture-owner|NB21|editorial|https:/);
  for (const tamper of [
    (g: Grant[]) => { Object.assign(g[0], { method: 'HEAD' }); },
    (g: Grant[]) => { g[0].url += '&extra=1'; },
    (g: Grant[]) => { g[0].url = g[0].url.replace('editorial/drafts', 'other/drafts'); },
    (g: Grant[]) => { g[0].issuedAt = '2026-10-26T11:00:00.000Z'; },
    (g: Grant[]) => { g.reverse(); },
  ]) {
    const changed = structuredClone(grants); tamper(changed);
    assert.throws(() => batch.assertGrants('K4-JANITOR-US', changed), /LAUNCH_GRANT/);
  }
  f.setNow(new Date('2026-10-25T10:00:00Z'));
  assert.throws(() => batch.assertGrants('K4-JANITOR-US', grants), /LAUNCH_GRANT/);
  f.setNow(new Date('2026-10-27T10:00:00Z'));
  assert.throws(() => batch.assertGrants('K4-JANITOR-US', grants), /LAUNCH_GRANT/);
});

test('rejects invalid TTLs, unknown scenes and insufficient credential lifetime before signing', async t => {
  const f = await fixture(t); const batch = await f.open(); await batch.stage(); f.calls.length = 0;
  for (const expiresInSeconds of [0, -1, 86401, NaN, Infinity, 0.5]) {
    await assert.rejects(() => batch.issueGrants('C06', { expiresInSeconds, credentialsValidUntil: '2026-10-28T10:00:00Z' }), /LAUNCH_TTL/);
  }
  await assert.rejects(() => batch.issueGrants('C06', { expiresInSeconds: 86400, credentialsValidUntil: '2026-10-26T11:00:00Z' }), /LAUNCH_CREDENTIAL_LIFETIME/);
  await assert.rejects(() => batch.issueGrants('unknown', { expiresInSeconds: 300, credentialsValidUntil: '2026-10-28T10:00:00Z' }), /LAUNCH_REFERENCES/);
  assert.deepEqual(f.calls, []);
});

test('rejects an SDK result for a different key or lifetime rather than releasing an unbound grant', async t => {
  const f = await fixture(t); const batch = await f.open(); await batch.stage();
  f.ports.sign = async () => 'https://offline-launch-fixture.s3.us-east-1.amazonaws.com/foreign?X-Amz-Date=20261026T100000Z&X-Amz-Expires=86400&X-Amz-Signature=offline';
  await assert.rejects(() => batch.issueGrants('C06', { expiresInSeconds: 86400, credentialsValidUntil: '2026-10-28T10:00:00Z' }), /LAUNCH_GRANT/);
});

test('keeps all objects while a dependent request or adoption review is unfinished, even after expiry', async t => {
  const f = await fixture(t); const batch = await f.open(); await batch.stage();
  await batch.issueGrants('K4-JANITOR-US', { expiresInSeconds: 300, credentialsValidUntil: '2026-10-28T10:00:00Z' });
  await batch.recordJob('K4-JANITOR-US', { status: 'accepted', requestId: 'private-real-request-fixture' });
  await batch.recordJob('C06', { status: 'abandoned', review: 'abandoned' });
  await batch.recordJob('C07', { status: 'abandoned', review: 'abandoned' });
  f.setNow(new Date('2026-10-28T10:00:00Z'));
  await assert.rejects(() => batch.cleanup(), /LAUNCH_RETENTION/);
  await assert.rejects(() => batch.issueGrants('K4-JANITOR-US', { expiresInSeconds: 300, credentialsValidUntil: '2026-10-30T10:00:00Z' }), /LAUNCH_ALREADY_SUBMITTED/);
  await assert.rejects(() => batch.recordJob('K4-JANITOR-US', { status: 'running', requestId: 'replacement' }), /LAUNCH_REQUEST_ID/);
  await batch.recordJob('K4-JANITOR-US', { status: 'succeeded', requestId: 'private-real-request-fixture' });
  await assert.rejects(() => batch.cleanup(), /LAUNCH_RETENTION/);
  await batch.recordJob('K4-JANITOR-US', { status: 'succeeded', requestId: 'private-real-request-fixture', review: 'complete' });
  await assert.rejects(() => batch.recordJob('K4-JANITOR-US', { status: 'running', requestId: 'private-real-request-fixture' }), /LAUNCH_JOB_STATE/);
  await batch.cleanup();
  assert.equal(f.calls.filter(x => x.kind === 'delete').length, 5);
  assert.deepEqual(await readFile(f.master), f.image);
});

test('resumes from a bound journal and refuses foreign manifests or forged inventory states', async t => {
  const f = await fixture(t); const batch = await f.open(); await batch.stage();
  const saved = f.saved.at(-1)!;
  const resumed = await f.open(saved); f.calls.length = 0;
  await resumed.stage(); assert.deepEqual(f.calls, []);
  const foreign = structuredClone(saved); foreign.manifestSha256 = 'a'.repeat(64);
  await assert.rejects(() => f.open(foreign), /LAUNCH_JOURNAL/);
  const extra = structuredClone(saved); extra.objects.foreign = { status: 'created' };
  await assert.rejects(() => f.open(extra), /LAUNCH_JOURNAL/);
});

test('retains references shared by a second explicitly declared video until both requests and reviews are final', async t => {
  const f = await fixture(t);
  f.manifest.dependencies.push({ sceneId: 'JANITOR-RESERVE', referenceIds: ids.slice(0, 2) }); f.repin();
  const batch = await f.open(); await batch.stage();
  for (const sceneId of ['K4-JANITOR-US', 'JANITOR-RESERVE']) {
    await batch.issueGrants(sceneId, { expiresInSeconds: 300, credentialsValidUntil: '2026-10-28T10:00:00Z' });
    await batch.recordJob(sceneId, { status: 'accepted', requestId: `real-${sceneId}` });
  }
  await batch.recordJob('K4-JANITOR-US', { status: 'succeeded', requestId: 'real-K4-JANITOR-US', review: 'complete' });
  for (const sceneId of ['C06', 'C07']) await batch.recordJob(sceneId, { status: 'abandoned', review: 'abandoned' });
  await assert.rejects(() => batch.cleanup(), /LAUNCH_RETENTION/);
  assert.equal(f.calls.filter(x => x.kind === 'delete').length, 0);
  await batch.recordJob('JANITOR-RESERVE', { status: 'failed', requestId: 'real-JANITOR-RESERVE', review: 'complete' });
  await batch.cleanup(); assert.equal(batch.summary().deleted, 5);
});

test('accepts a supplied nine-video graph with a different reference count and preserves each ordered edge', async t => {
  const f = await fixture(t);
  f.manifest.references = f.manifest.references.slice(0, 3);
  f.manifest.dependencies = Array.from({ length: 9 }, (_, i) => ({ sceneId: `CLIP-${i + 1}`, referenceIds: [ids[i % 3], ids[(i + 1) % 3]] }));
  f.repin(); const batch = await f.open(); await batch.stage();
  assert.equal(batch.summary().references, 3); assert.equal(batch.summary().created, 3);
  const grants = await batch.issueGrants('CLIP-3', { expiresInSeconds: 300, credentialsValidUntil: '2026-10-28T10:00:00Z' });
  assert.deepEqual(grants.map(g => g.referenceId), [ids[2], ids[0]]);
  const counts = structuredClone(f.registration); f.registration.referenceCount = 2;
  await assert.rejects(f.open, /LAUNCH_REFERENCES/); Object.assign(f.registration, counts);
  f.manifest.dependencies[8].referenceIds = ['foreign']; f.repin();
  await assert.rejects(f.open, /LAUNCH_REFERENCES/);
});

for (const format of ['jpeg', 'webp'] as const) {
  test(`checks decoded ${format} originals rather than trusting declared extensions`, async t => {
    const f = await fixture(t); const bytes = await sharp(f.image)[format]().toBuffer();
    await writeFile(f.master, bytes);
    for (const ref of f.manifest.references) {
      ref.sha256 = sha(bytes); ref.size = bytes.length; ref.mime = `image/${format}`;
      ref.key = ref.key.replace(sha(f.image), sha(bytes)).replace('.png', format === 'jpeg' ? '.jpg' : '.webp');
    }
    f.repin(); const batch = await f.open(); await batch.stage(); assert.equal(batch.summary().created, 5);
  });
}

async function privateRegistry(f: Awaited<ReturnType<typeof fixture>>) {
  const manifestPath = join(f.directory, 'manifest.json');
  const statePath = join(f.directory, 'journal.json');
  const registryPath = join(f.directory, 'registry.json');
  await writeFile(manifestPath, JSON.stringify(f.manifest), { mode: 0o600 });
  await writeFile(registryPath, JSON.stringify({ schemaVersion: 1, registration: f.registration, manifestPath, statePath }), { mode: 0o600 });
  return { registryPath, manifestPath, statePath };
}

test('loads only private local registration, serializes operators and persists an atomic private journal', async t => {
  const f = await fixture(t); const files = await privateRegistry(f);
  const local = await loadPrivateRegistry(files.registryPath);
  try {
    await assert.rejects(() => loadPrivateRegistry(files.registryPath), /LAUNCH_LOCKED/);
    const batch = await openStagingBatch({ ...local, ports: f.ports }); await batch.stage();
    assert.equal(JSON.parse(await readFile(files.statePath, 'utf8')).objects[ids[0]].status, 'created');
  } finally { await local.close(); }
  const resumed = await loadPrivateRegistry(files.registryPath);
  try { assert.equal(resumed.state?.objects[ids[0]].status, 'created'); } finally { await resumed.close(); }
  await chmod(files.registryPath, 0o644);
  await assert.rejects(() => loadPrivateRegistry(files.registryPath), /LAUNCH_PRIVATE_FILE/);
});

test('rejects symlink registries, public directories, repository and OUTREACH paths without SDK', async t => {
  const f = await fixture(t); const files = await privateRegistry(f);
  const link = join(f.directory, 'registry-link.json'); await symlink(files.registryPath, link);
  await assert.rejects(() => loadPrivateRegistry(link), /LAUNCH_PRIVATE_FILE/);
  await chmod(f.directory, 0o755);
  await assert.rejects(() => loadPrivateRegistry(files.registryPath), /LAUNCH_PRIVATE_FILE/);
  await chmod(f.directory, 0o700);
  const outreach = join(f.directory, 'OUTREACH'); await mkdir(outreach, { mode: 0o700 });
  await assert.rejects(() => writePrivateJson(join(outreach, 'grants.json'), { secret: true }), /LAUNCH_PRIVATE_FILE/);
  await assert.rejects(() => writePrivateJson(join(process.cwd(), 'scripts/launch-media/private.json'), {}), /LAUNCH_PRIVATE_FILE/);
  assert.deepEqual(f.calls, []);
});

test('writes grants exclusively to an explicit private file and refuses overwrite', async t => {
  const f = await fixture(t); const path = join(f.directory, 'grants.json');
  await writePrivateJson(path, { url: 'https://offline.invalid/?X-Amz-Signature=fixture' });
  await assert.rejects(() => writePrivateJson(path, { replaced: true }), /LAUNCH_PRIVATE_FILE/);
  assert.match(await readFile(path, 'utf8'), /X-Amz-Signature=fixture/);
});

test('CLI validation is offline and stdout contains only counts; errors never print private paths or raw SDK details', async t => {
  const f = await fixture(t); const files = await privateRegistry(f);
  const environment = { ...process.env, S3_BUCKET: 'offline-launch-fixture', S3_REGION: 'us-east-1', S3_ACCESS_KEY_ID: '', S3_SECRET_ACCESS_KEY: '' };
  const run = (command: string) => spawnSync('pnpm', ['exec', 'tsx', '--tsconfig', 'frontend/tsconfig.json', 'scripts/launch-media/cli.ts', command, files.registryPath], { env: environment, encoding: 'utf8' });
  const result = run('validate'); assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { references: 5, created: 0, preexisting: 0, deleted: 0, held: 0, jobsTerminal: 0 });
  const error = run('stage'); assert.equal(error.status, 1);
  assert.match(error.stderr, /^LAUNCH_UNCERTAIN\n$/);
  assert.doesNotMatch(result.stdout + error.stderr, /fixture-owner|editorial|X-Amz-|registry.json|S3_|stack/);
});

test('the existing owned-media wrapper still clamps a 24-hour request to one hour', async () => {
  const bundled = await build({
    entryPoints: ['frontend/server/owned-media-read-access.ts'], bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
    tsconfig: 'frontend/tsconfig.json',
    define: { 'process.env.S3_BUCKET': '"offline-wrapper-fixture"', 'process.env.S3_REGION': '"us-east-1"', 'process.env.S3_PUBLIC_BASE_URL': '""' },
    plugins: [{ name: 'offline-access', setup(b) {
      b.onResolve({ filter: /marketing-media\/access$/ }, () => ({ path: 'access', namespace: 'offline' }));
      b.onLoad({ filter: /.*/, namespace: 'offline' }, () => ({ contents: 'export const canReadMarketingFile = async () => false;' }));
    } }],
  });
  const loaded = { exports: {} as { createOwnedMediaReadUrl(input: { url: string; userId: string; expiresInSeconds: number }, deps: { sign(key: string, options: { expiresInSeconds: number }): Promise<string> }): Promise<string> } };
  new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(createRequire(join(process.cwd(), 'frontend/package.json')), loaded, loaded.exports);
  let ttl = 0;
  const result = await loaded.exports.createOwnedMediaReadUrl({ url: 'https://offline-wrapper-fixture.s3.us-east-1.amazonaws.com/renders/images/owner/original.png', userId: 'owner', expiresInSeconds: 86400 }, {
    sign: async (key: string, options: { expiresInSeconds: number }) => { assert.equal(key, 'renders/images/owner/original.png'); ttl = options.expiresInSeconds; return 'offline-result'; },
  });
  assert.equal(result, 'offline-result'); assert.equal(ttl, 3600);
});

for (const [name, mutate] of [
  ['duplicate reference IDs', (f: Fixture) => { f.manifest.references[1].id = f.manifest.references[0].id; }],
  ['duplicate dependency IDs', (f: Fixture) => { f.manifest.dependencies[1].sceneId = f.manifest.dependencies[0].sceneId; }],
  ['duplicate edge', (f: Fixture) => { f.manifest.dependencies[0].referenceIds = [ids[0], ids[0]]; }],
  ['path in reference ID', (f: Fixture) => { f.manifest.references[0].id = '../private'; }],
  ['prototype key', (f: Fixture) => { f.manifest.dependencies[0].sceneId = '__proto__'; }],
  ['missing role', (f: Fixture) => { Object.assign(f.manifest.references[0], { role: '' }); }],
  ['unbounded reference cardinality', (f: Fixture) => { f.registration.referenceCount = 100000; }],
] as const) {
  test(`rejects ${name} in a supplied graph before SDK`, async t => {
    const f = await fixture(t); mutate(f);
    f.registration.manifestSha256 = sha(JSON.stringify(f.manifest));
    await assert.rejects(f.open, /LAUNCH_REFERENCES/); assert.deepEqual(f.calls, []);
  });
}

test('tracks declared T2V dependencies without inventing references or requiring a grant', async t => {
  const f = await fixture(t);
  f.manifest.dependencies[0].referenceIds = [];
  f.repin(); const batch = await f.open(); await batch.stage();
  await batch.recordJob('K4-JANITOR-US', { status: 'accepted', requestId: 'actual-t2v-request' });
  await assert.rejects(() => batch.cleanup(), /LAUNCH_RETENTION/);
  assert.equal(f.calls.filter(x => x.kind === 'sign').length, 0);
  await batch.recordJob('K4-JANITOR-US', { status: 'succeeded', requestId: 'actual-t2v-request', review: 'complete' });
  for (const sceneId of ['C06', 'C07']) await batch.recordJob(sceneId, { status: 'abandoned', review: 'abandoned' });
  await batch.cleanup(); assert.equal(batch.summary().deleted, 5);
});

test('accepts a nine-video manifest with zero images when the supplied batch requires none', async t => {
  const f = await fixture(t); f.manifest.references = [];
  f.manifest.dependencies = Array.from({ length: 9 }, (_, i) => ({ sceneId: `T2V-${i}`, referenceIds: [] }));
  f.repin(); const batch = await f.open(); await batch.stage();
  assert.equal(batch.summary().references, 0);
  for (const scene of f.manifest.dependencies) await batch.recordJob(scene.sceneId, { status: 'abandoned', review: 'abandoned' });
  await batch.cleanup(); assert.deepEqual(f.calls, []);
});
