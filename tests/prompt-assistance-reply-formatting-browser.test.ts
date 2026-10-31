import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, webkit, expect } from '@playwright/test';
import { startWorkspaceReferenceFixture } from './helpers/workspace-reference-browser-fixture';

const original = 'Original **manual text**, kept verbatim.';
const proposal = 'A synthetic **prompt**.\n<img src="/inert" onerror="alert(1)"> [literal](https://example.invalid) ![literal](/inert.png)';
const user = 'Keep **literal user**.\n<em>literal HTML</em>';
const unsafe = '<img src="/inert" onerror="alert(1)">';
const reply = 'Ouvrez **Références**, puis **Upload** ou **Choose from Media**.\n**'+unsafe+'**\n[Link](javascript:alert(1)) ![Image](https://example.invalid/image.png) <script>alert(1)</script> <a href="https://example.invalid">plain</a>\n**inachevé / **** / ***ambigu***\n**deux\nlignes**';
const expected = reply.replace('**Références**','Références').replace('**Upload**','Upload').replace('**Choose from Media**','Choose from Media').replace('**'+unsafe+'**',unsafe);

const source = `
import {useEffect,useState} from 'react';import {createRoot} from 'react-dom/client';
import {I18nProvider} from './lib/i18n/I18nProvider';
import {PromptAssistancePanel} from './components/composer/PromptAssistancePanel.client';
import {usePromptAssistancePreview} from './components/composer/usePromptAssistancePreview';
import styles from './components/composer/prompt-assistance.module.css';
const config=globalThis.fixtureConfig,noop=()=>{};
function Main(){
 const[prompt,setPrompt]=useState(config.original);
 const c=usePromptAssistancePreview({accountKey:'synthetic-owner',scopeKey:'synthetic-format-only',contextKey:'fixed',draftText:prompt,onApplyText:setPrompt,locale:'fr',target:'prompt'});
 useEffect(()=>{c.dispatch({type:'send',id:1,message:config.user});c.dispatch({type:'reply',id:1,text:config.proposal,reply:config.reply});},[]);
 const state=c.state;
 return <I18nProvider locale="fr" dictionary={{}} fallback={{}}><main style={{maxWidth:900,margin:'32px auto',padding:6}}>
 <p style={{fontSize:12,marginBottom:16}}>Local · synthetic conversation · no service or generation</p>
 <div className={styles.root} data-prompt-assistance-preview>
 <PromptAssistancePanel locale="fr" modelLabel="Selected model" messages={state.messages} proposal={state.proposal?{text:state.proposal.text,target:'prompt',stale:state.proposal.revision!==state.revision}:null} message="" pending={false} onMessageChange={noop} onSend={()=>{throw Error('Sending forbidden');}} onProposalTextChange={text=>c.dispatch({type:'edit',text})} onApply={c.apply} onCopy={noop}/>
 </div><label style={{display:'block',marginTop:20}}>Manual prompt<textarea data-manual-prompt value={prompt} onChange={e=>setPrompt(e.target.value)} style={{display:'block',width:'100%',minHeight:100}}/></label>
 <button type="button" disabled={!c.canUndo} onClick={c.undo}>Undo application</button>
 <output data-state hidden>{JSON.stringify({messages:state.messages,proposal:state.proposal?.text,prompt})}</output>
 </main></I18nProvider>;
}createRoot(document.getElementById('root')).render(<Main/>);
`;

test('assistant replies render only inline bold while stored text, literal content and actual apply/Undo stay intact', {timeout:120000}, async () => {
  const fixture=await startWorkspaceReferenceFixture({source,config:{original,proposal,user,reply},assistancePreview:true});
  const evidence=process.env.MILO_REPLY_FORMATTING_EVIDENCE_DIR;
  const baselinePath=process.env.MILO_REPLY_FORMATTING_BASELINE;
  const baseline=baselinePath?JSON.parse(await readFile(baselinePath,'utf8')):null;
  const measurements:unknown[]=[];
  const browsers=[];
  const cases=[];
  if(evidence)await mkdir(evidence,{recursive:true});
  try {
    for(const name of ['chromium','webkit'] as const){
      const browser=await(name==='chromium'?chromium:webkit).launch({headless:true});
      browsers.push(browser);
        for(const width of [320,390,1440]){
          const page=await browser.newPage({viewport:{width,height:900}}),errors:string[]=[],requests:string[]=[],dialogs:string[]=[];
          page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{dialogs.push(d.message());void d.dismiss();});
          await page.route('**/*',route=>{const r=route.request();if(r.method()!=='GET'||new URL(r.url()).origin!==fixture.url){requests.push(r.method()+' '+r.url());return route.abort();}return route.continue();});
          await page.goto(fixture.url);
          const log=page.getByRole('log');await expect(log.locator(':scope > div')).toHaveCount(2);
          const panel=page.locator('[data-prompt-assistance-preview]'),bar=page.locator('[data-assistance-proposal]');
          const geometry={panel:await panel.boundingBox(),bar:await bar.boundingBox()};
          measurements.push({name,width,...geometry});
          if(evidence)await page.screenshot({path:evidence+'/'+name+'-'+width+'-reply.png',fullPage:true});
          cases.push({name,page,width,log,geometry,errors,requests,dialogs});
        }
    }
        for(const {name,page,width,log,geometry,errors,requests,dialogs} of cases){
          const assistant=log.locator(':scope > div').nth(1),human=log.locator(':scope > div').first();
          await expect(assistant.locator('strong')).toHaveText(['Références','Upload','Choose from Media',unsafe]);
          assert.equal(await assistant.textContent(),expected,'line breaks and unsupported markers stay literal');
          assert.equal(await human.textContent(),user);assert.equal(await human.locator('strong').count(),0);
          assert.equal(await assistant.locator('a,img,script,iframe,style,code,pre,p').count(),0);
          assert.equal(await assistant.evaluate(n=>getComputedStyle(n).whiteSpace),'pre-wrap');
          assert.ok(await assistant.locator('strong').first().evaluate(n=>getComputedStyle(n).display==='inline'));
          if(baseline){const before=baseline.find(x=>x.name===name&&x.width===width);if(before)assert.deepEqual(geometry,{panel:before.panel,bar:before.bar},'inline rendering cannot enlarge the panel or53px proposal bar');}
          const state=async()=>JSON.parse((await page.locator('[data-state]').textContent())!);
          assert.deepEqual((await state()).messages.map(m=>m.text),[user,reply]);assert.equal((await state()).proposal,proposal);
          await page.locator('[data-assistance-expand]').click();await expect(page.locator('[data-assistance-editor]')).toHaveValue(proposal);
          await page.locator('[data-assistance-apply]').click();await expect(page.locator('[data-manual-prompt]')).toHaveValue(proposal);
          await page.getByRole('button',{name:'Undo application'}).click();await expect(page.locator('[data-manual-prompt]')).toHaveValue(original);
          assert.deepEqual((await state()).messages.map(m=>m.text),[user,reply]);assert.equal((await state()).proposal,proposal);
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
          assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);assert.deepEqual(dialogs,[]);
        }
  }finally{for(const browser of browsers)await browser.close();if(evidence)await writeFile(evidence+'/measurements.json',JSON.stringify(measurements,null,2));await fixture.close();}
});
