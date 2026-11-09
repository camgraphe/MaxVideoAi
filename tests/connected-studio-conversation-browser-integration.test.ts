import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {expect} from '@playwright/test';
import {startStudioIntegrationRuntime} from './helpers/studio-integration-runtime';
import {startStudioConnectedBrowserFixture} from './helpers/studio-connected-browser-fixture';
import {initializeStudioConnectedFixture,STUDIO_CONNECTED_MONTAGE_INPUT,STUDIO_CONNECTED_ASSET_IDS} from './helpers/studio-connected-fixture-data';
import {STUDIO_FIXTURE_OWNERS} from './helpers/studio-auth-fixture';
import {postStudioMcpRequest,readStudioMcpResponse} from './helpers/studio-mcp-http-fixture';
import {STUDIO_PRIVATE_MEDIA_HOST,STUDIO_PRIVATE_MEDIA_KEYS} from './helpers/studio-private-storage-fixture';

const browserName = process.env.STUDIO_BROWSER_ENGINE ?? 'chromium';
const referenceIds=['ma_'+'e'.repeat(32),'ma_'+'f'.repeat(32)];
const referenceUrls=referenceIds.map((_,index)=>`https://cdn.maxvideoai.com/studio-local-fixture/reference-${index}.webp`);
assert.ok(browserName === 'chromium' || browserName === 'firefox' || browserName === 'webkit','Use a qualified browser engine.');

