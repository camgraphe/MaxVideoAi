import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {makeEditorialDraft} from './fixtures/editorial-draft.ts';import {parseEditorialDraft,digestEditorialDraft} from '../frontend/lib/editorial/schema.ts';
import {projectPublicEditorialArticle} from '../frontend/src/server/editorial/publication-content.ts';
import {ImageConfigContext} from 'next/dist/shared/lib/image-config-context.shared-runtime';
import {imageConfigDefault} from 'next/dist/shared/lib/image-config';

test('public reader preserves full images, one title, discrete captions and collapsed prompts',async()=>{
 const {PublicEditorialArticleView}=await import('../frontend/components/editorial/PublicEditorialArticleView.tsx');
 const draft=parseEditorialDraft(makeEditorialDraft());draft.assets[0].sha256='a'.repeat(64);
 const article=projectPublicEditorialArticle({articleId:'b1f7b87f-4850-4181-a499-97f9cadc78b3',version:1,digest:digestEditorialDraft(draft),draft,createdAt:'2026-09-21T11:00:00Z',approvedAt:null,approvedBy:null},'fr',{a1:`https://media.maxvideoai.com/editorial/published/${'a'.repeat(64)}.webp`});
 const html=renderToStaticMarkup(React.createElement(ImageConfigContext.Provider,{value:{...imageConfigDefault,remotePatterns:[{protocol:'https',hostname:'media.maxvideoai.com'}]}},React.createElement(PublicEditorialArticleView,{article})));
 assert.equal((html.match(/<h1/g)??[]).length,1);assert.match(html,/height:auto/);assert.match(html,/srcSet=/i);assert.match(html,/fetchPriority="high"/i);
 assert.match(html,/<details><summary>Exemple de prompt/);assert.doesNotMatch(html,/Private draft|Brouillon privé|editorial\/drafts|object-cover/);
 assert.match(html,/href="#source-s1"/);assert.match(html,/data-editorial-digest=/);
});
