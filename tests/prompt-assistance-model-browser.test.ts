import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium, webkit, expect } from '@playwright/test';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { startWorkspaceReferenceFixture } from './helpers/workspace-reference-browser-fixture';

const source = `
import {useState} from 'react'; import {createRoot} from 'react-dom/client';
import {I18nProvider} from './lib/i18n/I18nProvider';
import {Composer} from './components/Composer';
import {ComposerWorkspaceControls} from './components/composer/ComposerWorkspaceControls.client';
import {WorkspaceComposerModel} from './components/composer/WorkspaceComposerModel.client';
const engines=globalThis.fixtureConfig.engines;
function Fixture(){const [id,setId]=useState('seedance-2-0-mini');const [prompt,setPrompt]=useState('Keep my draft.');const engine=engines.find(e=>e.id===id);
return <I18nProvider locale="en" dictionary={{}} fallback={{}}><main style={{padding:12,maxWidth:900}}>
<button onClick={()=>setId('wan-3-prime')}>Single model</button>
<ComposerWorkspaceControls modelControl={<WorkspaceComposerModel engines={engines} engineId={id} onEngineChange={setId} mode="t2v" onModeChange={()=>{}}
 disabledEngineReasons={{'seedance-2-0':'Unavailable in this workflow'}} picker={{key:'fixture',scope:'owner',label:'Prices for',mode:'t2v',options:{}}} />}>
<Composer density="workspace" engine={engine} prompt={prompt} onPromptChange={setPrompt} assetFields={[]} assets={{}} price={1} currency="USD" isLoading={false}
 assistance={{scopeKey:'owner',contextKey:id}} onGenerate={()=>{throw Error('Unexpected generation')}} />
</ComposerWorkspaceControls></main></I18nProvider>};createRoot(document.getElementById('root')).render(<Fixture/>);`;

test('compact model selector keeps logos, short names and eligible variants reachable', {timeout:60_000}, async () => {
  const ids=['seedance-2-0-mini','seedance-2-0','seedance-2-0-fast','wan-3-prime'];
  const engines=listFalEngines().filter(entry=>ids.includes(entry.id)).map(entry=>entry.engine);
  const fixture=await startWorkspaceReferenceFixture({source,config:{engines},assistancePreview:true});
  try {
    for(const browserType of [chromium,webkit]) {
      const browser=await browserType.launch({headless:true});
      try {for(const width of [320,390,1440]) {
        const page=await browser.newPage({viewport:{width,height:844}});await page.goto(fixture.url);
        const model=page.getByRole('button',{name:`Change model: ${engines.find(e=>e.id==='seedance-2-0-mini')!.label}`,exact:true});
        const variants=page.getByRole('button',{name:'Variant: Mini',exact:true});
        await expect(variants).toBeVisible();
        await expect(model).toHaveText('Seedance 2 Mini');
        await expect(model.locator('[role="img"]')).toHaveCount(1);
        const m=await model.boundingBox(),v=await variants.boundingBox();
        assert.ok(m && v && v.x>=m.x+m.width && Math.abs(m.y-v.y)<2, 'variant control follows the model on the same row');
        await variants.click();
        await expect(page.getByRole('option',{name:'Standard',exact:true})).toBeDisabled();
        await expect(page.getByRole('option',{name:'Mini',exact:true})).toHaveAttribute('aria-selected','true');
        await page.getByRole('option',{name:'Fast',exact:true}).click();
        await expect(page.getByRole('button',{name:'Variant: Fast',exact:true})).toBeVisible();
        await expect(page.locator('[data-workspace-prompt]')).toHaveValue('Keep my draft.');
        await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
        const assistantVariant=page.getByRole('button',{name:'Variant: Fast',exact:true});
        await assistantVariant.focus();await page.keyboard.press('Enter');
        await expect(page.getByRole('listbox')).toBeVisible();await page.keyboard.press('Escape');
        await expect(assistantVariant).toBeFocused();
        await page.getByRole('button',{name:'Single model',exact:true}).click();
        await expect(page.getByRole('button',{name:/^Variant:/})).toHaveCount(0);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
        await page.close();
      }}finally{await browser.close();}
    }
  }finally{await fixture.close();}
});
