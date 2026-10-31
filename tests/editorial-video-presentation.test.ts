import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';
import {ImageConfigContext} from 'next/dist/shared/lib/image-config-context.shared-runtime';
import {imageConfigDefault} from 'next/dist/shared/lib/image-config';
import {makeEditorialVideoDraft} from './fixtures/editorial-video.ts';
import {checkedFixture} from './fixtures/editorial-checks.ts';
import {parseEditorialDraft, digestEditorialDraft} from '../frontend/lib/editorial/schema.ts';
import {publicEditorialArticleSchema} from '../frontend/lib/editorial/public-article.ts';
import {buildEditorialPublicationFiles} from '../frontend/src/server/editorial/publication-content.ts';
import {parseMarkdownFile} from '../frontend/lib/content/markdown.ts';
import {EditorialArticle} from '../frontend/app/(core)/admin/editorial/_components/EditorialArticle.tsx';
import {PublicEditorialArticleView} from '../frontend/components/editorial/PublicEditorialArticleView.tsx';

test('video options survive ingestion and JSON without materializing defaults in legacy blocks', () => {
  const draft = parseEditorialDraft(JSON.parse(JSON.stringify(makeEditorialVideoDraft())));
  for (const variant of Object.values(draft.locales)) {
    const legacy = variant.blocks.find(b => b.id === 'legacy-video')!;
    assert.equal(Object.hasOwn(legacy, 'presentation'), false);
    assert.equal(Object.hasOwn(legacy, 'aspectRatio'), false);
    const portrait = variant.blocks.find(b => b.id === 'inline-portrait');
    assert.ok(portrait?.type === 'video');
    assert.equal(portrait.presentation, 'inline');
    assert.equal(portrait.aspectRatio, '9:16');
  }
  assert.equal(digestEditorialDraft(draft), digestEditorialDraft(parseEditorialDraft(JSON.parse(JSON.stringify(draft)))));
});

test('video ingestion rejects unsupported options and localized presentation or ratio drift', () => {
  for (const [key, value] of [['presentation','autoplay'], ['presentation',null], ['aspectRatio','1:1'], ['aspectRatio','9/16'], ['aspectRatio',null], ['embed','<iframe>']] as const) {
    const draft = makeEditorialVideoDraft();
    Object.assign(draft.locales.en.blocks.find(b => b.id === 'inline-portrait')!, {[key]:value});
    assert.throws(() => parseEditorialDraft(draft), String(key));
  }
  for (const locale of ['fr','es'] as const) {
    for (const change of [{presentation:'disclosure'}, {aspectRatio:'16:9'}]) {
      const draft = makeEditorialVideoDraft();
      Object.assign(draft.locales[locale].blocks.find(b => b.id === 'inline-portrait')!, change);
      assert.throws(() => parseEditorialDraft(draft), /changed source video/i);
    }
  }
});

test('omitted and explicit default video options have the same cross-language meaning', () => {
  const draft = makeEditorialVideoDraft();
  Object.assign(draft.locales.fr.blocks.find(b => b.id === 'legacy-video')!, {presentation:'disclosure', aspectRatio:'16:9'});
  assert.doesNotThrow(() => parseEditorialDraft(draft));
});

test('publication files and markdown loader preserve video options for every locale and both readers', async t => {
  const draft = parseEditorialDraft(makeEditorialVideoDraft());
  const digest = digestEditorialDraft(draft);
  const report = checkedFixture().report;
  report.digest = digest;
  report.links.push({url:'https://www.youtube.com/watch?v=abcdefghijk', status:200});
  const record = {articleId:'b1f7b87f-4850-4181-a499-97f9cadc78b3', version:1, digest, draft,
    createdAt:'2026-10-25T10:00:00Z', approvedAt:'2026-10-25T11:00:00Z', approvedBy:'fixture@example.test'};
  const files = buildEditorialPublicationFiles(record, {a1:`https://media.maxvideoai.com/editorial/published/${'a'.repeat(64)}.webp`}, report).files;
  const dir = await mkdtemp(path.join(tmpdir(), 'editorial-video-'));
  t.after(() => rm(dir, {recursive:true, force:true}));
  for (const locale of ['en','fr','es'] as const) {
    for (const file of files.filter(f => f.path.startsWith(`content/${locale}/`))) await writeFile(path.join(dir, path.basename(file.path)), file.content);
    const post = await parseMarkdownFile(path.join(dir, `shot-list-${locale}.mdx`));
    const article = post.editorial!;
    assert.deepEqual(article.article.blocks.filter(b => b.type === 'video'), draft.locales[locale].blocks.filter(b => b.type === 'video'));
    for (const node of [React.createElement(PublicEditorialArticleView, {article}), React.createElement(EditorialArticle, {draft,locale,articleId:record.articleId,version:1})]) {
      const document = new JSDOM(renderToStaticMarkup(React.createElement(ImageConfigContext.Provider,
        {value:{...imageConfigDefault,remotePatterns:[{protocol:'https',hostname:'media.maxvideoai.com'}]}}, node))).window.document;
      const legacy = document.querySelector('#legacy-video details')!;
      assert.equal(legacy.hasAttribute('open'), false);
      assert.ok(legacy.querySelector('iframe'));
      assert.ok(document.querySelector('#disclosure-portrait details iframe'));
      for (const id of ['inline-landscape','inline-portrait']) {
        const section = document.getElementById(id)!;
        assert.equal(section.querySelector('details'), null);
        const frame = section.querySelector('iframe')!;
        assert.equal(frame.getAttribute('loading'), 'lazy');
        assert.equal(frame.getAttribute('referrerpolicy'), 'strict-origin-when-cross-origin');
        assert.equal(frame.hasAttribute('allowfullscreen'), true);
        const url = new URL(frame.getAttribute('src')!);
        assert.equal(url.origin, 'https://www.youtube-nocookie.com');
        assert.equal(url.searchParams.get('start'), '12');
        assert.equal(url.searchParams.has('autoplay'), false);
        assert.ok(frame.getAttribute('title'));
        assert.match(section.querySelector('figcaption')!.textContent!, /Player layout fixture/);
        assert.equal(section.querySelector('figcaption a')!.getAttribute('href'), 'https://www.youtube.com/watch?v=abcdefghijk');
      }
    }
    const invalid = structuredClone(article);
    Object.assign(invalid.article.blocks.find(b => b.id === 'inline-portrait')!, {aspectRatio:'1:1'});
    assert.equal(publicEditorialArticleSchema.safeParse(invalid).success, false);
  }
});
