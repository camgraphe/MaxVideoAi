import assert from 'node:assert/strict';
import test from 'node:test';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { collectCustomerTariffCutoverCheckpoints } from '../frontend/server/pricing/customer-tariff-cutover-evidence';
import { videoOperationTariffContexts } from '../frontend/lib/pricing-audit/video-operation-tariff-inventory';

test('operation inventory distinguishes omitted scope from explicit empty model or mode', () => {
  const full = videoOperationTariffContexts();
  assert.equal(full.length, 77);
  assert.deepEqual(videoOperationTariffContexts({ modelId: undefined, mode: undefined }), full);
  for (const scope of [{ modelId: '' }, { modelId: '', mode: 'v2v' }, { mode: '' },
    { modelId: 'flux-3', mode: '' }, { modelId: 'flux-3-draft', mode: '' },
    { modelId: 'missing-model' }, { modelId: 'flux-3', mode: 'missing-mode' }]) {
    assert.deepEqual(videoOperationTariffContexts(scope), [], JSON.stringify(scope));
  }
  for (const modelId of new Set(full.map(context => context.engine.id))) {
    const model = full.filter(context => context.engine.id === modelId);
    assert.deepEqual(videoOperationTariffContexts({ modelId }), model);
    for (const mode of new Set(model.map(context => context.mode))) {
      assert.deepEqual(videoOperationTariffContexts({ modelId, mode }), model.filter(context => context.mode === mode));
    }
  }
});

test('all historical checkpoints and independently enumerated additive operation families are disjoint', () => {
  const coverage = collectSellableManualTariffCoverage();
  const counts: Record<string, number> = {};
  for (const row of coverage.scenarios) if (row.selector.operation) counts[row.selector.operation] = (counts[row.selector.operation] ?? 0) + 1;
  assert.deepEqual(counts, { 'kling-reference': 13, 'kling-edit': 3, 'h3-recast': 2, 'h3-relight': 4,
    'luma-extend': 3, 'flux-keyframes': 48, 'flux-fast-edit': 1, 'flux-draft-enhance': 1, 'ltx23-reframe': 2 });
  const cases = collectCustomerTariffCutoverCheckpoints();
  assert.equal(cases.filter(row => row.kind === 'ordinary').length, 20286);
  assert.equal(cases.filter(row => row.kind === 'local_workflow').length, 324);
  assert.equal(cases.filter(row => row.kind === 'input_stress').length, 6372);
  assert.equal(cases.filter(row => String(row.kind) === 'new_offer').length, 89);
  assert.equal(cases.length, 27071);
  assert.equal(new Set(cases.map(row => row.key)).size, 27071);
  const veo = coverage.scenarios.filter(row => row.modelId === 'veo-3-1' && row.selector.mode === 'i2v');
  assert.equal(veo.length, 18);
  assert.deepEqual(new Set(veo.map(row => `${row.selector.durationSec}:${row.selector.resolution}:${row.selector.audio}`)),
    new Set([4,6,8].flatMap(s => ['720p','1080p','4k'].flatMap(r => ['false','true'].map(a => `${s}:${r}:${a}`)))));
  assert.ok(!coverage.scenarios.some(row => ['h3-extend','h3-insert','h3-reframe'].includes(row.selector.operation)));
});

test('exact additive selectors and default identities match the separately enumerated commercial inventory', async () => {
  const { videoOperationInitializationScenarios } = await import('../frontend/server/pricing/video-operation-tariffs');
  const { continuousInputTariffSelector } = await import('../frontend/src/lib/pricing-manual-scenario');
  const { buildManualTariffCoverageScenario } = await import('../frontend/lib/pricing-audit/manual-tariff-coverage');
  const expected: Record<string,string>[] = [];
  const add=(engineId:string,mode:string,operation:string,endpoint:string,resolutions:string[],durations:(number|string)[])=>{
    for(const resolution of resolutions)for(const duration of durations)expected.push({engineId,mode,operation,endpoint,
      transport:operation==='luma-extend'?'luma_agents_direct':'fal',resolution,durationSec:String(duration)});
  };
  add('kling-o3-4k','v2v','kling-reference','fal-ai/kling-video/o3/4k/video-to-video/reference',['4k'],Array.from({length:13},(_,i)=>i+3));
  for(const [tier,resolution] of [['standard','720p'],['pro','1080p'],['4k','4k']])
    add(`kling-o3-${tier}`,'v2v','kling-edit',`fal-ai/kling-video/o3/${tier}/video-to-video/edit`,[resolution],['continuous']);
  add('minimax-h3-max','v2v','h3-recast','minimax/h3-max/recast',['768P','1080P'],['continuous']);
  add('minimax-h3-max','v2v','h3-relight','minimax/h3-max/relight',['480P','768P','1080P','2K'],['continuous']);
  add('luma-ray-3-2','extend','luma-extend','ray-3.2/video/generation-anchor',['540p','720p','1080p'],[5]);
  for(const [engine,resolutions,suffix] of [['flux-3',['720p','1080p'],''],['flux-3-draft',['720p'],'/draft']] as const)
    add(engine,'ref2v','flux-keyframes',`blackforestlabs/flux-3/keyframes-to-video${suffix}`,[...resolutions],Array.from({length:16},(_,i)=>i+5));
  add('flux-3','v2v','flux-fast-edit','blackforestlabs/flux-3/edit-video',['720p'],['continuous']);
  add('flux-3-draft','v2v','flux-draft-enhance','blackforestlabs/flux-3/draft-enhance',['1080p'],['continuous']);
  add('ltx-2-3','reframe','ltx23-reframe','fal-ai/ltx-2.3/reframe',['720p','1080p'],['continuous']);
  for(const duration of [4,6])for(const resolution of ['720p','1080p','4k'])for(const audio of ['false','true'])
    expected.push({engineId:'veo-3-1',mode:'i2v',resolution,audio,durationSec:String(duration)});
  const key=(value:Record<string,string>)=>JSON.stringify(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)));
  const scenarios=videoOperationInitializationScenarios();
  assert.deepEqual(new Set(scenarios.map(s=>key(continuousInputTariffSelector(s.selector)??s.selector))),new Set(expected.map(key)));
  for(const scenario of scenarios.filter(s=>['kling-reference','luma-extend','ltx23-reframe','flux-keyframes'].includes(s.context.operation??''))) {
    assert.deepEqual(buildManualTariffCoverageScenario({...scenario.context,operation:undefined},'default').selector,scenario.selector);
  }
  for(const engine of ['kling-o3-standard','kling-o3-pro']) {
    const historical=collectSellableManualTariffCoverage({modelId:engine,mode:'v2v'}).scenarios.filter(s=>!s.context.operation);
    assert.ok(historical.length>0);
    for(const scenario of historical)assert.deepEqual(buildManualTariffCoverageScenario({...scenario.context,operation:'kling-reference'},'explicit').selector,scenario.selector);
  }
  const creation=collectSellableManualTariffCoverage({modelId:'minimax-h3-max'}).scenarios.filter(s=>['t2v','i2v'].includes(s.context.mode!));
  assert.deepEqual(new Set(creation.map(s=>s.context.durationSec)),new Set(Array.from({length:11},(_,i)=>i+5)));
});
