import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {AppRouterContext} from 'next/dist/shared/lib/app-router-context.shared-runtime';

async function mount() {
  const require=createRequire(import.meta.url),css=require.extensions['.css'];
  require.extensions['.css']=module=>{module.exports={};};
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/app/studio/conversation/project_current',pretendToBeVisual:true});
  Object.assign(dom.window.HTMLDialogElement.prototype,{showModal(){this.open=true;},close(){this.open=false;}});
  const globals={window:dom.window,self:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,React,IS_REACT_ACT_ENVIRONMENT:true};
  const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  const originalFetch=globalThis.fetch;
  const requests:Array<{url:unknown;init:RequestInit;pending:ReturnType<typeof Promise.withResolvers<Response>>}>=[];
  globalThis.fetch=async(url,init)=>{const pending=Promise.withResolvers<Response>();requests.push({url,init:init??{},pending});return pending.promise;};
  const destinations:string[]=[];
  const router={back(){},forward(){},refresh(){},push(url:string){destinations.push(url);},replace(url:string){destinations.push(url);},prefetch:async()=>{}} as never;
  const module=await import('../frontend/app/(core)/(workspace)/app/studio/_components/ConversationProjects.client').catch(()=>null);
  assert.ok(module?.ConversationProjects,'projects dialog exists');
  const root=createRoot(dom.window.document.getElementById('root')!);
  const render=async(accountKey='owner')=>act(async()=>root.render(React.createElement(AppRouterContext.Provider,{value:router},React.createElement(module.ConversationProjects,{key:accountKey,accountKey,currentProjectId:'project_current',locale:'en'}))));
  await render();
  const button=(name:string)=>Array.from(dom.window.document.querySelectorAll('button')).find(el=>(el.getAttribute('aria-label')??el.textContent??'').trim()===name)!;
  return {dom,requests,destinations,button,render,async close(){await act(async()=>root.unmount());globalThis.fetch=originalFetch;dom.window.close();for(const [key,value] of previous){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}if(css)require.extensions['.css']=css;else delete require.extensions['.css'];}};
}

test('project popup fetches on demand, filters saved projects and closes back to its trigger',async()=>{
  const view=await mount();
  try{
    assert.equal(view.requests.length,0);
    await act(async()=>view.button('Projects').click());
    assert.equal(view.requests.length,1);
    assert.equal(view.requests[0].init.method??'GET','GET');
    await act(async()=>view.requests[0].pending.resolve(Response.json({ok:true,projects:[
      {id:'project_current',name:'Current',updatedAt:'2026-10-03T10:00:00Z',persistenceMode:'connected'},
      {id:'project_other',name:'Summer film',updatedAt:'2026-10-02T10:00:00Z',persistenceMode:'connected'},
      {id:'project_old',name:'Classic canvas',updatedAt:'2026-10-01T10:00:00Z',persistenceMode:'legacy'},
    ]})));
    assert.equal(view.dom.window.document.querySelector('[aria-current="page"]')?.textContent?.includes('Current'),true);
    assert.equal(view.dom.window.document.querySelector('a[href="/app/studio/workspace/project_old"]'),null);
    assert.equal(view.dom.window.document.querySelectorAll('[data-project-row]').length,2);
    assert.doesNotMatch(view.dom.window.document.body.textContent??'',/Canvas & templates|Classic canvas/);
    const input=view.dom.window.document.querySelector<HTMLInputElement>('input[type="search"]')!;
    await act(async()=>{Object.getOwnPropertyDescriptor(view.dom.window.HTMLInputElement.prototype,'value')!.set!.call(input,'Summer');input.dispatchEvent(new view.dom.window.Event('input',{bubbles:true}));});
    assert.equal(view.dom.window.document.querySelectorAll('[data-project-row]').length,1);
    await act(async()=>view.button('Close projects').click());
    assert.equal(view.dom.window.document.activeElement,view.button('Projects'));
  }finally{await view.close();}
});

test('new project retries one identity and a closed/account-changed dialog cannot navigate on late acknowledgement',async()=>{
  const view=await mount();
  try{
    await act(async()=>view.button('Projects').click());
    await act(async()=>view.requests[0].pending.resolve(Response.json({ok:true,projects:[]})));
    await act(async()=>{view.button('New conversation').click();view.button('New conversation').click();});
    assert.equal(view.requests.length,2);
    const body=view.requests[1].init.body;
    await act(async()=>view.requests[1].pending.reject(new Error('lost acknowledgement')));
    await act(async()=>view.button('Try again').click());
    assert.equal(view.requests[2].init.body,body);
    await view.render('different-owner');
    await act(async()=>view.requests[2].pending.resolve(Response.json({ok:true,result:{projectId:'project_previous_owner'}})));
    assert.deepEqual(view.destinations,[]);
    await act(async()=>view.button('Projects').click());
    await act(async()=>view.requests[3].pending.resolve(Response.json({ok:true,projects:[]})));
    await act(async()=>view.button('New conversation').click());
    assert.notEqual(view.requests[4].init.body,body);
    await act(async()=>view.requests[4].pending.resolve(Response.json({ok:true,result:{projectId:'project_new_owner'}})));
    assert.deepEqual(view.destinations,['/app/studio/conversation/project_new_owner']);
  }finally{await view.close();}
});
