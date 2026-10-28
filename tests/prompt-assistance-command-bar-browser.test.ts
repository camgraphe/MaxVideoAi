import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium, expect } from '@playwright/test';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { startWorkspaceReferenceFixture } from './helpers/workspace-reference-browser-fixture';

const source = `
import {useState} from 'react'; import {createRoot} from 'react-dom/client';
import {PathnameContext} from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import {AppRouterContext} from 'next/dist/shared/lib/app-router-context.shared-runtime';
import {I18nProvider} from './lib/i18n/I18nProvider';
import {AppNavigation} from './components/app/AppNavigation.client';
import {AppCreationContent} from './components/app/AppCreationContent';
import {ComposerWorkspaceControls} from './components/composer/ComposerWorkspaceControls.client';
import {WorkspaceComposerModel} from './components/composer/WorkspaceComposerModel.client';
import {Composer} from './components/Composer';
const engine=globalThis.fixtureConfig.engine;
function Fixture(){const [path,setPath]=useState(location.pathname==='/'?'/app':location.pathname); const [mode,setMode]=useState(null); const [railView,setRailView]=useState('activity'); const [prompt,setPrompt]=useState('Original draft');
return <I18nProvider locale="en" dictionary={{}} fallback={{}}><PathnameContext.Provider value={path}><AppRouterContext.Provider value={{push:setPath,prefetch:()=>{},replace:setPath}}>
  <header className="app-connected-header" aria-label="Fixture header" />
  <div style={{display:"flex"}}><aside className="app-sidebar hidden md:flex"><AppNavigation variant="rail" /></aside><AppNavigation variant="mobile" />
  <AppCreationContent railNavigation={<div className="app-media-rail-switch" role="group" aria-label="Recents">
    <button aria-pressed={railView==='activity'} onClick={()=>setRailView('activity')}>Activity</button>
    <button aria-pressed={railView==='recent'} onClick={()=>setRailView('recent')}>Recents</button>
    <a href="/app/library" className="app-media-rail-view-all">View all</a>
  </div>}>
  {path!=='/app/audio'? <main className="app-workspace-main" style={{padding:12,maxWidth:900}}><ComposerWorkspaceControls modelControl={<WorkspaceComposerModel engines={[engine]} engineId={engine.id} mode="t2v" onModeChange={()=>{}} onEngineChange={()=>{}} />}>
  <Composer density="workspace" engine={engine} prompt={prompt} onPromptChange={setPrompt} assetFields={[]} assets={{}} price={1.35} currency="USD" isLoading={false}
    assistance={{scopeKey:'a:video',contextKey:'4s'}} activeManualMode={mode} onModeToggle={setMode}
    modeToggles={[{mode:null,label:'Create video'},{mode:'v2v',label:'Modify Video'},{mode:'extend',label:'Extend Video'}]}
    onGenerate={()=>{throw new Error('Must not generate')}} />
  </ComposerWorkspaceControls></main>:null}
 </AppCreationContent></div></AppRouterContext.Provider></PathnameContext.Provider></I18nProvider>};createRoot(document.getElementById('root')).render(<Fixture/>);`;

