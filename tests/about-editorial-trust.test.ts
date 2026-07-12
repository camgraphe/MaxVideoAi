import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const copyPath = 'frontend/app/(localized)/[locale]/(marketing)/about/_lib/about-copy.ts';
const schemaPath = 'frontend/app/(localized)/[locale]/(marketing)/about/_lib/about-schema.ts';
const viewPath = 'frontend/app/(localized)/[locale]/(marketing)/about/_components/AboutView.tsx';

test('About trust content has focused copy, schema, and view owners', () => {
  assert.equal(existsSync(copyPath), true);
  assert.equal(existsSync(schemaPath), true);
  assert.equal(existsSync(viewPath), true);
});

test('About owns localized human identity and honest commercial disclosure', async () => {
  const copyModule = await import('../frontend/app/(localized)/[locale]/(marketing)/about/_lib/about-copy') as unknown as {
    getAboutCopy(locale: 'en' | 'fr' | 'es'): {
      hero: { title: string };
      sections: Array<{ title: string; body: string }>;
      independence: { body: string };
    };
  };
  const profileModule = await import('../frontend/lib/editorial/profile');

  for (const locale of ['en', 'fr', 'es'] as const) {
    const copy = copyModule.getAboutCopy(locale);
    const profile = profileModule.getEditorialProfile(locale);
    assert.ok(copy.hero.title.length > 20);
    assert.equal(profile.name, 'Adrien Millot');
    assert.equal(profile.jobTitle, 'Founder & Product Lead');
    assert.equal(profile.location, 'France');
    assert.equal(copy.sections.length, 3);
    assert.match(copy.independence.body, /sells|commercialise|comercializa/i);
  }
});

test('About stays a thin route with focused view and schema modules', () => {
  const page = readFileSync('frontend/app/(localized)/[locale]/(marketing)/about/page.tsx', 'utf8');
  const view = readFileSync(viewPath, 'utf8');
  assert.match(page, /AboutView/);
  assert.match(page, /getEditorialProfile/);
  assert.match(page, /buildAboutWebPageJsonLd/);
  assert.doesNotMatch(page, /content\.paragraphs\.map/);
  assert.match(view, /id="adrien-millot"/);
  assert.ok(page.split('\n').length <= 120);
});

test('About schema is a WebPage with MaxVideoAI publisher', async () => {
  const copyModule = await import('../frontend/app/(localized)/[locale]/(marketing)/about/_lib/about-copy') as unknown as {
    getAboutCopy(locale: 'en'): unknown;
  };
  const schemaModule = await import('../frontend/app/(localized)/[locale]/(marketing)/about/_lib/about-schema') as unknown as {
    buildAboutWebPageJsonLd(input: { canonicalUrl: string; copy: unknown; inLanguage: string }): {
      '@type': string;
      publisher: { name: string };
    };
  };
  const schema = schemaModule.buildAboutWebPageJsonLd({
    canonicalUrl: 'https://maxvideoai.com/about',
    copy: copyModule.getAboutCopy('en'),
    inLanguage: 'en-US',
  });
  assert.equal(schema['@type'], 'WebPage');
  assert.equal(schema.publisher.name, 'MaxVideoAI');
});
