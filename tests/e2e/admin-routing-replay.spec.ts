import { expect, test } from '@playwright/test';
import { openAdminRoute } from './admin-helpers';
import type { HistoricalReplayReport, ReplayTrace } from '../../frontend/app/(core)/admin/routing/_lib/historical-replay-types';

const totals = { jobs: 52, completedPaidJobs: 52, comparableJobs: 52, excludedJobs: 0, historicalMicros: 52_000_000,
  historicalPricedJobs: 52, historicalPricedMicros: 52_000_000,
  installedMicros: 52_000_000, allMicros: 39_000_000, installedSavingsMicros: 0, additionalSavingsMicros: 13_000_000 };
const trace: ReplayTrace = {
  paidWallet:true, profile:null, bucketAt: '2026-11-25T14:00:00Z', source: 'web', engineId: 'wan-3-prime', mode: 't2v', resolution: '480p',
  durationSec: 15, jobs: 1, status: 'completed', historicalProvider: 'alibaba_model_studio', historicalMicros: 1_000_000,
  ceilingMicros: 1_200_000, installed: { provider:'alibaba_model_studio', costMicros: 1_000_000, order:['alibaba_model_studio','fal'] },
  all: { provider:'apimart', costMicros: 750_000, order:['apimart','alibaba_model_studio','fal'] }, additional: [], excludedReason:null,
  offers:[{ provider:'apimart', costMicros:750_000, reason:null, tariff:'Test rate card', sourceUrl:'https://apimart.ai/model/wan-3-0-prime' },
    {provider:'alibaba_model_studio', costMicros:1_000_000, reason:null, tariff:'Published rate'}],
};
function archive(offset: number) {
  const profiles = Array.from({length:52}, (_, i) => ({
    ...trace, bucketAt:new Date(Date.UTC(2026,10,25,14-i)).toISOString(),
  }));
  const report: HistoricalReplayReport = {
    totals, coverage:[{engineId:trace.engineId,...totals}], pricingBasis:'published-estimates', alibabaStandardDiscount:false,
    opportunities:[{provider:'apimart',standaloneSavingsMicros:13_000_000,incrementalSavingsMicros:13_000_000,jobsImproved:52,incrementalJobs:52}],
    coverageGaps:[], singleRouteProfiles:[], flows:[{historicalProvider:'alibaba_model_studio', installedProvider:'alibaba_model_studio', chosenProvider:'apimart', jobs:52, savingsMicros:13_000_000}],
    traces: profiles.slice(offset,offset+50), totalProfiles:52, excludedReasons:[], page:1+Math.floor(offset/50),pageSize:50,
  };
  return { source:'archive', report, startDay:'2026-10-28',endDay:'2026-11-27',capturedAt:'2026-11-27T09:00:00Z',
    engineOptions:['wan-3-prime'],statusOptions:['completed','failed'] };
}

