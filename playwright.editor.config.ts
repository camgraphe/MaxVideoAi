import { defineConfig } from '@playwright/test';

const host = process.env.PLAYWRIGHT_EDITOR_HOST ?? 'localhost';
const port = Number(process.env.PLAYWRIGHT_EDITOR_PORT ?? process.env.PORT ?? 3000);
const baseURL = process.env.PLAYWRIGHT_EDITOR_BASE_URL ?? `http://${host}:${port}`;
const webServerCommand = process.env.PLAYWRIGHT_EDITOR_WEB_SERVER_COMMAND
  ?? `frontend/node_modules/.bin/next dev ./frontend --hostname ${host} --port ${port}`;
const shouldStartWebServer = process.env.PLAYWRIGHT_EDITOR_SKIP_WEB_SERVER !== '1';

export default defineConfig({
  testDir: './tests/e2e/editor',
  testMatch: ['**/*.spec.ts'],
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'output/playwright/editor-report' }]]
    : [['list']],
  use: {
    baseURL,
    browserName: 'chromium',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  ...(shouldStartWebServer
    ? {
      webServer: {
        command: webServerCommand,
        url: baseURL,
        timeout: 180_000,
        reuseExistingServer: !process.env.CI,
      },
    }
    : {}),
});
