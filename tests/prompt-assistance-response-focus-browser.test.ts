import assert from 'node:assert/strict';
import test from 'node:test';
import {chromium, webkit, expect, type Page} from '@playwright/test';
import {listFalEngines} from '../frontend/src/config/falEngines';
import {startWorkspaceReferenceFixture} from './helpers/workspace-reference-browser-fixture';

// Only completion timing is synthetic. The focus owners, menus and CSS are real.
const source = `import {useEffect,useState} from 'react';import {createRoot} from 'react-dom/client';
import {PromptAssistancePanel} from './components/composer/PromptAssistancePanel.client';
import {CoreSettingsBar} from './components/CoreSettingsBar';
import {I18nProvider} from './lib/i18n/I18nProvider';
const config=globalThis.fixtureConfig;
function Conversation(){
 const [messages,setMessages]=useState([]),[message,setMessage]=useState(''),[pending,setPending]=useState(false);
 const [sends,setSends]=useState(0),[completed,setCompleted]=useState(0);
 useEffect(()=>{if(messages.at(-1)?.role==='assistant')setCompleted(sends);},[messages]);
 globalThis.finishReply=()=>{setMessages(list=>[...list,{id:'assistant-'+sends,role:'assistant',text:'Synthetic reply '+sends}]);setPending(false);};
 const send=()=>{setMessages(list=>[...list,{id:'user-'+(sends+1),role:'user',text:message}]);setSends(sends+1);setMessage('');setPending(true);};
 return <>
  <output data-pending={pending} data-completed={completed} data-sends={sends}/>
  <PromptAssistancePanel locale="en" modelLabel="Wan 3" messages={messages} proposal={null} message={message} pending={pending}
   onMessageChange={setMessage} onSend={send} onProposalTextChange={()=>{}} onApply={()=>{}} onCopy={()=>{}}
   helpControl={<button type="button" data-internal-control>Help control</button>}/>
 </>;
}
function Fixture(){
 const [audio,setAudio]=useState(true),[duration,setDuration]=useState(2);
 return <I18nProvider locale="en" dictionary={{}} fallback={{}}><main style={{maxWidth:900,margin:'40px auto',padding:16}}>
  <Conversation/><output data-audio={audio} data-duration={duration}/>
  <CoreSettingsBar density="workspace" engine={config.engine} mode="t2v" caps={config.caps}
   durationSec={duration} durationOption={duration} onDurationChange={value=>setDuration(Number(value))}
   resolution="480p" onResolutionChange={()=>{}} aspectRatio="9:16" onAspectRatioChange={()=>{}} fps={30} onFpsChange={()=>{}}
   showAudioControl audioEnabled={audio} onAudioChange={setAudio}/>
  <button type="button" data-external-control>External reader control</button>
 </main></I18nProvider>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);`;

const entry = listFalEngines().find(item => item.id === 'wan-3')!;
const config = {engine:entry.engine,caps:entry.modes.find(item => item.mode === 't2v')!.ui};
async function begin(page: Page) {
  await page.locator('[data-assistance-message]').fill('A synthetic question');
  await page.getByRole('button',{name:'Send message to Milo',exact:true}).click();
  await expect(page.locator('[data-pending]')).toHaveAttribute('data-pending','true');
}
async function finish(page: Page, sends=1) {
  await page.evaluate(() => (globalThis as any).finishReply());
  // The parent effect's following commit is after the panel's reply effect,
  // so an assertion cannot pass just before the old asynchronous focus runs.
  await expect(page.locator('[data-completed]')).toHaveAttribute('data-completed',String(sends));
  await expect(page.locator('[data-pending]')).toHaveAttribute('data-pending','false');
}

for (const browserType of [chromium,webkit]) {
  test(`${browserType.name()}: assistant completion preserves an open setting and moved focus`, {timeout:60_000}, async () => {
    const fixture=await startWorkspaceReferenceFixture({source,config});
    const browser=await browserType.launch({headless:true});
    try {
      for (const setting of ['Audio','Duration']) {
        const page=await browser.newPage();
        try {
          await page.goto(fixture.url);await begin(page);
          const trigger=page.getByRole('button',{name:new RegExp('^'+setting+':')});
          await trigger.focus();await trigger.press('Enter');
          const menu=page.getByRole('listbox');await expect(menu).toBeVisible();
          await expect(trigger).toBeFocused();
          await finish(page);
          await expect(trigger).toHaveAttribute('aria-expanded','true');
          await expect(trigger).toBeFocused();await expect(menu).toBeVisible();
          await menu.getByRole('option',{name:setting==='Audio'?'Audio: Off':'Duration: 3s',exact:true}).click();
          await expect(page.locator('[data-audio]')).toHaveAttribute(setting==='Audio'?'data-audio':'data-duration',setting==='Audio'?'false':'3');
          await expect(menu).toHaveCount(0);
        } finally {await page.close();}
      }
      for (const selector of ['[data-internal-control]','[data-external-control]']) {
        const page=await browser.newPage();
        try {
          await page.goto(fixture.url);await begin(page);
          const control=page.locator(selector);await control.focus();await finish(page);
          await expect(control).toBeFocused();
        } finally {await page.close();}
      }
    } finally {await browser.close();await fixture.close();}
  });

  test(`${browserType.name()}: Enter and keyboard Send return to the message at the explicit gesture`, {timeout:60_000}, async () => {
    const fixture=await startWorkspaceReferenceFixture({source,config});
    const browser=await browserType.launch({headless:true});
    try {
      const page=await browser.newPage();await page.goto(fixture.url);
      const input=page.locator('[data-assistance-message]');
      await input.fill('First question');await input.press('Enter');
      await expect(page.locator('[data-pending]')).toHaveAttribute('data-pending','true');
      await expect(input).toBeFocused();await finish(page);await expect(input).toBeFocused();
      await input.fill('Second question');
      const send=page.getByRole('button',{name:'Send message to Milo',exact:true});
      await send.focus();await send.press('Enter');
      await expect(send).toBeDisabled();await expect(input).toBeFocused();
      await expect(page.locator('[data-sends]')).toHaveAttribute('data-sends','2');
      await input.fill('Keep this next unsent message');
      await finish(page,2);await expect(input).toBeFocused();
      await expect(input).toHaveValue('Keep this next unsent message');
      assert.equal(await page.locator('[data-sends]').getAttribute('data-sends'),'2');
    } finally {await browser.close();await fixture.close();}
  });
}
