import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {makeEditorialDraft} from './fixtures/editorial-draft.ts';
import {parseEditorialDraft,digestEditorialDraft} from '../frontend/lib/editorial/schema.ts';

function record(){const draft=parseEditorialDraft(makeEditorialDraft());draft.assets[0].sha256='a'.repeat(64);return {articleId:'b1f7b87f-4850-4181-a499-97f9cadc78b3',version:1,digest:digestEditorialDraft(draft),draft,createdAt:'2026-09-21T10:00:00Z',approvedAt:'2026-09-21T11:00:00Z',approvedBy:'private-admin@example.test'};}
const media={a1:`https://media.maxvideoai.com/editorial/published/${'a'.repeat(64)}.webp`};

test('approved draft exports three complete file-based locales without private material',async()=>{
 const {buildEditorialPublicationFiles}=await import('../frontend/src/server/editorial/publication-content.ts');
 const r=record();const result=buildEditorialPublicationFiles(r,media);
 assert.equal(result.files.length,6);
 assert.deepEqual(result.slugs,{en:'shot-list-en',fr:'shot-list-fr',es:'shot-list-es'});
 for(const language of ['en','fr','es']){
  const artifact=JSON.parse(result.files.find(f=>f.path===`content/${language}/blog/shot-list-${language}.article.json`)!.content);
  assert.equal(artifact.article.locale,language);assert.equal(artifact.article.blocks.length,6);
  assert.equal(artifact.assets[0].url,media.a1);
  assert.equal(artifact.publication.digest,r.digest);
 }
 const text=JSON.stringify(result.files);for(const privateValue of ['private-admin@example.test','generationPrompt','supportedClaims','editorial/drafts/','research','rights'])assert.ok(!text.includes(privateValue),privateValue);
});

test('publication compiler refuses unapproved, modified and incomplete media versions',async()=>{
 const {buildEditorialPublicationFiles}=await import('../frontend/src/server/editorial/publication-content.ts');
 const r=record();assert.throws(()=>buildEditorialPublicationFiles({...r,approvedAt:null},media),/approv/i);
 r.draft.locales.en.title='Unreviewed change';assert.throws(()=>buildEditorialPublicationFiles(r,media),/digest/i);
 assert.throws(()=>buildEditorialPublicationFiles(record(),{}),/media/i);
 assert.throws(()=>buildEditorialPublicationFiles(record(),{a1:'https://evil.test/private.webp'}),/media|public/i);
});

test('existing markdown loader reads controlled article artifacts and rejects traversal or mismatched metadata',async t=>{
 const {buildEditorialPublicationFiles}=await import('../frontend/src/server/editorial/publication-content.ts');
 const {parseMarkdownFile}=await import('../frontend/lib/content/markdown.ts');
 const dir=await mkdtemp(path.join(tmpdir(),'editorial-content-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const files=buildEditorialPublicationFiles(record(),media).files.filter(f=>f.path.startsWith('content/fr/'));
 for(const file of files)await writeFile(path.join(dir,path.basename(file.path)),file.content);
 const mdx=path.join(dir,'shot-list-fr.mdx'),post=await parseMarkdownFile(mdx);
 assert.equal(post.editorial?.article.locale,'fr');assert.equal(post.image,media.a1);assert.equal(post.canonicalSlug,'shot-list-en');
 await writeFile(mdx,files.find(f=>f.path.endsWith('.mdx'))!.content.replace('shot-list-fr.article.json','../private.article.json'));
 await assert.rejects(parseMarkdownFile(mdx),/artifact/i);
 await writeFile(mdx,files.find(f=>f.path.endsWith('.mdx'))!.content.replace('Shot list fr','Another title'));
 await assert.rejects(parseMarkdownFile(mdx),/metadata/i);
});
