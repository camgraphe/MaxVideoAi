import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium, webkit, expect } from '@playwright/test';
import { startWorkspaceReferenceFixture } from './helpers/workspace-reference-browser-fixture';

const source = `
import {useState} from 'react'; import {createRoot} from 'react-dom/client';
import {AudioCreationEditor} from './app/(core)/(workspace)/app/audio/_components/AudioCreationEditor';
import {audioCreationCopy} from './app/(core)/(workspace)/app/audio/_lib/audio-creation-copy';
import {newAudioDraft} from './src/lib/audio-creation';
import styles from './app/(core)/(workspace)/app/audio/_components/audio-creation.module.css';
function Fixture(){
 const [intent,setIntent]=useState('voice'),[draft,setDraft]=useState({...newAudioDraft('voice'),script:'Keep this script.',prompt:'Keep this direction.'});
 return <main className={styles.root} data-audio-creation={intent}>
  <nav aria-label="Audio test intent">{['voice','music','song','sfx','ambience'].map(value=><button key={value} onClick={()=>{setIntent(value);setDraft({...newAudioDraft(value),script:'Keep this script.',prompt:'Keep this direction.'});}}>{value}</button>)}</nav>
  <div className={styles.layout}><AudioCreationEditor assistanceAccountId="fixture" intent={intent} draft={draft} copy={audioCreationCopy('en')}
   onChange={patch=>setDraft(current=>({...current,...patch}))} onFile={()=>{}} uploading={false} onLibrary={()=>{}} />
   <aside className={styles.results}>Listen</aside></div>
 </main>;
}createRoot(document.getElementById('root')).render(<Fixture/>);`;

test('audio page styling preserves the shared composer focus and circular send button', {timeout:90_000}, async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config:{},assistancePreview:true});
 try {for(const browserType of [chromium,webkit]) {
  const browser=await browserType.launch({headless:true});
  try {for(const width of [320,390,1105]) {for(const theme of ['light','dark']) {
   const page=await browser.newPage({viewport:{width,height:1112},hasTouch:width<768});await page.goto(fixture.url);
   await page.evaluate(theme=>document.documentElement.setAttribute('data-theme',theme),theme);
   const assistant=page.getByRole('tab',{name:'AI assistant',exact:true});
   const message=page.getByRole('textbox',{name:'Message Milo',exact:true});
   const send=page.getByRole('button',{name:'Send message to Milo',exact:true});
   const verifyShape=async()=>{
    await message.focus();
    const field=await message.evaluate(el=>{const css=getComputedStyle(el);return {outline:css.outlineStyle,shadow:css.boxShadow,fontSize:parseFloat(css.fontSize)};});
    assert.equal(field.outline,'none',`${browserType.name()} ${width} ${theme}: no rectangular focus inside the rounded composer`);
    assert.equal(field.shadow,'none');
    if(width<768) assert.ok(field.fontSize>=16,'touch input must not cause browser zoom');
    const button=(await send.boundingBox())!;
    assert.equal(button.width,button.height,`${browserType.name()} ${width} ${theme}: send remains circular`);
    assert.ok(button.width>=38);
    assert.equal(await send.evaluate(el=>getComputedStyle(el).borderRadius),'50%');
    const icon=(await send.locator('svg').boundingBox())!;
    assert.equal(icon.width,icon.height);
    assert.ok(Math.abs(icon.x+icon.width/2-button.x-button.width/2)<1);
    assert.ok(Math.abs(icon.y+icon.height/2-button.y-button.height/2)<1);
    const frame=await page.locator('[data-prompt-assistance-preview]').evaluate(el=>({border:getComputedStyle(el).borderColor,focused:getComputedStyle(el).getPropertyValue('--text-muted')}));
    assert.ok(frame.border && frame.focused,'the outer frame retains the shared focus treatment');
    assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('main *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1).map(el=>[el.tagName,el.className,el.getBoundingClientRect().right])),[],`${browserType.name()} ${width} ${theme}: no overflow`);
   };
   for(const intent of ['voice','music','song','sfx','ambience']) {
    if(intent!=='voice') await page.getByRole('navigation',{name:'Audio test intent'}).getByRole('button',{name:intent,exact:true}).click();
    await assistant.click();await verifyShape();
    if(intent==='voice') {
     await message.fill('Keep the delivery natural.');await send.click();
     await expect(page.getByRole('button',{name:'Use script',exact:true})).toBeEnabled();
     await verifyShape();
     await message.fill('Keep this unsent refinement.');await message.press('Tab');await send.focus();
     await expect(send).toBeFocused();
     assert.notEqual(await send.evaluate(el=>getComputedStyle(el).outlineStyle),'none','keyboard send focus remains visible');
     await page.getByRole('tab',{name:'Prompt',exact:true}).click();
     await page.locator('#audio-creation-text').focus();
     assert.equal(await page.locator('#audio-creation-text').evaluate(el=>getComputedStyle(el).outlineStyle),'none');
     await expect(page.locator('#audio-creation-text')).toHaveValue('Keep this script.');
     const model=page.getByRole('combobox',{name:'Model',exact:true});await model.focus();
     assert.notEqual(await model.evaluate(el=>getComputedStyle(el).outlineStyle),'none','audio settings outside the composer retain focus indicators');
    }
   }
   await page.close();
  }}}finally{await browser.close();}
 }}finally{await fixture.close();}
});
