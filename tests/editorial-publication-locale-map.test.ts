import assert from 'node:assert/strict';import test from 'node:test';import {readFileSync} from 'node:fs';
import {buildPublicationLocaleMap} from '../frontend/src/server/editorial/publication-locale-map';
const source=readFileSync('frontend/config/blog-slugs.ts','utf8');
const files=['en','fr','es'].map(l=>({path:`content/${l}/blog/new-shot-${l}.mdx`,content:`---\nslug: "new-shot-${l}"\ncanonicalSlug: "new-shot"\n---\n`}));
test('publication adds browser locale mapping without changing existing entries or resolver code',()=>{
 const result=buildPublicationLocaleMap(source,files);assert.match(result.content,/"new-shot":/);for(const l of ['en','fr','es'])assert.ok(result.content.includes(`${l}: "new-shot-${l}"`));
 assert.equal(result.content.slice(result.content.indexOf("  'access-sora")),source.slice(source.indexOf("  'access-sora")));
 assert.equal(buildPublicationLocaleMap(result.content,files).content,result.content);
 assert.throws(()=>buildPublicationLocaleMap(result.content,files.map((f,i)=>i?f:{path:'content/en/blog/different.mdx',content:f.content.replaceAll('new-shot-en','different')})),/collision/);
});
test('publication refuses inconsistent metadata, locale collisions, and executable map entries',()=>{
 assert.throws(()=>buildPublicationLocaleMap(source,files.map((f,i)=>i?f:{...f,content:f.content.replace('"new-shot"','"other"')})),/Inconsistent/);
 const collision=files.map((f,i)=>i?f:{path:'content/en/blog/access-sora-2-without-invite.mdx',content:f.content.replace('new-shot-en','access-sora-2-without-invite')});
 assert.throws(()=>buildPublicationLocaleMap(source,collision),/collision/);
 assert.throws(()=>buildPublicationLocaleMap(source.replace("en: 'access-sora-2-without-invite'",'en: arbitraryCode()'),files),/Unsupported/);
});
