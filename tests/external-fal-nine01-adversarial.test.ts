import assert from 'node:assert/strict';
import test from 'node:test';
import { chmod, readFile, writeFile, symlink } from 'node:fs/promises';
import path from 'node:path';
import { parseExternalFalImport } from '../frontend/server/external-fal-import/contract';
import { verifyExternalFalEvidence } from '../frontend/server/external-fal-import/evidence';
import { loadNine01NativeEvidence, readPrivateNativeFile } from '../frontend/server/external-fal-import/nine01-evidence';
import { readPrivateStagingReference } from '../frontend/server/external-fal-import/private-staging-source';
import { nine01Fixture, fixtureSha, SOURCE_TARGET, SOURCE_TIME, RECOVERY_TIME, signedFixtureUrl } from './helpers/nine01-native-evidence-fixture';

type Fixture = Awaited<ReturnType<typeof nine01Fixture>>;
const record = (value: unknown) => value as Record<string, unknown>;
function identity(f: Fixture, bytes = f.bundleBytes) {
  const input = parseExternalFalImport({ ...f.input, evidenceSha256: fixtureSha(bytes) });
  if (input.engineId !== 'kling-v4') throw new Error('fixture');
  return input;
}
async function edit(f: Fixture, role: string, change: (data: Record<string, unknown>) => void) {
  const proof = f.bundle.files[role], data = JSON.parse(await readFile(proof.path, 'utf8'));
  change(data);
  const bytes = Buffer.from(JSON.stringify(data));
  await writeFile(proof.path, bytes);
  proof.sha256 = fixtureSha(bytes);
  return Buffer.from(JSON.stringify(f.bundle));
}
function canon(value: unknown): string {
  const sort = (v: unknown): unknown => Array.isArray(v) ? v.map(sort) : v && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sort(record(v)[k])])) : v;
  return JSON.stringify(sort(value));
}
async function editJournal(f: Fixture, change: (rows: Record<string, unknown>[]) => void, rechain = true) {
  let rows = (await readFile(f.bundle.files.journal.path, 'utf8')).trim().split('\n').map(line => record(JSON.parse(line)));
  change(rows);
  if (rechain) {
    let previous: string | null = null;
    rows = rows.map((row, index) => {
      const { eventSha256: _old, ...rest } = row;
      const body = { ...rest, sequence: index + 1, previousEventSha256: previous };
      const result = { ...body, eventSha256: fixtureSha(canon(body)) };
      previous = result.eventSha256;
      return result;
    });
  }
  const bytes = Buffer.from(rows.map(row => JSON.stringify(row)).join('\n') + '\n');
  await writeFile(f.bundle.files.journal.path, bytes);
  f.bundle.files.journal.sha256 = fixtureSha(bytes);
  return Buffer.from(JSON.stringify(f.bundle));
}

for (const [name, role, change, expected] of [
  ['changed submitted body', 'request', (d: Record<string, unknown>) => { d.prompt = 'Substituted prompt.'; }, /REQUEST/],
  ['wrong native acceptance identity', 'accepted', (d: Record<string, unknown>) => { d.requestId = 'wrong'; }, /ACCEPTANCE/],
  ['wrong native provider response identity', 'acceptedResponse', (d: Record<string, unknown>) => { d.request_id = 'wrong'; }, /ACCEPTANCE/],
  ['wrong completed status identity', 'status', (d: Record<string, unknown>) => { d.request_id = 'wrong'; }, /COMPLETION/],
  ['wrong original video hash', 'validation', (d: Record<string, unknown>) => { record(d.measured).sha256 = '0'.repeat(64); }, /RESULT/],
  ['wrong native result data', 'result', (d: Record<string, unknown>) => { record(d.video).url = 'https://fal.media/other.mp4'; }, /RESULT/],
  ['wrong endpoint in submission', 'submissionStarted', (d: Record<string, unknown>) => { d.endpointSha256 = '0'.repeat(64); }, /REQUEST/],
  ['wrong staging owner', 'stagingManifest', (d: Record<string, unknown>) => { d.ownerId = '44444444-4444-4444-8444-444444444444'; }, /STAGING_REGISTRATION/],
  ['wrong staging target', 'stagingRegistry', (d: Record<string, unknown>) => { record(d.registration).targetFingerprintSha256 = '0'.repeat(64); }, /STAGING_REGISTRATION/],
  ['wrong staging request identity', 'stagingState', (d: Record<string, unknown>) => { record(record(d.jobs)['K4-JANITOR-US']).requestId = 'wrong'; }, /STAGING_STATE/],
  ['deleted reference object', 'stagingState', (d: Record<string, unknown>) => { record(record(d.objects).REF01).status = 'deleted'; }, /REFERENCE_BINDING/],
] as const) test(`native source admission rejects ${name} even when that source file is rehashed`, async () => {
  const f = await nine01Fixture();
  try { const bytes = await edit(f, role, change); await assert.rejects(loadNine01NativeEvidence(identity(f, bytes), bytes, SOURCE_TARGET), expected); }
  finally { await f.cleanup(); }
});

