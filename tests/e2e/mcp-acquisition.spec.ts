import { expect, test, type Browser, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

type FixtureMode = 'enabled' | 'preview' | 'gated';
type Theme = 'light' | 'dark';

const fixtureMode = (process.env.MCP_E2E_MODE ?? 'gated') as FixtureMode;
const baseURL = process.env.MCP_E2E_BASE_URL ?? 'http://127.0.0.1:62460';
const artifactDir = resolve(process.env.MCP_E2E_ARTIFACT_DIR ?? 'output/playwright/mcp-acquisition');

test.use({ baseURL });
test.describe.configure({ mode: 'serial' });

const marketingOwners = [
  '/mcp',
  '/integrations/claude',
  '/integrations/codex',
] as const;

const localizedOwners = [
  { path: '/mcp', canonical: 'https://maxvideoai.com/mcp', locale: 'en' },
  { path: '/fr/mcp', canonical: 'https://maxvideoai.com/fr/mcp', locale: 'fr' },
  { path: '/es/mcp', canonical: 'https://maxvideoai.com/es/mcp', locale: 'es' },
  {
    path: '/integrations/claude',
    canonical: 'https://maxvideoai.com/integrations/claude',
    locale: 'en',
  },
  {
    path: '/fr/integrations/claude',
    canonical: 'https://maxvideoai.com/fr/integrations/claude',
    locale: 'fr',
  },
  {
    path: '/es/integraciones/claude',
    canonical: 'https://maxvideoai.com/es/integraciones/claude',
    locale: 'es',
  },
  {
    path: '/integrations/codex',
    canonical: 'https://maxvideoai.com/integrations/codex',
    locale: 'en',
  },
  {
    path: '/fr/integrations/codex',
    canonical: 'https://maxvideoai.com/fr/integrations/codex',
    locale: 'fr',
  },
  {
    path: '/es/integraciones/codex',
    canonical: 'https://maxvideoai.com/es/integraciones/codex',
    locale: 'es',
  },
  { path: '/docs/mcp', canonical: 'https://maxvideoai.com/docs/mcp', locale: 'en' },
  { path: '/fr/docs/mcp', canonical: 'https://maxvideoai.com/fr/docs/mcp', locale: 'fr' },
  { path: '/es/docs/mcp', canonical: 'https://maxvideoai.com/es/docs/mcp', locale: 'es' },
] as const;

function onlyMode(mode: FixtureMode) {
  test.skip(fixtureMode !== mode, `requires the isolated ${mode} MCP fixture`);
}

async function newThemedPage(
  browser: Browser,
  options: { theme: Theme; viewport: { width: number; height: number }; javaScriptEnabled?: boolean },
) {
  const context = await browser.newContext({
    baseURL,
    viewport: options.viewport,
    colorScheme: options.theme,
    javaScriptEnabled: options.javaScriptEnabled ?? true,
  });
  await context.addInitScript((theme: Theme) => {
    try {
      window.localStorage.setItem('mv-theme', theme);
    } catch {
      // about:blank has an opaque origin before the first fixture navigation.
    }
    if (theme === 'dark') document.documentElement?.setAttribute('data-theme', 'dark');
    else document.documentElement?.removeAttribute('data-theme');
  }, options.theme);
  return { context, page: await context.newPage() };
}

async function expectNoFakeProof(page: Page) {
  await expect(page.locator('video')).toHaveCount(0);
  await expect(page.getByText(/Real MaxVideoAI output|Generated through MCP/i)).toHaveCount(0);
}

async function dismissCookieBanner(page: Page) {
  const reject = page.getByRole('button', { name: 'Reject all' });
  const appeared = await reject.waitFor({ state: 'visible', timeout: 2_000 }).then(() => true).catch(() => false);
  if (appeared) {
    await reject.click();
    await expect(reject).toBeHidden();
  }
}

test('checked-in gated build returns noindex 404s and emits no MCP discovery entries', async ({ page, request }) => {
  onlyMode('gated');

  for (const path of localizedOwners.map(({ path }) => path)) {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), path).toBe(404);
    const robotValues = await page.locator('meta[name="robots"]').evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('content') ?? ''),
    );
    expect(robotValues.length, path).toBeGreaterThan(0);
    expect(robotValues.every((value) => /noindex/i.test(value)), path).toBeTruthy();
  }

  for (const discoveryPath of ['/sitemap-en.xml', '/sitemap-fr.xml', '/sitemap-es.xml', '/llms.txt']) {
    const response = await request.get(discoveryPath);
    expect(response.ok(), discoveryPath).toBeTruthy();
    expect(await response.text()).not.toMatch(/(?:\/mcp|integrations\/(?:claude|codex)|integraciones\/(?:claude|codex))/i);
  }
});

