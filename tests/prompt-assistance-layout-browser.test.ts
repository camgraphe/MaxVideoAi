import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { startWorkspaceReferenceFixture, workspaceReferenceFixtureSource } from './helpers/workspace-reference-browser-fixture';
import { sourceSettingsBrowserSource } from './helpers/workspace-source-settings-browser-source';

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
    await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
    await page.locator('[data-assistance-message]').fill('Keep this voice direction');
    await page.getByRole('button',{name:'Remove Audio 1',exact:true}).click();
    await page.getByRole('combobox',{name:'Model',exact:true}).selectOption('minimax');
    await expect(page.getByRole('tab',{name:'AI assistant',exact:true})).toHaveAttribute('aria-selected','true');
    await expect(page.locator('[data-assistance-message]')).toHaveValue('Keep this voice direction');
    await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
    await page.locator('[data-assistance-message]').fill('Next');await page.locator('[data-assistance-message]').press('Enter');await page.getByRole('button',{name:'Switch to song'}).click();
    await expect(page.getByRole('tab',{name:'Prompt',exact:true})).toHaveAttribute('aria-selected','true');
    await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await expect(page.locator('[data-assistance-apply]')).toHaveCount(0);
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

test('compact reference picker retains the field character library action', async () => {
  const engine=listFalEngines().find(entry=>entry.id==='kling-o3-pro')!.engine;
  const field=[...engine.inputSchema!.required,...engine.inputSchema!.optional].find(field=>field.id==='image_urls')!;
  const source=workspaceReferenceFixtureSource.replace('assetFields={config.fields}', 'assetFields={config.fields.map(entry=>({...entry,headerAction:<button type="button" onClick={()=>{globalThis.characterOpened=true}}>Character library</button>}))}');
  const fixture=await startWorkspaceReferenceFixture({source,assistancePreview:true,config:{engine,locale:'en',fields:[{field,required:false}],assets:{},assistance:{scopeKey:'owner',contextKey:'image'}}});
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();await page.goto(fixture.url);
    await page.getByRole('button',{name:'Add references',exact:true}).click();
    await page.getByRole('button',{name:'Character library',exact:true}).click({timeout:2000});
    assert.equal(await page.evaluate(()=>(globalThis as any).characterOpened),true);
  } finally {await browser.close();await fixture.close();}
});