for (const [name, change, expected] of [
  ['another app owner', (input: ReturnType<typeof identity>) => { input.ownerUserId = '44444444-4444-4444-8444-444444444444'; }, /OWNER_OR_SCOPE/],
  ['another endpoint', (input: ReturnType<typeof identity>) => { input.endpoint = 'https://example.test/'; }, /OWNER_OR_SCOPE/],
  ['reordered input references', (input: ReturnType<typeof identity>) => { input.references.reverse(); }, /REFERENCE_BINDING/],
  ['wrong reference hash', (input: ReturnType<typeof identity>) => { input.references[0].sha256 = '0'.repeat(64); }, /REFERENCE_BINDING/],
] as const) test(`native source admission rejects ${name} before private reads`, async () => {
  const f = await nine01Fixture();
  try { const input = identity(f); change(input); await assert.rejects(loadNine01NativeEvidence(input, f.bundleBytes, SOURCE_TARGET), expected); }
  finally { await f.cleanup(); }
});

for (const [name, change, expected] of [
  ['duplicate submission', (rows: Record<string, unknown>[]) => { rows.push({ ...rows.find(row => row.event === 'submission_started' && row.kind === 'fal')! }); }, /EVENT_submission_started/],
  ['duplicate acceptance', (rows: Record<string, unknown>[]) => { rows.push({ ...rows.find(row => row.event === 'fal_request_accepted')! }); }, /EVENT_fal_request_accepted/],
  ['Nano acceptance borrowed as Kling', (rows: Record<string, unknown>[]) => { rows.find(row => row.event === 'fal_request_accepted')!.operationId = 'NINE-01-NANO-01-BASE'; }, /EVENT_fal_request_accepted/],
  ['missing completed observation', (rows: Record<string, unknown>[]) => { rows.splice(rows.findIndex(row => row.event === 'fal_status_observed'), 1); }, /COMPLETION/],
] as const) test(`native journal rejects ${name} with an otherwise valid hash chain`, async () => {
  const f = await nine01Fixture();
  try { const bytes = await editJournal(f, change); await assert.rejects(loadNine01NativeEvidence(identity(f, bytes), bytes, SOURCE_TARGET), expected); }
  finally { await f.cleanup(); }
});

test('a broken original journal chain fails independently of the outer file hash', async () => {
  const f = await nine01Fixture();
  try { const bytes = await editJournal(f, rows => { rows[0].requestBodySha256 = 'e'.repeat(64); }, false);
    await assert.rejects(loadNine01NativeEvidence(identity(f, bytes), bytes, SOURCE_TARGET), /JOURNAL_CHAIN/); }
  finally { await f.cleanup(); }
});

test('irrelevant Nano records cannot add Kling evidence to the selected native summary', async () => {
  const f = await nine01Fixture();
  try { const bytes = await editJournal(f, rows => { rows.push({ ...rows.find(row => row.event === 'fal_request_accepted')!, operationId: 'NINE-01-NANO-02-BASE' }); });
    const verified = await loadNine01NativeEvidence(identity(f, bytes), bytes, SOURCE_TARGET);
    assert.equal(verified.summary.eventSequences.length, 5);
    assert.ok(!JSON.stringify(verified.summary).includes(f.dir));
    assert.ok(!JSON.stringify(verified.summary).includes('X-Amz-Signature'));
  } finally { await f.cleanup(); }
});

