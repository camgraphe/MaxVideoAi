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
  '/integrations/chatgpt',
  '/integrations/claude',
  '/integrations/codex',
] as const;

const localizedOwners = [
  { path: '/mcp', canonical: 'https://maxvideoai.com/mcp', locale: 'en' },
  { path: '/fr/mcp', canonical: 'https://maxvideoai.com/fr/mcp', locale: 'fr' },
  { path: '/es/mcp', canonical: 'https://maxvideoai.com/es/mcp', locale: 'es' },
  {
    path: '/integrations/chatgpt',
    canonical: 'https://maxvideoai.com/integrations/chatgpt',
    locale: 'en',
  },
  {
    path: '/fr/integrations/chatgpt',
    canonical: 'https://maxvideoai.com/fr/integrations/chatgpt',
    locale: 'fr',
  },
  {
    path: '/es/integraciones/chatgpt',
    canonical: 'https://maxvideoai.com/es/integraciones/chatgpt',
    locale: 'es',
  },
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

  for (const owner of localizedOwners) {
    const response = await page.goto(owner.path, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), owner.path).toBe(404);
    expect(response?.headers()['x-robots-tag'], owner.path).toBe('noindex, nofollow');
    expect(response?.headers()['x-middleware-rewrite'], owner.path).toContain(
      `/${owner.locale}/__mcp-publication-gated__`,
    );
    const robotValues = await page.locator('meta[name="robots"]').evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('content') ?? ''),
    );
    expect(robotValues.length, owner.path).toBeGreaterThan(0);
    expect(robotValues.every((value) => /noindex/i.test(value)), owner.path).toBeTruthy();
  }

  for (const discoveryPath of ['/sitemap-en.xml', '/sitemap-fr.xml', '/sitemap-es.xml', '/llms.txt']) {
    const response = await request.get(discoveryPath);
    expect(response.ok(), discoveryPath).toBeTruthy();
    expect(await response.text()).not.toMatch(/(?:\/mcp|integrations\/(?:chatgpt|claude|codex)|integraciones\/(?:chatgpt|claude|codex))/i);
  }
});

test('renderable preview is noindex and hides trial, live price references, and proof', async ({ page }) => {
  onlyMode('preview');

  await page.setViewportSize({ width: 1440, height: 1000 });
  expect(page.viewportSize()).toEqual({ width: 1440, height: 1000 });
  const response = await page.goto('/mcp', { waitUntil: 'load' });
  expect(response?.status()).toBe(200);
  expect(await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }))).toEqual({
    width: 1440,
    height: 1000,
  });
  await dismissCookieBanner(page);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/i);
  await expect(page.getByText('FIRST VIDEO INCLUDED')).toHaveCount(0);
  await expect(page.locator('[data-price-reference]')).toHaveCount(0);
  const unavailableBudget = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Ask for a budget for the whole film—not a preset tier' }),
  });
  await expect(unavailableBudget.getByText('Describe the finished video, total duration, shot count and priorities.')).toBeVisible();
  await expectNoFakeProof(page);
  mkdirSync(artifactDir, { recursive: true });
  await page.screenshot({
    path: resolve(artifactDir, 'preview-no-trial-no-paid-light-1440x1000.png'),
    fullPage: true,
  });
  await unavailableBudget.screenshot({
    path: resolve(artifactDir, 'preview-budget-unavailable-light-1440x1000.png'),
  });
});

test('enabled fixture captures MCP, ChatGPT, Claude, and Codex at desktop/mobile in light/dark', async ({ browser }) => {
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
          const slug = path === '/mcp' ? 'mcp' : path.split('/').at(-1) ?? 'integration';
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

test('landing presents equal official client actions and conversation-led project budgets', async ({ page }) => {
  onlyMode('enabled');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/mcp', { waitUntil: 'load' });
  await dismissCookieBanner(page);

  await expect(page.getByRole('heading', {
    level: 1,
    name: 'Turn ChatGPT or Claude into your AI video producer.',
  })).toBeVisible();
  await expect(page.getByText('PRICE BEFORE YOU GENERATE')).toBeVisible();
  await expect(page.getByText('INTRODUCTORY CREDIT WHEN ELIGIBLE')).toBeVisible();
  await expect(page.locator('[data-project-proposal="quality"]')).toBeVisible();
  await expect(page.locator('[data-project-proposal="lower-cost"]')).toBeVisible();
  await expect(page.locator('[data-price-reference="included_trial"]')).toBeVisible();
  await expect(page.locator('[data-price-reference="lowest_paid"]')).toBeVisible();
  await expect(page.locator('[data-price-reference="affordable_upgrade"]')).toBeVisible();
  await expectNoFakeProof(page);
  const availableBudget = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Ask for a budget for the whole film—not a preset tier' }),
  });
  await availableBudget.screenshot({
    path: resolve(artifactDir, 'enabled-budget-trial-paid-light-1440x1000.png'),
  });

  const chatgpt = page.locator('main [data-client="chatgpt"]').first();
  const claude = page.locator('main [data-client="claude"]').first();
  const [chatgptBox, claudeBox] = await Promise.all([chatgpt.boundingBox(), claude.boundingBox()]);
  expect(chatgptBox).not.toBeNull();
  expect(claudeBox).not.toBeNull();
  expect(Math.abs(chatgptBox!.width - claudeBox!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(chatgptBox!.height - claudeBox!.height)).toBeLessThanOrEqual(1);

  const [chatgptMark, claudeMark] = await Promise.all([
    chatgpt.locator('img:visible').boundingBox(),
    claude.locator('img:visible').boundingBox(),
  ]);
  expect(chatgptMark).not.toBeNull();
  expect(claudeMark).not.toBeNull();
  expect(Math.abs(chatgptMark!.width - claudeMark!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(chatgptMark!.height - claudeMark!.height)).toBeLessThanOrEqual(1);
});

test('ChatGPT and Claude actions support keyboard focus and activation', async ({ page }) => {
  onlyMode('enabled');
  await page.route('**/api/mcp/acquisition', (route) => route.fulfill({ status: 204 }));

  await page.goto('/mcp', { waitUntil: 'load' });
  const chatgpt = page.locator('main [data-client="chatgpt"]').first();
  await chatgpt.focus();
  await expect(chatgpt).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/integrations\/chatgpt$/);

  await page.goto('/mcp', { waitUntil: 'load' });
  const claude = page.locator('main [data-client="claude"]').first();
  await claude.focus();
  await expect(claude).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/integrations\/claude$/);
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
  const canonicalProtocol = await request.get('/mcp', { headers: apiHostHeaders });
  expect(canonicalProtocol.status()).toBe(401);
  expect(canonicalProtocol.headers()['cache-control']).toBe('private, no-store');
  expect(canonicalProtocol.headers()['x-robots-tag']).toBe('noindex, nofollow');

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
  expect(upload.status()).toBe(401);

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
