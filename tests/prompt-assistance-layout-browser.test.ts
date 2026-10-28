import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { startWorkspaceReferenceFixture } from './helpers/workspace-reference-browser-fixture';

test('audio preview applies only to its active text field and retires an intent switch', {timeout:60_000}, async () => {
  const source = `import { useState } from 'react'; import {createRoot} from 'react-dom/client';
    import { AudioCreationEditor } from './app/(core)/(workspace)/app/audio/_components/AudioCreationEditor';
    import {newAudioDraft} from './src/lib/audio-creation';
    import {audioCreationCopy} from './app/(core)/(workspace)/app/audio/_lib/audio-creation-copy';
    function Fixture(){const [intent,setIntent]=useState('voice'); const [draft,setDraft]=useState({...newAudioDraft('voice'),script:'Original speech',prompt:'Original style',lyrics:'Original lyrics',voiceModel:'seed',reference:{url:'/voice.wav',name:'long-private-file-name.wav'}});
      globalThis.currentDraft=draft;return <><button onClick={()=>setIntent('song')}>Switch to song</button><AudioCreationEditor assistanceAccountId="a" intent={intent} draft={draft} copy={audioCreationCopy('en')} onChange={patch=>setDraft(d=>({...d,...patch}))} onFile={()=>{}} uploading={false} onLibrary={()=>{}} /></>}
    createRoot(document.getElementById('root')).render(<Fixture/>);`;
  const fixture=await startWorkspaceReferenceFixture({source, config:{}, assistancePreview:true});
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();await page.goto(fixture.url);
    await page.getByRole('button',{name:'Audio 1',exact:true}).click();
    await expect(page.locator('[data-assistance-message]')).toHaveValue('@Audio1 ');
    await expect(page.locator('[data-assistance-message]')).toBeFocused();
    assert.equal(await page.evaluate(()=>(globalThis as any).currentDraft.script),'Original speech');
    await page.locator('[data-assistance-message]').fill('Make it natural.');await page.locator('[data-assistance-message]').press('Enter');
    await expect(page.getByRole('button',{name:'Use script',exact:true})).toBeEnabled();
    await page.locator('[data-assistance-expand]').click();await page.locator('[data-assistance-editor]').fill('Revised speech.');await page.getByRole('button',{name:'Use script',exact:true}).click();
    assert.deepEqual(await page.evaluate(()=>{const d=(globalThis as any).currentDraft;return [d.script,d.prompt,d.lyrics,d.voiceModel,d.reference.name]}),['Revised speech.','Original style','Original lyrics','seed','long-private-file-name.wav']);
    await page.getByRole('button',{name:'Undo',exact:true}).click();
    assert.equal(await page.evaluate(()=>(globalThis as any).currentDraft.script),'Original speech');
    await page.getByRole('tab',{name:'With Milo',exact:true}).click();
    await page.locator('[data-assistance-message]').fill('Next');await page.locator('[data-assistance-message]').press('Enter');await page.getByRole('button',{name:'Switch to song'}).click();
    await expect(page.getByRole('tab',{name:'Prompt',exact:true})).toHaveAttribute('aria-selected','true');
    await page.getByRole('tab',{name:'With Milo',exact:true}).click();await expect(page.locator('[data-assistance-apply]')).toHaveCount(0);
    await page.locator('[data-assistance-message]').fill('More rhythm');await page.locator('[data-assistance-message]').press('Enter');await expect(page.getByRole('button',{name:'Use prompt',exact:true})).toBeEnabled();
    await page.locator('[data-assistance-expand]').click();await page.locator('[data-assistance-editor]').fill('Revised music style.');await page.getByRole('button',{name:'Use prompt',exact:true}).click();
    assert.deepEqual(await page.evaluate(()=>{const d=(globalThis as any).currentDraft;return [d.script,d.prompt,d.lyrics]}),['Original speech','Revised music style.','Original lyrics']);
  } finally {await browser.close();await fixture.close();}
});

