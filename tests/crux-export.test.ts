import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCruxResponse, queryCrux } from '../scripts/performance/crux-client.mjs';

const requested = { scope: 'url', target: 'https://maxvideoai.com/pricing', formFactor: 'PHONE' };
const period = { firstDate: { year: 2026, month: 8, day: 23 }, lastDate: { year: 2026, month: 9, day: 19 } };

test('CrUX export rejects origin fallback as a measurement of an individual URL', () => {
  const result = normalizeCruxResponse(requested, { record: { key: { origin: 'https://maxvideoai.com', formFactor: 'PHONE' }, collectionPeriod: period, metrics: {} } });
  assert.equal(result.status, 'scope-mismatch');
  assert.deepEqual(result.rows, []);
});

test('CrUX export keeps zero, missing metrics, units and explicit collection dates distinct', () => {
  const result = normalizeCruxResponse(requested, { record: {
    key: { url: requested.target, formFactor: 'PHONE' }, collectionPeriod: period,
    metrics: { cumulative_layout_shift: { percentiles: { p75: '0.00' } }, largest_contentful_paint: { percentiles: { p75: 2800 }, histogram: [{start:0,end:2500,density:0.7},{start:2500,end:4000,density:0.2},{start:4000,density:0.1}] } },
  } });
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.rows.find(row => row.metric === 'cumulative_layout_shift'), {
    firstDate: '2026-08-23', lastDate: '2026-09-19', metric: 'cumulative_layout_shift', unit: 'unitless', p75: 0, histogram: null, fractions: null,
  });
  assert.equal(result.rows.find(row => row.metric === 'interaction_to_next_paint')?.p75, null);
  assert.equal(result.rows.find(row => row.metric === 'largest_contentful_paint')?.histogram[0].density, 0.7);
});

test('history preserves missing periods without averaging overlapping windows', () => {
  const result = normalizeCruxResponse(requested, { record: {
    key: { url: requested.target, formFactor: 'PHONE' },
    collectionPeriods: [period, { firstDate: {year:2026,month:8,day:30}, lastDate:{year:2026,month:9,day:26} }],
    metrics: {
      largest_contentful_paint: { percentilesTimeseries: { p75s: [2800, 'NaN'] } },
      largest_contentful_paint_resource_type: { fractionTimeseries: { image: {fractions:[0.6,null]}, text:{fractions:[0.4,null]} } },
    },
  } });
  assert.deepEqual(result.rows.filter(row => row.metric === 'largest_contentful_paint').map(row => [row.lastDate,row.p75]), [['2026-09-19',2800],['2026-09-26',null]]);
  assert.deepEqual(result.rows.find(row => row.metric === 'largest_contentful_paint_resource_type')?.fractions, {image:0.6,text:0.4});
});

test('a device mismatch cannot be labelled as phone data', () => {
  assert.equal(normalizeCruxResponse(requested, {record:{key:{url:requested.target,formFactor:'DESKTOP'},metrics:{},collectionPeriod:period}}).status,'scope-mismatch');
});

test('no-data is reserved for Google NOT_FOUND, not quota or permission failures', async () => {
  for (const [httpStatus, googleStatus, want] of [[404,'NOT_FOUND','no-data'],[403,'PERMISSION_DENIED','error'],[429,'RESOURCE_EXHAUSTED','error']] as const) {
    let requestCount = 0;
    const result = await queryCrux(requested, { apiKey: 'test-key', fetchImpl: async (url, init) => {
      requestCount++;
      assert.match(String(url), /records:queryRecord/);
      assert.equal(new URL(String(url)).searchParams.get('key'), 'test-key');
      assert.deepEqual(JSON.parse(init.body), {url:requested.target,formFactor:'PHONE'});
      return new Response(JSON.stringify({error:{code:httpStatus,status:googleStatus}}), {status:httpStatus});
    } });
    assert.equal(result.status,want);
    assert.equal(requestCount,1,'must not silently retry at origin scope');
  }
});

test('history requests explicitly ask for 40 periods and never include the API key in results', async () => {
  const result = await queryCrux(requested, {apiKey:'private-test-key',history:true,fetchImpl:async(url,init)=>{
    assert.match(String(url), /records:queryHistoryRecord/);
    assert.equal(JSON.parse(init.body).collectionPeriodCount,40);
    return new Response(JSON.stringify({error:{code:404,status:'NOT_FOUND'}}),{status:404});
  }});
  assert.equal(JSON.stringify(result).includes('private-test-key'),false);
});

