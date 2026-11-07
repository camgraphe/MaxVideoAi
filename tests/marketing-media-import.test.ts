import assert from 'node:assert/strict';
import test from 'node:test';
import { importMarketingPublication, previewMarketingPublicationImport } from '../frontend/server/marketing-media/import-publication';
import { copyMarketingMediaFile } from '../frontend/server/marketing-media/storage';
import { fixtureVideoId, nestedReference, publicationFile, publicationManifest, selectedVideo, staleVideo } from './helpers/marketing-publication-fixture';

test('preview reports only the selected film and required files, without historical Vesper media', () => {
  assert.deepEqual(previewMarketingPublicationImport(publicationManifest()), {
    videoId: fixtureVideoId, name: 'Vesper', durationSec: 14, resolution: '720 × 1280',
    width: 720, height: 1280, fileCount: 4,
  });
});

test('an incomplete manifest cannot omit a nested model-specific reference', () => {
  const manifest = publicationManifest();
  manifest.files = manifest.files.filter(({ url }) => url !== nestedReference.entry.url);
  assert.throws(() => previewMarketingPublicationImport(manifest), /missing.*file/i);
});

test('the import rejects relative and unplanned recipe media even when the settings match', () => {
  const relative = publicationManifest();
  relative.recreationSnapshot.advanced.extraInputValues.elements[0].frontal_image = 'private/image.png';
  relative.publication.settings_snapshot = structuredClone(relative.recreationSnapshot);
  assert.throws(() => previewMarketingPublicationImport(relative), /unsupported media reference/i);

  const unplanned = publicationManifest();
  const core = { ...unplanned.recreationSnapshot.core, imageUrl: nestedReference.entry.url };
  unplanned.recreationSnapshot.core = core;
  unplanned.recreationSnapshot.advanced.extraInputValues.elements = [];
  unplanned.publication.settings_snapshot = structuredClone(unplanned.recreationSnapshot);
  assert.throws(() => previewMarketingPublicationImport(unplanned), /unsupported media reference/i);
});

test('a publication must match its portable recipe', () => {
  const engineMismatch = publicationManifest();
  engineMismatch.publication.engine_id = 'another-engine';
  assert.throws(() => previewMarketingPublicationImport(engineMismatch), /engine|match/i);
  const settingsMismatch = publicationManifest();
  settingsMismatch.publication.settings_snapshot.core.durationSec = 12;
  assert.throws(() => previewMarketingPublicationImport(settingsMismatch), /settings|match/i);
});

test('matching source settings must still include operations the engine requires', () => {
  for (const engineId of ['minimax-h3-max', 'flux-3', 'flux-3-draft']) {
    const manifest = publicationManifest();
    manifest.publication.engine_id = engineId;
    manifest.recreationSnapshot.engineId = engineId;
    manifest.publication.settings_snapshot = structuredClone(manifest.recreationSnapshot);
    assert.throws(() => previewMarketingPublicationImport(manifest), /operation/i);
  }
});

test('the import rejects private bindings and provenance', () => {
  const manifest = publicationManifest();
  const privateRef = { ...manifest.recreationSnapshot.refs, source_job_id: 'private-job' };
  manifest.recreationSnapshot.refs = privateRef;
  manifest.publication.settings_snapshot.refs = privateRef;
  assert.throws(() => previewMarketingPublicationImport(manifest), /private/i);

  const source = { ...manifest.source, owner_id: 'private-account' };
  assert.throws(() => previewMarketingPublicationImport({ ...publicationManifest(), source }), /source|provenance/i);

  const another = publicationManifest();
  const publication = { ...another.publication, user_id: 'private-account' };
  assert.throws(() => previewMarketingPublicationImport({ ...another, publication }), /private/i);

  const historical = publicationManifest();
  const files = historical.files.map((file) => file.url === staleVideo.entry.url
    ? { ...file, sourceUrl: 'https://private.example.com/file' } : file);
  assert.throws(() => previewMarketingPublicationImport({ ...historical, files }), /file|private/i);
});

