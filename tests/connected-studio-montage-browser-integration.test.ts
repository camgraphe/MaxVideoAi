import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import test from 'node:test';
import { expect } from '@playwright/test';
import { startStudioIntegrationRuntime } from './helpers/studio-integration-runtime';
import { startStudioConnectedBrowserFixture } from './helpers/studio-connected-browser-fixture';
import { STUDIO_FIXTURE_OWNERS } from './helpers/studio-auth-fixture';
import { initializeStudioConnectedFixture, STUDIO_CONNECTED_MONTAGE_INPUT } from './helpers/studio-connected-fixture-data';
import { postStudioMcpRequest, readStudioMcpResponse } from './helpers/studio-mcp-http-fixture';

test('fresh authenticated Studio opens the MCP-persisted montage, decodes private media and reopens a server-acknowledged edit', { timeout: 180_000 }, async (t) => {
  const runtime = await startStudioIntegrationRuntime({
    mcp: { studioMontageCreation: true }, privateStorage: true,
    initializeDatabase: initializeStudioConnectedFixture,
  });
  let browserFixture: Awaited<ReturnType<typeof startStudioConnectedBrowserFixture<ReturnType<typeof runtime.auth.createSession>>>> | undefined;
  try {
    const session = runtime.auth.createSession(STUDIO_FIXTURE_OWNERS[0], { clientId: 'studio-connected-browser-fixture' });
    const create = () => postStudioMcpRequest(runtime, {
      jsonrpc: '2.0', id: 1, method: 'tools/call', params: {
        name: 'create_studio_montage', arguments: STUDIO_CONNECTED_MONTAGE_INPUT,
      },
    }, { token: session.access_token }).then(readStudioMcpResponse);
    const result = await create();
    assert.notEqual(result.result.isError, true, JSON.stringify(result.result));
    const montage = result.result.structuredContent;
    assert.equal(montage.persisted, true);
    let expireNextPrivateRequest = false;
    browserFixture = await startStudioConnectedBrowserFixture({ runtime, signatureClock: () => {
      if (expireNextPrivateRequest) {
        expireNextPrivateRequest = false;
        return new Date(Date.now() + 3_600_000);
      }
      return new Date();
    } });

    const prepareFresh = async (browserSession = session) => {
      const owned = await browserFixture!.newContext(browserSession, { viewport: { width: 1440, height: 900 }, locale: 'en-US', colorScheme: 'light', reducedMotion: 'reduce' });
      assert.deepEqual((await owned.context.storageState()).origins, [], 'No Studio draft, global localStorage or previous browser cache seeds this context.');
      // These unrelated account/consent readers are outside this minimal SQL fixture.
      // Project, sequence, workspace, media access, montage and Auth requests remain real.
      const auxiliary = new Map<string, unknown>([
        ['/api/member-status', { tier: 'Member' }],
        ['/api/wallet', { balance: 42.5, balanceCents: 4250, currency: 'USD' }],
        ['/api/admin/access', { ok: false }],
        ['/api/legal/cookies/version', { ok: true, version: 'studio-connected-browser', publishedAt: null }],
        ['/api/legal/cookies', { ok: true, version: 'studio-connected-browser' }],
      ]);
      for (const [path, json] of auxiliary) {
        await owned.page.route(`${runtime.browserOrigin}${path}`, (route) => route.fulfill({ json }));
      }
      // No generation is submitted or priced in this persistence-only fixture.
      await owned.page.route(`${runtime.browserOrigin}/api/preflight`, (route) => route.fulfill({
        status: 503, json: { ok: false, error: 'GENERATION_NOT_PART_OF_PERSISTENCE_TEST' },
      }));
      const errors: string[] = [];
      owned.page.on('pageerror', (error) => errors.push(error.message));
      return { ...owned, errors };
    };
    const openFresh = async () => {
      const owned = await prepareFresh();
      await owned.page.goto(`${runtime.browserOrigin}${montage.studioUrl}`, { waitUntil: 'domcontentloaded' });
      await expect(owned.page.locator('[data-timeline-item]')).toHaveCount(2, { timeout: 25_000 });
      const rejectCookies = owned.page.getByRole('button', { name: 'Reject all', exact: true });
      await expect(rejectCookies).toBeVisible({ timeout: 10_000 });
      await rejectCookies.click();
      return owned;
    };

    const first = await openFresh();
    const page = first.page;
    let stale: Awaited<ReturnType<typeof openFresh>> | undefined;
    try {
      await expect(page.locator('[data-timeline-item]')).toHaveCount(2, { timeout: 25_000 });
      await expect(page.locator('[data-timeline-item="montage-clip-01"]')).toHaveAttribute('data-timeline-start', '0');
      await expect(page.locator('[data-timeline-item="montage-clip-02"]')).toHaveAttribute('data-timeline-start', '2');
      await expect(page.locator('[data-timeline-item="montage-clip-01"]')).toHaveAttribute('data-timeline-duration', '2');
      const firstVideo = page.locator('video[data-playback-item-id="montage-clip-01"]');
      await expect(firstVideo).toHaveCount(1);
      await expect.poll(() => firstVideo.evaluate((element) => (element as HTMLVideoElement).readyState), { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
      await page.locator('video[data-playback-item-id]').evaluateAll((elements) => {
        for (const element of elements) {
          const video = element as HTMLVideoElement;
          video.dataset.proofFrames = '0';
          const onFrame: VideoFrameRequestCallback = (_now, metadata) => {
            video.dataset.proofFrames = String(Number(video.dataset.proofFrames) + 1);
            video.dataset.proofMediaTime = String(metadata.mediaTime);
            video.dataset.proofWidth = String(metadata.width);
            video.dataset.proofHeight = String(metadata.height);
            if (video.isConnected) video.requestVideoFrameCallback(onFrame);
          };
          video.requestVideoFrameCallback(onFrame);
        }
      });
      await page.getByRole('button', { name: 'Play timeline', exact: true }).click();
      await expect.poll(() => firstVideo.getAttribute('data-proof-frames').then(Number)).toBeGreaterThan(1);
      await expect.poll(() => firstVideo.getAttribute('data-proof-media-time').then(Number)).toBeGreaterThan(1.05);
      await expect(firstVideo).toHaveAttribute('data-proof-width', '320');
      await expect(firstVideo).toHaveAttribute('data-proof-height', '180');
      assert.equal(await firstVideo.evaluate((element) => (element as HTMLVideoElement).muted), false, 'Preserve must leave the known embedded AAC track enabled.');
      assert.ok(await firstVideo.evaluate((element) => (element as HTMLVideoElement).volume) > 0);
      assert.equal(await firstVideo.evaluate((element) => typeof (
        element as HTMLVideoElement & { webkitAudioDecodedByteCount?: number }
      ).webkitAudioDecodedByteCount), 'number', 'This native AAC proof requires the pinned Chromium decoded-byte counter; it is not a cross-browser or private RMS claim.');
      await expect.poll(() => firstVideo.evaluate((element) => (
        element as HTMLVideoElement & { webkitAudioDecodedByteCount?: number }
      ).webkitAudioDecodedByteCount ?? 0)).toBeGreaterThan(0);
      await page.getByRole('button', { name: 'Pause timeline', exact: true }).click();
      await expect.poll(() => firstVideo.evaluate((element) => (element as HTMLVideoElement).paused)).toBe(true);

      // Fault injection advances only the private-storage validator for one GET.
      // The browser/server clocks and the renewal route are not mocked.
      const privateRequestCount = browserFixture.readPrivateRequests().length;
      const sourceTimeBeforeExpiry = await firstVideo.evaluate((element) => (element as HTMLVideoElement).currentTime);
      const oldSignedUrl = await firstVideo.evaluate((element) => (element as HTMLVideoElement).currentSrc);
      const originalResource = new URL(oldSignedUrl);
      const signingTime = originalResource.searchParams.get('X-Amz-Date');
      assert.match(signingTime ?? '', /^\d{8}T\d{6}Z$/u);
      const signedAt = Date.UTC(Number(signingTime!.slice(0, 4)), Number(signingTime!.slice(4, 6)) - 1, Number(signingTime!.slice(6, 8)), Number(signingTime!.slice(9, 11)), Number(signingTime!.slice(11, 13)), Number(signingTime!.slice(13, 15)));
      // SigV4 timestamps have whole-second precision: a renewed token must be distinguishable.
      await expect.poll(() => Date.now() - signedAt).toBeGreaterThan(1100);
      const renewal = page.waitForResponse((response) => (
        response.url() === `${runtime.browserOrigin}/api/studio/projects/${montage.projectId}/media-access`
        && response.request().method() === 'POST' && response.status() === 200
      ));
      const newPrivateAccess = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return url.origin === originalResource.origin && url.pathname === originalResource.pathname
          && response.url() !== oldSignedUrl && [200, 206].includes(response.status());
      });
      const renewalProof = Promise.all([renewal, newPrivateAccess]);
      // The original promise still rejects when awaited, but a prior assertion failure
      // must not leave response waiters throwing after context teardown.
      void renewalProof.catch(() => undefined);
      expireNextPrivateRequest = true;
      await firstVideo.evaluate((element) => (element as HTMLVideoElement).load());
      await expect.poll(() => browserFixture!.readPrivateRequests().slice(privateRequestCount).some((entry) => entry.status === 403)).toBe(true);
      await renewalProof;
      await expect.poll(() => firstVideo.evaluate((element) => (element as HTMLVideoElement).readyState), { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
      await expect.poll(() => firstVideo.evaluate((element) => (element as HTMLVideoElement).currentTime)).toBeCloseTo(sourceTimeBeforeExpiry, 1);
      assert.equal(await firstVideo.evaluate((element) => (element as HTMLVideoElement).paused), true);
      assert.ok(browserFixture.readPrivateRequests().slice(privateRequestCount).some((entry) => entry.status === 206 && entry.range !== null));

      const secondVideo = page.locator('video[data-playback-item-id="montage-clip-02"]');
      const framesBeforeSeek = Number(await secondVideo.getAttribute('data-proof-frames'));
      await page.getByLabel('Timeline scrubber').evaluate((element) => {
        const input = element as HTMLInputElement;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '2.5');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await expect.poll(() => secondVideo.getAttribute('data-proof-frames').then(Number)).toBeGreaterThan(framesBeforeSeek);
      await expect.poll(() => secondVideo.getAttribute('data-proof-media-time').then(Number)).toBeCloseTo(1, 1);
      assert.ok(await secondVideo.evaluate((element) => Number(getComputedStyle(element).opacity)) > 0.99);

      stale = await openFresh();
      await page.locator('[data-timeline-item="montage-clip-01"]').click();
      await page.getByLabel('Clip name', { exact: true }).fill('A real browser edit');
      await expect.poll(async () => {
        const rows = await runtime.database.pool.query('SELECT timeline_state FROM studio_sequences WHERE id = $1', [montage.sequenceId]);
        return rows.rows[0].timeline_state.timelineItems[0].title;
      }, { timeout: 15_000 }).toBe('A real browser edit');
      const saved = await runtime.database.pool.query('SELECT revision, workspace_state FROM studio_projects WHERE id = $1', [montage.projectId]);
      assert.ok(Number(saved.rows[0].revision) >= 1);
      assert.deepEqual(saved.rows[0].workspace_state.nodes, [], 'Connected bootstrap must never save a starter over this empty montage canvas.');
      assert.deepEqual(saved.rows[0].workspace_state.edges, []);
      assert.doesNotMatch(JSON.stringify(saved.rows), /X-Amz-Signature/u);
      assert.equal(await page.evaluate(() => Object.keys(localStorage).some((key) => /X-Amz-Signature|mediaAccessUrl/u.test(localStorage.getItem(key) ?? ''))), false, 'Browser drafts must strip transient private object tokens too.');
      const conflictResponse = stale.page.waitForResponse((response) => (
        response.url() === `${runtime.browserOrigin}/api/studio/projects/${montage.projectId}/workspace`
        && response.request().method() === 'PUT' && response.status() === 409
      ), { timeout: 15_000 });
      void conflictResponse.catch(() => undefined);
      await stale.page.locator('[data-timeline-item="montage-clip-01"]').click();
      await stale.page.getByLabel('Clip name', { exact: true }).fill('Unsaved stale tab edit');
      await conflictResponse;
      await expect(stale.page.getByLabel('Clip name', { exact: true })).toHaveValue('Unsaved stale tab edit');
      const kept = await runtime.database.pool.query('SELECT timeline_state FROM studio_sequences WHERE id = $1', [montage.sequenceId]);
      assert.equal(kept.rows[0].timeline_state.timelineItems[0].title, 'A real browser edit');
      assert.equal(kept.rows[0].timeline_state.timelineItems.length, 2);
      const conflictAlert = stale.page.locator('[data-studio-revision-conflict="true"][role="alert"]');
      await expect(conflictAlert).toContainText('This project changed in another tab. Your local draft is preserved.');
      await expect.poll(() => stale!.page.evaluate(() => Object.keys(localStorage).some((key) => (
        localStorage.getItem(key) ?? ''
      ).includes('Unsaved stale tab edit')))).toBe(true);
      stale.page.once('dialog', (dialog) => { void dialog.accept(); });
      await stale.page.getByRole('button', { name: 'Reload server version', exact: true }).click();
      await expect(conflictAlert).toHaveCount(0);
      await stale.page.locator('[data-timeline-item="montage-clip-01"]').click();
      await expect(stale.page.getByLabel('Clip name', { exact: true })).toHaveValue('A real browser edit');
      assert.deepEqual(first.errors, []);
      assert.deepEqual(stale.errors, []);
      await mkdir('output/playwright/studio-connected', { recursive: true });
      await page.screenshot({ path: 'output/playwright/studio-connected/persisted-private-viewer.png', fullPage: true });
      t.diagnostic(JSON.stringify({ snapshot: runtime.revision, revision: Number(saved.rows[0].revision), privateRequests: browserFixture.readPrivateRequests() }));
    } catch (error) {
      await mkdir('output/playwright/studio-connected', { recursive: true });
      await page.screenshot({ path: 'output/playwright/studio-connected/failure.png', fullPage: true }).catch(() => undefined);
      t.diagnostic(`Owned runtime tail: ${runtime.readLogs().slice(-3500)}`);
      t.diagnostic(JSON.stringify({ pageErrors: first.errors, privateRequests: browserFixture.readPrivateRequests() }));
      throw error;
    } finally {
      try { await stale?.close(); } finally { await first.close(); }
    }

    const replay = await create();
    assert.equal(replay.result.structuredContent.projectId, montage.projectId);
    const reopened = await openFresh();
    try {
      await expect(reopened.page.locator('[data-timeline-item]')).toHaveCount(2, { timeout: 25_000 });
      await reopened.page.locator('[data-timeline-item="montage-clip-01"]').click();
      await expect(reopened.page.getByLabel('Clip name', { exact: true })).toHaveValue('A real browser edit');
      assert.deepEqual(reopened.errors, []);
    } finally { await reopened.close(); }

    const sessionB = runtime.auth.createSession(STUDIO_FIXTURE_OWNERS[1], { clientId: 'studio-connected-browser-fixture' });
    const forbidden = await prepareFresh(sessionB);
    const privateBeforeForeign = browserFixture.readPrivateRequests().length;
    try {
      const projectRoute = `${runtime.browserOrigin}/api/studio/projects/${montage.projectId}`;
      const refusedRead = forbidden.page.waitForResponse((response) => (
        [projectRoute, `${projectRoute}/workspace`].includes(response.url())
        && response.request().method() === 'GET' && response.status() === 404
      ));
      void refusedRead.catch(() => undefined);
      await forbidden.page.goto(`${runtime.browserOrigin}${montage.studioUrl}`, { waitUntil: 'domcontentloaded' });
      await refusedRead;
      const unavailable = forbidden.page.locator('[data-studio-project-access-error][role="alert"]');
      await expect(unavailable).toBeVisible();
      await expect(unavailable).toContainText(/project/iu);
      await expect(forbidden.page.locator('[data-timeline-item="montage-clip-01"], [data-timeline-item="montage-clip-02"]')).toHaveCount(0);
      await expect(forbidden.page.getByText('A real browser edit', { exact: true })).toHaveCount(0);
      assert.equal(browserFixture.readPrivateRequests().slice(privateBeforeForeign).some((entry) => entry.status === 200 || entry.status === 206), false);
      assert.deepEqual(forbidden.errors, []);
    } finally { await forbidden.close(); }
  } finally {
    try { await browserFixture?.close(); } finally { await runtime.close(); }
  }
});
