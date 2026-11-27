import { expect, test } from '@playwright/test';
import { openAdminRoute } from './admin-helpers';

test('inspect a simulated route and switch to the recorded activity feed', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let reads = 0;
  await page.route('**/api/admin/routing/traffic', async route => {
    reads++;
    await route.fulfill({ json: {
      observedAt: '2026-11-27T20:01:00Z', windowMinutes: 60, sampledJobs: 1, truncated: false,
      routes: [{ engineId: 'wan-3-prime', provider: 'fal', attempts: 1, jobsOnly: 0,
        fallbacks: 1, failed: 0, uncertain: 0, latestAt: '2026-11-27T20:00:55Z' }],
      events: [{ engineId: 'wan-3-prime', provider: 'fal', status: 'accepted', stage: 'fallback',
        previousProvider: 'alibaba_model_studio', at: '2026-11-27T20:00:55Z' }],
    } });
  });
  await openAdminRoute(page, '/admin/routing');
  const map = page.getByRole('region', { name: 'Routing network' });
  await expect(map.getByRole('button', { name: 'Play simulation' })).toBeVisible();
  await map.getByRole('combobox', { name: 'Filter traffic by engine' }).selectOption('wan-3-prime');
  await map.getByRole('button', { name: 'Inspect provider WaveSpeedAI' }).click();
  await expect(map.getByRole('link', { name: 'Rate card' })).toBeVisible();
  await map.getByRole('button', { name: 'Inspect scenario' }).click();
  const lab = page.getByRole('region', { name: 'Video routing explorer' });
  await expect(lab.getByRole('combobox', { name: 'Engine', exact: true })).toHaveValue('wan-3-prime');
  await lab.getByLabel('Compare installed suppliers only').check();
  await lab.getByText('Scenario settings').click();
  await expect(lab.getByLabel('WaveSpeedAI response')).toBeDisabled();
  expect(reads).toBe(0);
  await map.getByRole('button', { name: 'Observed' }).click();
  await expect(map.getByRole('button', { name: 'Inspect provider Fal', exact: true })).toBeVisible();
  await expect(map.getByRole('button', { name: 'Inspect provider WaveSpeedAI' })).toHaveCount(0);
  expect(reads).toBe(1);
});
