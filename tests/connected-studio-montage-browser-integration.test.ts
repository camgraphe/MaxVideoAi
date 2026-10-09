import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { expect } from '@playwright/test';
import { startStudioIntegrationRuntime } from './helpers/studio-integration-runtime';
import { startStudioConnectedBrowserFixture } from './helpers/studio-connected-browser-fixture';
import { STUDIO_FIXTURE_OWNERS } from './helpers/studio-auth-fixture';
import { initializeStudioConnectedFixture, STUDIO_CONNECTED_ASSET_IDS, STUDIO_CONNECTED_MONTAGE_INPUT } from './helpers/studio-connected-fixture-data';
import { postStudioMcpRequest, readStudioMcpResponse } from './helpers/studio-mcp-http-fixture';
import { STUDIO_PRIVATE_MEDIA_HOST, STUDIO_PRIVATE_MEDIA_KEYS, serveStudioPrivateMediaRequest, validateStudioPrivateMediaRequest } from './helpers/studio-private-storage-fixture';

test('MCP montage opens the current conversation with private playback, durable edits, export recovery and account isolation', { timeout: 300_000 }, async () => {
  const runtime = await startStudioIntegrationRuntime({
    revision: process.env.STUDIO_BROWSER_TEST_REVISION ?? process.env.STUDIO_INTEGRATION_REVISION,
    mcp: { studioMontageCreation: true }, privateStorage: true, conversation: true, conversationExports: true,
    initializeDatabase: async (database) => {
      await initializeStudioConnectedFixture(database);
      for (const name of ['00_create_profiles.sql', '01_legal_documents.sql', '02_user_consents.sql', '04_profiles_timestamps.sql', '12_app_settings.sql', '30_mcp_paid_generation.sql', '39_mcp_quote_lifetime.sql', '49_studio_generation_scope.sql', '50_studio_image_conversation.sql', '51_studio_image_model_usage.sql', '52_studio_conversation_runs.sql', '53_studio_media_generation_scope.sql']) {
        await database.pool.query(await readFile(`neon/migrations/${name}`, 'utf8'));
      }
      await database.pool.query('ALTER TABLE app_jobs ADD COLUMN status text');
      // Export history resolves both historical internal IDs and public IDs.
      // Match migration 16's production text ID, rather than the helper's UUID shortcut.
      await database.pool.query('ALTER TABLE media_assets ALTER COLUMN id TYPE text USING id::text');
      // A completed local artifact exercises read-only recovery and private delivery.
      // Rendering and billing are covered by the canonical worker integration lane.
      await database.pool.query(`CREATE TABLE app_timeline_exports (
        id text PRIMARY KEY, user_id text NOT NULL, idempotency_key text NOT NULL,
        project_name text NOT NULL, status text NOT NULL, progress integer NOT NULL,
        message text, duration_sec numeric NOT NULL, resolution text, fps integer,
        quality_preset text NOT NULL, amount_cents integer NOT NULL, currency text NOT NULL,
        billing_kind text NOT NULL, billing_status text NOT NULL, render_manifest jsonb NOT NULL,
        export_settings jsonb NOT NULL, output_url text, output_asset_id text, output_size_bytes bigint,
        output_mime_type text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    },
  });
  let browserFixture: Awaited<ReturnType<typeof startStudioConnectedBrowserFixture>> | undefined;
  let diagnose = async () => ({});
  try {
    const session = runtime.auth.createSession(STUDIO_FIXTURE_OWNERS[0], { clientId: 'studio-connected-browser-fixture' });
    const otherSession = runtime.auth.createSession(STUDIO_FIXTURE_OWNERS[1], { clientId: 'studio-connected-browser-fixture' });
    let requestId = 0;
    const mcp = (name: string, input: unknown, token = session.access_token) => postStudioMcpRequest(runtime, {
      jsonrpc: '2.0', id: ++requestId, method: 'tools/call', params: { name, arguments: input },
    }, { token }).then(readStudioMcpResponse);
    const created = await mcp('create_studio_montage', STUDIO_CONNECTED_MONTAGE_INPUT);
    assert.notEqual(created.result.isError, true, JSON.stringify(created.result));
    const montage = created.result.structuredContent;
    assert.equal(montage.persisted, true);
    assert.equal(montage.studioUrl, `/app/studio/conversation/${montage.projectId}`);
    assert.doesNotMatch(JSON.stringify(created.result), /X-Amz-|s3\.|media-assets\//u);
    const endpoint = `/api/studio/projects/${montage.projectId}`;
    const timelineEndpoint = `${runtime.browserOrigin}${endpoint}/conversation-timeline`;
    const exportId = `tlx_${'a'.repeat(64)}`;
    const exportMediaPath = `/api/studio/timeline-exports/${exportId}/media`;
    await runtime.database.pool.query(`INSERT INTO app_timeline_exports (
      id,user_id,idempotency_key,project_name,status,progress,message,duration_sec,resolution,fps,
      quality_preset,amount_cents,currency,billing_kind,billing_status,render_manifest,export_settings,
      output_url,output_asset_id,output_size_bytes,output_mime_type
    ) VALUES ($1,$2,'completed-local-artifact',$3,'completed',100,'Export ready.',4,'1080p',30,
      'standard',0,'USD','free','free_completed',$4::jsonb,'{}'::jsonb,$5,$6,NULL,'video/mp4')`, [
      exportId, STUDIO_FIXTURE_OWNERS[0], STUDIO_CONNECTED_MONTAGE_INPUT.title,
      JSON.stringify({ sequenceId: montage.sequenceId }),
      `https://${STUDIO_PRIVATE_MEDIA_HOST}/${STUDIO_PRIVATE_MEDIA_KEYS.b}`, '20000000-0000-4000-8000-000000000002',
    ]);
    const exportRecovery = await fetch(`${runtime.origin}${endpoint}/conversation-exports`, { headers: { Authorization: `Bearer ${session.access_token}` } });
    assert.equal(exportRecovery.status, 200, await exportRecovery.clone().text());
    assert.equal((await exportRecovery.json()).exports[0].artifact.outputUrl, exportMediaPath);
    const exportGrant = await fetch(`${runtime.origin}${exportMediaPath}`, { headers: { Authorization: `Bearer ${session.access_token}` }, redirect: 'manual' });
    assert.equal(exportGrant.status, 307);
    const exportLocation = exportGrant.headers.get('location')!;
    const exportValidation = await validateStudioPrivateMediaRequest({ url: exportLocation, method: 'GET' });
    assert.equal(exportValidation.ok, true, JSON.stringify({ validation: exportValidation, queryNames: [...new URL(exportLocation).searchParams.keys()] }));
    let expireNextPrivateRequest = false;
    browserFixture = await startStudioConnectedBrowserFixture({ runtime, signatureClock: () => {
      if (expireNextPrivateRequest) { expireNextPrivateRequest = false; return new Date(Date.now() + 3_600_000); }
      return new Date();
    } });
    const allErrors: string[] = [], retiredWrites: string[] = [];
    const timelineWrites: Array<{ expectedRevision: number; edit: { kind: string } }> = [];
    const renewalResponses = { timelinePreview: false, newPrivateAccess: false };
    const prepareFresh = async (browserSession = session, viewport = { width: 1440, height: 900 }) => {
      const owned = await browserFixture!.newContext(browserSession, { viewport, locale: 'en-US', colorScheme: 'light', reducedMotion: 'reduce' });
      assert.deepEqual((await owned.context.storageState()).origins, [], 'A fresh context has no Canvas drafts or previous media grants.');
      // Only unrelated account/consent readers are simulated. Studio persistence,
      // commands, ownership, export recovery, media grants and Auth remain real.
      const auxiliary = new Map<string, unknown>([
        ['/api/member-status', { tier: 'Member' }], ['/api/wallet', { balance: 42.5, balanceCents: 4250, currency: 'USD' }],
        ['/api/admin/access', { ok: false }], ['/api/legal/reconsent', { ok: true, needsReconsent: false, documents: [] }],
        ['/api/legal/cookies/version', { ok: true, version: 'studio-connected-browser', publishedAt: null }],
        ['/api/legal/cookies', { ok: true, version: 'studio-connected-browser' }],
      ]);
      for (const [path, json] of auxiliary) await owned.page.route(`${runtime.browserOrigin}${path}`, (route) => route.fulfill({ json }));
      await owned.page.route(`${runtime.browserOrigin}/api/preflight`, (route) => route.fulfill({ status: 503, json: { ok: false, error: 'GENERATION_NOT_PART_OF_PERSISTENCE_TEST' } }));
      owned.page.on('pageerror', (error) => allErrors.push(error.message));
      owned.page.on('request', (request) => {
        if (request.url() === timelineEndpoint && request.method() === 'POST') timelineWrites.push(request.postDataJSON());
        const path = new URL(request.url()).pathname;
        if (['PUT', 'PATCH', 'POST'].includes(request.method()) && /^\/api\/studio\/projects(?:\/[^/]+(?:\/sequences(?:\/[^/]+)?)?)?$/u.test(path)) retiredWrites.push(`${request.method()} ${path}`);
      });
      return owned;
    };
    const openFresh = async (oldUrl = false) => {
      const owned = await prepareFresh();
      await owned.page.goto(`${runtime.browserOrigin}${oldUrl ? `/app/studio/workspace/${montage.projectId}` : montage.studioUrl}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await expect(owned.page).toHaveURL(`${runtime.browserOrigin}${montage.studioUrl}`);
      await expect(owned.page.locator('[data-timeline-item]')).toHaveCount(2, { timeout: 45_000 });
      const cookies = owned.page.getByRole('button', { name: 'Reject all', exact: true });
      if (await cookies.isVisible()) await cookies.click();
      return owned;
    };
    const proof = async (name: string, page: Awaited<ReturnType<typeof openFresh>>['page']) => {
      if (!process.env.STUDIO_PROOF_DIRECTORY) return;
      await mkdir(process.env.STUDIO_PROOF_DIRECTORY, { recursive: true });
      await page.screenshot({ path: join(process.env.STUDIO_PROOF_DIRECTORY, `montage-${name}.png`) });
    };
    const first = await openFresh(true), page = first.page;
    diagnose = async () => {
      await proof('failure', page);
      return { alerts: await page.getByRole('alert').allTextContents(), timelineWrites, retiredWrites, renewalResponses, privateRequests: browserFixture!.readPrivateRequests(),
        videos: await page.locator('video').evaluateAll((elements) => elements.map((element) => {
          const video = element as HTMLVideoElement;
          return { id: video.dataset.playbackItemId, ready: video.readyState, time: video.currentTime, error: video.error?.code };
        })) };
    };
    await expect(page.locator('[data-timeline-item="montage-clip-01"]')).toHaveAttribute('data-timeline-start', '0');
    await expect(page.locator('[data-timeline-item="montage-clip-02"]')).toHaveAttribute('data-timeline-start', '2');
    await expect(page.getByLabel('Film monitor', { exact: true })).toHaveCount(0);
    assert.equal(timelineWrites.length, 0, 'Hydration must not create an edit or a competing revision.');
    await expect(page.getByRole('button', { name: 'Export film', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Select clip Pattern B', exact: true }).click();
    const firstVideo = page.locator('video[data-playback-item-id="montage-clip-01"]');
    await expect.poll(() => firstVideo.evaluate((element) => (element as HTMLVideoElement).readyState), { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
    await expect.poll(() => firstVideo.evaluate((element) => (element as HTMLVideoElement).currentTime)).toBeCloseTo(1, 1);
    const geometry = await firstVideo.evaluate((element) => {
      const frameElement = element.closest('[aria-label="Film monitor"]') as HTMLElement;
      const frame = frameElement.getBoundingClientRect(), video = element.getBoundingClientRect();
      return { sourceAspectRatio: (element as HTMLVideoElement).videoWidth / (element as HTMLVideoElement).videoHeight,
        frameAspectRatio: frameElement.clientWidth / frameElement.clientHeight, widthRatio: video.width / frame.width,
        heightRatio: video.height / frame.height, fit: getComputedStyle(element).objectFit };
    });
    assert.equal(geometry.fit, 'contain');
    assert.ok(Math.abs(geometry.sourceAspectRatio - 16 / 9) < 0.001);
    assert.ok(Math.abs(geometry.frameAspectRatio - 16 / 9) < 0.02);
    assert.ok(geometry.widthRatio >= 0.98 && geometry.widthRatio <= 1.02, JSON.stringify(geometry));
    assert.ok(geometry.heightRatio >= 0.98 && geometry.heightRatio <= 1.02, JSON.stringify(geometry));
    // Browser-only callback avoids esbuild's injected named-function helper.
    await page.evaluate(`(() => {
      const video = document.querySelector('video[data-playback-item-id="montage-clip-01"]');
      video.dataset.proofFrames = '0';
      const onFrame = (_now, metadata) => {
        video.dataset.proofFrames = String(Number(video.dataset.proofFrames) + 1);
        video.dataset.proofMediaTime = String(metadata.mediaTime);
        video.dataset.proofWidth = String(metadata.width); video.dataset.proofHeight = String(metadata.height);
        if (video.isConnected) video.requestVideoFrameCallback(onFrame);
      };
      video.requestVideoFrameCallback(onFrame);
    })()`);
    await page.getByRole('button', { name: 'Play film', exact: true }).click();
    await expect.poll(() => firstVideo.getAttribute('data-proof-frames').then(Number)).toBeGreaterThan(1);
    await expect.poll(() => firstVideo.getAttribute('data-proof-media-time').then(Number)).toBeGreaterThan(1.05);
    await expect(firstVideo).toHaveAttribute('data-proof-width', '320');
    await expect(firstVideo).toHaveAttribute('data-proof-height', '180');
    assert.equal(await firstVideo.evaluate((element) => (element as HTMLVideoElement).muted), false);
    assert.ok(await firstVideo.evaluate((element) => (element as HTMLVideoElement).volume) > 0);
    await expect.poll(() => firstVideo.evaluate((element) => (element as HTMLVideoElement & { webkitAudioDecodedByteCount?: number }).webkitAudioDecodedByteCount ?? 0)).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Pause film', exact: true }).click();
    await expect.poll(() => firstVideo.evaluate((element) => (element as HTMLVideoElement).paused)).toBe(true);
    const privateRequestCount = browserFixture.readPrivateRequests().length;
    const sourceTimeBeforeExpiry = await firstVideo.evaluate((element) => (element as HTMLVideoElement).currentTime);
    const oldSignedUrl = await firstVideo.evaluate((element) => (element as HTMLVideoElement).currentSrc);
    const originalResource = new URL(oldSignedUrl), signedTime = originalResource.searchParams.get('X-Amz-Date')!;
    const signedAt = Date.UTC(Number(signedTime.slice(0, 4)), Number(signedTime.slice(4, 6)) - 1, Number(signedTime.slice(6, 8)), Number(signedTime.slice(9, 11)), Number(signedTime.slice(11, 13)), Number(signedTime.slice(13, 15)));
    await expect.poll(() => Date.now() - signedAt).toBeGreaterThan(1100);
    const renewed = page.waitForResponse((response) => response.url() === `${timelineEndpoint}?preview=1` && response.status() === 200)
      .then((response) => { renewalResponses.timelinePreview = true; return response; });
    const newPrivateAccess = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.origin === originalResource.origin && url.pathname === originalResource.pathname && response.url() !== oldSignedUrl && [200, 206].includes(response.status());
    }).then((response) => { renewalResponses.newPrivateAccess = true; return response; });
    const renewalProof = Promise.all([renewed, newPrivateAccess]);
    void renewalProof.catch(() => undefined);
    expireNextPrivateRequest = true;
    await firstVideo.evaluate((element) => (element as HTMLVideoElement).load());
    await expect.poll(() => browserFixture!.readPrivateRequests().slice(privateRequestCount).some((entry) => entry.status === 403)).toBe(true);
    await renewalProof;
    await expect.poll(() => firstVideo.evaluate((element) => (element as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
    await expect.poll(() => firstVideo.evaluate((element) => (element as HTMLVideoElement).currentTime)).toBeCloseTo(sourceTimeBeforeExpiry, 1);
    assert.equal(await firstVideo.evaluate((element) => (element as HTMLVideoElement).paused), true);
    assert.ok(browserFixture.readPrivateRequests().slice(privateRequestCount).some((entry) => entry.status === 206 && entry.range !== null));
    await page.getByRole('button', { name: 'Select clip Pattern A', exact: true }).click();
    const secondVideo = page.locator('video[data-playback-item-id="montage-clip-02"]');
    await expect.poll(() => secondVideo.evaluate((element) => (element as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
    await expect.poll(() => secondVideo.evaluate((element) => (element as HTMLVideoElement).currentTime)).toBeCloseTo(0.5, 1);

    const stale = await openFresh();
    let releaseStaleReads = () => {};
    const staleReadGate = new Promise<void>((resolve) => { releaseStaleReads = resolve; });
    await stale.page.route(`${timelineEndpoint}?preview=1`, async (route) => { await staleReadGate; await route.continue(); });
    try {
      await page.getByRole('button', { name: 'Select clip Pattern B', exact: true }).click();
      await page.getByLabel('Clip duration in seconds', { exact: true }).fill('1');
      await page.getByLabel('Clip duration in seconds', { exact: true }).press('Tab');
      await expect(page.getByLabel('Film timeline', { exact: true })).toHaveAttribute('data-revision', '1');
      await expect(page.locator('[data-timeline-item="montage-clip-02"]')).toHaveAttribute('data-timeline-start', '1');
      await stale.page.getByRole('button', { name: 'Select clip Pattern B', exact: true }).click();
      const conflict = stale.page.waitForResponse((response) => response.url() === timelineEndpoint && response.request().method() === 'POST' && response.status() === 409);
      void conflict.catch(() => undefined);
      await stale.page.getByLabel('Audio volume', { exact: true }).press('Home');
      await conflict;
      releaseStaleReads();
      await expect(stale.page.getByLabel('Film timeline', { exact: true }).getByRole('alert')).toContainText('The film changed.');
      await expect(stale.page.getByLabel('Film timeline', { exact: true })).toHaveAttribute('data-revision', '1');
      // The failed command remains in the inspector until explicitly retried;
      // the canonical timeline has refreshed to the winning revision.
      await expect(stale.page.getByLabel('Audio volume', { exact: true })).toHaveValue('0');
      await stale.page.getByLabel('Audio volume', { exact: true }).press('Home');
      await expect(stale.page.getByLabel('Film timeline', { exact: true })).toHaveAttribute('data-revision', '2');
      await expect(stale.page.getByLabel('Audio volume', { exact: true })).toHaveValue('0');
    } finally { releaseStaleReads(); await stale.close(); }

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel('Film timeline', { exact: true })).toHaveAttribute('data-revision', '2');
    await page.getByRole('button', { name: 'Select clip Pattern A', exact: true }).click();
    let refusedWrite = false;
    await page.route(timelineEndpoint, async (route) => {
      assert.equal(route.request().method(), 'POST');
      if (!refusedWrite) { refusedWrite = true; return route.fulfill({ status: 503, json: { ok: false, error: 'STUDIO_TIMELINE_EDIT_FAILED' } }); }
      return route.continue();
    });
    await page.getByLabel('Clip duration in seconds', { exact: true }).fill('1');
    await page.getByLabel('Clip duration in seconds', { exact: true }).press('Tab');
    await expect(page.getByLabel('Film timeline', { exact: true }).getByRole('alert')).toHaveText('STUDIO_TIMELINE_EDIT_FAILED');
    await expect(page.getByLabel('Clip duration in seconds', { exact: true })).toHaveValue('1');
    await expect(page.locator('[data-timeline-item="montage-clip-02"]')).toHaveAttribute('data-timeline-duration', '2');
    assert.equal(Number((await runtime.database.pool.query('SELECT revision FROM studio_projects WHERE id=$1', [montage.projectId])).rows[0].revision), 2);
    await page.getByLabel('Clip duration in seconds', { exact: true }).fill('1');
    await page.getByLabel('Clip duration in seconds', { exact: true }).press('Tab');
    await expect(page.getByLabel('Film timeline', { exact: true })).toHaveAttribute('data-revision', '3');
    await page.unroute(timelineEndpoint);
    const clipBounds = await page.getByRole('button', { name: 'Select clip Pattern A', exact: true }).boundingBox();
    assert.ok(clipBounds);
    const grip = { x: clipBounds.x + clipBounds.width / 2, y: clipBounds.y + clipBounds.height / 2 };
    await page.mouse.move(grip.x, grip.y);
    await page.mouse.down();
    await page.mouse.move(grip.x + 68, grip.y, { steps: 4 });
    await page.mouse.up();
    await expect(page.getByLabel('Film timeline', { exact: true })).toHaveAttribute('data-revision', '4');
    const replay = await mcp('create_studio_montage', STUDIO_CONNECTED_MONTAGE_INPUT);
    assert.notEqual(replay.result.isError, true);
    assert.equal(replay.result.structuredContent.projectId, montage.projectId);
    assert.equal(replay.result.structuredContent.revision, 4, 'Replaying the original MCP receipt must preserve the current browser edits.');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-timeline-item="montage-clip-02"]')).toHaveAttribute('data-timeline-start', '3');
    await expect(page.locator('[data-timeline-item="montage-clip-01"]')).toHaveAttribute('data-timeline-duration', '1');
    await expect(page.locator('[data-timeline-item="montage-clip-02"]')).toHaveAttribute('data-timeline-duration', '1');
    const durable = await runtime.database.pool.query(`SELECT p.workspace_state,s.timeline_state FROM studio_projects p JOIN studio_sequences s ON s.project_id=p.id WHERE p.id=$1`, [montage.projectId]);
    assert.deepEqual(durable.rows[0].workspace_state.nodes, []);
    assert.deepEqual(durable.rows[0].workspace_state.edges, []);
    assert.equal(durable.rows[0].timeline_state.timelineItems[0].audioMix.volume, 0);
    assert.doesNotMatch(JSON.stringify(durable.rows), /X-Amz-Signature/u);
    assert.equal(await page.evaluate(() => Object.keys(localStorage).some((key) => /X-Amz-Signature|mediaAccessUrl/u.test(localStorage.getItem(key) ?? ''))), false);
    await proof('saved-current-timeline', page);

    // A timeline occurrence continues authorizing playback after a bin-only edit.
    const aggregateResponse = await fetch(`${runtime.origin}${endpoint}/workspace`, { headers: { Authorization: `Bearer ${session.access_token}` } });
    assert.equal(aggregateResponse.status, 200);
    const aggregate = await aggregateResponse.json();
    const snapshot = { name: aggregate.project.name, canvasTemplateId: aggregate.project.canvasTemplateId, settings: aggregate.project.settings,
      workspaceState: { ...aggregate.project.workspaceState,
        projectAssets: aggregate.project.workspaceState.projectAssets.filter((asset: { ref: { assetId: string } }) => asset.ref.assetId !== STUDIO_CONNECTED_ASSET_IDS.b),
        sequences: aggregate.sequences.map((sequence: { id: string; name: string; settings: unknown; timelineState: unknown }) => ({ id: sequence.id, name: sequence.name, projectSettings: sequence.settings, ...sequence.timelineState as object })),
      } };
    const binSave = await fetch(`${runtime.origin}${endpoint}/workspace`, { method: 'PUT', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedRevision: 4, snapshot }) });
    assert.equal(binSave.status, 200, await binSave.clone().text());
    assert.equal((await binSave.json()).revision, 5);
    const privateBeforeBinReload = browserFixture!.readPrivateRequests().length;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel('Film timeline', { exact: true })).toHaveAttribute('data-revision', '5');
    await page.getByRole('button', { name: 'Select clip Pattern B', exact: true }).click();
    await expect.poll(() => firstVideo.evaluate((element) => (element as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
    const retainedSource = await firstVideo.evaluate((element) => {
      const url = new URL((element as HTMLVideoElement).currentSrc);
      return `${url.origin}${url.pathname}`;
    });
    assert.ok(retainedSource.endsWith('/' + STUDIO_PRIVATE_MEDIA_KEYS.b), 'Playback must keep B after its bin entry is removed.');
    assert.ok(browserFixture!.readPrivateRequests().slice(privateBeforeBinReload).some((entry) => entry.url === retainedSource && entry.status === 206));

    const renderCard = page.getByRole('article', { name: 'Film render', exact: true });
    await expect(renderCard).toHaveCount(1);
    await expect(renderCard).toContainText('Your film is ready.');
    await expect(renderCard.getByRole('link', { name: 'Open original', exact: true })).toHaveAttribute('href', exportMediaPath);
    const exportDeliveries: Array<{ status: number; range: string | null }> = [];
    // Playwright routes only the first URL in a redirect chain. Follow this real
    // owned 307 locally, validating its grant before serving the offline bucket
    // bytes. This preserves the canonical route and avoids contacting fake S3.
    await page.route(`${runtime.browserOrigin}${exportMediaPath}`, async (route) => {
      const response = await route.fetch({ maxRedirects: 0 });
      assert.equal(response.status(), 307);
      assert.equal(response.headers()['cache-control'], 'private, no-store');
      const location = response.headers().location;
      const validation = await validateStudioPrivateMediaRequest({ url: location, method: route.request().method() });
      assert.equal(validation.ok, true);
      if (validation.ok) assert.equal(validation.key, STUDIO_PRIVATE_MEDIA_KEYS.b);
      assert.equal(new URL(location).searchParams.get('X-Amz-Expires'), '300');
      const range = route.request().headers().range ?? null;
      const media = await serveStudioPrivateMediaRequest({ url: location, method: route.request().method(), range });
      assert.ok(media.status === 200 || media.status === 206);
      exportDeliveries.push({ status: media.status, range });
      await route.fulfill({ status: media.status, headers: media.headers, body: media.body });
    });
    const renderedVideo = renderCard.getByLabel('Generated video', { exact: true });
    await renderedVideo.evaluate((element) => (element as HTMLVideoElement).play());
    await expect.poll(() => renderedVideo.evaluate((element) => (element as HTMLVideoElement).videoWidth)).toBe(320);
    await expect.poll(() => renderedVideo.evaluate((element) => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(0.05);
    await renderedVideo.evaluate((element) => (element as HTMLVideoElement).pause());
    assert.ok(exportDeliveries.some((delivery) => delivery.status === 206 && delivery.range !== null));
    assert.equal((await runtime.database.pool.query('SELECT count(*)::int AS count FROM app_timeline_exports')).rows[0].count, 1, 'Recovery and playback never requeue a render or change its billing.');
    assert.equal((await runtime.database.pool.query('SELECT billing_status FROM app_timeline_exports WHERE id=$1', [exportId])).rows[0].billing_status, 'free_completed');

    const other = await prepareFresh(otherSession);
    try {
      const foreignPage = await other.page.goto(`${runtime.browserOrigin}${montage.studioUrl}`, { waitUntil: 'domcontentloaded' });
      assert.equal(foreignPage?.status(), 404);
      await expect(other.page.locator('[data-timeline-item]')).toHaveCount(0);
      const foreignRead = await other.page.request.get(timelineEndpoint+'?preview=1');
      assert.equal(foreignRead.status(), 404);
      assert.doesNotMatch(await foreignRead.text(), /X-Amz-|Pattern B|Pattern A/u);
      assert.equal((await other.page.request.get(`${runtime.browserOrigin}${exportMediaPath}`, { maxRedirects: 0 })).status(), 404);
      const foreignHistory = await other.page.request.get(`${runtime.browserOrigin}${endpoint}/conversation-exports`);
      assert.equal(foreignHistory.status(), 200);
      assert.deepEqual(await foreignHistory.json(), { ok: true, exports: [] });
      const foreignMontage = await mcp('create_studio_montage', STUDIO_CONNECTED_MONTAGE_INPUT, otherSession.access_token);
      assert.equal(foreignMontage.result.isError, true);
      assert.equal(foreignMontage.result.structuredContent.error.code, 'REFERENCE_NOT_FOUND');
      assert.equal(Number((await runtime.database.pool.query('SELECT revision FROM studio_projects WHERE id=$1', [montage.projectId])).rows[0].revision), 5);
    } finally { await other.close(); }

    // The current mobile picker recovers one committed project after a lost acknowledgement.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Projects', exact: true }).click();
    const projects = page.getByRole('dialog', { name: 'Your projects', exact: true });
    await expect(projects.locator('[data-project-row]')).toHaveCount(1);
    await expect(projects.locator('[data-project-row]')).toHaveAttribute('href', montage.studioUrl);
    await expect(projects.getByRole('button', { name: 'Canvas', exact: true })).toHaveCount(0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
    const createAttempts: Array<{ name: string; idempotencyKey: string }> = [];
    let newProjectId = '';
    await page.route(`${runtime.browserOrigin}/api/studio/conversation-projects`, async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      createAttempts.push(route.request().postDataJSON());
      const response = await route.fetch();
      assert.equal(response.status(), 200);
      const body = await response.json();
      newProjectId = body.result.projectId;
      if (createAttempts.length === 1) return route.abort('failed');
      return route.fulfill({ response });
    });
    await projects.getByRole('button', { name: 'New conversation', exact: true }).click();
    await expect(projects.getByRole('alert')).toContainText('Try again to recover the same project.');
    await projects.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(page).toHaveURL(`${runtime.browserOrigin}/app/studio/conversation/${newProjectId}`);
    await expect(page.getByRole('heading', { name: 'What shall we create?', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Message Studio', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open timeline', exact: true })).toBeVisible();
    assert.equal(createAttempts.length, 2);
    assert.deepEqual(createAttempts[0], createAttempts[1]);
    const receipt = await runtime.database.pool.query('SELECT project_id FROM studio_project_commands WHERE user_id=$1 AND idempotency_key=$2', [STUDIO_FIXTURE_OWNERS[0], createAttempts[0].idempotencyKey]);
    assert.deepEqual(receipt.rows, [{ project_id: newProjectId }]);
    const empty = await runtime.database.pool.query('SELECT user_id,persistence_mode,revision FROM studio_projects WHERE id=$1', [newProjectId]);
    assert.deepEqual(empty.rows, [{ user_id: STUDIO_FIXTURE_OWNERS[0], persistence_mode: 'connected', revision: '0' }]);
    await proof('mobile-new-conversation', page);
    assert.deepEqual(retiredWrites, [], 'Current UI must never call retired Canvas mutations.');
    assert.deepEqual(allErrors, []);
    assert.ok(browserFixture.readPrivateRequests().some((entry) => entry.status === 206 && entry.range !== null));
    assert.equal((await runtime.database.pool.query('SELECT count(*)::int AS count FROM studio_projects')).rows[0].count, 2);
    assert.equal((await runtime.database.pool.query("SELECT count(*)::int AS count FROM studio_project_commands WHERE command_kind='create_studio_montage'")).rows[0].count, 1);
    await first.close();
  } catch (error) {
    throw new Error(`${String(error)}\n${JSON.stringify(await diagnose())}\n${runtime.readLogs().slice(-4000)}`, { cause: error });
  } finally { await browserFixture?.close(); await runtime.close(); }
});
