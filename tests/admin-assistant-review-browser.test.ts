import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { startWorkspaceReferenceFixture } from './helpers/workspace-reference-browser-fixture';

const scope = { source: 'composer', userId: 'synthetic-owner', scopeId: 'a1bd8c76-7171-4f53-92f7-b0d7e418f534', requestId: 'a1bd8c76-7171-4f53-92f7-b0d7e418f534' };
const item = { ...scope, createdAt: '2026-10-29T12:00:00Z', state: 'complete', surface: 'video', mediaModel: 'seedance-2-5', assistantModel: 'gpt-6.1-terra', reviewVerdict: 'unreviewed' };
const source = `import {createRoot} from 'react-dom/client';
import {AssistantReviewDetail} from './app/(core)/admin/assistants/_components/AssistantReviewDetail';
import {AssistantReviewList} from './app/(core)/admin/assistants/_components/AssistantReviewList';
const item=globalThis.fixtureConfig;
createRoot(document.getElementById('root')).render(<main style={{maxWidth:1150,margin:'0 auto',padding:16}}><AssistantReviewDetail item={item}/><AssistantReviewList filter={{source:'composer',page:0,limit:25}} data={{status:'available',items:[item],hasMore:false}}/></main>);`;

test('assistant review works on desktop and mobile without revealing or saving content implicitly', { timeout: 90_000 }, async () => {
  const fixture = await startWorkspaceReferenceFixture({ source, config: item });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const requests: Record<string, unknown>[] = [];
      const detail = { item, accessId: 'synthetic-access', message: 'Keep the slow camera move and natural lighting.', reply: 'I kept the 8-second shot and Image 1 as the subject reference.', proposal: 'A complete cinematic prompt for an 8-second shot.',
        evidence: [{ title: 'Selected draft, settings and owned references', status: 'available', data: { value: { settings: { durationSec: 8, resolution: '1080p', aspectRatio: '16:9', audio: false }, references: [{ label: 'Image 1', perception: 'provided' }] }, truncated: false, omitted: 0 } }],
        limitations: ['Retained evidence only. No automatic quality score.'], annotations: { status: 'available', items: [], truncated: false } };
      await page.route('**/api/admin/assistants/review', async route => {
        const body = route.request().postDataJSON(); requests.push(body);
        await route.fulfill({ json: body.action === 'reveal' ? { detail } : { annotation: { ...body, actorId: 'reviewer', createdAt: '2026-10-29T12:01:00Z' } } });
      });
      await page.goto(fixture.url);
      await expect(page.getByRole('button', { name: 'Reveal recorded content' })).toBeVisible();
      assert.equal(requests.length, 0);
      await page.getByRole('button', { name: 'Reveal recorded content' }).click();
      await expect(page.getByText(detail.message, { exact: true })).toBeVisible();
      await page.getByText('Selected draft, settings and owned references', { exact: true }).click();
      await expect(page.locator('pre')).toContainText('1080p');
      await page.getByRole('combobox', { name: 'Assessment', exact: true }).selectOption('needs_work');
      await page.getByRole('checkbox', { name: 'references', exact: true }).check();
      await page.getByRole('textbox', { name: 'Reviewer note' }).fill('Image 1 was understood; verify the lighting instruction.');
      assert.equal(requests.length, 1, 'Editing an evaluation does not save it');
      await page.getByRole('button', { name: 'Save review', exact: true }).click();
      await expect(page.getByRole('status')).toHaveText('Review saved.');
      assert.equal(requests[1].verdict, 'needs_work'); assert.deepEqual(requests[1].issues, ['references']);
      assert.match(String(requests[1].note), /Image 1/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, 'The document must not overflow on mobile');
      await mkdir('.local/assistant-review', { recursive: true });
      await page.screenshot({ path: `.local/assistant-review/review-${width}.png`, fullPage: true });
      await page.getByRole('button', { name: 'Hide content' }).click();
      await expect(page.getByText(detail.message, { exact: true })).toHaveCount(0);
      await page.close();
    }
  } finally { await browser.close(); await fixture.close(); }
});
