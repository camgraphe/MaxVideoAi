import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExamplesPaginationHref } from '../frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-page-hrefs';
import { getExamplesPaginationSeo, parseExamplesPage, withExamplesPaginationMetadata } from '../frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-pagination-seo';
import { buildSeoMetadata } from '../frontend/lib/seo/metadata';

for (const [locale, base] of [['en', '/examples'], ['fr', '/fr/galerie'], ['es', '/es/galeria']] as const) {
  test(`${locale}: hub pagination keeps the visitor's language and page identity`, () => {
    const args = { engineFromPath: '', galleryBasePath: base, selectedEngine: null, sort: 'playlist' as const };
    assert.equal(buildExamplesPaginationHref({ ...args, targetPage: 2 }), `${base}?page=2`);
    assert.equal(buildExamplesPaginationHref({ ...args, targetPage: 1 }), base);
    assert.equal(buildExamplesPaginationHref({ ...args, targetPage: 3, sort: 'date-desc' }), `${base}?sort=date-desc&page=3`);
    const metadata = withExamplesPaginationMetadata(buildSeoMetadata({ locale, title: 'Gallery', description: 'Examples', englishPath: '/examples' }), locale, '/examples', 2);
    assert.equal(metadata.alternates?.canonical, `https://maxvideoai.com${base}?page=2`);
    assert.equal(metadata.alternates?.languages?.fr, 'https://maxvideoai.com/fr/galerie?page=2');
  });
}

test('only canonical decimal page values enter a default indexable series', () => {
  assert.deepEqual(parseExamplesPage(undefined), { page: 1, invalid: false, redirect: false });
  assert.deepEqual(parseExamplesPage('1'), { page: 1, invalid: false, redirect: true });
  assert.deepEqual(parseExamplesPage('2'), { page: 2, invalid: false, redirect: false });
  for (const page of ['', '0', '-2', '2.5', '2junk', '1e2', '02', ' 2 ', ['2', '3'], '9007199254740991']) {
    assert.deepEqual(parseExamplesPage(page), { page: 1, invalid: true, redirect: true });
    assert.equal(getExamplesPaginationSeo({ page }).index, false);
  }
  assert.deepEqual(getExamplesPaginationSeo({ page: '2', sort: 'playlist', utm_source: 'test' }), { index: true, canonicalPage: 2 });
  for (const params of [{ sort: 'date-desc' }, { sort: 'invalid' }, { sort: ['playlist', 'date-desc'] }, { engine: 'ltx' }, { other: 'value' }]) {
    assert.deepEqual(getExamplesPaginationSeo({ page: '2', ...params }), { index: false, canonicalPage: 1 });
  }
});
