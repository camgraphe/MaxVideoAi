import assert from 'node:assert/strict';
import test from 'node:test';
import { listFalEngines } from '@/config/falEngines';
import { getPresetQuote } from '../frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData';
import { buildHomePriceDemo } from '../frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-price-demo-data';

test('guided Wan 3 demo uses supported settings and exact canonical quotes in every locale', () => {
 const entry = listFalEngines().find(item => item.modelSlug === 'wan-3')!;
 for (const locale of ['en','fr','es'] as const) {
  const [demo] = buildHomePriceDemo(locale);
  assert.equal(demo.engine.id, 'wan-3');
  assert.deepEqual(demo.steps.map(s => [s.seconds,s.resolution]), [[5,'720p'],[15,'720p'],[15,'1080p']]);
  for (const step of demo.steps) {
   assert.ok(step.seconds <= entry.engine.maxDurationSec);
   assert.ok(entry.engine.resolutions.includes(step.resolution));
   const quote = getPresetQuote(entry, {id:'test',label:'',subLabel:'',durationSec:step.seconds,resolution:step.resolution,audio:true},locale);
   assert.equal(quote.status,'exact');
   assert.equal(step.amountCents,quote.amountCents);
   assert.equal(step.display,quote.display);
  }
  assert.ok(demo.steps[1].amountCents > demo.steps[0].amountCents);
  assert.ok(demo.steps[2].amountCents > demo.steps[1].amountCents);
 }
});