test('the option cannot borrow the base acceptance or result identity', async () => {
  const f = await nine01Fixture({ optional: true });
  try { const bytes = await edit(f, 'accepted', row => { row.requestId = '22222222-2222-4222-8222-222222222222'; });
    await assert.rejects(loadNine01NativeEvidence(identity(f, bytes), bytes, SOURCE_TARGET), /ACCEPTANCE/); }
  finally { await f.cleanup(); }
});

test('a grant already expired at the real submission cannot establish a historical reference binding', async () => {
  const f = await nine01Fixture({ submittedAtMs: SOURCE_TIME + 86400000 });
  try { await assert.rejects(loadNine01NativeEvidence(identity(f), f.bundleBytes, SOURCE_TARGET), /GRANT_EXPIRY/); }
  finally { await f.cleanup(); }
});

for (const [name, mutate] of [
  ['arbitrary host', (u: URL) => { u.hostname = 'example.test'; }],
  ['userinfo', (u: URL) => { u.username = 'user'; }],
  ['non-default port', (u: URL) => { u.port = '444'; }],
  ['other object', (u: URL) => { u.pathname = u.pathname.replace('REF01-', 'OTHER-'); }],
  ['encoded path trick', (u: URL) => { u.pathname = u.pathname.replace('editorial', '%65ditorial'); }],
  ['duplicate expiry', (u: URL) => { u.searchParams.append('X-Amz-Expires', '300'); }],
  ['overlong fresh grant', (u: URL) => { u.searchParams.set('X-Amz-Expires', '301'); }],
  ['another method', (u: URL) => { u.searchParams.set('x-id', 'PutObject'); }],
  ['redirect query', (u: URL) => { u.searchParams.set('redirect', 'https://example.test/'); }],
] as const) test(`private source reader refuses ${name} before fetching`, async () => {
  const f = await nine01Fixture();
  try {
    const url = new URL(signedFixtureUrl(f.grants[0].key, RECOVERY_TIME, 300)); mutate(url);
    await assert.rejects(readPrivateStagingReference({ slotId: 'image_urls.0', key: f.grants[0].key,
      sha256: f.input.references[0].sha256, size: f.image.length, mime: 'image/png' }, {
      target: SOURCE_TARGET, now: () => RECOVERY_TIME, sign: async () => url.toString(),
    }, f.fetcher), /IMPORT_NINE01_GRANT/);
    assert.equal(f.calls.length, 0);
  } finally { await f.cleanup(); }
});

test('a fresh grant which has expired is not fetched', async () => {
  const f = await nine01Fixture();
  try { await assert.rejects(readPrivateStagingReference({ slotId: 'image_urls.0', key: f.grants[0].key,
    sha256: f.input.references[0].sha256, size: f.image.length, mime: 'image/png' }, { target: SOURCE_TARGET, now: () => RECOVERY_TIME,
    sign: async key => signedFixtureUrl(key, RECOVERY_TIME - 301000, 300) }, f.fetcher), /GRANT_EXPIRY/);
    assert.equal(f.calls.length, 0);
  } finally { await f.cleanup(); }
});

for (const [name, response, expected] of [
  ['missing object', () => new Response(null, { status: 404 }), /REFERENCE_READ/],
  ['redirect', () => new Response(null, { status: 302, headers: { location: 'https://example.test/' } }), /REFERENCE_READ/],
  ['too many bytes', (f: Fixture) => new Response(Buffer.alloc(f.image.length + 1)), /REFERENCE_SIZE/],
  ['changed bytes', (f: Fixture) => new Response(Buffer.alloc(f.image.length)), /REFERENCE_HASH/],
] as const) test(`private source reader rejects ${name} without fallback or retry`, async () => {
  const f = await nine01Fixture(); let gets = 0;
  try { await assert.rejects(readPrivateStagingReference({ slotId: 'image_urls.0', key: f.grants[0].key,
    sha256: f.input.references[0].sha256, size: f.image.length, mime: 'image/png' }, { target: SOURCE_TARGET, now: () => RECOVERY_TIME,
    sign: async key => signedFixtureUrl(key, RECOVERY_TIME, 300) }, (async (_url, options) => {
      gets++; assert.equal(options?.method, 'GET'); assert.equal(options?.redirect, 'error'); return response(f);
    }) as typeof fetch), expected); assert.equal(gets, 1);
  } finally { await f.cleanup(); }
});

