import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {SWRConfig} from 'swr';
import {ModelCinematicPromptPrice} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelCinematicPromptPrice.client';
import type {CinematicAsset,CinematicPresentation} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-cinematic-data';

test('price is requested only on opening, uses exact settings and never invents an unavailable amount', async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost:3116'});
  let result:unknown={status:'exact',amountCents:12.5,currency:'USD',revision:'test',scenarioLabel:'One image'};
  const requests:unknown[]=[];
  const globals={window:dom.window,document:dom.window.document,React,IS_REACT_ACT_ENVIRONMENT:true,
    fetch:async(_url:unknown,options:RequestInit)=>{requests.push(JSON.parse(options.body as string));return {ok:true,json:async()=>result};}};
  const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  const quoteInput={modelId:'seedream-5-5',mode:'i2i',durationSec:1,resolution:'2K',referenceImageCount:1};
  const asset={creation:{href:'/app/image',quoteInput,locale:'en',isStartFrame:false}} as CinematicAsset;
  const ui={price:'Generation price',priceNote:'Before taxes',priceUnit:'/ image',priceLoading:'Checking price…',priceUnavailable:'Price in Create'} as CinematicPresentation['ui'];
  const root=createRoot(dom.window.document.getElementById('root')!);
  const cache=new Map();
  const render=async(open:boolean,selected=asset)=>{await React.act(async()=>{
    root.render(React.createElement(SWRConfig,{value:{provider:()=>cache}},React.createElement('ul',null,React.createElement(ModelCinematicPromptPrice,{asset:selected,ui,open}))));
  });};
  try{
    await render(false);assert.equal(requests.length,0);
    await render(true);assert.deepEqual(requests,[quoteInput]);assert.match(dom.window.document.body.textContent!,/\$0.125 \/ image/);
    result={status:'unavailable'};
    await render(true,{...asset,creation:{...asset.creation!,quoteInput:{...quoteInput,mode:'t2i',referenceImageCount:0}}});
    assert.match(dom.window.document.body.textContent!,/Price in Create/);assert.doesNotMatch(dom.window.document.body.textContent!,/\$/);
  }finally{
    await React.act(async()=>root.unmount());dom.window.close();
    for(const [key,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}
  }
});