test('compact Modify and Extend keep source references inside the writing footer in both tabs', async () => {
  const source=sourceSettingsBrowserSource.replace('<Composer density="workspace"','<Composer assistance={{scopeKey:"owner",contextKey:"modify"}} density="workspace"');
  const fixture=await startWorkspaceReferenceFixture({source,assistancePreview:true,config:{}});
  const browser=await chromium.launch({headless:true});
  try {
    for(const width of [320,390,1440]) {
      const page=await browser.newPage({viewport:{width,height:844},hasTouch:width<768});await page.goto(fixture.url);
      await page.locator('[data-mode="create"]').click();
      const creationTop=await page.locator('[data-prompt-assistance-preview]').evaluate(el=>el.getBoundingClientRect().top+scrollY);
      await page.getByRole('button',{name:'Add references',exact:true}).click();
      const picker=page.getByRole('dialog');
      assert.deepEqual(await picker.locator('.app-reference-role-row').evaluateAll(rows=>rows.map(row=>[...row.querySelectorAll('[data-reference-role]')].map(button=>button.getAttribute('data-reference-role')))),
        [['image_urls','video_urls','audio_urls'],['image_url','end_image_url']]);
      await expect(picker.locator('[data-reference-role="image_urls"]')).toHaveAttribute('aria-pressed','true');
      const referenceRow=await picker.locator('.app-reference-role-row').first().boundingBox();
      for(const fieldId of ['image_urls','video_urls','audio_urls']) {
        const buttonBox=await picker.locator(`[data-reference-role="${fieldId}"]`).boundingBox();
        assert.ok(buttonBox && referenceRow && Math.abs(buttonBox.y-referenceRow.y)<1, 'media choices share the first row on mobile and desktop');
      }
      const framesRow=await picker.locator('.app-reference-role-row').last().boundingBox();
      assert.ok(referenceRow && framesRow && framesRow.y>=referenceRow.y+referenceRow.height, 'start and end images stay below media references');
      const pickerBeforeHelp=await picker.boundingBox();
      await expect(picker.getByRole('button',{name:'About references',exact:true})).toHaveCount(0);
      const tooltip=picker.getByRole('tooltip');
      for(const [title,description] of [['Images','Guide subjects, style and composition.'],['Videos','Guide motion and visual style.'],['Audio','Guides sound, rhythm or voice, depending on the model.'],['Start image','Sets the opening image of your clip.'],['End image','Sets the closing image of your clip.']]) {
        const help=picker.getByRole('button',{name:`About ${title}`,exact:true});
        if(width<768) await help.tap(); else await help.click();
        await expect(tooltip).toBeVisible();
        await expect(tooltip).toHaveText(description);
        await expect(picker.locator('[data-reference-role="image_urls"]')).toHaveAttribute('aria-pressed','true');
        assert.deepEqual(await picker.boundingBox(),pickerBeforeHelp,'help does not resize the reference dialog');
        const tooltipBox=await tooltip.boundingBox(),inventoryBox=await picker.locator('.app-reference-inventory').boundingBox();
        assert.ok(tooltipBox && pickerBeforeHelp && tooltipBox.x>=pickerBeforeHelp.x && tooltipBox.x+tooltipBox.width<=pickerBeforeHelp.x+pickerBeforeHelp.width,'each tooltip stays within the picker at mobile widths');
        assert.ok(tooltipBox && inventoryBox && tooltipBox.y+tooltipBox.height<=inventoryBox.y+inventoryBox.height,'help is fully visible inside the scrolling panel');
        await help.press('Escape');
        await expect(tooltip).toHaveCount(0);
        await expect(picker).toBeVisible();
        await expect(help).toBeFocused();
      }
      const referenceHelp=picker.getByRole('button',{name:'About End image',exact:true});
      await referenceHelp.press('Enter');
      await expect(tooltip).toBeVisible();
      await picker.locator('[data-reference-role="video_urls"]').click();
      await expect(tooltip).toHaveCount(0);
      await expect(picker.locator('[data-reference-role="video_urls"]')).toHaveAttribute('aria-pressed','true');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
      await picker.getByRole('button',{name:'Close',exact:true}).click();
      for(const operation of ['v2v','extend']){const idleGeometry: Array<{height:number;sourceTop:number;sourceLeft:number}> = [];await page.locator(`[data-mode="${operation}"]`).click();for(const mode of ['Prompt','AI assistant']){
        await page.getByRole('tab',{name:mode,exact:true}).click();
        assert.equal(await page.locator('[data-prompt-assistance-preview]').evaluate(el=>el.getBoundingClientRect().top+scrollY),creationTop, 'source guidance must not shift the composer when changing operation');
        const guidance=page.getByRole('status').filter({hasText:'Upload the video'});
        await expect(guidance).toHaveCount(1);
        const noticeBox=await guidance.boundingBox(),toolbarBox=await page.locator('.app-composer-toolbar').boundingBox();
        assert.ok(noticeBox && toolbarBox && noticeBox.y>=toolbarBox.y+toolbarBox.height, 'source guidance stays below Generate in both writing modes');
        const sourceButton=page.locator('[data-reference-command="video_urls"],[data-reference-command="video_url"],[data-reference-command="extension_source_videos"]').first();
        await expect(sourceButton).toBeVisible();
        const sourceBox=await sourceButton.boundingBox();
        const inputBox=await page.locator(mode==='Prompt'?'[data-workspace-prompt]':'[data-assistance-message]').boundingBox();
        assert.ok(sourceBox && inputBox && sourceBox.y>=inputBox.y+inputBox.height, 'source action stays below the writing area');
        const frame=await page.locator('[data-prompt-assistance-preview]').boundingBox();
        assert.ok(frame);
        idleGeometry.push({height:frame.height,sourceTop:sourceBox.y-frame.y,sourceLeft:sourceBox.x-frame.x});
        const surface=page.locator(mode==='Prompt'?'[data-assistance-manual-input]':'[data-assistance-input]');
        await expect(surface.locator('[data-reference-command]')).toHaveCount(1);
        await expect(surface.getByRole('button',{name:'Add references',exact:true})).toBeVisible();
        await expect(surface.locator('.app-reference-required')).toHaveCount(0);
        assert.equal(await sourceButton.evaluate(button=>getComputedStyle(button).flexDirection),'row', 'source action remains a compact horizontal control on mobile');
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
        if(process.env.PROMPT_ASSISTANCE_EVIDENCE_DIR && operation==='v2v' && mode==='Prompt' && width===390) {
          await mkdir(process.env.PROMPT_ASSISTANCE_EVIDENCE_DIR,{recursive:true});
          await page.locator('[data-workspace-prompt]').focus();
          await page.locator('[data-prompt-assistance-preview]').screenshot({path:`${process.env.PROMPT_ASSISTANCE_EVIDENCE_DIR}/modify-footer-mobile.png`});
        }
        const recognizablePeopleNotice=page.getByRole('note').filter({hasText:'recognizable person'});
        await expect(recognizablePeopleNotice).toHaveCount(0);
        await sourceButton.click();await expect(page.locator('.app-reference-popup')).toBeVisible();
        await expect(page.getByRole('dialog').getByRole('note').filter({hasText:'recognizable person'})).toBeVisible();
        await expect(page.locator('.app-reference-popup')).not.toContainText('Reference images');
        await page.locator('.app-reference-popup').getByRole('button',{name:'Close',exact:true}).click();
        await expect(page.locator('.app-reference-popup')).toHaveCount(0);
        await expect(recognizablePeopleNotice).toHaveCount(0);
        await surface.getByRole('button',{name:'Add references',exact:true}).click();
        const sourceField=await sourceButton.getAttribute('data-reference-command');
        await page.getByRole('dialog').locator(`[data-reference-role="${sourceField}"]`).click();
        await expect(page.getByRole('dialog').getByRole('note').filter({hasText:'recognizable person'})).toBeVisible();
        await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
      }
        assert.deepEqual(idleGeometry[1],idleGeometry[0], 'required source and frame stay fixed between empty writing modes');
      }
      await page.close();
    }
  }finally{await browser.close();await fixture.close();}
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
      await page.getByRole('tab',{name:'AI assistant',exact:true}).click({timeout:3000});
      const message=page.locator('[data-assistance-message]');
      const inputTop = () => message.evaluate(el => el.getBoundingClientRect().top + window.scrollY);
      const emptyInputTop = await inputTop();
      await expect(page.locator('[data-assistance-transcript]')).toBeHidden();
      await message.fill('Keep the camera movement slow.');
      assert.ok(Math.abs(await inputTop()-emptyInputTop)<2, 'typing alone must keep the empty conversation compact');
      await message.press('Enter');
      await expect(page.locator('[data-assistance-transcript]')).toBeVisible();
      const initialInputTop = await inputTop();
      assert.ok(initialInputTop-emptyInputTop>=230, 'the history opens only after the first send');
      await expect(page.locator('[data-assistance-apply]')).toBeEnabled();
      assert.ok(Math.abs(await inputTop()-initialInputTop)<2, 'the first reply must not push the opened reply field down');
      await page.locator('[data-assistance-expand]').click();
      assert.ok(Math.abs(await inputTop()-initialInputTop)<2, 'expanding a proposal must not move the reply field');
      const text='A slow camera movement. '.repeat(100);
      await page.locator('[data-assistance-editor]').fill(text);
      await page.locator('[data-assistance-expand]').click();
      await page.locator('[data-assistance-apply]').click();
      await expect(page.locator('[data-workspace-prompt]')).toHaveValue(text);
      await page.getByRole('button',{name:'Undo',exact:true}).click();
      await expect(page.locator('[data-workspace-prompt]')).toHaveValue('Keep this visible.');
      await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
      for(let i=0;i<10;i++){await message.fill(`Follow-up ${i}`);await message.press('Enter');await expect(page.getByRole('button',{name:'Send message to Milo'})).toBeDisabled();await expect(page.locator('[data-assistance-apply]')).toBeEnabled();}
      assert.ok(Math.abs(await inputTop()-initialInputTop)<2, 'ten replies must not move the reply field');
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