test('loads replay on demand, compares recorded and hypothetical paths, scrubs across pages and filters the cohort', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  const reads: URL[] = [];
  await page.route('**/api/admin/routing/replay?**', async route => {
    const url = new URL(route.request().url());
    reads.push(url);
    const result = archive(Number(url.searchParams.get('offset')));
    return route.fulfill({ json:result });
  });
  await openAdminRoute(page, '/admin/routing');
  const network = page.getByRole('region',{name:'Routing network',exact:true});
  expect(reads).toHaveLength(0);
  await network.getByRole('button',{name:'Replay 30d'}).click();
  const replay = network.getByRole('region',{name:'Historical routing replay'});
  await expect(replay.getByText('Anonymized production archive')).toBeVisible();
  await expect(replay.getByRole('region',{name:'Actual to simulated supplier flows'})).toContainText('52 jobs');
  await replay.getByRole('button',{name:'Inspect provider APIMart Gold'}).click();
  await expect(replay.getByRole('region',{name:'Replay supplier estimate'})).toContainText('$0.75 per job');
  await expect(replay.getByRole('link',{name:'Rate card'})).toHaveAttribute('href','https://apimart.ai/model/wan-3-0-prime');
  const compare = replay.getByRole('group',{name:'Replay route comparison'});
  await compare.getByRole('button',{name:'Historical owner'}).click();
  await expect(replay.getByRole('button',{name:'Inspect provider Alibaba Model Studio'})).toContainText('Owner');
  await compare.getByRole('button',{name:'With candidates'}).click();
  await expect(replay.getByRole('button',{name:'Inspect provider APIMart Gold'})).toContainText('Modelled');
  expect(reads).toHaveLength(1);
  await replay.getByRole('button',{name:'Previous historical profile (older)',exact:true}).click();
  await expect(replay.getByRole('slider')).toHaveValue('51');
  const slider = replay.getByRole('slider');
  await slider.focus();
  await slider.press('Home');
  await expect(replay.getByRole('slider')).toHaveValue('1');
  expect(reads.at(-1)?.searchParams.get('offset')).toBe('50');
  await replay.getByRole('button',{name:'Play historical replay'}).click();
  await expect(replay.getByRole('slider')).toHaveValue('3', {timeout:10_000});
  await replay.getByRole('button',{name:'Pause historical replay'}).click();
  expect(reads.at(-1)?.searchParams.get('offset')).toBe('0');
  await replay.getByRole('combobox',{name:'Job status',exact:true}).selectOption('failed');
  await expect(replay.getByRole('slider')).toHaveValue('52');
  expect(reads.at(-1)?.searchParams.get('status')).toBe('failed');
  expect(reads.at(-1)?.searchParams.get('offset')).toBe('0');
  await replay.getByRole('combobox',{name:'Wan Standard pricing'}).selectOption('alibaba-discount');
  await expect(replay.getByText('Anonymized production archive')).toBeVisible();
  expect(reads.at(-1)?.searchParams.get('tariff')).toBe('alibaba-discount');
});

test('replay errors support retry and direct entry works on mobile', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  let count = 0;
  await page.route('**/api/admin/routing/replay?**', async route => {
    count++;
    if (count === 1) return route.fulfill({status:503,json:{error:'unavailable'}});
    return route.fulfill({json:archive(0)});
  });
  await openAdminRoute(page, '/admin/routing?view=replay&engine=wan-3-prime');
  const replay = page.getByRole('region',{name:'Historical routing replay'});
  await expect(replay.getByText('Historical replay is unavailable.')).toBeVisible();
  await replay.getByRole('button',{name:'Retry'}).click();
  await expect(replay.getByRole('slider')).toBeVisible();
  await expect(replay.getByRole('combobox',{name:'Engine',exact:true})).toHaveValue('wan-3-prime');
  expect(await replay.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await expect(replay.getByRole('button',{name:'Inspect provider APIMart Gold'})).toBeVisible();
});

test('shows hypothetical routes for excluded jobs without reporting savings', async ({ page }) => {
  await page.route('**/api/admin/routing/replay?**', async route => {
    const dataset = archive(0);
    const unpaid: ReplayTrace = {
      ...trace, mode:'i2v', paidWallet:false, status:'failed', excludedReason:'Job did not complete',
      profile:{aspectRatio:'16:9', requestedRatioVerified:true, observedAspectRatio:null, images:1,hasStartFrame:true,hasEndFrame:true,hasVideo:false,
        inputVideoSeconds:null,hasAudioReference:false,hasDocument:false,audioEnabled:true},
    };
    const zero = {jobs:1,completedPaidJobs:0,comparableJobs:0,excludedJobs:1,historicalPricedJobs:0,historicalPricedMicros:0,historicalMicros:0,installedMicros:0,allMicros:0,
      installedSavingsMicros:0,additionalSavingsMicros:0};
    return route.fulfill({json:{...dataset, report:{...dataset.report, traces:[unpaid], totalProfiles:1,
      totals:zero,coverage:[{engineId:trace.engineId,...zero}], flows:[],opportunities:[],singleRouteProfiles:[],
      excludedReasons:[{reason:'Job did not complete',jobs:1}]}}});
  });
  await openAdminRoute(page, '/admin/routing?view=replay');
  const replay = page.getByRole('region', {name:'Historical routing replay'});
  await expect(replay.getByText('Hypothetical route · outside savings · Job did not complete')).toBeVisible();
  await expect(replay.getByText(/start frame · end frame · audio on/)).toBeVisible();
  await expect(replay.getByText('Estimated saving / job').locator('..')).toContainText('—');
  await expect(replay.getByRole('button',{name:'Inspect provider APIMart Gold'})).toContainText('Modelled');
});
