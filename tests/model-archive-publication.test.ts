import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getRuntimeModelById } from '../frontend/config/model-runtime';
import { parseModelArchiveContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-archive-content';
import { buildModelArchiveMetadata } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-archive-metadata';

for (const locale of ['en', 'fr', 'es'] as const) {
  test(`Seedance 1.5 ${locale} archive explains product availability without inventing a provider shutdown`, () => {
    const model = getRuntimeModelById('seedance-1-5-pro')!;
    assert.equal(model.lifecycle, 'deep_legacy');
    assert.equal(model.publication.app.published, false);
    const document = JSON.parse(readFileSync(`content/models/${locale}/seedance-1-5-pro.json`, 'utf8'));
    const archive = parseModelArchiveContent(document.archive);
    assert.doesNotMatch(JSON.stringify(archive), /OpenAI|September|septembre|septiembre|sora/i);
    assert.equal(archive.source, undefined);
    assert.equal(archive.alternatives[0].modelId, 'seedance-2-5');
    assert.doesNotMatch(JSON.stringify(document), /\/app\?engine=seedance-1-5-pro/);
    const metadata = buildModelArchiveMetadata(model, archive, locale);
    const prefix = { en: '/models', fr: '/fr/modeles', es: '/es/modelos' }[locale];
    assert.equal(metadata.alternates?.canonical, `https://maxvideoai.com${prefix}/seedance-1-5-pro`);
    assert.deepEqual(metadata.robots, { index: true, follow: true });
  });

  test(`Sora ${locale} archive source is explicitly authored and stays specific to its announcement`, () => {
    for (const id of ['sora-2', 'sora-2-pro']) {
      const document = JSON.parse(readFileSync(`content/models/${locale}/${id}.json`, 'utf8'));
      const archive = parseModelArchiveContent(document.archive);
      assert.equal(archive.source?.href, 'https://help.openai.com/en/articles/20001152-what-to-know-about-the-sora-discontinuation');
      assert.ok(archive.source?.label);
      assert.throws(() => parseModelArchiveContent({ ...document.archive, source: { label: 'Incomplete source' } }));
    }
  });
}

test('generic archive renderer gets optional source attribution from localized content', () => {
  const source = readFileSync('frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelArchivePage.tsx', 'utf8');
  assert.doesNotMatch(source, /help\.openai\.com|sora-discontinuation/);
  assert.match(source, /content\.source\.href/);
  assert.match(source, /content\.source\.label/);
});

test('archive page leaves the main landmark to the marketing layout', () => {
  const archive = readFileSync('frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelArchivePage.tsx', 'utf8');
  const layout = readFileSync('frontend/app/(localized)/[locale]/(marketing)/layout.tsx', 'utf8');
  assert.match(layout, /<main(?:\s|>)/);
  assert.doesNotMatch(archive, /<main(?:\s|>)/);
});
