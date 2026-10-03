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
    await initializeStudioConnectedFixture(database);
    for (const name of ['00_create_profiles.sql','01_legal_documents.sql','02_user_consents.sql','04_profiles_timestamps.sql','12_app_settings.sql','30_mcp_paid_generation.sql','39_mcp_quote_lifetime.sql','49_studio_generation_scope.sql','50_studio_image_conversation.sql','51_studio_image_model_usage.sql','52_studio_conversation_runs.sql','53_studio_media_generation_scope.sql']) await database.pool.query(await readFile('neon/migrations/'+name,'utf8'));
    await database.pool.query('ALTER TABLE app_jobs ADD COLUMN status text');
    for(let index=0;index<2;index++) await database.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,status,original_name,metadata) VALUES($1,$2,$3,'image',$4,'image/webp','ready',$5,'{}'::jsonb)`,[`20000000-0000-4000-8000-00000000000${index+5}`,referenceIds[index],STUDIO_FIXTURE_OWNERS[0],referenceUrls[index],index?'Night shift':'Watch study']);
  }});
  let browser: Awaited<ReturnType<typeof startStudioConnectedBrowserFixture>> | undefined;
  let diagnose = async () => ({});
  try {
    const session = runtime.auth.createSession(STUDIO_FIXTURE_OWNERS[0],{clientId: 'studio-native-timeline-fixture'});
    const created = await postStudioMcpRequest(runtime,{jsonrpc: '2.0',id: 1,method: 'tools/call',params: {name: 'create_studio_montage',arguments: STUDIO_CONNECTED_MONTAGE_INPUT}},{token: session.access_token}).then(readStudioMcpResponse);
    assert.notEqual(created.result.isError,true,JSON.stringify(created.result));
    const project = created.result.structuredContent;
    browser = await startStudioConnectedBrowserFixture({runtime,browserName});
    const owned = await browser.newContext(session,{viewport: {width: 1440,height: 900},locale: 'en-US',reducedMotion: 'reduce'});
    const page = owned.page;
    let diagnosticPage = page;
    const mediaFailures: string[] = [];
    page.on('response',response => {if (response.status() === 403) mediaFailures.push(new URL(response.url()).pathname);});
    diagnose = async () => {
      await proof('failure',diagnosticPage);
      return {
        mediaFailures,
        monitor: await diagnosticPage.getByLabel('Film monitor',{exact: true}).count(),
        alerts: await diagnosticPage.getByRole('alert').allTextContents(),
        decoders: await diagnosticPage.locator('video').evaluateAll(elements => elements.map(element => {
          const video = element as HTMLVideoElement;
          return {id: video.dataset.playbackItemId,ready: video.readyState,time: video.currentTime,network: video.networkState,error: video.error?.code,source: video.currentSrc ? new URL(video.currentSrc).pathname : null};
        })),
      };
    };
    const errors: string[] = [];
    page.on('pageerror',error => errors.push(error.message));
    page.on('console',message => {if (message.type() === 'error' && /hydration|Hydration|Each child|cannot be a descendant|Cannot update/i.test(message.text())) errors.push(message.text());});
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
      await expect(dialog.getByRole('alert')).toHaveText('The library is unavailable. Check your connection.');
      await expect(dialog.getByRole('button',{name: 'Import',exact: true})).toBeEnabled();
      const bounds = await dialog.boundingBox();
      assert.ok(bounds && bounds.x >= 0 && bounds.x+bounds.width <= page.viewportSize()!.width,'Library fits the viewport.');
      await page.getByRole('button',{name: 'Close library',exact: true}).click();
      await expect(page.getByRole('button',{name: 'Open library',exact: true})).toBeFocused();
      await page.unroute(endpoint);
      await page.route(endpoint,route => route.fulfill({json: {ok: true,assets: [],nextCursor: null}}));
      await page.getByRole('button',{name: 'Open library',exact: true}).click();
      await expect(dialog.getByText('No media here yet. You can import some.',{exact: true})).toBeVisible();
      await dialog.getByRole('button',{name: 'Audio',exact: true}).click();
      await expect(dialog.getByRole('button',{name: 'Audio',exact: true})).toHaveAttribute('aria-pressed','true');
      await expect(dialog.getByRole('alert')).toHaveCount(0);
      await proof('olive-library-'+page.viewportSize()!.width);
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(page.getByRole('button',{name: 'Open library',exact: true})).toBeFocused();
      await page.unroute(endpoint);
    }
    await page.goto(url,{waitUntil: 'domcontentloaded',timeout: 120000});
    await expect(page.locator('[data-timeline-item]')).toHaveCount(2,{timeout: 45000});
    const cookies = page.getByRole('button',{name: 'Reject all',exact: true});
    if (await cookies.isVisible()) await cookies.click();
    await expect(page.getByRole('heading',{name:'What shall we create?'})).toBeVisible();
    const message = page.getByRole('textbox',{name:'Message Studio',exact:true});
    await page.getByRole('button',{name:'Shape a prompt',exact:false}).click();
    await expect(message).toBeFocused();
    await expect(message).toHaveValue('Help me write a prompt for ');
    await expect(page.getByRole('button',{name:'Explore an idea',exact:false})).toHaveCount(0);
    await message.fill('');
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
    await page.route(libraryEndpoint,route=>route.fulfill({json:{ok:true,assets:referenceIds.map((assetId,index)=>({assetId,kind:'image',name:index?'Night shift':'Watch study',url:referenceUrls[index]})),nextCursor:null}}));
    for(const name of ['Watch study','Night shift']) {
      await page.getByRole('button',{name:'Open library',exact:true}).click();
      await page.getByRole('button',{name:'Choose '+name,exact:true}).click();
    }
    await page.unroute(libraryEndpoint);
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
    await expect(shelf.getByRole('button',{name:'Open media',exact:true})).toBeVisible();
    await proof('media-dock-mobile-compact');
    await shelf.getByRole('button',{name:'Open media',exact:true}).click();
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
    await message.fill('');
    await page.setViewportSize({width:1440,height:900});
    await page.reload({waitUntil:'domcontentloaded'});
    await expect(page.locator('[data-timeline-item]')).toHaveCount(2);

    await page.getByRole('button',{name: 'Switch to Olive',exact: true}).click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme','dark');
    await checkLibrary();
    await proof('olive-desktop');
    await expect(page.locator('[data-tone]')).toHaveAttribute('data-tone','olive');
    await page.reload({waitUntil: 'domcontentloaded'});
    await expect(page.locator('[data-tone]')).toHaveAttribute('data-tone','olive');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme','dark');
    await page.getByRole('button',{name: 'Switch to Charcoal',exact: true}).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
    await expect(page.getByLabel('Film monitor',{exact: true})).toHaveCount(0);
    await expect(page.locator('video[data-playback-item-id]')).toHaveCount(0);
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
    await page.getByRole('button',{name: 'Select clip Pattern B',exact: true}).click();
    await expect(page.getByRole('textbox',{name: 'Message Studio',exact: true})).toBeVisible();
    const geometry = await page.evaluate(() => {
      const chat = document.querySelector('textarea')!.getBoundingClientRect();
      const monitor = document.querySelector('[aria-label="Film monitor"]')!.getBoundingClientRect();
      return {chatBottom: chat.bottom,chatTop: chat.top,monitorTop: monitor.top,monitorHeight: monitor.height,width: document.documentElement.scrollWidth,viewport: window.innerWidth};
    });
    assert.ok(geometry.chatBottom <= geometry.monitorTop,'Chat composer stays above the compact monitor.');
    assert.ok(geometry.chatTop >= 0);
    assert.ok(geometry.monitorHeight <= 112);
    assert.equal(geometry.width,geometry.viewport,'The mobile document does not overflow horizontally.');
    await page.getByRole('button',{name: 'Switch to Olive',exact: true}).click();
    await expect(page.locator('[data-tone]')).toHaveAttribute('data-tone','olive');
    await proof('olive-mobile');
    await checkLibrary();
    await page.getByLabel('Audio volume',{exact: true}).press('Home');
    await expect(page.getByLabel('Film timeline',{exact: true})).toHaveAttribute('data-revision','2');
    await page.reload({waitUntil: 'domcontentloaded'});
    await expect(page.locator('[data-tone]')).toHaveAttribute('data-tone','olive');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme','dark');
    await expect(page.locator('[data-timeline-item]')).toHaveCount(2);
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
    await page.reload({waitUntil: 'domcontentloaded'});
    await expect(page.locator('[data-timeline-item="montage-clip-02"]')).toHaveAttribute('data-timeline-start','2');
    for (const width of [320,768]) {
      await page.setViewportSize({width,height: 844});
      await expect(page.getByRole('textbox',{name: 'Message Studio',exact: true})).toBeVisible();
      await expect(page.getByRole('link',{name:'My projects',exact:true})).toBeVisible();
      await page.getByRole('button',{name:'Studio help',exact:true}).click();
      await expect(page.getByRole('dialog',{name:'Make it yours.',exact:true})).toBeVisible();
      await proof('help-'+width);
      await page.keyboard.press('Escape');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),'The document stays within the viewport, including classic WebKit scrollbars.');
    }
    await page.setViewportSize({width:1440,height:900});
    await page.getByRole('link',{name:'My projects',exact:true}).click();
    await expect(page.getByRole('button',{name:'Open Studio',exact:true})).toBeVisible({timeout:30000});
    await proof('projects-entry');
    await page.getByRole('button',{name:'Open Studio',exact:true}).click();
    await expect(page).toHaveURL(/\/app\/studio\/conversation\/project_/,{timeout:30000});
    await expect(page.getByRole('heading',{name:'What shall we create?'})).toBeVisible();
    await expect(page.getByRole('button',{name:'Open timeline',exact:true})).toBeVisible();
    await proof('empty-workspace');
    assert.deepEqual(errors,[]);
    assert.ok(browser.readPrivateRequests().some(request => request.status === 200 || request.status === 206));
    await owned.close();
  } catch (error) {throw new Error(String(error)+'\n'+JSON.stringify(await diagnose())+'\n'+runtime.readLogs().slice(-4000),{cause: error});}
  finally {await browser?.close();await runtime.close();}
});