test('ordinary production composer does not expose the simulated assistant', async () => {
  const engine = listFalEngines().find(entry => entry.id === 'kling-o3-pro')!.engine;
  const fixture = await startWorkspaceReferenceFixture({config:{engine,locale:'en',fields:[],assets:{},assistance:{scopeKey:'a:video',contextKey:'16:9'}}});
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();await page.goto(fixture.url);
    await expect(page.locator('[data-workspace-prompt]')).toBeVisible();
    await expect(page.locator('[data-prompt-assistance-preview]')).toHaveCount(0);
  } finally {await browser.close();await fixture.close();}
});

test('real composer keeps the full suggestion, independent scrolling, references and safe manual fallback', {timeout:120_000}, async () => {
  const engine = listFalEngines().find(entry => entry.id === 'kling-o3-pro')!.engine;
  const field = [...engine.inputSchema!.required,...engine.inputSchema!.optional].find(field => field.id === 'image_urls')!;
  const config = { engine, locale:'en', prompt:'Keep this visible.', assistance:{scopeKey:'a:video',contextKey:'16:9:5s'}, fields:[{field,required:false,role:'reference'}], assets:{image_urls:[{id:'first',kind:'image',name:'a-file-name-that-should-not-be-shown.png',size:1,type:'image/png',url:'/first.svg',previewUrl:'/first.svg',status:'ready'}]} };
  const fixture = await startWorkspaceReferenceFixture({config,assistancePreview:true});
  const browser = await chromium.launch({headless:true});
  try {
    for (const width of [320,390,768,1024,1440]) {
      const page = await browser.newPage({viewport:{width,height:width===1024?600:900},reducedMotion:'reduce'});
      const errors:string[]=[]; page.on('pageerror',error=>errors.push(error.message));
      await page.goto(fixture.url);
      if(width===390) await page.locator('html').evaluate(el=>el.setAttribute('data-theme','dark'));
      await page.getByRole('tab',{name:'With Milo',exact:true}).click({timeout:3000});
      const message=page.locator('[data-assistance-message]');
      await message.fill('Keep the camera movement slow.'); await message.press('Enter');
      await expect(page.locator('[data-assistance-apply]')).toBeEnabled();
      await page.locator('[data-assistance-expand]').click();
      const text='A slow camera movement. '.repeat(100);
      await page.locator('[data-assistance-editor]').fill(text);
      await page.locator('[data-assistance-expand]').click();
      await page.locator('[data-assistance-apply]').click();
      await expect(page.locator('[data-workspace-prompt]')).toHaveValue(text);
      await page.getByRole('button',{name:'Undo',exact:true}).click();
      await expect(page.locator('[data-workspace-prompt]')).toHaveValue('Keep this visible.');
      await page.getByRole('tab',{name:'With Milo',exact:true}).click();
      for(let i=0;i<10;i++){await message.fill(`Follow-up ${i}`);await message.press('Enter');await expect(page.getByRole('button',{name:'Send message to Milo'})).toBeDisabled();await expect(page.locator('[data-assistance-apply]')).toBeEnabled();}
      await expect(message).toBeFocused();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
      assert.equal(await page.locator('[data-assistance-transcript]').evaluate(el=>el.scrollHeight>el.clientHeight),true);
      assert.equal(await page.locator('[data-assistance-apply]').evaluate(el=>Boolean(el.closest('[data-assistance-body],[data-assistance-transcript]'))),false);
      assert.equal(await page.evaluate(()=>(globalThis as any).submissions??0),0);
      if (process.env.PROMPT_ASSISTANCE_EVIDENCE_DIR && [390,1440].includes(width)) {
        await mkdir(process.env.PROMPT_ASSISTANCE_EVIDENCE_DIR,{recursive:true});
        await page.screenshot({path:`${process.env.PROMPT_ASSISTANCE_EVIDENCE_DIR}/composer-${width}.png`,fullPage:true});
      }
      // A replaced reference invalidates the proposal before a newer draft can be overwritten.
      await page.evaluate(()=>(globalThis as any).updateReferences({image_urls:[]}));
      await expect(page.locator('[data-assistance-apply]')).toBeDisabled();
      assert.deepEqual(errors,[]);
      await page.close();
    }
  } finally { await browser.close(); await fixture.close(); }
});
