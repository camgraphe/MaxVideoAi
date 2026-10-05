import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';

test('the guest example lets visitors inspect references, then gates creation without calling Studio APIs',async()=>{
  const require=createRequire(import.meta.url),css=require.extensions['.css'];
  require.extensions['.css']=module=>{module.exports={};};
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/app/studio',pretendToBeVisual:true});
  dom.window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}}) as never;
  Object.assign(dom.window.HTMLElement.prototype,{attachEvent(){},detachEvent(){},getClientRects(){return [{width:10,height:10}];}});
  const globals={window:dom.window,self:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,HTMLAnchorElement:dom.window.HTMLAnchorElement,React,IS_REACT_ACT_ENVIRONMENT:true};
  const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  const originalFetch=globalThis.fetch;let requests=0;
  globalThis.fetch=async()=>{requests++;throw new Error('Guest demonstration must not call an account API');};
  const {createRoot}=require('../frontend/node_modules/react-dom/client');
  const root=createRoot(dom.window.document.getElementById('root')!);
  try {
    const module=await import('../frontend/app/(core)/(workspace)/app/studio/_components/StudioGuestDemo.client').catch(()=>null);
    assert.ok(module?.StudioGuestDemo,'guest demonstration exists');
    const {I18nProvider}=await import('../frontend/lib/i18n/I18nProvider');
    await act(async()=>root.render(React.createElement(I18nProvider,{locale:'fr',dictionary:{},fallback:{},children:React.createElement(module.StudioGuestDemo,{available:true})})));
    assert.match(dom.window.document.body.textContent??'',/14 secondes/);
    assert.equal(dom.window.document.querySelectorAll('[data-demo-reference]').length,3);
    assert.equal(dom.window.document.querySelector('[role="dialog"]'),null);
    const button=(label:string)=>dom.window.document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
    await act(async()=>button('Agrandir Image 1').click());
    assert.ok(dom.window.document.querySelector('[role="dialog"] img'));
    await act(async()=>button('Fermer').click());
    await act(async()=>button('Ajouter des médias').click());
    assert.match(dom.window.document.querySelector('[role="dialog"]')?.textContent??'',/médias/);
    const signup=dom.window.document.querySelector<HTMLAnchorElement>('[role="dialog"] a')!;
    assert.equal(new URL(signup.href).pathname,'/login');
    assert.equal(new URL(signup.href).searchParams.get('next'),'/app/studio');
    await act(async()=>button('Fermer').click());
    const textarea=dom.window.document.querySelector('textarea')!;
    await act(async()=>{
      Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value')!.set!.call(textarea,'Une publicité pour ma tasse');
      textarea.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
    });
    await act(async()=>dom.window.document.querySelector('form')!.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
    assert.match(dom.window.document.querySelector('[role="dialog"]')?.textContent??'',/message/);
    assert.equal(textarea.value,'Une publicité pour ma tasse');
    await act(async()=>button('Fermer').click());
    const canvas=dom.window.document.querySelector('aside')!.parentElement!;
    for(const type of ['dragover','drop']) {
      const event=new dom.window.Event(type,{bubbles:true,cancelable:true});
      Object.defineProperty(event,'dataTransfer',{value:{types:['Files'],files:[new dom.window.File(['photo'],'product.png',{type:'image/png'})]}});
      await act(async()=>{canvas.dispatchEvent(event);});
      assert.equal(event.defaultPrevented,true,`${type} must prevent browser file navigation`);
    }
    assert.match(dom.window.document.querySelector('[role="dialog"]')?.textContent??'',/médias/);
    assert.equal(textarea.value,'Une publicité pour ma tasse');
    assert.equal(requests,0);
    assert.equal(dom.window.document.querySelector('audio')?.getAttribute('preload'),'none');
  } finally {
    await act(async()=>root.unmount());globalThis.fetch=originalFetch;dom.window.close();
    for(const [key,value] of previous){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}
    if(css)require.extensions['.css']=css;else delete require.extensions['.css'];
  }
});
