import { expect, test } from '@playwright/test';

const cases = [401, 503].flatMap((status) => [false, true].map((historical) => ({ status, historical })));
for (const { status, historical } of cases) {
  test(`${historical ? 'unmarked historical' : 'locally created'} legacy project remains escapable and recoverable after API ${status}`, async ({ page }) => {
    // This is the explicit local-draft UI, not evidence of server persistence.
    const writes: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/studio/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) writes.push(request.method());
    });
    await page.route('**/api/studio/**', (route) => route.fulfill({ status, json: { ok: false } }));
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
    const prompt = page.getByRole('textbox', { name: 'Prompt', exact: true });
    await prompt.fill(`Local edit survives ${status}`);
    await expect.poll(() => page.evaluate((id) => {
      const projects = JSON.parse(localStorage.getItem('maxvideoai.editor.projects.v1') ?? '[]');
      return Array.isArray(projects) && projects.some((project) => project.id === id);
    }, projectId)).toBe(true);
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
    const exit = page.locator('header').getByRole('button', { name: 'Projects', exact: true });
    await expect(exit, 'Known local projects must not remain trapped behind unresolved connected hydration.').toBeEnabled();
    const writesBeforeExit = writes.length;
    await exit.click();
    await expect(page).toHaveURL(/\/app\/studio\/projects$/);
    expect(writes.length, 'A local-only exit must not attempt a server writer while persistence mode is unavailable.').toBe(writesBeforeExit);
    await page.locator('[class*="projectCardMain"]').click();
    await expect(page).toHaveURL(projectUrl);
    await expect(page.locator('.react-flow__node')).toHaveCount(2);
    await expect(prompt).toHaveValue(`Local edit survives ${status}`);
    await expect(exit).toBeEnabled();
  });
}
