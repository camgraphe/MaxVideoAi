import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {makeEditorialDraft} from './fixtures/editorial-draft.ts';
import {parseEditorialDraft} from '../frontend/lib/editorial/schema.ts';
import {EditorialArticle} from '../frontend/app/(core)/admin/editorial/_components/EditorialArticle.tsx';
function fixture(){
 const d=makeEditorialDraft();d.sources.push({id:'creator-video',title:'Demo',publisher:'Creator',url:'https://www.youtube.com/watch?v=abcdefghijk',retrievedAt:'2026-09-20',publishedAt:'2026-09-20'});
 for(const v of Object.values(d.locales))v.blocks.push(...[
 {id:'file-flow',type:'diagram',heading:'',nodes:[{kind:'image',label:'Reference image'},{kind:'video',label:'Generated clip'}],connections:['Generate'],alt:'Image to video',caption:'Documented sequence'},
 {id:'source-demo',type:'video',heading:'Demonstration',videoId:'abcdefghijk',sourceId:'creator-video',credit:'Creator',startSeconds:12,caption:'Attributed example'}] as never[]);
 return d;
}
test('site and phone renderer accept controlled diagrams/videos with source attribution',()=>{
 const draft=parseEditorialDraft(fixture());
 const html=renderToStaticMarkup(React.createElement(EditorialArticle,{draft,locale:'fr',articleId:'test',version:1}));
 assert.match(html,/<svg/);assert.match(html,/youtube-nocookie.com\/embed\/abcdefghijk\?start=12/);assert.match(html,/Voir la démonstration/);assert.match(html,/<details><summary>Exemple de prompt/);
});
test('invalid connections, changed localized media and arbitrary video URLs fail ingestion',()=>{
 for(const mutate of [(d:any)=>d.locales.fr.blocks.at(-1).videoId='otherid1234',(d:any)=>d.sources.at(-1).url='https://evil.test/watch?v=abcdefghijk',(d:any)=>d.locales.en.blocks.at(-2).connections=[],(d:any)=>d.locales.en.blocks.at(-1).embed='<iframe src="evil">']){
 const d=fixture();mutate(d);assert.throws(()=>parseEditorialDraft(d));
 }
});

test('French diagram text can expand naturally and remains visible in the site reader',()=>{
 const d=fixture();
 const label='Envoyer chaque ensemble et conserver la musique intacte pour le montage';
 const diagram=d.locales.fr.blocks.find(b=>b.type==='diagram');
 assert.ok(diagram?.type==='diagram');diagram.connections=[label];
 const draft=parseEditorialDraft(d);
 const html=renderToStaticMarkup(React.createElement(EditorialArticle,{draft,locale:'fr',articleId:'test',version:1}));
 assert.ok(html.includes(label));
 diagram.connections=['A paragraph instead of a concise diagram label. '.repeat(10)];
 assert.throws(()=>parseEditorialDraft(d));
});
