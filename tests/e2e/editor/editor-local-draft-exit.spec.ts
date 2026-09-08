import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Only this owned test context receives a non-authenticating session hint so
  // the real client executes the explicitly mocked API instead of its no-hint shortcut.
  await page.addInitScript(() => sessionStorage.setItem('last-known:user-id', 'studio-local-draft-fixture'));
});

const cases = [
  ...[401, 503].flatMap((status) => [false, true].map((historical) => ({ status, historical, serverReturns: false }))),
  { status: 401, historical: false, serverReturns: true },
];
for (const { status, historical, serverReturns } of cases) {
  test(`${historical ? 'unmarked historical' : 'locally created'} legacy project remains escapable and recoverable after API ${status}${serverReturns ? ' and a healthy full server returns' : ''}`, async ({ page }) => {
    // This is the explicit local-draft UI, not evidence of server persistence.
    const writes: string[] = [];
    const responses: Array<{ path: string; status: number }> = [];
    page.on('response', (response) => {
      const path = new URL(response.url()).pathname;
      if (path.startsWith('/api/studio/')) responses.push({ path, status: response.status() });
    });
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/studio/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) writes.push(request.method());
    });
    let online = false;
    let serverProjects: Array<Record<string, unknown>> = [];
    await page.route('**/api/studio/**', (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (online && route.request().method() === 'GET') {
        return pathname === '/api/studio/projects'
          ? route.fulfill({ json: { ok: true, projects: serverProjects } })
          : route.fulfill({ status: 404, json: { ok: false, error: 'Not found' } });
      }
      return route.fulfill({ status, json: { ok: false } });
    });
    await page.route('**/api/member-status', (route) => route.fulfill({ json: { tier: 'Member' } }));
    await page.route('**/api/wallet', (route) => route.fulfill({ json: { balance: 42.5, currency: 'USD' } }));
    await page.route('**/api/admin/access', (route) => route.fulfill({ json: { ok: false } }));
    await page.route('**/api/legal/cookies/version', (route) => route.fulfill({ json: { ok: true, version: 'studio-local-fixture', publishedAt: null } }));
    await page.route('**/api/legal/cookies', (route) => route.fulfill({ json: { ok: true } }));
    await page.goto('/app/studio/projects', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Reject all', exact: true }).click();
    await page.getByRole('button', { name: /Blank project/ }).click();
    await expect(page).toHaveURL(/\/app\/studio\/workspace\/project_/);
    const projectUrl = page.url();
    const projectId = new URL(projectUrl).pathname.split('/').at(-1)!;
    await expect(page.locator('.react-flow__node')).toHaveCount(2);
    await expect.poll(() => responses.some((response) => response.path === `/api/studio/projects/${projectId}` && response.status === status), 'The controlled API failure must actually reach the hydration consumer.').toBe(true);
    const prompt = page.getByRole('textbox', { name: 'Prompt', exact: true });
    await prompt.fill(`Local edit survives ${status}`);
    await expect.poll(() => page.evaluate((id) => {
      const projects = JSON.parse(localStorage.getItem('maxvideoai.editor.projects.v1') ?? '[]');
      return Array.isArray(projects) && projects.some((project) => project.id === id);
    }, projectId)).toBe(true);
    const localProject = await page.evaluate((id) => JSON.parse(localStorage.getItem('maxvideoai.editor.projects.v1') ?? '[]').find((project) => project.id === id), projectId);
    if (historical) {
      // Recreate the exact pre-marker record shape from this context's own UI data.
      // Keep the actual user-edited workspace snapshot and reload it unchanged.
      await page.evaluate((id) => {
        const projects = JSON.parse(localStorage.getItem('maxvideoai.editor.projects.v1') ?? '[]');
        localStorage.setItem('maxvideoai.editor.projects.v1', JSON.stringify(projects.map((project) => project.id !== id ? project : {
          id: project.id, name: project.name, createdAt: project.createdAt, updatedAt: project.updatedAt,
          settings: project.settings, canvasTemplateId: project.canvasTemplateId,
        })));
      }, projectId);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(prompt).toHaveValue(`Local edit survives ${status}`);
    }
    if (serverReturns) {
      serverProjects = Array.from({ length: 40 }, (_, index) => ({
        ...localProject, id: `server-project-${index + 1}`, name: `Server project ${index + 1}`, persistenceMode: 'legacy',
      }));
      online = true;
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('.react-flow__node')).toHaveCount(2);
      await expect(prompt).toHaveValue(`Local edit survives ${status}`);
      await expect.poll(() => responses.some((response) => response.path === `/api/studio/projects/${projectId}` && response.status === 404)).toBe(true);
    }
    const exit = page.locator('header').getByRole('button', { name: 'Projects', exact: true });
    await expect(exit, 'Known local projects must not remain trapped behind unresolved connected hydration.').toBeEnabled();
    const writesBeforeExit = writes.length;
    await exit.click();
    await expect(page).toHaveURL(/\/app\/studio\/projects$/);
    expect(writes.length, 'A local-only exit must not attempt a server writer while persistence mode is unavailable.').toBe(writesBeforeExit);
    if (serverReturns) await expect(page.locator('[class*="projectCardMain"]'), 'All 40 server projects and the unmatched local project must remain reachable.').toHaveCount(41);
    await page.locator('[class*="projectCardMain"]').filter({ hasText: localProject.name }).click();
    await expect(page).toHaveURL(projectUrl);
    await expect(page.locator('.react-flow__node')).toHaveCount(2);
    await expect(prompt).toHaveValue(`Local edit survives ${status}`);
    await expect(exit).toBeEnabled();
  });
}