test('renderable preview is noindex and hides trial, paid budget cards, and proof', async ({ page }) => {
  onlyMode('preview');

  const response = await page.goto('/mcp', { waitUntil: 'load' });
  expect(response?.status()).toBe(200);
  await dismissCookieBanner(page);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/i);
  await expect(page.getByText('FIRST VIDEO INCLUDED')).toHaveCount(0);
  await expect(page.locator('[data-budget-slot]')).toHaveCount(0);
  await expectNoFakeProof(page);
  mkdirSync(artifactDir, { recursive: true });
  await page.screenshot({ path: resolve(artifactDir, 'preview-no-trial-no-paid-light-1440x1000.png') });
});

test('enabled fixture captures MCP, Claude, and Codex at desktop/mobile in light/dark', async ({ browser }) => {
  onlyMode('enabled');
  test.setTimeout(120_000);
  mkdirSync(artifactDir, { recursive: true });

  const viewports = [
    { name: 'desktop', width: 1440, height: 1000 },
    { name: 'mobile', width: 390, height: 844 },
  ] as const;

  for (const viewport of viewports) {
    for (const theme of ['light', 'dark'] as const) {
      const { context, page } = await newThemedPage(browser, { theme, viewport });
      try {
        for (const path of marketingOwners) {
          const response = await page.goto(path, { waitUntil: 'load' });
          expect(response?.status(), path).toBe(200);
          await dismissCookieBanner(page);
          await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
          if (theme === 'dark') await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
          else await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
          await expectNoFakeProof(page);
          const slug = path === '/mcp' ? 'mcp' : path.endsWith('claude') ? 'claude' : 'codex';
          await page.screenshot({
            path: resolve(artifactDir, `${slug}-${viewport.name}-${theme}-${viewport.width}x${viewport.height}.png`),
            animations: 'disabled',
          });
        }
      } finally {
        await context.close();
      }
    }
  }
});

test('landing presents equal official client actions and honest budget-first content', async ({ page }) => {
  onlyMode('enabled');
  await page.goto('/mcp', { waitUntil: 'load' });

  await expect(page.getByRole('heading', {
    level: 1,
    name: 'Turn your brief into the right model, prompt and budget.',
  })).toBeVisible();
  await expect(page.getByText('PRICE BEFORE YOU GENERATE')).toBeVisible();
  await expect(page.getByText('FIRST VIDEO INCLUDED')).toBeVisible();
  await expect(page.locator('[data-budget-slot="included_trial"]')).toBeVisible();
  await expect(page.locator('[data-budget-slot="lowest_paid"]')).toBeVisible();
  await expect(page.locator('[data-budget-slot="affordable_upgrade"]')).toBeVisible();
  await expectNoFakeProof(page);

  const claude = page.locator('main [data-client="claude"]').first();
  const codex = page.locator('main [data-client="codex"]').first();
  const [claudeBox, codexBox] = await Promise.all([claude.boundingBox(), codex.boundingBox()]);
  expect(claudeBox).not.toBeNull();
  expect(codexBox).not.toBeNull();
  expect(Math.abs(claudeBox!.width - codexBox!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(claudeBox!.height - codexBox!.height)).toBeLessThanOrEqual(1);

  const [claudeMark, codexMark] = await Promise.all([
    claude.locator('img:visible').boundingBox(),
    codex.locator('img:visible').boundingBox(),
  ]);
  expect(claudeMark).not.toBeNull();
  expect(codexMark).not.toBeNull();
  expect(Math.abs(claudeMark!.width - codexMark!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(claudeMark!.height - codexMark!.height)).toBeLessThanOrEqual(1);
});

test('Claude and Codex actions support keyboard focus and activation', async ({ page }) => {
  onlyMode('enabled');
  await page.route('**/api/mcp/acquisition', (route) => route.fulfill({ status: 204 }));

  await page.goto('/mcp', { waitUntil: 'load' });
  const claude = page.locator('main [data-client="claude"]').first();
  await claude.focus();
  await expect(claude).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/integrations\/claude$/);

  await page.goto('/mcp', { waitUntil: 'load' });
  const codex = page.locator('main [data-client="codex"]').first();
  await codex.focus();
  await expect(codex).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/integrations\/codex$/);
});