test('the import rejects signed, non-HTTPS, private or unscoped media URLs', () => {
  for (const candidate of [
    selectedVideo.entry.url + '?X-Amz-Signature=secret',
    selectedVideo.entry.url + '?',
    selectedVideo.entry.url.replace('https:', 'http:'),
    selectedVideo.entry.url.replace('https://', 'https://user:secret@'),
    selectedVideo.entry.url.replace('source.example.com', '127.0.0.1'),
    selectedVideo.entry.url.replace('/marketing-media/', '/personal-media/'),
  ]) {
    const manifest = publicationManifest();
    manifest.publication.video_url = candidate;
    manifest.files.find(({ url }) => url === selectedVideo.entry.url)!.url = candidate;
    assert.throws(() => previewMarketingPublicationImport(manifest), /portable|marketing.media URL/i);
  }
});

test('the required closure rejects duplicate declarations, unsupported MIME and copy bounds', () => {
  const duplicate = publicationManifest();
  duplicate.files.push({ ...duplicate.files.at(-1)! });
  assert.throws(() => previewMarketingPublicationImport(duplicate), /duplicate/i);

  const wrongMime = publicationManifest();
  wrongMime.files.at(-1)!.mime = 'video/unsupported';
  assert.throws(() => previewMarketingPublicationImport(wrongMime), /MIME|media type/i);

  const conflictingRoles = publicationManifest();
  conflictingRoles.publication.thumb_url = conflictingRoles.publication.video_url;
  assert.throws(() => previewMarketingPublicationImport(conflictingRoles), /media roles/i);

  const oversized = publicationManifest();
  oversized.files.at(-1)!.sizeBytes = 256 * 1024 ** 2 + 1;
  assert.throws(() => previewMarketingPublicationImport(oversized), /size/i);

  const cumulative = publicationManifest();
  for (const item of cumulative.files) item.sizeBytes = 256 * 1024 ** 2;
  assert.throws(() => previewMarketingPublicationImport(cumulative), /total.*size/i);

  const tooMany = publicationManifest();
  const references = Array.from({ length: 61 }, (_, index) => publicationFile('reference scene ' + index));
  tooMany.recreationSnapshot.refs.videoUrls.push(...references.map(({ entry }) => entry.url));
  tooMany.publication.settings_snapshot = structuredClone(tooMany.recreationSnapshot);
  tooMany.files.push(...references.map(({ entry }) => entry));
  assert.throws(() => previewMarketingPublicationImport(tooMany), /too many media/i);
});

test('explicit rights confirmation is required before touching storage or the database', async () => {
  const inaccessible = async (): Promise<never> => assert.fail('Import touched an external dependency');
  await assert.rejects(
    importMarketingPublication({ manifest: publicationManifest(), actorId: 'admin', permissionConfirmed: false },
      { transaction: inaccessible, copyFile: inaccessible }),
    { status: 403 },
  );
});

test('verified public imports reject changed bytes, MIME and size before writing the target object', async () => {
  const { entry, bytes } = selectedVideo;
  for (const change of ['hash', 'mime', 'size'] as const) {
    const changedBytes = Buffer.from(bytes);
    if (change === 'hash') changedBytes[0] ^= 1;
    const responseBytes = change === 'size' ? changedBytes.subarray(1) : changedBytes;
    await assert.rejects(copyMarketingMediaFile(
      { sourceUrl: entry.url, kind: 'video', role: 'original' },
      { copyId: 'target', ownerId: null, remainingBytes: 1024, signal: new AbortController().signal, expected: entry },
      {
        open: async () => ({
          statusCode: 200,
          headers: { 'content-type': change === 'mime' ? 'video/webm' : entry.mime, 'content-length': String(responseBytes.length) },
          body: (async function* () { yield responseBytes; })(),
        }),
        put: async () => assert.fail('Unverified bytes were uploaded'),
        verify: async () => assert.fail('Unverified bytes were made readable'),
      },
    ), /does not match|differs from/i);
  }
});
