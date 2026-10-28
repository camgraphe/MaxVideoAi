import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium, expect } from '@playwright/test';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { startWorkspaceReferenceFixture } from './helpers/workspace-reference-browser-fixture';

const source = `
import {useState} from 'react'; import {createRoot} from 'react-dom/client';
import {PathnameContext} from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import {I18nProvider} from './lib/i18n/I18nProvider';
import {AppNavigation} from './components/app/AppNavigation.client';
import {ComposerWorkspaceControls} from './components/composer/ComposerWorkspaceControls.client';
import {WorkspaceComposerModel} from './components/composer/WorkspaceComposerModel.client';
import {Composer} from './components/Composer';
const engine=globalThis.fixtureConfig.engine;
function Fixture(){const [path,setPath]=useState('/app'); const [mode,setMode]=useState(null); const [prompt,setPrompt]=useState('Original draft');
return <I18nProvider locale="en" dictionary={{}} fallback={{}}><PathnameContext.Provider value={path}>
  <button onClick={()=>setPath('/app/audio')}>Audio route</button><button onClick={()=>setPath('/app/image')}>Image route</button><button onClick={()=>setPath('/app')}>Video route</button>
  <AppNavigation variant="activities" />
  {path!=='/app/audio'? <main className="app-workspace-main" style={{padding:12,maxWidth:900}}><ComposerWorkspaceControls modelControl={<WorkspaceComposerModel engines={[engine]} engineId={engine.id} mode="t2v" onModeChange={()=>{}} onEngineChange={()=>{}} />}>
  <Composer density="workspace" engine={engine} prompt={prompt} onPromptChange={setPrompt} assetFields={[]} assets={{}} price={1.35} currency="USD" isLoading={false}
    assistance={{scopeKey:'a:video',contextKey:'4s'}} activeManualMode={mode} onModeToggle={setMode}
    modeToggles={[{mode:null,label:'Create video'},{mode:'v2v',label:'Modify Video'},{mode:'extend',label:'Extend Video'}]}
    onGenerate={()=>{throw new Error('Must not generate')}} />
  </ComposerWorkspaceControls></main>:null}
 </PathnameContext.Provider></I18nProvider>};createRoot(document.getElementById('root')).render(<Fixture/>);`;

test('common bar keeps one media navigation, visible operations and a model control in either writing tab', {timeout:60_000}, async () => {
  const engine = listFalEngines().find(entry => entry.id === 'kling-o3-pro')!.engine;
  const fixture = await startWorkspaceReferenceFixture({source, config:{engine}, assistancePreview:true});
  const browser = await chromium.launch({headless:true});
  try {
    for (const width of [320,390,768,1440]) {
      const page=await browser.newPage({viewport:{width,height:900}}); await page.goto(fixture.url);
      await expect(page.getByRole('navigation',{name:'Creation type'})).toHaveCount(1);
      for (const label of ['Create video','Modify Video','Extend Video']) await expect(page.getByRole('button',{name:label,exact:true})).toBeVisible();
      for (const tab of ['Prompt','AI assistant']) {
        await page.getByRole('tab',{name:tab,exact:true}).click();
        await expect(page.getByRole('button',{name:`Change model: ${engine.label}`,exact:true})).toHaveCount(1);
        await expect(page.getByRole('button',{name:`Change model: ${engine.label}`,exact:true})).toBeVisible();
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
      }
      const message=page.locator('[data-assistance-message]');
      const height=await page.locator('[data-assistance-transcript]').evaluate(el=>el.clientHeight);
      await page.getByRole('button',{name:'Expand',exact:true}).click();
      assert.ok(await page.locator('[data-assistance-transcript]').evaluate(el=>el.clientHeight)>height);
      await page.getByRole('button',{name:'Collapse',exact:true}).click();
      await message.fill('Refine this'); await message.press('Enter'); await expect(page.locator('[data-assistance-apply]')).toBeEnabled();
      await page.getByRole('button',{name:'Review',exact:true}).click();
      await expect(page.locator('[data-assistance-transcript]')).toBeHidden();
      await expect(message).toBeVisible();
      await page.getByRole('button',{name:'Conversation',exact:true}).click();
      await expect(page.locator('[data-assistance-transcript]')).toBeVisible();
      await page.getByRole('button',{name:'Image route',exact:true}).click();
      await expect(page.getByRole('navigation',{name:'Creation type'})).toHaveCount(1);
      await expect(page.getByRole('link',{name:'Image',exact:true})).toHaveAttribute('aria-current','page');
      await page.getByRole('button',{name:'Audio route',exact:true}).click();
      await expect(page.getByRole('navigation',{name:'Creation type'})).toHaveCount(1);
      await expect(page.getByRole('link',{name:'Audio',exact:true})).toHaveAttribute('aria-current','page');
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