test('native chat timeline, persistent app themes and mobile chat access ('+browserName+')', {timeout: 240000},async () => {
  const runtime = await startStudioIntegrationRuntime({mcp: {studioMontageCreation: true},privateStorage: true,conversation: true,initializeDatabase: async database => {
    await initializeStudioConnectedFixture(database,{libraryPicker:true});
    for (const name of ['00_create_profiles.sql','01_legal_documents.sql','02_user_consents.sql','04_profiles_timestamps.sql','12_app_settings.sql','30_mcp_paid_generation.sql','39_mcp_quote_lifetime.sql','49_studio_generation_scope.sql','50_studio_image_conversation.sql','51_studio_image_model_usage.sql','52_studio_conversation_runs.sql','53_studio_media_generation_scope.sql']) await database.pool.query(await readFile('neon/migrations/'+name,'utf8'));
    await database.pool.query('ALTER TABLE app_jobs ADD COLUMN status text');
    for(let index=0;index<2;index++) await database.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,status,original_name,metadata) VALUES($1,$2,$3,'image',$4,'image/webp','ready',$5,'{}'::jsonb)`,[`20000000-0000-4000-8000-00000000000${index+5}`,referenceIds[index],STUDIO_FIXTURE_OWNERS[0],referenceUrls[index],index?'Night shift':'Watch study']);
  }});
  let browser: Awaited<ReturnType<typeof startStudioConnectedBrowserFixture>> | undefined;
  let diagnose = async () => ({});
  try {
    await runtime.database.pool.query('DELETE FROM user_roles');
    const session = runtime.auth.createSession(STUDIO_FIXTURE_OWNERS[0],{clientId: 'studio-native-timeline-fixture'});
    const created = await postStudioMcpRequest(runtime,{jsonrpc: '2.0',id: 1,method: 'tools/call',params: {name: 'create_studio_montage',arguments: STUDIO_CONNECTED_MONTAGE_INPUT}},{token: session.access_token}).then(readStudioMcpResponse);
    assert.notEqual(created.result.isError,true,JSON.stringify(created.result));
    const project = created.result.structuredContent;
    browser = await startStudioConnectedBrowserFixture({runtime,browserName});
    const owned = await browser.newContext(session,{viewport: {width: 1440,height: 900},locale: 'en-US',reducedMotion: 'reduce'});
    const page = owned.page;
    async function openFilm(target=page) {
      if(target.viewportSize()!.width<768&&!await target.getByRole('dialog',{name:'Film tools',exact:true}).isVisible())await target.getByRole('button',{name:'Open film tools',exact:true}).click();
    }
    async function setTheme(dark:boolean) {
      if(await page.getByRole('dialog',{name:'Film tools',exact:true}).isVisible())await page.getByRole('button',{name:'Close film tools',exact:true}).click();
      await expect(page.getByLabel('Loading account',{exact:true})).toHaveCount(0);
      await expect(async()=>{
        if(!await page.getByRole('dialog',{name:'MaxVideoAI',exact:true}).isVisible())await page.getByRole('button',{name:'Open MaxVideoAI menu',exact:true}).click();
        await expect(page.getByRole('button',{name:dark?'Dark':'Light',exact:true})).toBeVisible({timeout:1000});
      }).toPass({timeout:10000});
      const menu = page.getByRole('dialog',{name:'MaxVideoAI',exact:true});
      const preferences = menu.locator('.app-site-preferences');
      const palette = menu.getByRole('button',{name:dark?'Dark':'Light',exact:true});
      await expect(palette).toBeInViewport();
      await expect(menu.getByText('Language',{exact:true})).toBeInViewport();
      assert.equal(await preferences.evaluate(element => !!element.closest('.app-site-dialog-body')),false,'preferences are outside scrolling destinations');
      await menu.locator('.app-site-dialog-body').evaluate(element => {element.scrollTop = element.scrollHeight;});
      await expect(palette).toBeInViewport();
      await palette.click();
      await expect(palette).toHaveAttribute('aria-pressed','true');
      await proof('preferences-'+(dark?'dark':'light')+'-'+page.viewportSize()!.width);
      await page.getByRole('dialog',{name:'MaxVideoAI',exact:true}).getByRole('button',{name:'Close ×',exact:true}).click();
    }
    let diagnosticPage = page;
    const mediaFailures: string[] = [];
    const errors: string[] = [];
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    let reloadEvidence: Record<string,unknown> | null = null;
    page.on('response',response => {if (response.status() === 403) mediaFailures.push(new URL(response.url()).pathname);});
    page.on('pageerror',error => {errors.push(error.message);pageErrors.push(error.message.slice(0,1000));});
    page.on('console',message => {
      if(message.type()!=='error')return;
      consoleErrors.push(message.text().slice(0,1000));
      if(consoleErrors.length>10)consoleErrors.shift();
      if(/hydration|Hydration|Each child|cannot be a descendant|Cannot update/i.test(message.text()))errors.push(message.text());
    });
    diagnose = async () => {
      await proof('failure',diagnosticPage);
      return {
        path: new URL(diagnosticPage.url()).pathname,
        pageErrors: pageErrors.slice(-10),
        consoleErrors,
        reloadEvidence,
        headings: (await diagnosticPage.getByRole('heading').allTextContents()).slice(0,10).map(text=>text.slice(0,200)),
        statuses: (await diagnosticPage.getByRole('status').allTextContents()).slice(0,10).map(text=>text.slice(0,500)),
        bodyTail: (await diagnosticPage.locator('body').innerText({timeout:1000})).slice(-2000),
        mediaFailures,
        monitor: await diagnosticPage.getByLabel('Film monitor',{exact: true}).count(),
        alerts: await diagnosticPage.getByRole('alert').allTextContents(),
        decoders: await diagnosticPage.locator('video').evaluateAll(elements => elements.map(element => {
          const video = element as HTMLVideoElement;
          return {id: video.dataset.playbackItemId,ready: video.readyState,time: video.currentTime,network: video.networkState,error: video.error?.code,source: video.currentSrc ? new URL(video.currentSrc).pathname : null};
        })),
      };
    };
    const auxiliary = new Map([['/api/member-status',{tier: 'Member'}],['/api/wallet',{balance: 0,balanceCents: 0,currency: 'USD'}],['/api/admin/access',{ok: false}],['/api/legal/reconsent',{ok: true,needsReconsent: false,documents: []}],['/api/legal/cookies/version',{ok: true,version: 'native-timeline',publishedAt: null}],['/api/legal/cookies',{ok: true,version: 'native-timeline'}]]);
    for (const [path,json] of auxiliary) await page.route(runtime.browserOrigin+path,route => route.fulfill({json}));
    const url = runtime.browserOrigin+'/app/studio/conversation/'+project.projectId;
    async function proof(name: string,target = page) {
      if (!process.env.STUDIO_PROOF_DIRECTORY) return;
      await mkdir(process.env.STUDIO_PROOF_DIRECTORY,{recursive: true});
      await target.screenshot({path: join(process.env.STUDIO_PROOF_DIRECTORY,browserName+'-'+name+'.png')});
    }
    // UI-only library outage/empty state. Media ownership and decoding use the real owned DB below.
    async function checkLibrary() {
      const endpoint = runtime.browserOrigin+'/api/media-library/assets?*';
      await page.route(endpoint,route => route.fulfill({status: 503,json: {ok: false}}));
      await page.getByRole('button',{name: 'Open library',exact: true}).click();
      const dialog = page.getByRole('dialog',{name: 'MaxVideoAI library',exact: true});
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('alert')).toHaveText('The library is unavailable.');
      await expect(dialog.getByRole('button',{name: 'Import',exact: true})).toBeEnabled();
      const bounds = await dialog.boundingBox();
      assert.ok(bounds && bounds.x >= 0 && bounds.x+bounds.width <= page.viewportSize()!.width,'Library fits the viewport.');
      await page.getByRole('button',{name: 'Close library',exact: true}).click();
      await expect(page.getByRole('button',{name: 'Open library',exact: true})).toBeFocused();
      await page.unroute(endpoint);
      await page.route(endpoint,route => route.fulfill({json: {ok: true,assets: [],nextCursor: null}}));
      await page.getByRole('button',{name: 'Open library',exact: true}).click();
      await expect(dialog.getByText('No media here yet',{exact: true})).toBeVisible();
      await expect(dialog.getByRole('button',{name:'Add to conversation',exact:true})).toBeDisabled();
      await dialog.getByRole('combobox',{name:'Media type',exact:true}).selectOption('audio');
      await expect(dialog.getByRole('combobox',{name:'Media type',exact:true})).toHaveValue('audio');
      await expect(dialog.getByRole('alert')).toHaveCount(0);
      await proof('olive-library-'+page.viewportSize()!.width);
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(page.getByRole('button',{name: 'Open library',exact: true})).toBeFocused();
      await page.unroute(endpoint);
      await openFilm();
      await page.getByRole('button',{name:'Add library media to film',exact:true}).click();
      await expect(dialog.getByRole('button',{name:'Add to timeline',exact:true})).toBeDisabled();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button',{name:'Add library media to film',exact:true})).toBeFocused();
    }
    await page.goto(runtime.browserOrigin+'/app/studio',{waitUntil: 'domcontentloaded',timeout: 120000});
    await expect(page).toHaveURL(url);
    await expect(page.locator('[data-timeline-item]')).toHaveCount(2,{timeout: 45000});
    const cookies = page.getByRole('button',{name: 'Reject all',exact: true});
    if (await cookies.isVisible()) await cookies.click();
    await expect(page.getByRole('heading',{name:'What would you like to do?'})).toBeVisible();
    const namingBefore=(await runtime.database.pool.query('SELECT name,revision FROM studio_projects WHERE id=$1',[project.projectId])).rows[0];
    await page.getByRole('button',{name:'Projects',exact:true}).click();
    const projectsDialog=page.getByRole('dialog',{name:'Your projects',exact:true});
    await projectsDialog.getByRole('button',{name:'Rename '+namingBefore.name,exact:true}).click();
    const nameField=projectsDialog.getByRole('textbox',{name:'Project name',exact:true});
    await expect(nameField).toBeFocused();await nameField.fill('Native Studio film');await nameField.press('Enter');
    await expect(projectsDialog.getByRole('button',{name:'Rename Native Studio film',exact:true})).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button',{name:'Projects',exact:true})).toBeFocused();
    await expect(page.locator('section[aria-label="Conversational Studio"] > header').getByText('Native Studio film',{exact:true})).toBeVisible();
    const namingAfter=(await runtime.database.pool.query('SELECT name,revision FROM studio_projects WHERE id=$1',[project.projectId])).rows[0];
    assert.equal(namingAfter.name,'Native Studio film');assert.equal(namingAfter.revision,namingBefore.revision);
    const message = page.getByRole('textbox',{name:'Message Milo',exact:true});
    const starterRequests:string[]=[];
    const recordStarterRequest=(request:import('@playwright/test').Request)=>{if(request.method()==='POST'&&request.url().includes('/api/studio/'))starterRequests.push(new URL(request.url()).pathname);};
    page.on('request',recordStarterRequest);
    for(const [label,draft] of [
      ['Create a video','I’d like to create a video of '],
      ['Develop an idea','Help me develop an idea for '],
      ['Extend a clip','I’d like to extend a clip. '],
      ['Edit an image','I’d like to edit an image. '],
    ]){
      await page.getByRole('button',{name:label,exact:true}).click();
      await expect(message).toBeFocused();
      await expect(message).toHaveValue(draft);
      await expect(page.getByRole('button',{name:label,exact:true})).toHaveCount(0);
      await message.fill('');
    }
    page.off('request',recordStarterRequest);
    assert.deepEqual(starterRequests,[],'Starters only edit a draft; they never submit a conversation or generation');
    await page.getByRole('button',{name:'Studio help',exact:true}).click();
    await expect(page.getByRole('dialog',{name:'Make it yours.',exact:true})).toBeVisible();
    await proof('help-desktop');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button',{name:'Studio help',exact:true})).toBeFocused();
    await page.getByRole('button',{name:'Collapse timeline',exact:true}).click();
    await expect(page.getByRole('button',{name:'Select clip Pattern B',exact:true})).not.toBeVisible();
    await expect(message).toBeVisible();
    await proof('timeline-collapsed');
    await page.getByRole('button',{name:'Open timeline',exact:true}).click();
    await expect(page.getByRole('button',{name:'Select clip Pattern B',exact:true})).toBeVisible();

    // Real owned database references and preview route; local image transport only.
    for(const [index,file] of ['frontend/public/media/mcp/project-demo/watch-static.webp','frontend/public/assets/app-starters/night-shift-9f91929fe7da.webp'].entries()) {
      const body=await readFile(file);
      await page.route(referenceUrls[index],route=>route.fulfill({contentType:'image/webp',body}));
    }
    const libraryEndpoint=runtime.browserOrigin+'/api/media-library/assets?*';
    await page.route(libraryEndpoint,route=>route.fulfill({json:{ok:true,assets:referenceIds.map((assetId,index)=>({id:`20000000-0000-4000-8000-00000000000${index+5}`,assetId,ref:{type:'asset',assetId,kind:'image'},kind:'image',source:'upload',name:index?'Night shift':'Watch study',url:referenceUrls[index],thumbUrl:referenceUrls[index],mime:'image/webp'})),hasMore:false,nextCursor:null}}));
    const selectionWarmup=await owned.context.request.post(runtime.browserOrigin+'/api/media-library/selection/validate',{
      data:{candidates:referenceIds.map((assetId,index)=>({reference:{type:'asset',assetId,kind:'image'},originalUrl:referenceUrls[index]}))},
      headers:{origin:runtime.browserOrigin},timeout:90_000,
    });
    const selectionBody=await selectionWarmup.json();assert.equal(selectionWarmup.status(),200,JSON.stringify(selectionBody));
    assert.equal(selectionBody.results.length,2);assert.ok(selectionBody.results.every((item:{error?:string;sourceRevision?:string})=>!item.error&&item.sourceRevision));await selectionWarmup.dispose();
    for(const name of ['Watch study','Night shift']) {
      await page.getByRole('button',{name:'Open library',exact:true}).click();
      const library = page.getByRole('dialog',{name:'MaxVideoAI library',exact:true});
      await expect(library.getByRole('button',{name:'Import',exact:true})).toBeInViewport();
      const row=library.getByRole('row',{name,exact:true});
      await expect(row.getByRole('button',{name:'Preview '+name,exact:true})).toBeVisible();
      const tile = row.getByRole('checkbox');
      await expect(tile).toHaveCount(1);
      await expect(tile).toHaveAttribute('aria-label','Select '+name);
      await expect(tile).toHaveAccessibleName('Select '+name+' '+name);
      await expect(tile).not.toBeChecked();
      await row.locator('label.compact-media-check').click();
      await expect(tile).toBeChecked();
      await expect(library).toBeVisible();
      await proof('library-selected-'+name.replaceAll(' ','-'));
      const validation=page.waitForResponse(response=>response.url().endsWith('/api/media-library/selection/validate')&&response.request().method()==='POST');
      await library.getByRole('button',{name:'Add to conversation',exact:true}).click();
      const checked=await validation,body=await checked.json();
      assert.equal(checked.status(),200,JSON.stringify(body));
      const index=name==='Watch study'?0:1;
      assert.deepEqual(checked.request().postDataJSON(),{candidates:[{reference:{type:'asset',assetId:referenceIds[index],kind:'image'},originalUrl:referenceUrls[index]}]});
      assert.equal(body.results[0].error,undefined);assert.ok(body.results[0].sourceRevision);
    }
    await page.unroute(libraryEndpoint);
    await page.reload({waitUntil:'domcontentloaded'});
    await expect(page.getByRole('button',{name:'Remove Image 1',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Remove Image 2',exact:true})).toBeVisible();
    const shelf=page.getByRole('complementary',{name:'Media panel',exact:true});
    await expect(shelf).toBeVisible();
    await expect(shelf.getByRole('img',{name:'Night shift',exact:true})).toBeVisible();
    await shelf.getByRole('button',{name:'Preview Image 1',exact:true}).click();
    await expect(shelf.getByRole('img',{name:'Watch study',exact:true})).toBeVisible();
    const drag=await page.evaluateHandle(()=>new DataTransfer());
    await shelf.getByRole('button',{name:'Preview Image 1',exact:true}).dispatchEvent('dragstart',{dataTransfer:drag});
    await message.dispatchEvent('drop',{dataTransfer:drag});
    await expect(message).toHaveValue('@Image 1 ');
    await expect(message).toBeFocused();
    const centerBounds=await message.boundingBox();
    const referenceBounds=await shelf.locator('[data-media-card]').evaluateAll(elements=>elements.map(element=>{const b=element.getBoundingClientRect();return {left:b.left,right:b.right};}));
    assert.ok(centerBounds && referenceBounds.every(b=>b.right<centerBounds.x || b.left>centerBounds.x+centerBounds.width),'References preserve the central writing space.');
    await proof('media-dock-desktop');
    await page.getByRole('button',{name:'Remove Image 1',exact:true}).click();
    await expect(message).toHaveValue(' ');
    await shelf.getByRole('button',{name:'Mention in message',exact:true}).click();
    await expect(message).toHaveValue(/\s*@Image 1\s/);
    await shelf.getByRole('button',{name:'Collapse media',exact:true}).click();
    await expect(shelf.getByRole('button',{name:'Preview Image 1',exact:true})).toBeVisible();
    await expect(shelf.getByRole('button',{name:'Mention in message',exact:true})).toHaveCount(0);
    await expect(message).toHaveValue(/\s*@Image 1\s/);
    await shelf.getByRole('button',{name:'Open media',exact:true}).click();
    await page.setViewportSize({width:390,height:844});
    await expect(message).toBeVisible();
    await expect(page.getByRole('button',{name:'References · 2 attached',exact:true})).toBeVisible();
    await proof('media-dock-mobile-compact');
    await page.getByRole('button',{name:'References · 2 attached',exact:true}).click();
    await expect(shelf.getByRole('button',{name:'Mention in message',exact:true})).toBeVisible();
    await shelf.getByRole('button',{name:'Preview Image 2',exact:true}).click();
    await expect.poll(async()=>{const b=await shelf.locator('[data-media-card][data-selected="true"]').boundingBox();return !!b&&b.x>=0&&b.x+b.width<=390;}).toBe(true);
    await shelf.getByRole('button',{name:'Preview Image 1',exact:true}).click();
    await shelf.getByRole('button',{name:'Enlarge Image 1',exact:true}).click();
    await expect(page.getByRole('dialog',{name:'Image 1',exact:true})).toBeVisible();
    await proof('media-lightbox-mobile');
    await page.keyboard.press('Escape');
    await expect(shelf.getByRole('button',{name:'Enlarge Image 1',exact:true})).toBeFocused();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
    await proof('media-dock-mobile');
    await page.getByRole('button',{name:'Remove Image 1',exact:true}).click();
    await page.getByRole('button',{name:'Remove Image 2',exact:true}).click();
    await page.getByRole('button',{name:'Close references',exact:true}).click();
    await message.fill('');
    await page.setViewportSize({width:1440,height:900});
    await page.reload({waitUntil:'domcontentloaded'});
    await expect(page.locator('[data-timeline-item]')).toHaveCount(2);

    await setTheme(false);
    await expect(page.locator('html')).not.toHaveAttribute('data-theme','dark');
    await checkLibrary();
    await proof('olive-desktop');
    await expect(page.locator('[data-tone]')).toHaveAttribute('data-tone','olive');
    await page.reload({waitUntil: 'domcontentloaded'});
    await expect(page.locator('[data-tone]')).toHaveAttribute('data-tone','olive');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme','dark');
    await setTheme(true);
    await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
    await expect(page.getByLabel('Film monitor',{exact: true})).toHaveCount(0);
    await expect(page.locator('video[data-playback-item-id]')).toHaveCount(0);
    await openFilm();
    await page.getByRole('button',{name: 'Select clip Pattern B',exact: true}).click();
    const video = page.locator('video[data-playback-item-id="montage-clip-01"]');
    await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).readyState),{timeout: 20000}).toBeGreaterThanOrEqual(2);
    await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).currentTime)).toBeGreaterThanOrEqual(.98);
    await page.getByRole('button',{name: 'Start',exact: true}).click();
    await page.getByLabel('Clip duration in seconds',{exact: true}).fill('1');
    await page.getByLabel('Clip duration in seconds',{exact: true}).press('Tab');
    await expect(page.getByLabel('Film timeline',{exact: true})).toHaveAttribute('data-revision','1');
    await expect(page.locator('[data-timeline-item="montage-clip-02"]')).toHaveAttribute('data-timeline-start','1');
    await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).currentTime)).toBeGreaterThanOrEqual(1.98);
    await page.getByRole('button',{name: 'Play film',exact: true}).click();
    await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(2.1);
    await page.getByRole('button',{name: 'Pause film',exact: true}).click();
    const mountedSource = await video.getAttribute('src');
    const currentSourceTime = await video.evaluate(element => (element as HTMLVideoElement).currentTime);
    const poll = await page.waitForResponse(response => response.url().includes('/conversation-timeline?preview=1') && response.request().method() === 'GET',{timeout: 25000});
    const freshProjection = await poll.json();
    assert.notEqual(freshProjection.result.items[0].mediaAccessUrl,mountedSource,'server issues a different private signature');
    await page.waitForTimeout(150);
    assert.equal(await video.getAttribute('src'),mountedSource,'ordinary polling preserves the mounted decoder source');
    assert.ok(Math.abs(await video.evaluate(element => (element as HTMLVideoElement).currentTime)-currentSourceTime) < .04);
    await proof('charcoal-desktop');
    await page.getByRole('button',{name: 'Collapse monitor',exact: true}).first().click();
    await expect(page.locator('video[data-playback-item-id]')).toHaveCount(0);
    await page.reload({waitUntil: 'domcontentloaded'});
    await expect(page.locator('[data-timeline-item="montage-clip-01"]')).toHaveAttribute('data-timeline-duration','1');
    await expect(page.getByLabel('Film monitor',{exact: true})).toHaveCount(0);
    await page.setViewportSize({width: 390,height: 844});
    await openFilm();
    await page.getByRole('button',{name: 'Select clip Pattern B',exact: true}).click();
    await expect(page.getByRole('textbox',{name: 'Message Milo',exact: true})).toBeVisible();
    const geometry = await page.evaluate(() => {
      const chat = document.querySelector('textarea')!.getBoundingClientRect();
      const monitor = document.querySelector('[aria-label="Film monitor"]')!.getBoundingClientRect();
      return {chatBottom: chat.bottom,chatTop: chat.top,monitorTop: monitor.top,monitorHeight: monitor.height,width: document.documentElement.scrollWidth,viewport: window.innerWidth};
    });
    const filmBounds=await page.getByRole('dialog',{name:'Film tools',exact:true}).boundingBox();
    assert.ok(filmBounds&&filmBounds.y>=0&&filmBounds.y+filmBounds.height<=844,'Film tools fit in an on-demand mobile sheet.');
    assert.ok(geometry.chatTop >= 0);
    assert.ok(geometry.monitorHeight <= 112);
    assert.equal(geometry.width,geometry.viewport,'The mobile document does not overflow horizontally.');
    await setTheme(false);
    await expect(page.locator('[data-tone]')).toHaveAttribute('data-tone','olive');
    await proof('olive-mobile');
    await checkLibrary();
    await page.getByLabel('Audio volume',{exact: true}).press('Home');
    await expect(page.getByLabel('Film timeline',{exact: true})).toHaveAttribute('data-revision','2');
    await page.reload({waitUntil: 'domcontentloaded'});
    await expect(page.locator('[data-tone]')).toHaveAttribute('data-tone','olive');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme','dark');
    await expect(page.locator('[data-timeline-item]')).toHaveCount(2);
    await openFilm();
    await page.getByRole('button',{name: 'Select clip Pattern B',exact: true}).click();
    await expect(page.getByLabel('Audio volume',{exact: true})).toHaveValue('0');
    await page.getByRole('button',{name: 'Collapse monitor',exact: true}).first().click();
    const blockedMedia = 'https://'+STUDIO_PRIVATE_MEDIA_HOST+'/'+STUDIO_PRIVATE_MEDIA_KEYS.b+'?*';
    // Fresh contexts prevent Firefox's already-decoded media cache from bypassing the injected denial.
    for (const permanent of [false,true]) {
      const retry = await browser.newContext(session,{viewport: {width: 390,height: 844},locale: 'en-US',reducedMotion: 'reduce'});
      const retryPage = retry.page;
      diagnosticPage = retryPage;
      retryPage.on('pageerror',error => errors.push(error.message));
      retryPage.on('console',message => {if (message.type() === 'error' && /hydration|Hydration|Each child|cannot be a descendant|Cannot update/i.test(message.text())) errors.push(message.text());});
      retryPage.on('response',response => {if (response.status() === 403) mediaFailures.push(new URL(response.url()).pathname);});
      for (const [path,json] of auxiliary) await retryPage.route(runtime.browserOrigin+path,route => route.fulfill({json}));
      let denied = 0,renewalReads = 0;
      await retryPage.route(blockedMedia,route => {
        // WebKit can retry a Range request before reporting a decoder error.
        if (permanent || renewalReads === 0) {denied++;return route.fulfill({status: 403,body: 'Fixture media unavailable'});}
        return route.fallback();
      });
      const initialRead = retryPage.waitForResponse(response => response.url().includes('/conversation-timeline?preview=1'));
      await retryPage.goto(url,{waitUntil: 'domcontentloaded'});
      const originalProjection = await (await initialRead).json();
      await expect(retryPage.locator('[data-timeline-item]')).toHaveCount(2);
      const consent = retryPage.getByRole('button',{name: 'Reject all',exact: true});
      if (await consent.isVisible()) await consent.click();
      // Replay this actual owned projection to guarantee a same-URL renewal, independent of wall-clock seconds.
      if (!permanent) await retryPage.route(runtime.browserOrigin+'/api/studio/projects/'+project.projectId+'/conversation-timeline?preview=1',route => route.fulfill({json: originalProjection}));
      retryPage.on('request',request => {if (request.url().includes('/conversation-timeline?preview=1')) renewalReads++;});
      await openFilm(retryPage);
      await retryPage.getByRole('button',{name: 'Select clip Pattern B',exact: true}).click();
      if (permanent) {
        await expect(retryPage.getByText('This clip could not be played. Reopen the monitor to retry, or remove it from the film.',{exact: true})).toBeVisible();
        await expect(retryPage.getByLabel('Film monitor',{exact: true})).toHaveCount(0);
        assert.ok(denied >= 2,'The permanent denial reaches both decoder attempts.');
      } else {
        const recoveredVideo = retryPage.locator('video[data-playback-item-id="montage-clip-01"]');
        await expect.poll(() => recoveredVideo.evaluate(element => (element as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
        await expect(recoveredVideo).toHaveAttribute('src',originalProjection.result.items[0].mediaAccessUrl);
        await expect(retryPage.getByLabel('Film monitor',{exact: true})).toBeVisible();
        assert.ok(denied >= 1,'A denied decoder load recovers with the same URL and real bytes.');
      }
      assert.equal(renewalReads,1,'One automatic renewal per explicit monitor opening.');
      await retry.close();
    }
    diagnosticPage = page;
    await runtime.database.pool.query('UPDATE media_assets SET deleted_at=NOW() WHERE public_id=$1',[STUDIO_CONNECTED_ASSET_IDS.b]);
    await page.reload({waitUntil: 'domcontentloaded'});
    await expect(page.locator('[data-timeline-item]')).toHaveCount(2);
    await openFilm();
    await page.getByRole('button',{name: 'Select clip Pattern B',exact: true}).click();
    await expect(page.getByText('Media unavailable. You can remove this clip.',{exact: true}).first()).toBeVisible();
    await expect(page.getByLabel('Film monitor',{exact: true})).toHaveCount(0);
    await page.getByRole('button',{name: 'Remove selected clip',exact: true}).click();
    await expect(page.getByLabel('Film timeline',{exact: true})).toHaveAttribute('data-revision','3');
    await expect(page.locator('[data-timeline-item]')).toHaveCount(1);
    await page.getByRole('button',{name: 'Select clip Pattern A',exact: true}).click();
    await expect.poll(() => page.locator('video[data-playback-item-id="montage-clip-02"]').evaluate(element => (element as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
    await expect(page.locator('[data-timeline-item="montage-clip-02"]')).toHaveAttribute('data-timeline-start','0');
    const clipBounds = await page.getByRole('button',{name: 'Select clip Pattern A',exact: true}).boundingBox();
    assert.ok(clipBounds);
    const grip = {x: clipBounds.x+clipBounds.width/2,y: clipBounds.y+clipBounds.height/2};
    await page.mouse.move(grip.x,grip.y);
    await page.mouse.down();
    await page.mouse.move(grip.x+68,grip.y,{steps: 4});
    await page.mouse.up();
    await expect(page.getByLabel('Film timeline',{exact: true})).toHaveAttribute('data-revision','4');
    await expect(page.locator('[data-timeline-item="montage-clip-02"]')).toHaveAttribute('data-timeline-start','2');
    // Persistence is checked after the new document's owned reads finish.
    // DOMContentLoaded does not await either React reader; a previous poll must
    // not satisfy this gate. The final DOM assertion keeps its existing budget.
    const reloadStartedAt=Date.now();
    const reloadHistoryUrl=runtime.browserOrigin+'/api/studio/projects/'+project.projectId+'/image-conversation';
    const reloadTimelineUrl=runtime.browserOrigin+'/api/studio/projects/'+project.projectId+'/conversation-timeline?preview=1';
    const reloadRequests=new Map<import('@playwright/test').Request,number>();
    const reloadEvents:Record<string,unknown>[]=[];
    let reloadNavigationRequested=false,reloadDocumentCommitted=false;
    reloadEvidence={events:reloadEvents};
    const reloadEvent=(request:import('@playwright/test').Request,event:string,extra:Record<string,unknown>={})=>{
      if(reloadRequests.has(request))reloadEvents.push({readId:reloadRequests.get(request),event,path:new URL(request.url()).pathname,atMs:Date.now()-reloadStartedAt,...extra});
    };
    const onReloadRequest=(request:import('@playwright/test').Request)=>{
      if(request.isNavigationRequest()&&request.frame()===page.mainFrame()&&request.url()===url){reloadNavigationRequested=true;reloadEvidence!.navigationRequestedAtMs=Date.now()-reloadStartedAt;}
      if(!reloadDocumentCommitted||request.method()!=='GET'||![reloadHistoryUrl,reloadTimelineUrl].includes(request.url()))return;
      reloadRequests.set(request,reloadRequests.size+1);reloadEvent(request,'request');
    };
    const onReloadNavigation=(frame:import('@playwright/test').Frame)=>{
      if(reloadNavigationRequested&&frame===page.mainFrame()&&frame.url()===url){reloadDocumentCommitted=true;reloadEvidence!.documentCommittedAtMs=Date.now()-reloadStartedAt;}
    };
    const onReloadResponse=(response:import('@playwright/test').Response)=>reloadEvent(response.request(),'response',{status:response.status()});
    const onReloadFinished=(request:import('@playwright/test').Request)=>reloadEvent(request,'finished');
    const onReloadFailed=(request:import('@playwright/test').Request)=>reloadEvent(request,'failed',{error:request.failure()?.errorText});
    page.on('request',onReloadRequest);page.on('framenavigated',onReloadNavigation);page.on('response',onReloadResponse);page.on('requestfinished',onReloadFinished);page.on('requestfailed',onReloadFailed);
    try {
      // Use the fixture's existing 30-second response budget, without changing
      // the persistence assertion's five-second UI budget or retrying reload.
      const historyRead=page.waitForResponse(response=>reloadRequests.has(response.request())&&response.url()===reloadHistoryUrl,{timeout:30000});
      const timelineRead=page.waitForResponse(response=>reloadRequests.has(response.request())&&response.url()===reloadTimelineUrl,{timeout:30000});
      const [,historyResponse,timelineResponse]=await Promise.all([page.reload({waitUntil:'domcontentloaded'}),historyRead,timelineRead]);
      assert.deepEqual(await Promise.all([historyResponse.finished(),timelineResponse.finished()]),[null,null]);
      const [reloadHistory,reloadTimeline]=await Promise.all([historyResponse.json(),timelineResponse.json()]);
      const stored=(await runtime.database.pool.query('SELECT revision FROM studio_projects WHERE id=$1',[project.projectId])).rows[0];
      Object.assign(reloadEvidence,{history:{status:historyResponse.status(),ok:reloadHistory.ok,projectId:reloadHistory.result?.projectId},timeline:{status:timelineResponse.status(),ok:reloadTimeline.ok,projectId:reloadTimeline.result?.data?.projectId,revision:reloadTimeline.result?.data?.revision,items:reloadTimeline.result?.items?.map((item:{id:string;startSec:number})=>({id:item.id,startSec:item.startSec}))},storedRevision:stored?.revision});
      assert.equal(historyResponse.status(),200);assert.equal(reloadHistory.ok,true);assert.equal(reloadHistory.result.projectId,project.projectId);
      assert.equal(timelineResponse.status(),200);assert.equal(reloadTimeline.ok,true);assert.equal(reloadTimeline.result.data.projectId,project.projectId);
      assert.equal(reloadTimeline.result.data.revision,4);assert.equal(Number(stored?.revision),4);
      assert.deepEqual(reloadTimeline.result.items.map((item:{id:string;startSec:number})=>({id:item.id,startSec:item.startSec})),[{id:'montage-clip-02',startSec:2}]);
      await expect(page.locator('[data-timeline-item="montage-clip-02"]')).toHaveAttribute('data-timeline-start','2');
    } finally {
      page.off('request',onReloadRequest);page.off('framenavigated',onReloadNavigation);page.off('response',onReloadResponse);page.off('requestfinished',onReloadFinished);page.off('requestfailed',onReloadFailed);
    }
    for (const width of [320,768]) {
      await page.setViewportSize({width,height: 844});
      await expect(page.getByRole('textbox',{name: 'Message Milo',exact: true})).toBeVisible();
      await expect(page.getByRole('button',{name:'Projects',exact:true})).toBeVisible();
      await page.getByRole('button',{name:'Studio help',exact:true}).click();
      await expect(page.getByRole('dialog',{name:'Make it yours.',exact:true})).toBeVisible();
      await proof('help-'+width);
      await page.keyboard.press('Escape');
      if(width===320){await setTheme(true);await checkLibrary();await setTheme(false);}
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),'The document stays within the viewport, including classic WebKit scrollbars.');
    }
    await page.setViewportSize({width:1440,height:900});
    await page.getByRole('button',{name:'Projects',exact:true}).click();
    await expect(page.getByRole('dialog',{name:'Your projects',exact:true})).toBeVisible({timeout:30000});
    await page.getByRole('button',{name:'Rename Native Studio film',exact:true}).click();
    const mobileName=page.getByRole('textbox',{name:'Project name',exact:true});
    await expect(mobileName).toBeInViewport();await mobileName.fill('Cancelled mobile title');await mobileName.press('Escape');
    await expect(page.getByRole('button',{name:'Rename Native Studio film',exact:true})).toBeFocused();
    await expect(page.getByRole('dialog',{name:'Your projects',exact:true})).toBeVisible();
    await proof('projects-entry');
    const previousProjectId=new URL(page.url()).pathname.split('/').at(-1);
    const creation=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/studio/conversation-projects' && response.request().method()==='POST').then(async response=>{
      assert.equal(response.status(),200);
      const body=await response.json();
      assert.equal(body.ok,true);assert.ok(body.result.projectId);assert.notEqual(body.result.projectId,previousProjectId);
      return body;
    });
    // Navigation can finish before the new workspace's history request. Register
    // before clicking, including when creation and history both return quickly.
    const historyLoaded=page.waitForResponse(async response=>{
      if(response.request().method()!=='GET'||!new URL(response.url()).pathname.endsWith('/image-conversation'))return false;
      const created=await creation;
      return response.url()===`${runtime.browserOrigin}/api/studio/projects/${created.result.projectId}/image-conversation`;
    },{timeout:30_000});
    const [,newConversation,history]=await Promise.all([
      page.getByRole('button',{name:'New conversation',exact:true}).click(),creation,historyLoaded,
    ]);
    await expect(page).toHaveURL(`${runtime.browserOrigin}/app/studio/conversation/${newConversation.result.projectId}`,{timeout:30000});
    assert.equal(history.status(),200);
    const historyBody=await history.json();
    assert.equal(historyBody.ok,true);assert.equal(historyBody.result.projectId,newConversation.result.projectId);
    await expect(page.getByRole('heading',{name:'What would you like to do?'})).toBeVisible();
    await expect(page.getByRole('button',{name:'Open timeline',exact:true})).toBeVisible();
    await proof('empty-workspace');
    assert.deepEqual(errors,[]);
    assert.ok(browser.readPrivateRequests().some(request => request.status === 200 || request.status === 206));
    await owned.close();
  } catch (error) {throw new Error(String(error)+'\n'+JSON.stringify(await diagnose())+'\n'+runtime.readLogs().slice(-4000),{cause: error});}
  finally {await browser?.close();await runtime.close();}
});
