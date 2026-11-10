import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';

const bundle = bundleClientFlow(`
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {ActivityRow} from './app/(core)/jobs/_components/ActivityRow.client';
import {DEFAULT_JOBS_COPY} from './app/(core)/jobs/_lib/jobs-copy';
const root=createRoot(document.getElementById('root'));
window.IS_REACT_ACT_ENVIRONMENT=true;
window.fx={act,render:()=>root.render(<ul>{window.groups.map(group=><ActivityRow key={group.id}
 group={group} copy={DEFAULT_JOBS_COPY} allowRemove={false} savingToLibrary={false}
 onOpen={group=>window.opened.push(group.id)} onAction={()=>{}}/>)}</ul>),unmount:()=>root.unmount()};
`, {
  '@/lib/i18n/I18nProvider': `export const useI18n=()=>({locale:'en',t:(_,fallback)=>fallback});`,
  'next/link': `export default function Link({children,prefetch,...props}){return <a {...props}>{children}</a>}`,
  'next/dynamic': `export default ()=>()=>null;`,
});

function group(id:string, surface='video', status='completed', extra:Record<string,unknown>={}) {
  const job={jobId:id,surface,engineLabel:'Test model',durationSec:7,prompt:'A dancer in the kitchen',status,createdAt:'2026-11-10T12:00:00Z',...extra};
  const member={id,jobId:id,job,engineLabel:'Test model',durationSec:7,prompt:job.prompt,status,createdAt:job.createdAt,source:'job',thumbUrl:'https://fixture.example/poster.webp',videoUrl:surface==='video'?'https://fixture.example/original.mp4':null,audioUrl:surface==='audio'?'https://fixture.example/original.wav':null};
  return {id,hero:member,members:[member],previews:[],count:1,source:'history',createdAt:job.createdAt,totalPriceCents:46,currency:'USD'};
}

test('Activity shows compact generation facts and keeps media playback out of the list', async()=>{
  const dom=createClientFlowDom('/jobs'), w=dom.window as any;
  w.groups=[group('v1'),group('a1','audio'),group('failed','image','failed'),group('pending','video','pending')];
  w.opened=[];
  try {
    w.eval(await bundle); await w.fx.act(async()=>w.fx.render());
    assert.equal(w.document.querySelectorAll('[data-activity-id]').length,4);
    assert.equal(w.document.querySelectorAll('video,audio,source').length,0,'history must not mount playback readers');
    assert.ok(w.document.body.textContent.includes('$0.46'));
    assert.ok(w.document.body.textContent.includes('In progress'));
    assert.ok(w.document.body.textContent.includes('Failed'));
    assert.ok(w.document.body.textContent.includes('A dancer in the kitchen'));
    for(const img of w.document.querySelectorAll('img')) {
      assert.match(img.src,/poster\.webp$/);
      assert.equal(img.getAttribute('loading'),'lazy');
    }
    await w.fx.act(async()=>w.document.querySelector('[data-activity-id="v1"] button').click());
    assert.deepEqual([...w.opened],['v1'],'the row opens the exact generation details');
    assert.equal(w.document.querySelector('[data-activity-id="v1"] a')?.getAttribute('href'),'/app?job=v1');
  } finally {if(w.fx)await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});

test('Activity preserves thumbnail identity on pagination and has an icon when no poster is available',async()=>{
  const dom=createClientFlowDom('/jobs'), w=dom.window as any;
  w.groups=[group('v1')];w.opened=[];
  try {
    w.eval(await bundle);await w.fx.act(async()=>w.fx.render());
    const image=w.document.querySelector('img');
    const noPoster=group('no-poster');noPoster.hero.thumbUrl=null as any;
    await w.fx.act(async()=>{w.groups=[...w.groups,noPoster];w.fx.render();});
    assert.equal(w.document.querySelector('[data-activity-id="v1"] img'),image);
    assert.equal(w.document.querySelector('[data-activity-id="no-poster"] img'),null,'do not fetch original video as a poster');
    assert.equal(w.document.querySelectorAll('video,audio').length,0);
  } finally {if(w.fx)await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});

test('Activity never treats legacy image originals or AV URLs as stored posters',async()=>{
  const dom=createClientFlowDom('/jobs'),w=dom.window as any;
  const image=group('legacy-image','image');
  Object.assign(image.hero,{originalUrl:'https://fixture.example/full-size.png',thumbUrl:'https://fixture.example/full-size.png?grant=other'});
  const video=group('invalid-poster');video.hero.thumbUrl='https://fixture.example/small-video.mp4';
  w.groups=[image,video];w.opened=[];
  try {
    w.eval(await bundle);await w.fx.act(async()=>w.fx.render());
    assert.equal(w.document.querySelectorAll('img,video,audio').length,0,'old thumbnail fallbacks must not load originals in the log');
  }finally{if(w.fx)await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});

test('Activity distinguishes a known free batch from an unknown batch total',async()=>{
  const dom=createClientFlowDom('/jobs'),w=dom.window as any;
  const free=group('free','image'),unknown=group('unknown','image');
  for(const g of [free,unknown]){g.count=2;g.totalPriceCents=null as any;Object.assign(g.hero,{priceCents:0});g.members=[g.hero,{...g.hero,id:g.id+'-second',priceCents:0} as any];}
  delete (unknown.members[1] as any).priceCents;
  w.groups=[free,unknown];w.opened=[];
  try{w.eval(await bundle);await w.fx.act(async()=>w.fx.render());
    assert.ok(w.document.querySelector('[data-activity-id="free"]').textContent.includes('$0.00'));
    assert.ok(w.document.querySelector('[data-activity-id="unknown"]').textContent.includes('—'));
  }finally{if(w.fx)await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});

test('Activity recognizes image outputs from tools without loading their originals',async()=>{
  const dom=createClientFlowDom('/jobs'),w=dom.window as any;
  const image=group('upscaled-image','upscale');
  Object.assign(image.hero,{originalUrl:'https://fixture.example/upscaled.png'});
  const video=group('upscaled-video','upscale','completed',{videoUrl:'https://fixture.example/upscaled.mp4'});
  Object.assign(video.hero,{videoUrl:'https://fixture.example/upscaled.mp4'});
  w.groups=[image,video];w.opened=[];
  try{w.eval(await bundle);await w.fx.act(async()=>w.fx.render());
    assert.equal(w.document.querySelector('[data-activity-id="upscaled-image"] img')?.getAttribute('src'),'https://fixture.example/poster.webp');
    assert.equal(w.document.querySelector('[data-activity-id="upscaled-video"] a')?.getAttribute('href'),'/app/tools/upscale?kind=video');
    assert.equal(w.document.querySelectorAll('video,audio').length,0);
  }finally{if(w.fx)await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});
