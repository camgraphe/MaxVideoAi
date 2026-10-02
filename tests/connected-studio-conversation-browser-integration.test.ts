import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {expect} from '@playwright/test';
import {startStudioIntegrationRuntime} from './helpers/studio-integration-runtime';
import {startStudioConnectedBrowserFixture} from './helpers/studio-connected-browser-fixture';
import {initializeStudioConnectedFixture,STUDIO_CONNECTED_MONTAGE_INPUT} from './helpers/studio-connected-fixture-data';
import {STUDIO_FIXTURE_OWNERS} from './helpers/studio-auth-fixture';
import {postStudioMcpRequest,readStudioMcpResponse} from './helpers/studio-mcp-http-fixture';

test('native chat timeline collapses, trims real source frames and preserves mobile chat access', {timeout: 240000},async () => {
  const runtime = await startStudioIntegrationRuntime({mcp: {studioMontageCreation: true},privateStorage: true,conversation: true,initializeDatabase: async database => {
    await initializeStudioConnectedFixture(database);
    for (const name of ['30_mcp_paid_generation.sql','39_mcp_quote_lifetime.sql','49_studio_generation_scope.sql','50_studio_image_conversation.sql','51_studio_image_model_usage.sql','52_studio_conversation_runs.sql','53_studio_media_generation_scope.sql']) await database.pool.query(await readFile('neon/migrations/'+name,'utf8'));
    await database.pool.query('ALTER TABLE app_jobs ADD COLUMN status text');
  }});
  let browser: Awaited<ReturnType<typeof startStudioConnectedBrowserFixture>> | undefined;
  try {
    const session = runtime.auth.createSession(STUDIO_FIXTURE_OWNERS[0],{clientId: 'studio-native-timeline-fixture'});
    const created = await postStudioMcpRequest(runtime,{jsonrpc: '2.0',id: 1,method: 'tools/call',params: {name: 'create_studio_montage',arguments: STUDIO_CONNECTED_MONTAGE_INPUT}},{token: session.access_token}).then(readStudioMcpResponse);
    assert.notEqual(created.result.isError,true,JSON.stringify(created.result));
    const project = created.result.structuredContent;
    browser = await startStudioConnectedBrowserFixture({runtime});
    const owned = await browser.newContext(session,{viewport: {width: 1440,height: 900},locale: 'en-US',reducedMotion: 'reduce'});
    const page = owned.page;
    const errors: string[] = [];
    page.on('pageerror',error => errors.push(error.message));
    const auxiliary = new Map([['/api/member-status',{tier: 'Member'}],['/api/wallet',{balance: 0,balanceCents: 0,currency: 'USD'}],['/api/admin/access',{ok: false}],['/api/legal/cookies/version',{ok: true,version: 'native-timeline',publishedAt: null}],['/api/legal/cookies',{ok: true,version: 'native-timeline'}]]);
    for (const [path,json] of auxiliary) await page.route(runtime.browserOrigin+path,route => route.fulfill({json}));
    const url = runtime.browserOrigin+'/app/studio/conversation/'+project.projectId;
    await page.goto(url,{waitUntil: 'domcontentloaded',timeout: 120000});
    await expect(page.locator('[data-timeline-item]')).toHaveCount(2,{timeout: 45000});
    const cookies = page.getByRole('button',{name: 'Reject all',exact: true});
    if (await cookies.isVisible()) await cookies.click();
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
    assert.deepEqual(errors,[]);
    assert.ok(browser.readPrivateRequests().some(request => request.status === 200 || request.status === 206));
    await owned.close();
  } catch (error) {throw new Error(String(error)+'\n'+runtime.readLogs().slice(-4000),{cause: error});}
  finally {await browser?.close();await runtime.close();}
});
