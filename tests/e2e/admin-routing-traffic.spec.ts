import { expect, test } from '@playwright/test';
import { openAdminRoute } from './admin-helpers';

test('inspect a simulated route and switch to the recorded activity feed', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let reads = 0;
  await page.route('**/api/admin/routing/traffic', async route => {
    reads++;
    await route.fulfill({ json: {
      observedAt: '2026-11-27T20:01:00Z', windowMinutes: 60, sampledJobs: 1, truncated: false,
      engineUsage: [{ engineId: 'wan-3-prime', jobs: 1, jobsWithFallback: 1 }],
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
  await expect(map.getByRole('region', { name: 'Supplier estimates' })).toContainText('$0.77145');
  await map.getByRole('button', { name: 'Inspect provider APIMart Gold' }).click();
  await expect(map.getByText(/Optional admin pilot · access required/)).toBeVisible();
  await map.getByRole('button', { name: 'Inspect provider WaveSpeedAI' }).click();
  await expect(map.getByRole('link', { name: 'Rate card' })).toBeVisible();
  await map.getByRole('button', { name: 'Inspect scenario' }).click();
  const lab = page.getByRole('region', { name: 'Video routing explorer' });
  await expect(lab.getByRole('combobox', { name: 'Engine', exact: true })).toHaveValue('wan-3-prime');
  await lab.getByText('Compare API inputs').click();
  await expect(lab.locator('pre').filter({ hasText: '"generate_audio": true' })).toBeVisible();
  await expect(lab.locator('pre').filter({ hasText: '"audio": true' })).toBeVisible();
  await lab.getByLabel('Compare installed suppliers only').check();
  await expect(lab.locator('pre').filter({ hasText: '"generate_audio"' })).toHaveCount(0);
  await expect(lab.locator('pre').filter({ hasText: '"audio": true' })).toBeVisible();
  await lab.getByText('Scenario settings').click();
  await expect(lab.getByLabel('WaveSpeedAI response')).toBeDisabled();
  expect(reads).toBe(0);
  await map.getByRole('button', { name: 'Observed' }).click();
  await expect(map.getByRole('button', { name: 'Inspect provider Fal', exact: true })).toBeVisible();
  await expect(map.getByRole('button', { name: 'Inspect provider WaveSpeedAI' })).toHaveCount(0);
  await expect(map.getByRole('region', { name: 'Provider volume' })).toContainText('1 record');
  await expect(page.getByRole('region', { name: 'Engines in this sample' })).toContainText('1 with fallback');
  expect(reads).toBe(1);
});

test('an unavailable recorded feed recovers and expired admin access clears the sample', async ({ page }) => {
  let reads = 0;
  await page.route('**/api/admin/routing/traffic', async route => {
    reads++;
    if (reads === 1) return route.fulfill({ status: 503, json: { error: 'routing_traffic_unavailable' } });
    if (reads > 2) return route.fulfill({ status: 403, json: { error: 'forbidden' } });
    return route.fulfill({ json: {
      observedAt: '2026-11-27T20:01:00Z', windowMinutes: 60, sampledJobs: 1, truncated: false,
      engineUsage: [{ engineId: 'wan-3-prime', jobs: 1, jobsWithFallback: 0 }],
      routes: [{ engineId: 'wan-3-prime', provider: 'fal', attempts: 1, jobsOnly: 0, fallbacks: 0,
        failed: 0, uncertain: 0, latestAt: '2026-11-27T20:00:55Z' }],
      events: [{ engineId: 'wan-3-prime', provider: 'fal', status: 'accepted', stage: 'primary',
        previousProvider: null, at: '2026-11-27T20:00:55Z' }],
    } });
  });
  await openAdminRoute(page, '/admin/routing');
  const map = page.getByRole('region', { name: 'Routing network' });
  await page.clock.install();
  await map.getByRole('button', { name: 'Observed' }).click();
  await expect(page.getByText(/Recorded traffic is unavailable/)).toBeVisible();
  await page.clock.fastForward(30_100);
  const fal = map.getByRole('button', { name: 'Inspect provider Fal', exact: true });
  await expect(fal).toBeVisible();
  await page.clock.fastForward(30_100);
  await expect(page.getByText('Admin access is required to view recorded traffic.')).toBeVisible();
  await expect(fal).toHaveCount(0);
  expect(reads).toBe(3);
});
