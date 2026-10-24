import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {expect} from '@playwright/test';
import {startStudioIntegrationRuntime} from './helpers/studio-integration-runtime';
import {startStudioConnectedBrowserFixture} from './helpers/studio-connected-browser-fixture';
import {initializeStudioConnectedFixture,STUDIO_CONNECTED_MONTAGE_INPUT} from './helpers/studio-connected-fixture-data';
import {STUDIO_FIXTURE_OWNERS} from './helpers/studio-auth-fixture';
import {postStudioMcpRequest,readStudioMcpResponse} from './helpers/studio-mcp-http-fixture';

const browserName=process.env.STUDIO_BROWSER_ENGINE==='webkit'?'webkit':'chromium';
const refs=['a','b','c'].map(value=>'ma_'+value.repeat(32));
const urls=refs.map((_,index)=>`https://cdn.maxvideoai.com/studio-local-fixture/mobile-${index}.webp`);

test('mobile chat keeps reading space, references and navigation without changing desktop ('+browserName+')',{timeout:240000},async()=>{
  const runtime=await startStudioIntegrationRuntime({revision:process.env.STUDIO_TEST_REVISION,mcp:{studioMontageCreation:true},privateStorage:true,conversation:true,initializeDatabase:async db=>{
    await initializeStudioConnectedFixture(db);
    for(const name of ['00_create_profiles.sql','01_legal_documents.sql','02_user_consents.sql','04_profiles_timestamps.sql','12_app_settings.sql','30_mcp_paid_generation.sql','39_mcp_quote_lifetime.sql','49_studio_generation_scope.sql','50_studio_image_conversation.sql','51_studio_image_model_usage.sql','52_studio_conversation_runs.sql','53_studio_media_generation_scope.sql'])await db.pool.query(await readFile('neon/migrations/'+name,'utf8'));
    await db.pool.query('ALTER TABLE app_jobs ADD COLUMN status text');
    for(let i=0;i<3;i++)await db.pool.query("INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,status,original_name,metadata) VALUES($1,$2,$3,'image',$4,'image/webp','ready',$5,'{}'::jsonb)",[`20000000-0000-4000-8000-00000000000${i+5}`,refs[i],STUDIO_FIXTURE_OWNERS[0],urls[i],`Reference ${i+1}`]);
  }});
  let browser:Awaited<ReturnType<typeof startStudioConnectedBrowserFixture>>|undefined;
  try{
    const session=runtime.auth.createSession(STUDIO_FIXTURE_OWNERS[0],{clientId:'mobile-chat-fixture'});
    // Compile the owned route before the bounded MCP command timeout starts.
    const warm=await fetch(runtime.origin+'/mcp',{headers:{Host:runtime.mcpHost},signal:AbortSignal.timeout(90000)});
    await warm.arrayBuffer();
    const created=await postStudioMcpRequest(runtime,{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'create_studio_montage',arguments:STUDIO_CONNECTED_MONTAGE_INPUT}},{token:session.access_token}).then(readStudioMcpResponse);
    assert.notEqual(created.result.isError,true,JSON.stringify(created.result));
    const {projectId}=created.result.structuredContent;
    browser=await startStudioConnectedBrowserFixture({runtime,browserName});
    const {page}=await browser.newContext(session,{viewport:{width:390,height:844},locale:'en-US',reducedMotion:'reduce'});
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    for(const [path,json] of [['/api/member-status',{tier:'Member'}],['/api/wallet',{balance:46.29,balanceCents:4629,currency:'USD'}],['/api/admin/access',{ok:false}],['/api/legal/reconsent',{ok:true,needsReconsent:false,documents:[]}]] as const)await page.route(runtime.browserOrigin+path,route=>route.fulfill({json}));
    // Deterministic conversation prose; auth, project, references and timeline use the real owned fixture.
    await page.route('**/image-conversation',route=>route.request().method()==='GET'?route.fulfill({json:{ok:true,result:{projectId,projectName:'Three reference film',turns:Array.from({length:8},(_,i)=>({
      requestId:`10000000-0000-4000-8000-${String(i).padStart(12,'0')}`,message:`Scene ${i+1}: use these three references.`,
      references:refs,referenceMentions:refs.map((assetId,index)=>({assetId,label:`Image ${index+1}`})),
      reply:'Keep the characters consistent with the reference images. Begin with a wide shot, then move closer as the scene unfolds. Review the exact quote before confirming any generation.\n\nThe images stay attached while you refine the direction.',
      state:'ready',retryable:false,quote:null,generation:null,createdAt:'2026-10-24T12:00:00Z',
    }))}}}):route.continue());
    for(const url of urls)await page.route(url,route=>route.fulfill({contentType:'image/webp',path:'frontend/public/media/mcp/project-demo/watch-static.webp'}));
    await page.route('**/api/legal/cookies/version',route=>route.fulfill({json:{ok:true,version:'mobile-chat',publishedAt:null}}));
    await page.route('**/api/legal/cookies',route=>route.fulfill({json:{ok:true,version:'mobile-chat'}}));
    await page.goto(runtime.browserOrigin+'/app/studio/conversation/'+projectId,{timeout:120000});
    const consent=page.getByRole('button',{name:'Reject all',exact:true});
    await expect(consent).toBeVisible({timeout:20000});await consent.click();await expect(consent).not.toBeVisible();
    const log=page.getByRole('log',{name:'Conversation with Milo',exact:true});
    await expect(log.getByText('Scene 8: use these three references.',{exact:true})).toBeAttached();
    const message=page.getByRole('textbox',{name:'Message Milo',exact:true});
    await expect(message).toBeVisible();
    const evidence=process.env.STUDIO_PROOF_DIRECTORY??'/tmp/studio-mobile-chat';
    await mkdir(evidence,{recursive:true});
    const geometry=async()=>page.evaluate(()=>{
      const log=document.querySelector('[role="log"]')!.getBoundingClientRect();
      const input=document.querySelector('textarea')!.getBoundingClientRect();
      return {logHeight:log.height,logTop:log.top,inputBottom:input.bottom,width:document.documentElement.scrollWidth,height:window.innerHeight};
    });
    await page.screenshot({path:join(evidence,browserName+'-mobile.png')});
    await writeFile(join(evidence,browserName+'-geometry.json'),JSON.stringify(await geometry(),null,2));
    await page.setViewportSize({width:1440,height:900});
    await expect(page.getByRole('img',{name:'Reference 1',exact:true})).toBeVisible({timeout:30000});
    await page.evaluate(()=>document.fonts.ready);
    await page.screenshot({path:join(evidence,browserName+'-desktop-initial.png')});
    const desktopGeometry=await page.evaluate(()=>Object.fromEntries(['.app-connected-header','[role="log"]','textarea','[aria-label="Media panel"]','[aria-label="Film timeline"]'].map(selector=>{
      const box=document.querySelector(selector)!.getBoundingClientRect();return [selector,{x:box.x,y:box.y,width:box.width,height:box.height}];
    })));
    await writeFile(join(evidence,browserName+'-desktop-geometry.json'),JSON.stringify(desktopGeometry,null,2));
    if(process.env.STUDIO_MOBILE_CAPTURE_ONLY==='1')return;
    await page.setViewportSize({width:390,height:844});
    await expect(page.getByRole('button',{name:'Open MaxVideoAI menu',exact:true}).locator('.app-glyph')).toBeVisible();
    assert.ok((await geometry()).logHeight>=844*.6,'The conversation receives at least 60% of the mobile viewport with three references and a film.');
    const references=page.getByRole('button',{name:'References · 3 attached',exact:true});
    await references.click();
    const panel=page.getByRole('dialog',{name:'References',exact:true});
    await expect(panel).toBeVisible();
    await page.screenshot({path:join(evidence,browserName+'-references.png')});
    await panel.getByRole('button',{name:'Preview Image 1',exact:true}).click();
    await panel.getByRole('button',{name:'Enlarge Image 1',exact:true}).click();
    await expect(page.getByRole('dialog',{name:'Image 1',exact:true})).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel.getByRole('button',{name:'Enlarge Image 1',exact:true})).toBeFocused();
    await panel.getByRole('button',{name:'Include in next message',exact:true}).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button',{name:'References · 2 attached',exact:true})).toBeFocused();
    await log.evaluate(element=>{element.scrollTop=100;});
    const scroll=await log.evaluate(element=>element.scrollTop);
    await page.getByRole('button',{name:'References · 2 attached',exact:true}).click();
    await page.keyboard.press('Escape');
    assert.ok(Math.abs(await log.evaluate(element=>element.scrollTop)-scroll)<2,'Opening references preserves reading position.');
    await message.fill('A long follow-up\nwith several lines\nabout the framing\nand the camera\nand the lighting\nand the ending.');
    const latest=await page.getByRole('button',{name:'Latest message',exact:true}).boundingBox();
    const input=await message.boundingBox();
    assert.ok(latest&&input&&latest.y+latest.height<=input.y,'The latest-message button stays above a multiline composer.');
    await page.getByRole('button',{name:'Latest message',exact:true}).click();
    await expect.poll(()=>log.evaluate(element=>element.scrollHeight-element.clientHeight-element.scrollTop)).toBeLessThan(5);
    await page.getByRole('button',{name:'Open MaxVideoAI menu',exact:true}).click();
    const menu=page.getByRole('dialog',{name:'MaxVideoAI',exact:true});
    await expect(menu.getByRole('navigation',{name:'Application',exact:true})).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Open film tools',exact:true}).click();
    await expect(page.getByLabel('Film timeline',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Close film tools',exact:true}).click();
    await page.getByRole('button',{name:'Milo settings and credits',exact:true}).click();
    await expect(page.getByRole('button',{name:'Close assistance',exact:true})).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button',{name:'Milo settings and credits',exact:true})).toBeFocused();
    // iOS changes the visual viewport without resizing the layout viewport.
    await page.evaluate(()=>{
      Object.defineProperty(window.visualViewport!,'height',{configurable:true,value:430});
      Object.defineProperty(window.visualViewport!,'offsetTop',{configurable:true,value:60});
      window.visualViewport!.dispatchEvent(new Event('resize'));
    });
    await page.getByRole('button',{name:'References · 2 attached',exact:true}).click();
    const keyboardPanel=await panel.boundingBox();
    assert.ok(keyboardPanel&&keyboardPanel.y>=60&&keyboardPanel.y+keyboardPanel.height<=490,'References fit above the keyboard in the visual viewport.');
    await page.keyboard.press('Escape');
    await page.evaluate(()=>{
      Reflect.deleteProperty(window.visualViewport!,'height');
      Reflect.deleteProperty(window.visualViewport!,'offsetTop');
      window.visualViewport!.dispatchEvent(new Event('resize'));
    });
    for(const size of [{width:320,height:568},{width:390,height:430}]){
      await page.setViewportSize(size);await message.fill('A short follow-up');
      await expect(message).toBeInViewport();
      assert.equal((await geometry()).width,size.width);
      assert.ok((await geometry()).logHeight>size.height*.5,'Short mobile viewports retain readable history.');
    }
    await page.setViewportSize({width:1440,height:900});
    await expect(page.getByRole('button',{name:/References ·/})).not.toBeVisible();
    await expect(page.getByRole('complementary',{name:'Media panel',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Remove Image 2',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Open library',exact:true})).toBeVisible();
    await page.screenshot({path:join(evidence,browserName+'-desktop.png')});
    await page.setViewportSize({width:390,height:844});await message.fill('');
    await page.getByRole('button',{name:'Open MaxVideoAI menu',exact:true}).click();
    await page.getByRole('button',{name:'Dark',exact:true}).click();
    await page.keyboard.press('Escape');
    await page.screenshot({path:join(evidence,browserName+'-mobile-dark.png')});
    assert.deepEqual(errors,[]);
  }finally{await browser?.close();await runtime.close();}
});