test('top navigation stays aligned and compact while operations, Expand and model selection stay reachable', {timeout:60_000}, async () => {
  const engine = listFalEngines().find(entry => entry.id === 'kling-o3-pro')!.engine;
  const fixture = await startWorkspaceReferenceFixture({source, config:{engine}, assistancePreview:true});
  const browser = await chromium.launch({headless:true});
  try {
    for (const width of [320,390,768,1440]) {
      const page=await browser.newPage({viewport:{width,height:900}}); await page.goto(fixture.url);
      await expect(page.getByRole('navigation',{name:'Creation type'})).toBeVisible();
      await expect(page.getByRole('group',{name:'Creation type'})).toHaveCount(0);
      await expect(page.getByRole('combobox',{name:'Creation type'})).toHaveCount(0);
      const topbar = page.locator('.app-creation-topbar');
      const topbarBounds = await topbar.boundingBox();
      assert.ok(topbarBounds && topbarBounds.height<=46, 'one compact navigation row');
      const railNav = topbar.getByRole('group',{name:'Recents'});
      if(width>=768) {
        await expect(railNav).toBeVisible();
        const mediaBounds = await topbar.getByRole('link',{name:'Video',exact:true}).boundingBox();
        const activityBounds = await railNav.getByRole('button',{name:'Activity',exact:true}).boundingBox();
        assert.ok(mediaBounds && activityBounds && Math.abs(mediaBounds.y-activityBounds.y)<1, 'media and gallery tabs share a baseline');
        const viewAll = railNav.getByRole('link',{name:'View all',exact:true});
        const viewAllBounds = await viewAll.boundingBox(), railBounds = await railNav.boundingBox();
        assert.ok(viewAllBounds && railBounds && activityBounds && Math.abs(viewAllBounds.y-activityBounds.y)<1 && Math.abs(viewAllBounds.x+viewAllBounds.width-railBounds.x-railBounds.width)<1, 'View all stays on the same row at the right edge');
        await expect(viewAll).toHaveAttribute('href','/app/library');
        await railNav.getByRole('button',{name:'Recents',exact:true}).click();
        await expect(railNav.getByRole('button',{name:'Recents',exact:true})).toHaveAttribute('aria-pressed','true');
        await railNav.getByRole('button',{name:'Activity',exact:true}).click();
      } else await expect(railNav).toBeHidden();
      for (const label of ['Create video','Modify Video','Extend Video']) await expect(page.getByRole('button',{name:label,exact:true})).toBeVisible();
      const idleGeometry: Array<{height:number;modelTop:number;toolbarTop:number}> = [];
      for (const tab of ['Prompt','AI assistant']) {
        await page.getByRole('tab',{name:tab,exact:true}).click();
        await expect(page.getByRole('button',{name:`Change model: ${engine.label}`,exact:true})).toHaveCount(1);
        await expect(page.getByRole('button',{name:`Change model: ${engine.label}`,exact:true})).toBeVisible();
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
        idleGeometry.push(await page.evaluate(()=>{
          const root=document.querySelector('[data-prompt-assistance-preview]')!.getBoundingClientRect();
          const model=document.querySelector('[role="tabpanel"]:not([hidden]) button[aria-label^="Change model:"]')!.getBoundingClientRect();
          const toolbar=document.querySelector('.app-composer-toolbar')!.getBoundingClientRect();
          return {height:root.height,modelTop:model.top-root.top,toolbarTop:toolbar.top+scrollY};
        }));
      }
      assert.deepEqual(idleGeometry[1],idleGeometry[0], 'before chatting, the frame, model and generation toolbar stay fixed between tabs');
      const writing = await page.getByRole('tablist',{name:'Writing mode'}).boundingBox();
      const operations = await page.locator('[data-composer-command-bar]').boundingBox();
      assert.ok(writing && operations);
      await expect(page.getByRole('button',{name:'Expand',exact:true})).toHaveCount(0);
      if(width>=768) assert.ok(Math.abs(writing.y-operations.y)<3, 'writing tabs and operations share a row');
      await page.getByRole('button',{name:'Modify Video',exact:true}).click();
      await expect(page.getByRole('button',{name:'Modify Video',exact:true})).toHaveAttribute('aria-pressed','true');
      await page.getByRole('button',{name:'Create video',exact:true}).click();
      await expect(page.getByRole('tab',{name:'Prompt',exact:true})).toHaveAttribute('aria-selected','true');
      await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
      const message=page.locator('[data-assistance-message]');
      await expect(page.locator('[data-assistance-transcript]')).toBeHidden();
      await message.fill('Refine this'); await message.press('Enter'); await expect(page.locator('[data-assistance-apply]')).toBeEnabled();
      const expand = await page.getByRole('button',{name:'Expand',exact:true}).boundingBox();
      assert.ok(expand && expand.y>=Math.max(writing.y+writing.height,operations.y+operations.height), 'Expand has its own conversation heading, away from operations');
      const height=await page.locator('[data-assistance-transcript]').evaluate(el=>el.clientHeight);
      await page.getByRole('button',{name:'Expand',exact:true}).click();
      assert.ok(await page.locator('[data-assistance-transcript]').evaluate(el=>el.clientHeight)>height);
      await page.getByRole('button',{name:'Collapse',exact:true}).click();
      await page.getByRole('button',{name:'Review',exact:true}).click();
      await expect(page.locator('[data-assistance-transcript]')).toBeHidden();
      await expect(message).toBeVisible();
      await page.getByRole('button',{name:'Conversation',exact:true}).click();
      await expect(page.locator('[data-assistance-transcript]')).toBeVisible();
      for (const type of ['image','audio','video']) {
        const links=page.getByRole('navigation',{name:'Creation type'});
        await links.getByRole('link',{name:type[0].toUpperCase()+type.slice(1),exact:true}).click();
        await expect(links.getByRole('link',{name:type[0].toUpperCase()+type.slice(1),exact:true})).toHaveAttribute('aria-current','page');
        await expect(page.getByRole('navigation',{name:'Creation type'})).toBeVisible();
      }
      await page.close();
    }
  } finally {await browser.close();await fixture.close();}
});

test('production keeps its original media navigation and does not inject the preview model slot', async () => {
  const engine=listFalEngines().find(entry=>entry.id==='kling-o3-pro')!.engine;
  const fixture=await startWorkspaceReferenceFixture({source,config:{engine},assistancePreview:false});
  const browser=await chromium.launch({headless:true});
  try {const page=await browser.newPage();await page.goto(fixture.url);
    await expect(page.getByRole('navigation',{name:'Creation type'})).toBeVisible();
    await expect(page.locator('[data-composer-command-bar]')).toHaveCount(0);
    await expect(page.locator('[data-prompt-assistance-preview]')).toHaveCount(0);
  }finally{await browser.close();await fixture.close();}
});
