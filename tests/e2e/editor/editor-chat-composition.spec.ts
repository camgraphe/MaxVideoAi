import { expect, test } from '@playwright/test';
import { canvasNodeControls, openMinimalEditorWorkspace } from './editor-helpers';

test('Chat card and inspector simulate locally and disable Live without losing the draft', async ({ page }) => {
  let chatRequests = 0;
  await page.route('**/api/studio/chat', async (route) => { chatRequests++; await route.abort(); });
  await page.route('**/api/legal/cookies/version', (route) => route.fulfill({ json: { ok: true, version: 'studio-local-fixture', publishedAt: null } }));
  await openMinimalEditorWorkspace(page);
  await page.locator('[data-canvas-toolbar-menu-id="add"]').click();
  await page.locator('[data-canvas-toolbar-preset-id="chat-box"]').click();
  const chat = page.locator('.react-flow__node.selected');
  await chat.getByRole('textbox', { name: 'Message', exact: true }).fill('Plan my scene');
  await chat.getByRole('button', { name: 'Simulate', exact: true }).click();
  await expect(chat).toContainText('Simulation — local echo, no model was called:');
  await chat.getByRole('textbox', { name: 'Message', exact: true }).fill('Keep my next draft');
  const chatId = await chat.getAttribute('data-id');
  expect(chatId).toBeTruthy();
  await page.waitForTimeout(1_050);

  await page.goto(new URL(page.url()).pathname, { waitUntil: 'domcontentloaded' });
  const liveChat = page.locator(`.react-flow__node[data-id=${JSON.stringify(chatId)}]`);
  await expect(liveChat.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
  await expect(liveChat).toContainText('Live Chat unavailable');
  await liveChat.getByRole('textbox', { name: 'Message', exact: true }).press('ControlOrMeta+Enter');
  await expect(liveChat.getByRole('textbox', { name: 'Message', exact: true })).toHaveValue('Keep my next draft');
  await liveChat.click({ force: true });
  await (await canvasNodeControls(page, liveChat)).locator('[data-canvas-node-inspect-button]').click();
  let inspector = page.locator('[data-studio-canvas-inspector="true"]');
  await expect(inspector.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
  await expect(inspector).toContainText('Live Chat unavailable');

  await page.goto(`${new URL(page.url()).pathname}?__studio_test_simulation=1`, { waitUntil: 'domcontentloaded' });
  const simulatedChat = page.locator(`.react-flow__node[data-id=${JSON.stringify(chatId)}]`);
  await simulatedChat.click({ force: true });
  await (await canvasNodeControls(page, simulatedChat)).locator('[data-canvas-node-inspect-button]').click();
  inspector = page.locator('[data-studio-canvas-inspector="true"]');
  await expect(inspector.getByRole('button', { name: 'Simulate', exact: true })).toBeEnabled();
  await inspector.getByRole('button', { name: 'Simulate', exact: true }).click();
  await expect(inspector).toContainText('Keep my next draft');
  expect(chatRequests).toBe(0);
});