test('EN, FR, and ES intent owners remain server-readable with JavaScript disabled', async ({ browser }) => {
  onlyMode('enabled');
  const { context, page } = await newThemedPage(browser, {
    theme: 'light',
    viewport: { width: 1280, height: 900 },
    javaScriptEnabled: false,
  });

  try {
    for (const owner of localizedOwners) {
      const response = await page.goto(owner.path, { waitUntil: 'domcontentloaded' });
      expect(response?.status(), owner.path).toBe(200);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', owner.locale);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', owner.canonical);
      await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(1);
      await expect(page.locator('link[rel="alternate"][hreflang="fr"]')).toHaveCount(1);
      await expect(page.locator('link[rel="alternate"][hreflang="es"]')).toHaveCount(1);
      await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(1);
      await expect(page.locator('script[type="application/ld+json"]')).not.toHaveCount(0);
      expect(await page.locator('a[href]').count(), owner.path).toBeGreaterThan(2);
      await expect(page.locator('input[type="password"]')).toHaveCount(0);
    }
  } finally {
    await context.close();
  }
});

test('protocol and discovery responses stay private and absent from public discovery', async ({ page, request }) => {
  onlyMode('enabled');

  const apiHostHeaders = { Host: 'api.maxvideoai.com' };
  const protocol = await request.get('/api/mcp', { headers: apiHostHeaders });
  expect(protocol.status()).toBe(401);
  expect(protocol.headers()['cache-control']).toBe('private, no-store');
  expect(protocol.headers()['x-robots-tag']).toBe('noindex, nofollow');

  const protectedResource = await request.get('/.well-known/oauth-protected-resource/mcp', {
    headers: apiHostHeaders,
  });
  expect([200, 503]).toContain(protectedResource.status());
  expect(protectedResource.headers()['x-robots-tag']).toBe('noindex, nofollow');
  if (protectedResource.status() === 503) {
    expect(protectedResource.headers()['cache-control']).toBe('private, no-store');
  }

  const consent = await page.goto('/oauth/consent', { waitUntil: 'domcontentloaded' });
  expect(consent?.status()).toBe(200);
  expect(consent?.headers()['x-robots-tag']).toMatch(/noindex/i);
  expect(consent?.headers()['cache-control']).toContain('private');

  const wallet = await request.get('/api/wallet');
  expect(wallet.status()).toBe(401);
  expect(wallet.headers()['cache-control']).toBe('private, no-store');

  const upload = await request.post('/api/uploads/image', { multipart: {} });
  expect(upload.status()).toBe(400);

  const robots = await request.get('/robots.txt');
  const robotsText = await robots.text();
  for (const privatePath of ['/api/', '/oauth', '/account', '/uploads', '/library']) {
    expect(robotsText).toContain(`Disallow: ${privatePath}`);
  }

  for (const publicList of ['/sitemap-en.xml', '/sitemap-fr.xml', '/sitemap-es.xml', '/llms.txt']) {
    const body = await (await request.get(publicList)).text();
    expect(body).not.toContain('api.maxvideoai.com/mcp');
    expect(body).not.toMatch(/\/oauth\/consent|\/api\/uploads|\/api\/wallet|\/account\//i);
  }
});