test('a delayed server listing preserves a local project created after that listing began', async ({ page }) => {
  let releaseListing!: () => void;
  let releaseCreation!: () => void;
  let markListingStarted!: () => void;
  let markCreationStarted!: () => void;
  const listingGate = new Promise<void>((resolve) => { releaseListing = resolve; });
  const creationGate = new Promise<void>((resolve) => { releaseCreation = resolve; });
  const listingStarted = new Promise<void>((resolve) => { markListingStarted = resolve; });
  const creationStarted = new Promise<void>((resolve) => { markCreationStarted = resolve; });
  let listings = 0;
  let serverProjects: Array<Record<string, unknown>> = [];
  await page.route('**/api/member-status', (route) => route.fulfill({ json: { tier: 'Member' } }));
  await page.route('**/api/wallet', (route) => route.fulfill({ json: { balance: 42.5, currency: 'USD' } }));
  await page.route('**/api/admin/access', (route) => route.fulfill({ json: { ok: false } }));
  await page.route('**/api/legal/cookies/version', (route) => route.fulfill({ json: { ok: true, version: 'studio-local-fixture', publishedAt: null } }));
  await page.route('**/api/legal/cookies', (route) => route.fulfill({ json: { ok: true } }));
  await page.route('**/api/studio/**', async (route) => {
    const collection = new URL(route.request().url()).pathname === '/api/studio/projects';
    if (collection && route.request().method() === 'GET') {
      listings += 1;
      if (listings === 1) { markListingStarted(); await listingGate; }
      await route.fulfill({ json: { ok: true, projects: serverProjects } });
    } else if (collection && route.request().method() === 'POST') {
      markCreationStarted();
      await creationGate;
      await route.fulfill({ status: 503, json: { ok: false } });
    } else await route.fulfill({ status: 404, json: { ok: false } });
  });
  try {
    await page.goto('/app/studio/projects', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Reject all', exact: true }).click();
    await listingStarted;
    await page.getByRole('button', { name: /Blank project/ }).click();
    await creationStarted;
    const localProject = await page.evaluate(() => JSON.parse(localStorage.getItem('maxvideoai.editor.projects.v1') ?? '[]').find((project) => project.persistenceMode === 'local-only'));
    expect(localProject?.id).toBeTruthy();
    serverProjects = Array.from({ length: 40 }, (_, index) => ({
      ...localProject, id: `existing-server-${index + 1}`, name: `Existing server ${index + 1}`, persistenceMode: 'legacy',
    }));
    releaseListing();
    await expect(page.locator('[class*="projectCardMain"]'), 'The completed listing must reconcile against the newly created local record, not the pre-request snapshot.').toHaveCount(41);
    await expect.poll(() => page.evaluate((id) => JSON.parse(localStorage.getItem('maxvideoai.editor.projects.v1') ?? '[]').some((project) => project.id === id), localProject.id)).toBe(true);
    releaseCreation();
    await expect(page).toHaveURL(new RegExp(`/app/studio/workspace/${localProject.id}$`));
    await expect(page.locator('.react-flow__node')).toHaveCount(2);
    await page.locator('header').getByRole('button', { name: 'Projects', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/studio\/projects$/);
    await expect(page.locator('[class*="projectCardMain"]')).toHaveCount(41);
    await page.locator('[class*="projectCardMain"]').filter({ hasText: localProject.name }).click();
    await expect(page).toHaveURL(new RegExp(`/app/studio/workspace/${localProject.id}$`));
    await expect(page.locator('.react-flow__node')).toHaveCount(2);
  } finally {
    releaseListing();
    releaseCreation();
  }
});