test('private proof files reject symlink leaves, public modes and a bounded oversized read', async () => {
  const f = await nine01Fixture();
  try {
    const alias = path.join(f.dir, 'alias.json'); await symlink(f.files.request.path, alias);
    await assert.rejects(readPrivateNativeFile(alias), /PRIVATE_FILE/);
    await chmod(f.files.request.path, 0o644); await assert.rejects(readPrivateNativeFile(f.files.request.path), /PRIVATE_FILE/);
    await chmod(f.files.request.path, 0o600); await assert.rejects(readPrivateNativeFile(f.files.request.path, 8), /PRIVATE_FILE/);
  } finally { await f.cleanup(); }
});

test('legacy imports still reject S3 references even when a native source port is supplied', async () => {
  const f = await nine01Fixture(); let signs = 0;
  try {
    const { evidenceProfile: _profile, ...raw } = f.input;
    const journal = Buffer.from([{ event: 'submission_started', endpoint: f.endpoint, input: f.body },
      { event: 'accepted', requestId: f.requestId }, { event: 'recovered', requestId: f.requestId, status: 'COMPLETED',
        result: { requestId: '', data: f.result } }].map(row => JSON.stringify(row)).join('\n'));
    const input = parseExternalFalImport({ ...raw, evidenceSha256: fixtureSha(journal) });
    await assert.rejects(verifyExternalFalEvidence(input, f.assets, { journal, fetcher: f.fetcher, readUrl: async ({ url }) => url,
      provider: { status: async () => ({ status: 'COMPLETED', request_id: f.requestId }), result: async () => ({ requestId: '', data: f.result }) },
      nativeSource: { target: SOURCE_TARGET, sign: async key => { signs++; return signedFixtureUrl(key, RECOVERY_TIME, 300); } },
    }), /IMPORT_PROVIDER_MEDIA_HOST/);
    assert.equal(signs, 0); assert.ok(!f.calls.some(url => url.includes('.s3.')));
  } finally { await f.cleanup(); }
});

test('invalid native source JSON and profile errors are sanitized instead of printing private input values', async () => {
  const f = await nine01Fixture();
  try {
    const sentinel = 'test-private-grant-sentinel';
    for (const [bytes, code] of [[Buffer.from('{"secret":"' + sentinel + '", broken}'), 'IMPORT_NINE01_SOURCE_JSON'],
      [Buffer.from(JSON.stringify({ ...f.bundle, profile: sentinel })), 'IMPORT_NINE01_BUNDLE_SCHEMA']] as const) {
      await assert.rejects(loadNine01NativeEvidence(identity(f, bytes), bytes, SOURCE_TARGET), error =>
        error instanceof Error && error.message === code && !error.message.includes(sentinel));
    }
  } finally { await f.cleanup(); }
});

for (const phase of ['sign', 'fetch'] as const) test(`private ${phase} failures do not leak grants in operator errors`, async () => {
  const f = await nine01Fixture();
  try {
    await assert.rejects(readPrivateStagingReference({ slotId: 'image_urls.0', key: f.grants[0].key,
      sha256: f.input.references[0].sha256, size: f.image.length, mime: 'image/png' }, {
      target: SOURCE_TARGET, now: () => RECOVERY_TIME,
      sign: async key => { if (phase === 'sign') throw new Error('test-private-sentinel'); return signedFixtureUrl(key, RECOVERY_TIME, 300); },
    }, (async () => { throw new Error('test-private-sentinel'); }) as typeof fetch), error => error instanceof Error
      && error.message === (phase === 'sign' ? 'IMPORT_NINE01_SOURCE_SIGN' : 'IMPORT_NINE01_REFERENCE_READ'));
  } finally { await f.cleanup(); }
});
