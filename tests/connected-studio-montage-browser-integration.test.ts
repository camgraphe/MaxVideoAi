import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import test from 'node:test';
import { expect } from '@playwright/test';
import { startStudioIntegrationRuntime } from './helpers/studio-integration-runtime';
import { startStudioConnectedBrowserFixture } from './helpers/studio-connected-browser-fixture';
import { STUDIO_FIXTURE_OWNERS } from './helpers/studio-auth-fixture';
import { initializeStudioConnectedFixture, STUDIO_CONNECTED_ASSET_IDS, STUDIO_CONNECTED_MONTAGE_INPUT } from './helpers/studio-connected-fixture-data';
import { postStudioMcpRequest, readStudioMcpResponse } from './helpers/studio-mcp-http-fixture';

test('connected Studio persists ordered MCP and UI montages with private playback and revision-safe editing', { timeout: 240_000 }, async (t) => {
  const runtime = await startStudioIntegrationRuntime({
    revision: process.env.STUDIO_BROWSER_TEST_REVISION,
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
      try {
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
        const workspaceWrites: Array<{ expectedRevision: number; snapshot: unknown }> = [];
        owned.page.on('pageerror', (error) => errors.push(error.message));
        owned.page.on('request', (request) => {
          if (request.method() === 'PUT' && request.url() === `${runtime.browserOrigin}/api/studio/projects/${montage.projectId}/workspace`) {
            workspaceWrites.push(request.postDataJSON());
          }
        });
        return { ...owned, errors, workspaceWrites };
      } catch (error) {
        await owned.close();
        throw error;
      }
    };
    const openFresh = async () => {
      const owned = await prepareFresh();
      try {
        await owned.page.goto(`${runtime.browserOrigin}${montage.studioUrl}`, { waitUntil: 'domcontentloaded' });
        await expect(owned.page.locator('[data-timeline-item]')).toHaveCount(2, { timeout: 25_000 });
        const rejectCookies = owned.page.getByRole('button', { name: 'Reject all', exact: true });
        await expect(rejectCookies).toBeVisible({ timeout: 10_000 });
        await rejectCookies.click();
        return owned;
      } catch (error) {
        await owned.close();
        throw error;
      }
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
      // Keep this recursive browser-only callback outside tsx/esbuild's named-function
      // transform; injected helpers such as __name do not exist in the page realm.
      await page.evaluate(`(() => {
        const elements = document.querySelectorAll('video[data-playback-item-id]');
        for (const element of elements) {
          const video = element;
          video.dataset.proofFrames = '0';
          const onFrame = (_now, metadata) => {
            video.dataset.proofFrames = String(Number(video.dataset.proofFrames) + 1);
            video.dataset.proofMediaTime = String(metadata.mediaTime);
            video.dataset.proofWidth = String(metadata.width);
            video.dataset.proofHeight = String(metadata.height);
            if (video.isConnected) video.requestVideoFrameCallback(onFrame);
          };
          video.requestVideoFrameCallback(onFrame);
        }
      })()`);
      await expect(firstVideo).toHaveAttribute('data-proof-frames', /^\d+$/u);
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
      // Observe beyond the documented 900ms autosave debounce: merely opening the
      // second tab or receiving private access must not create a competing revision.
      await stale.page.waitForTimeout(1_200);
      assert.equal(stale.workspaceWrites.length, 0, 'Hydration and private access alone must not autosave a fresh tab.');
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
      const writesBeforeConflictReopen = stale.workspaceWrites.length;
      for (let reopen = 0; reopen < 2; reopen += 1) {
        await stale.page.reload({ waitUntil: 'domcontentloaded' });
        await expect(stale.page.locator('[data-timeline-item]')).toHaveCount(2);
        await stale.page.locator('[data-timeline-item="montage-clip-01"]').click();
        await expect(stale.page.getByLabel('Clip name', { exact: true })).toHaveValue('Unsaved stale tab edit');
        await expect(conflictAlert).toBeVisible();
        await stale.page.waitForTimeout(1_200);
        assert.equal(stale.workspaceWrites.length, writesBeforeConflictReopen, 'Recovering a stale local draft must not silently rebase it onto the latest server revision, including a second reopen.');
        const draftBases = await stale.page.evaluate(() => Object.keys(localStorage)
          .filter((key) => key.includes('.connected.') && (localStorage.getItem(key) ?? '').includes('Unsaved stale tab edit'))
          .map((key) => { const draft = JSON.parse(localStorage.getItem(key)!); return { dirty: draft.dirty, revision: draft.revision }; }));
        assert.deepEqual(draftBases, [{ dirty: true, revision: montage.revision }], 'A conflicted draft must retain the revision it was edited against across recovery and local persistence.');
      }
      const conflictedUrl = stale.page.url();
      await stale.page.getByRole('button', { name: 'Projects', exact: true }).click();
      await stale.page.waitForTimeout(1_200);
      assert.equal(stale.page.url(), conflictedUrl, 'Exit must stay in the editor when the real save result is conflict.');
      await expect(stale.page.getByLabel('Clip name', { exact: true })).toHaveValue('Unsaved stale tab edit');
      await expect(stale.page.getByText('Workspace saved. Returning to projects.', { exact: true })).toHaveCount(0);
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
      t.diagnostic(JSON.stringify({ firstWriteRevisions: first.workspaceWrites.map((write) => write.expectedRevision),
        secondWriteRevisions: stale?.workspaceWrites.map((write) => write.expectedRevision) ?? [] }));
      t.diagnostic(JSON.stringify({ nativeReaders: await page.locator('video[data-playback-item-id]').evaluateAll((elements) => elements.map((element) => {
        const video = element as HTMLVideoElement;
        return { id: video.dataset.playbackItemId, frames: video.dataset.proofFrames, mediaTime: video.dataset.proofMediaTime,
          currentTime: video.currentTime, readyState: video.readyState, paused: video.paused, error: video.error?.code,
          width: video.videoWidth, height: video.videoHeight, opacity: getComputedStyle(video).opacity };
      })) }));
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

    await t.test('initial unresolved hydration never exposes a successful save-and-exit action', async () => {
      const loading = await prepareFresh();
      let releaseRead!: () => void;
      const held = new Promise<void>((resolve) => { releaseRead = resolve; });
      let markReadStarted!: () => void;
      const started = new Promise<void>((resolve) => { markReadStarted = resolve; });
      const initialWrites: string[] = [];
      const projectEndpoint = `${runtime.browserOrigin}/api/studio/projects/${montage.projectId}`;
      try {
        loading.page.on('request', (request) => {
          if (request.url().startsWith(projectEndpoint) && ['PUT', 'PATCH', 'POST'].includes(request.method())) initialWrites.push(request.method());
        });
        await loading.page.route(projectEndpoint, async (route) => {
          if (route.request().method() === 'GET') { markReadStarted(); await held; }
          await route.continue().catch(() => undefined);
        });
        await loading.page.goto(`${runtime.browserOrigin}${montage.studioUrl}`, { waitUntil: 'domcontentloaded' });
        await started;
        await expect(loading.page.getByRole('button', { name: 'Projects', exact: true })).toBeDisabled();
        await loading.page.waitForTimeout(1_200);
        assert.deepEqual(initialWrites, [], 'An unresolved project must not persist a transient starter through a legacy writer.');
        releaseRead();
        await expect(loading.page.locator('[data-timeline-item]')).toHaveCount(2);
        await expect(loading.page.getByRole('button', { name: 'Projects', exact: true })).toBeEnabled();
        assert.deepEqual(loading.errors, []);
      } finally { releaseRead(); await loading.close(); }
    });

    await t.test('cross-tab Auth identity changes purge the prior private montage without navigating the editor', async () => {
      for (const replacement of [sessionB, null]) {
        const switched = await openFresh();
        const peer = await switched.context.newPage();
        let releaseScopeReply = () => {};
        try {
          const oldVideo = switched.page.locator('video[data-playback-item-id="montage-clip-01"]');
          await expect(oldVideo).toHaveCount(1);
          await expect.poll(() => switched.page.locator('video[data-playback-item-id]').evaluateAll((elements) => (
            elements.length === 2 && elements.every((element) => (element as HTMLVideoElement).readyState >= 2)
          ))).toBe(true);
          const privateBeforeSwitch = browserFixture!.readPrivateRequests().length;
          const editorUrl = switched.page.url();
          const projectEndpoint = `${runtime.browserOrigin}/api/studio/projects/${montage.projectId}`;
          const ownerDenial = replacement ? switched.page.waitForResponse((response) => (
            [projectEndpoint, `${projectEndpoint}/workspace`].includes(response.url())
            && response.request().method() === 'GET' && response.status() === 404
          )) : null;
          void ownerDenial?.catch(() => undefined);
          await switched.page.evaluate(() => { (window as Window & { studioAuthPageMarker?: string }).studioAuthPageMarker = 'same-editor-document'; });
          await peer.goto(`${runtime.browserOrigin}/api/legal/cookies/version`);
          if (replacement) {
            let markSaveStarted!: () => void;
            const started = new Promise<void>((resolve) => { markSaveStarted = resolve; });
            const held = new Promise<void>((resolve) => { releaseScopeReply = resolve; });
            await switched.page.route(`${projectEndpoint}/workspace`, async (route) => {
              if (route.request().method() !== 'PUT') { await route.continue(); return; }
              markSaveStarted();
              await held;
              await route.fulfill({ status: 503, json: { ok: false, error: 'CONTROLLED_SCOPE_CHANGE_SAVE' } }).catch(() => undefined);
            });
            // No server ACK exists while this explicit exit is pending. Replacing
            // the account must cancel the wait, never reinterpret it as Saved.
            await switched.page.getByRole('button', { name: 'Projects', exact: true }).click();
            await started;
          }
          await switched.context.clearCookies();
          if (replacement) {
            await switched.context.addCookies(runtime.auth.cookiesFor(replacement).map((cookie) => ({ ...cookie, url: runtime.browserOrigin })));
          }
          // Inject the installed SDK's actual peer-tab notification contract after
          // changing only this owned context's fixture cookies. The receiving SDK,
          // React subscription, workspace routes and owner checks are not mocked.
          // This is an Auth-event isolation proof, not a full interactive login.
          await peer.evaluate((nextSession) => {
            const channel = new BroadcastChannel('sb-127-auth-token');
            channel.postMessage({ event: nextSession ? 'SIGNED_IN' : 'SIGNED_OUT', session: nextSession });
            channel.close();
          }, replacement);
          if (ownerDenial) await ownerDenial;
          else {
            // A signed-out consumer may correctly avoid issuing an authenticated
            // read. Verify the actual cookie-less route refusal independently.
            assert.equal(await switched.page.evaluate(async (path) => (await fetch(path, { cache: 'no-store' })).status,
              `/api/studio/projects/${montage.projectId}`), 401);
          }
          await expect(switched.page.locator('[data-timeline-item="montage-clip-01"], [data-timeline-item="montage-clip-02"]')).toHaveCount(0);
          await expect(switched.page.locator('video[data-playback-item-id], audio')).toHaveCount(0);
          await expect(switched.page.getByText('A real browser edit', { exact: true })).toHaveCount(0);
          // Observe beyond autosave debounce so a temporary empty render followed
          // by stale hydration cannot establish account isolation.
          await switched.page.waitForTimeout(1_200);
          await expect(switched.page.locator('[data-timeline-item="montage-clip-01"], [data-timeline-item="montage-clip-02"], video[data-playback-item-id], audio')).toHaveCount(0);
          assert.equal(browserFixture!.readPrivateRequests().slice(privateBeforeSwitch).some((entry) => entry.status === 200 || entry.status === 206), false);
          assert.equal(switched.page.url(), editorUrl);
          assert.equal(await switched.page.evaluate(() => (window as Window & { studioAuthPageMarker?: string }).studioAuthPageMarker), 'same-editor-document');
          assert.deepEqual(switched.errors, []);
        } catch (error) {
          await switched.page.screenshot({ path: `output/playwright/studio-connected/auth-${replacement ? 'switch' : 'signout'}-failure.png`, fullPage: true }).catch(() => undefined);
          throw error;
        } finally { releaseScopeReply(); await switched.close(); }
      }
    });

    await t.test('failed autosave stays local across reopen and exit waits for a real successful retry', async () => {
      const offline = await openFresh();
      const endpoint = `${runtime.browserOrigin}/api/studio/projects/${montage.projectId}/workspace`;
      let failWrites = true;
      try {
        await offline.page.route(endpoint, (route) => route.request().method() === 'PUT' && failWrites
          ? route.fulfill({ status: 503, json: { ok: false, error: 'CONTROLLED_LOCAL_SAVE_UNAVAILABLE' } })
          : route.continue());
        const failedSave = offline.page.waitForResponse((response) => response.url() === endpoint && response.request().method() === 'PUT' && response.status() === 503);
        void failedSave.catch(() => undefined);
        await offline.page.locator('[data-timeline-item="montage-clip-01"]').click();
        await offline.page.getByLabel('Clip name', { exact: true }).fill('Recovered offline browser draft');
        await failedSave;
        await expect(offline.page.getByText('Studio sync is temporarily unavailable. Local draft mode is active.', { exact: true })).toBeVisible();
        const beforeRecovery = await runtime.database.pool.query('SELECT timeline_state FROM studio_sequences WHERE id=$1', [montage.sequenceId]);
        assert.equal(beforeRecovery.rows[0].timeline_state.timelineItems[0].title, 'A real browser edit');
        await offline.page.reload({ waitUntil: 'domcontentloaded' });
        await expect(offline.page.locator('[data-timeline-item]')).toHaveCount(2);
        await offline.page.locator('[data-timeline-item="montage-clip-01"]').click();
        await expect(offline.page.getByLabel('Clip name', { exact: true })).toHaveValue('Recovered offline browser draft');
        const failedExit = offline.page.waitForResponse((response) => response.url() === endpoint && response.request().method() === 'PUT' && response.status() === 503);
        void failedExit.catch(() => undefined);
        await offline.page.getByRole('button', { name: 'Projects', exact: true }).click();
        await failedExit;
        await offline.page.waitForTimeout(1_200);
        assert.equal(offline.page.url(), `${runtime.browserOrigin}${montage.studioUrl}`);
        await expect(offline.page.getByLabel('Clip name', { exact: true })).toHaveValue('Recovered offline browser draft');
        await expect(offline.page.getByText('Workspace saved. Returning to projects.', { exact: true })).toHaveCount(0);
        failWrites = false;
        const successfulExit = offline.page.waitForResponse((response) => response.url() === endpoint && response.request().method() === 'PUT' && response.status() === 200);
        void successfulExit.catch(() => undefined);
        await offline.page.getByRole('button', { name: 'Projects', exact: true }).click();
        await successfulExit;
        await expect(offline.page).toHaveURL(`${runtime.browserOrigin}/app/studio/projects`);
        const recovered = await runtime.database.pool.query('SELECT timeline_state FROM studio_sequences WHERE id=$1', [montage.sequenceId]);
        assert.equal(recovered.rows[0].timeline_state.timelineItems[0].title, 'Recovered offline browser draft');
        assert.deepEqual(offline.errors, []);
      } catch (error) {
        await offline.page.screenshot({ path: 'output/playwright/studio-connected/local-recovery-failure.png', fullPage: true }).catch(() => undefined);
        throw error;
      } finally { await offline.close(); }
    });

    await t.test('a fresh context renews a retained private clip after its bin entry was removed', async () => {
      // The real removal contract keeps clips when their bin entry is removed.
      // Persist that state via CAS, then require a fresh reader to request access
      // from the live timeline ref, with no transient URL seeded in localStorage.
      const workspaceEndpoint = `${runtime.origin}/api/studio/projects/${montage.projectId}/workspace`;
      const aggregateResponse = await fetch(workspaceEndpoint, { headers: { Authorization: `Bearer ${session.access_token}` }, signal: AbortSignal.timeout(30_000) });
      assert.equal(aggregateResponse.status, 200);
      const binAggregate = await aggregateResponse.json();
      const retainedTimelineSnapshot = {
        name: binAggregate.project.name, canvasTemplateId: binAggregate.project.canvasTemplateId, settings: binAggregate.project.settings,
        workspaceState: {
          ...binAggregate.project.workspaceState,
          projectAssets: binAggregate.project.workspaceState.projectAssets.filter((asset: { ref: { assetId: string } }) => asset.ref.assetId !== STUDIO_CONNECTED_ASSET_IDS.b),
          sequences: binAggregate.sequences.map((sequence: { id: string; name: string; settings: unknown; timelineState: Record<string, unknown> }) => ({
            id: sequence.id, name: sequence.name, projectSettings: sequence.settings, ...sequence.timelineState,
          })),
        },
      };
      const binRemoval = await fetch(workspaceEndpoint, {
        method: 'PUT', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedRevision: binAggregate.project.revision, snapshot: retainedTimelineSnapshot }),
        signal: AbortSignal.timeout(30_000),
      });
      assert.equal(binRemoval.status, 200, (await binRemoval.clone().text()).slice(0, 1000));
      const removedState = await runtime.database.pool.query('SELECT workspace_state FROM studio_projects WHERE id=$1', [montage.projectId]);
      assert.equal(removedState.rows[0].workspace_state.projectAssets.some((asset: { ref?: { assetId?: string } }) => asset.ref?.assetId === STUDIO_CONNECTED_ASSET_IDS.b), false);
      const retainedState = await runtime.database.pool.query('SELECT timeline_state FROM studio_sequences WHERE id=$1', [montage.sequenceId]);
      assert.deepEqual(retainedState.rows[0].timeline_state.timelineItems.map((item: { ref: { assetId: string } }) => item.ref.assetId), [STUDIO_CONNECTED_ASSET_IDS.b, STUDIO_CONNECTED_ASSET_IDS.a]);
      const privateBeforeReopen = browserFixture!.readPrivateRequests().length;
      const withoutBin = await openFresh();
      try {
        const retainedVideo = withoutBin.page.locator('video[data-playback-item-id="montage-clip-01"]');
        await expect(retainedVideo, 'A retained private clip must mount from its live timeline reference after reopening without its bin entry.').toHaveCount(1);
        await expect.poll(() => retainedVideo.evaluate((element) => (element as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
        const retainedSource = await retainedVideo.evaluate((element) => {
          const url = new URL((element as HTMLVideoElement).currentSrc);
          return `${url.origin}${url.pathname}`;
        });
        assert.ok(retainedSource.endsWith('/studio-private/pattern-b.mp4'), 'The renewed decoder must use B, not another available bin asset.');
        assert.ok(browserFixture!.readPrivateRequests().slice(privateBeforeReopen).some((entry) => entry.url === retainedSource && entry.status === 206));
        assert.deepEqual(withoutBin.errors, []);
      } catch (error) {
        await withoutBin.page.screenshot({ path: 'output/playwright/studio-connected/retained-clip-failure.png', fullPage: true }).catch(() => undefined);
        throw error;
      } finally { await withoutBin.close(); }
    });

    await t.test('mobile keyboard creation saves the exact caller-ordered clips through the shared command', async () => {
      // UI creation consumes an explicit shared-library listing fixture; the listing
      // owner is outside this minimal SQL schema. Studio command/Auth/resolution and
      // every project/sequence/receipt write remain the real routes and database.
      const creator = await prepareFresh();
      try {
        await creator.page.setViewportSize({ width: 390, height: 844 });
        await creator.page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
        const library = await runtime.database.pool.query(`SELECT public_id, kind, url, mime_type, metadata
          FROM media_assets WHERE user_id=$1 ORDER BY public_id`, [STUDIO_FIXTURE_OWNERS[0]]);
        let libraryAttempts = 0;
        await creator.page.route(`${runtime.browserOrigin}/api/media-library/assets?**`, (route) => {
          libraryAttempts += 1;
          if (libraryAttempts === 1) return route.fulfill({ status: 503, json: { ok: false } });
          return route.fulfill({ json: {
          ok: true, hasMore: false, nextCursor: null,
          assets: library.rows.map((asset) => ({
            id: asset.public_id, ref: { type: 'asset', assetId: asset.public_id, kind: asset.kind },
            kind: asset.kind, url: asset.url, mime: asset.mime_type, mediaFacts: asset.metadata.mediaFacts,
          })),
          } });
        });
        await creator.page.goto(`${runtime.browserOrigin}/app/studio/projects`, { waitUntil: 'domcontentloaded' });
        await creator.page.getByRole('button', { name: 'Reject all', exact: true }).click();
        await creator.page.getByRole('button', { name: 'MaxVideoAI Menu', exact: true }).click();
        await creator.page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
        await creator.page.getByRole('button', { name: 'Close ×', exact: true }).click();
        await expect(creator.page.locator('html')).toHaveAttribute('data-theme', 'dark');
        const open = creator.page.locator('[data-studio-montage-open="true"]');
        await expect(open).toBeVisible();
        await open.click();
        const dialog = creator.page.locator('[data-studio-montage-dialog="true"]');
        await expect(dialog).toBeVisible();
        await expect(dialog.locator('[data-studio-montage-validation-error="true"]')).toBeVisible();
        await expect(dialog.locator('[data-studio-montage-title-input="true"]')).toBeFocused();
        await expect(dialog.locator('[data-studio-montage-library-error="true"][role="alert"]')).toContainText('The video library could not be loaded.');
        await dialog.locator('[data-studio-montage-title-input="true"]').fill('Preserved during library retry');
        await dialog.getByRole('combobox', { name: 'Frame rate', exact: true }).selectOption('30');
        await dialog.getByRole('button', { name: 'Retry video library', exact: true }).click();
        await expect(dialog.locator('[data-studio-montage-add]')).toHaveCount(2);
        await expect(dialog.locator('[data-studio-montage-library-error="true"]')).toHaveCount(0);
        await expect(dialog.locator('[data-studio-montage-title-input="true"]')).toHaveValue('Preserved during library retry');
        await expect(dialog.getByRole('combobox', { name: 'Frame rate', exact: true })).toHaveValue('30');
        await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement)), 'Retry must retain keyboard ownership when its trigger is removed.').toBe(true);
        assert.equal(libraryAttempts, 2, 'Retry must relaunch the listing inside the same dialog without resetting its intent.');
        await creator.page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await expect(open).toBeFocused();
        await open.click();
        await expect(dialog.locator('[data-studio-montage-add]')).toHaveCount(2);
        await expect(dialog.locator(`[data-studio-montage-add="${STUDIO_CONNECTED_ASSET_IDS.unmeasured}"]`)).toHaveCount(0);
        await dialog.locator('[data-studio-montage-title-input="true"]').fill('Ordered from the Studio interface');
        await dialog.getByRole('combobox', { name: 'Frame rate', exact: true }).selectOption('30');
        await expect(dialog.locator('[data-studio-montage-submit="true"]')).toBeDisabled();
        await expect(dialog.locator('[data-studio-montage-validation-error="true"]')).toContainText(/2.*12/u);
        for (const assetId of [STUDIO_CONNECTED_ASSET_IDS.a, STUDIO_CONNECTED_ASSET_IDS.b, STUDIO_CONNECTED_ASSET_IDS.a]) {
          await dialog.locator(`[data-studio-montage-add="${assetId}"]`).click();
        }
        const ordered = dialog.locator('[data-studio-montage-clip]');
        await expect(ordered).toHaveCount(3);
        await ordered.nth(2).getByRole('button', { name: 'Remove 3', exact: true }).click();
        await expect(ordered).toHaveCount(2);
        await dialog.locator('[data-studio-montage-move-up="1"]').click();
        await expect(ordered.nth(0)).toHaveAttribute('data-studio-montage-asset-id', STUDIO_CONNECTED_ASSET_IDS.b);
        await dialog.locator('[data-studio-montage-move-down="0"]').focus();
        await creator.page.keyboard.press('Enter');
        await expect(ordered.nth(0)).toHaveAttribute('data-studio-montage-asset-id', STUDIO_CONNECTED_ASSET_IDS.a);
        await dialog.locator('[data-studio-montage-move-up="1"]').focus();
        await creator.page.keyboard.press('Enter');
        // A source-end trim must remain within measured bounds at a fractional FPS
        // conversion. Settings change together with every ordered occurrence.
        await dialog.getByRole('combobox', { name: 'Frame rate', exact: true }).selectOption('24');
        await ordered.nth(0).getByLabel('Source in frame', { exact: true }).fill('12');
        await ordered.nth(0).getByLabel('Duration in frames', { exact: true }).fill('132');
        await expect(dialog.locator('[data-studio-montage-submit="true"]')).toBeEnabled();
        await dialog.getByRole('combobox', { name: 'Frame rate', exact: true }).selectOption('25');
        await expect(ordered.nth(0).getByLabel('Source in frame', { exact: true })).toHaveValue('13');
        await expect(ordered.nth(0).getByLabel('Duration in frames', { exact: true })).toHaveValue('137');
        await expect(dialog.locator('[data-studio-montage-submit="true"]')).toBeEnabled();
        await ordered.nth(0).getByLabel('Duration in frames', { exact: true }).fill('138');
        await expect(dialog.locator('[data-studio-montage-validation-error="true"]')).toBeVisible();
        await expect(dialog.locator('[data-studio-montage-submit="true"]')).toBeDisabled();
        await ordered.nth(0).getByLabel('Duration in frames', { exact: true }).fill('137');
        await dialog.getByRole('combobox', { name: 'Frame rate', exact: true }).selectOption('30');
        for (const [index, clip] of STUDIO_CONNECTED_MONTAGE_INPUT.clips.entries()) {
          await ordered.nth(index).getByLabel('Source in frame', { exact: true }).fill(String(clip.sourceInFrame));
          await ordered.nth(index).getByLabel('Duration in frames', { exact: true }).fill(String(clip.durationFrames));
        }
        const dialogBox = await dialog.boundingBox();
        assert.ok(dialogBox && dialogBox.x >= 0 && dialogBox.width <= 390 && dialogBox.y >= 0 && dialogBox.y + dialogBox.height <= 845, 'The ordered creation dialog must fit the mobile viewport.');
        await creator.page.screenshot({ path: 'output/playwright/studio-connected/mobile-ordered-creation.png', fullPage: true });
        // The first real command commits, then its reply is lost. While the reply is
        // pending, visible intent must stay frozen. Retrying the same visible intent
        // must reuse its exact key and return the one committed project/receipt.
        let releaseLostReply!: () => void;
        const lostReply = new Promise<void>((resolve) => { releaseLostReply = resolve; });
        let acknowledgeFirst!: (value: { projectId: string }) => void;
        let rejectFirst!: (error: unknown) => void;
        const firstCommitted = new Promise<{ projectId: string }>((resolve, reject) => { acknowledgeFirst = resolve; rejectFirst = reject; });
        void firstCommitted.catch(() => undefined);
        const attempts: unknown[] = [];
        const montageEndpoint = `${runtime.browserOrigin}/api/studio/montages`;
        await creator.page.route(montageEndpoint, async (route) => {
          if (route.request().method() !== 'POST') { await route.continue(); return; }
          attempts.push(route.request().postDataJSON());
          if (attempts.length !== 1) { await route.continue(); return; }
          try {
            const committed = await route.fetch();
            assert.equal(committed.status(), 200, (await committed.text()).slice(0, 1000));
            const payload = await committed.json();
            assert.equal(payload.montage.persisted, true);
            acknowledgeFirst(payload.montage);
            await lostReply;
            await route.abort('failed');
          } catch (error) { rejectFirst(error); await route.abort('failed').catch(() => undefined); }
        });
        let firstCreated: { projectId: string };
        try {
          await dialog.locator('[data-studio-montage-submit="true"]').click();
          firstCreated = await firstCommitted;
          for (const control of await dialog.locator('input, select, button').all()) {
            await expect(control, 'Every visible creation control must preserve the in-flight command intent.').toBeDisabled();
          }
          await creator.page.keyboard.press('Escape');
          await expect(dialog).toBeVisible();
        } finally { releaseLostReply(); }
        await expect(dialog.locator('[data-studio-montage-error="true"][role="alert"]')).toBeVisible();
        await expect(dialog.locator('[data-studio-montage-submit="true"]')).toBeEnabled();
        const creation = creator.page.waitForResponse((response) => response.url() === montageEndpoint && response.request().method() === 'POST');
        void creation.catch(() => undefined);
        await dialog.locator('[data-studio-montage-submit="true"]').click();
        const response = await creation;
        assert.equal(response.status(), 200, (await response.text()).slice(0, 1000));
        const input = response.request().postDataJSON();
        assert.equal(attempts.length, 2);
        assert.deepEqual(attempts[0], attempts[1], 'Lost replies must retry the identical business payload and idempotency key.');
        assert.deepEqual(input.clips, STUDIO_CONNECTED_MONTAGE_INPUT.clips);
        assert.deepEqual(input.settings, STUDIO_CONNECTED_MONTAGE_INPUT.settings);
        assert.match(input.idempotencyKey, /^studio-ui-/u);
        const uiMontage = (await response.json()).montage;
        assert.equal(uiMontage.persisted, true);
        assert.notEqual(uiMontage.projectId, montage.projectId);
        assert.equal(uiMontage.projectId, firstCreated!.projectId);
        await expect(creator.page).toHaveURL(`${runtime.browserOrigin}${uiMontage.studioUrl}`);
        await expect(creator.page.locator('[data-timeline-item]')).toHaveCount(2);
        const uiReceipt = await runtime.database.pool.query('SELECT request_payload FROM studio_project_commands WHERE project_id=$1 AND user_id=$2', [uiMontage.projectId, STUDIO_FIXTURE_OWNERS[0]]);
        assert.deepEqual(uiReceipt.rows.map((row) => row.request_payload), [input]);
        const uiSequence = await runtime.database.pool.query('SELECT timeline_state FROM studio_sequences WHERE id=$1 AND project_id=$2', [uiMontage.sequenceId, uiMontage.projectId]);
        assert.deepEqual(uiSequence.rows[0].timeline_state.timelineItems.map((item: { montageSource: { assetId: string } }) => item.montageSource.assetId), [STUDIO_CONNECTED_ASSET_IDS.b, STUDIO_CONNECTED_ASSET_IDS.a]);
        assert.deepEqual(creator.errors, []);
        assert.equal((await runtime.database.pool.query('SELECT count(*)::int AS count FROM studio_project_commands')).rows[0].count, 2);
      } catch (error) {
        await creator.page.screenshot({ path: 'output/playwright/studio-connected/creation-failure.png', fullPage: true }).catch(() => undefined);
        t.diagnostic(`UI creation: ${JSON.stringify(creator.errors)}; runtime tail: ${runtime.readLogs().slice(-2000)}`);
        throw error;
      } finally { await creator.close(); }
    });
  } finally {
    try { await browserFixture?.close(); } finally { await runtime.close(); }
  }
});
