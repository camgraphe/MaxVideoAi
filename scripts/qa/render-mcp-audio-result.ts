import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { chromium, type ColorScheme } from '@playwright/test';

import { buildGenerationResultAppHtml } from '../../frontend/src/server/mcp/generation-result-app';

const outputDirectory = path.resolve(process.argv[2] ?? '/tmp');
const toolOutput = {
  jobId: 'audio-review-1',
  surface: 'audio',
  status: 'completed',
  progress: 100,
  message: null,
  priceCents: 45,
  currency: 'USD',
  paymentStatus: 'paid_wallet',
  result: {
    surface: 'audio',
    audioUrl: 'https://media.maxvideoai.com/generated/audio-review-1.m4a',
    videoUrl: null,
    thumbnailUrl: null,
    mimeType: 'audio/mp4',
    durationSec: 12.375,
  },
  library: { url: 'https://maxvideoai.com/app/library' },
  workspace: { url: 'https://maxvideoai.com/app/audio?job=audio-review-1' },
  savedToLibrary: true,
  retry: null,
  download: null,
};

const views: Array<{
  name: string;
  width: number;
  height: number;
  colorScheme: ColorScheme;
}> = [
  { name: 'light', width: 760, height: 520, colorScheme: 'light' },
  { name: 'dark', width: 760, height: 520, colorScheme: 'dark' },
  { name: 'mobile', width: 390, height: 620, colorScheme: 'light' },
];

async function main(): Promise<void> {
  await mkdir(outputDirectory, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const view of views) {
      const page = await browser.newPage({
        viewport: { width: view.width, height: view.height },
        colorScheme: view.colorScheme,
      });
      await page.route('https://media.maxvideoai.com/**', (route) => route.fulfill({
        status: 200,
        contentType: 'audio/mp4',
        body: Buffer.alloc(0),
      }));
      const fixtureBootstrap = `<script>window.openai={toolOutput:${JSON.stringify(toolOutput)},openExternal:async()=>undefined};</script>`;
      const html = buildGenerationResultAppHtml().replace('<script>', `${fixtureBootstrap}<script>`);
      await page.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      await page.waitForSelector('#audio-art:not([hidden])');
      await page.waitForSelector('#audio:not([hidden])');
      const art = await page.locator('#audio-art').evaluate((element) => {
        const style = getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        return { color: style.color, display: style.display, height: bounds.height, top: bounds.top };
      });
      console.log(`${view.name}: audio art ${JSON.stringify(art)}`);
      await page.screenshot({
        path: path.join(outputDirectory, `maxvideoai-mcp-audio-v5-reviewed3-${view.name}.png`),
        fullPage: true,
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
