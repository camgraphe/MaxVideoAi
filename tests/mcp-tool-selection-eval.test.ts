import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import mcpPublication from '../frontend/config/mcp-publication.json';
import {
  ALL_FIXTURE_CATEGORIES,
  assertCompleteOfflinePolicyDecisions,
  buildFixtureBaseline,
  inspectLiveMcpMetadata,
  parseDecisionBundle,
  parseFixtureCorpus,
  scoreRecordedDecisions,
} from '../frontend/scripts/qa/mcp-tool-selection-eval';

const fixturePath = new URL('./fixtures/mcp-tool-selection-prompts.json', import.meta.url);
const recordedDecisionPath = new URL(
  './fixtures/mcp-tool-selection-recorded-decisions.json',
  import.meta.url
);

function fixtures() {
  return parseFixtureCorpus(JSON.parse(readFileSync(fixturePath, 'utf8')));
}

function hostProfileScore(
  scores: ReturnType<typeof scoreRecordedDecisions>,
  host: 'codex' | 'claude' | 'other',
  registryProfile: 'live-read-only' | 'future-generation-evaluation'
) {
  const score = scores.hostProfiles.find(
    (entry) => entry.host === host && entry.registryProfile === registryProfile
  );
  assert.ok(score, `missing ${host}/${registryProfile} score`);
  return score;
}

function aggregateProfileScore(
  scores: ReturnType<typeof scoreRecordedDecisions>,
  registryProfile: 'live-read-only' | 'future-generation-evaluation'
) {
  const score = scores.aggregateProfiles.find(
    (entry) => entry.registryProfile === registryProfile
  );
  assert.ok(score, `missing aggregate/${registryProfile} score`);
  return score;
}

test('public fixture corpus covers every approved intent with strict labels and future tools gated', () => {
  const corpus = fixtures();
  assert.ok(corpus.length >= ALL_FIXTURE_CATEGORIES.length);
  assert.deepEqual(
    [...new Set(corpus.map((fixture) => fixture.category))].sort(),
    [...ALL_FIXTURE_CATEGORIES].sort()
  );

  for (const fixture of corpus) {
    assert.ok(fixture.prompt.length >= 20);
    assert.ok(fixture.reason.length >= 20);
    assert.ok(Array.isArray(fixture.expectedTools));
    assert.ok(Array.isArray(fixture.allowedAlternatives));
    assert.ok(Array.isArray(fixture.prohibitedTools));
    assert.ok(fixture.expectedCapabilityClaims.length > 0);
    assert.ok(fixture.prohibitedClaims.length > 0);
    assert.equal(new Set(fixture.expectedTools).size, fixture.expectedTools.length);
    assert.equal(new Set(fixture.allowedAlternatives).size, fixture.allowedAlternatives.length);
    assert.equal(new Set(fixture.prohibitedTools).size, fixture.prohibitedTools.length);
    assert.doesNotMatch(fixture.prompt, /\bsynthetic\b|prescribed tool sequence/i);

    for (const futureTool of ['prepare_generation', 'confirm_generation']) {
      if (fixture.expectedTools.includes(futureTool)) {
        assert.equal(fixture.registryProfile, 'future-generation-evaluation');
      }
    }
  }

  assert.ok(
    corpus.some((fixture) =>
      fixture.expectedTools.join(',').includes('prepare_generation,confirm_generation')
    ),
    'one public scenario should exercise quote before confirmation'
  );
  assert.ok(
    corpus.some((fixture) =>
      fixture.expectedTools.join(',') === 'list_models,get_model_details,calculate_project_budget'
    ),
    'a 60-second multi-plan scenario should discover current models, inspect details, and budget proposals'
  );
  assert.ok(
    corpus.some((fixture) =>
      fixture.expectedTools.join(',') === 'get_model_details,recommend_models'
    ),
    'a named-model fit comparison should inspect details before advice'
  );
  assert.ok(
    corpus.some((fixture) =>
      fixture.expectedTools.length === 1
        && fixture.expectedTools[0] === 'prepare_generation'
        && fixture.prohibitedTools.includes('recommend_models')
    ),
    'a complete generation request should prepare an exact quote without a forced recommendation'
  );
  assert.ok(
    corpus.some((fixture) =>
      fixture.expectedTools.join(',') === 'recommend_models,calculate_project_budget'
        && fixture.prohibitedTools.includes('confirm_generation')
    ),
    'a no-spend budget request should discuss and estimate without confirmation'
  );
  assert.ok(
    corpus.some((fixture) => fixture.expectedTools.includes('get_generation_status')),
    'one gated scenario should cover status and recovery without retrying'
  );
  const byId = new Map(corpus.map((fixture) => [fixture.id, fixture]));
  assert.deepEqual(byId.get('chosen-model-budget-no-advice')?.expectedTools, [
    'get_model_details',
    'calculate_project_budget',
  ]);
  assert.ok(byId.get('chosen-model-budget-no-advice')?.prohibitedTools.includes('recommend_models'));
  assert.deepEqual(byId.get('quality-first-open-choice')?.expectedTools, [
    'recommend_models',
    'get_model_details',
    'calculate_project_budget',
  ]);
  assert.deepEqual(byId.get('budget-led-mixed-shot-plan')?.expectedTools, [
    'list_models',
    'get_model_details',
    'calculate_project_budget',
  ]);
  assert.deepEqual(byId.get('named-model-unavailable-no-substitution')?.expectedTools, [
    'get_model_details',
  ]);
  assert.ok(byId.get('named-model-unavailable-no-substitution')?.prohibitedTools.includes('recommend_models'));
  assert.deepEqual(byId.get('host-designed-generator-only')?.expectedTools, ['prepare_generation']);
  assert.ok(byId.get('host-designed-generator-only')?.prohibitedTools.includes('recommend_models'));
  assert.deepEqual(byId.get('operational-seedance-quality-first')?.expectedTools, [
    'recommend_models',
    'get_model_details',
    'calculate_project_budget',
  ]);
  assert.deepEqual(byId.get('operational-comparable-budget-alternatives')?.expectedTools, [
    'list_models',
    'get_model_details',
    'calculate_project_budget',
  ]);
  for (const id of [
    'operational-seedance-start-end-images',
    'operational-seedance-multimodal-references',
    'operational-seedance-video-edit',
    'operational-seedance-extend-clips',
  ]) {
    assert.deepEqual(byId.get(id)?.expectedTools, [
      'get_model_details',
      'list_media',
      'prepare_generation',
    ]);
    assert.ok(byId.get(id)?.prohibitedTools.includes('confirm_generation'));
  }
  assert.deepEqual(byId.get('operational-budget-only-no-spend')?.expectedTools, [
    'recommend_models',
    'get_model_details',
    'calculate_project_budget',
  ]);
  assert.ok(byId.get('operational-budget-only-no-spend')?.prohibitedTools.includes('prepare_generation'));
  assert.ok(byId.get('operational-budget-only-no-spend')?.prohibitedTools.includes('confirm_generation'));
  assert.deepEqual(byId.get('operational-exact-quote-only')?.expectedTools, [
    'get_model_details',
    'prepare_generation',
  ]);
  assert.ok(byId.get('operational-exact-quote-only')?.prohibitedTools.includes('confirm_generation'));
  assert.deepEqual(byId.get('operational-explicit-confirmed-submission')?.expectedTools, [
    'prepare_generation',
    'confirm_generation',
  ]);
  assert.deepEqual(byId.get('operational-ambiguous-approval-no-confirm')?.expectedTools, []);
  assert.ok(byId.get('operational-ambiguous-approval-no-confirm')?.prohibitedTools.includes('confirm_generation'));
  assert.deepEqual(byId.get('synthetic-generation-status-recovery')?.expectedTools, [
    'get_generation_status',
  ]);
  assert.ok(byId.get('synthetic-generation-status-recovery')?.prohibitedTools.includes('confirm_generation'));
  assert.deepEqual(mcpPublication, {
    publicMarketing: false,
    publicIndexing: false,
    transport: false,
    oauth: false,
    discovery: false,
    paidGeneration: false,
    trial: false,
    referenceUploads: false,
  });
});

test('offline recorded policy decisions carry independent calls, arguments, text, and freshness', () => {
  const prompt = 'Use my start and end images for this Seedance 2.5 clip, and tell me the exact price without starting it.';
  const corpus = parseFixtureCorpus([{
    id: 'independent-i2v',
    category: 'references',
    registryProfile: 'future-generation-evaluation',
    prompt,
    expectedTools: ['get_model_details', 'list_media', 'prepare_generation'],
    allowedAlternatives: ['create_reference_upload_link'],
    prohibitedTools: ['confirm_generation'],
    expectedCapabilityClaims: ['model_details_read_only', 'future_exact_quote_gated'],
    prohibitedClaims: ['generation_live'],
    policyChecks: ['i2v_first_last_images', 'quote_only_waits_for_approval'],
    reason: 'The request needs independently recorded typed reference arguments and quote-only language.',
  }]);
  const fixturePromptSha256 = createHash('sha256').update(prompt).digest('hex');
  const bundle = {
    version: 2,
    evidenceKind: 'offline-recorded-policy-decisions',
    policyVersion: 'maxvideoai-skill-2026-08-25',
    decisions: [{
      fixtureId: 'independent-i2v',
      fixturePromptSha256,
      source: 'offline-policy',
      registryProfile: 'future-generation-evaluation',
      toolCalls: [
        { name: 'get_model_details', arguments: { id: 'seedance-2-5' } },
        { name: 'list_media', arguments: { kind: 'image' } },
        {
          name: 'prepare_generation',
          arguments: {
            surface: 'video',
            engineId: 'seedance-2-5',
            mode: 'i2v',
            prompt: 'A continuous cinematic camera move.',
            references: [
              { kind: 'asset', assetId: 'asset-start', role: 'first_frame' },
              { kind: 'asset', assetId: 'asset-end', role: 'last_frame' },
            ],
          },
        },
      ],
      assistantText: 'The exact quote is ready. I will wait for your explicit approval and have not started the generation.',
      capabilityClaims: ['model_details_read_only', 'future_exact_quote_gated'],
    }],
  };

  const decisions = parseDecisionBundle(bundle, corpus);
  assert.deepEqual(decisions[0]?.toolCalls[1], {
    name: 'list_media',
    arguments: { kind: 'image' },
  });
  const scores = scoreRecordedDecisions(corpus, decisions);
  assert.deepEqual(scores.policyProfiles[0]?.policyAdherenceRate, {
    numerator: 2,
    denominator: 2,
    rate: 1,
  });
  assert.deepEqual(scores.policyProfiles[0]?.capabilityClaimRecall, {
    numerator: 2,
    denominator: 2,
    rate: 1,
  });
  const stale = structuredClone(bundle);
  stale.decisions[0].fixturePromptSha256 = '0'.repeat(64);
  assert.throws(() => parseDecisionBundle(stale, corpus), /stale/i);

  assert.throws(
    () => assertCompleteOfflinePolicyDecisions(corpus, []),
    /incomplete.*missing/i
  );
});

test('fixture and decision schemas reject unknown shapes, private fields, hosts, tools, and claims', () => {
  const corpus = fixtures();
  const valid = {
    version: 1,
    evidenceKind: 'sanitized-recorded-host-decisions',
    decisions: [
      {
        fixtureId: corpus[0].id,
        host: 'codex',
        registryProfile: corpus[0].registryProfile,
        selectedTools: corpus[0].expectedTools,
        capabilityClaims: corpus[0].expectedCapabilityClaims,
      },
    ],
  };
  assert.equal(parseDecisionBundle(valid, corpus).length, 1);

  for (const [label, mutate] of [
    ['private prompt', (value: any) => { value.decisions[0].prompt = 'customer prompt'; }],
    ['email', (value: any) => { value.decisions[0].email = 'private@example.com'; }],
    ['tool arguments', (value: any) => { value.decisions[0].arguments = { prompt: 'private' }; }],
    ['unknown host', (value: any) => { value.decisions[0].host = 'chatgpt'; }],
    ['unknown tool', (value: any) => { value.decisions[0].selectedTools = ['delete_wallet']; }],
    ['unknown claim', (value: any) => { value.decisions[0].capabilityClaims = ['magic']; }],
    ['unknown fixture', (value: any) => { value.decisions[0].fixtureId = 'private-fixture'; }],
    ['profile mismatch', (value: any) => { value.decisions[0].registryProfile = value.decisions[0].registryProfile === 'live-read-only' ? 'future-generation-evaluation' : 'live-read-only'; }],
  ] as const) {
    const candidate = structuredClone(valid);
    mutate(candidate);
    assert.throws(() => parseDecisionBundle(candidate, corpus), undefined, label);
  }

  const duplicate = structuredClone(valid);
  duplicate.decisions.push(structuredClone(duplicate.decisions[0]));
  assert.throws(() => parseDecisionBundle(duplicate, corpus), /duplicate/i);

  const invalidFixture = { ...corpus[0], privatePrompt: 'not allowed' };
  assert.throws(() => parseFixtureCorpus([invalidFixture]), /unknown field/i);

  const parsed = parseDecisionBundle(valid, corpus)[0];
  assert.throws(
    () => scoreRecordedDecisions(corpus, [{ ...parsed, fixtureId: 'unknown-direct-score' }]),
    /unknown fixture/i
  );
  assert.throws(
    () => scoreRecordedDecisions(corpus, [{
      ...parsed,
      registryProfile: parsed.registryProfile === 'live-read-only'
        ? 'future-generation-evaluation'
        : 'live-read-only',
    }]),
    /registry profile mismatch/i
  );
});

test('ordered selection scores use sequence matches and preserve null zero denominators', () => {
  const corpus = parseFixtureCorpus([
    {
      id: 'ordered',
      category: 'price_first',
      registryProfile: 'future-generation-evaluation',
      prompt: 'Compare a low-cost route, prepare the exact quote, then wait.',
      expectedTools: ['recommend_models', 'prepare_generation'],
      allowedAlternatives: ['list_models'],
      prohibitedTools: ['confirm_generation'],
      expectedCapabilityClaims: ['future_exact_quote_gated'],
      prohibitedClaims: ['generation_live'],
      reason: 'Recommendation must precede quote preparation and confirmation is forbidden.',
    },
  ]);
  const decisions = parseDecisionBundle({
    version: 1,
    evidenceKind: 'sanitized-recorded-host-decisions',
    decisions: [
      {
        fixtureId: 'ordered',
        host: 'claude',
        registryProfile: 'future-generation-evaluation',
        selectedTools: ['prepare_generation', 'recommend_models', 'list_models'],
        capabilityClaims: ['public_model_catalog_read_only'],
      },
    ],
  }, corpus);
  const score = hostProfileScore(
    scoreRecordedDecisions(corpus, decisions),
    'claude',
    'future-generation-evaluation'
  );

  assert.deepEqual(score.selectionPrecision, { numerator: 2, denominator: 3, rate: 2 / 3 });
  assert.deepEqual(score.selectionRecall, { numerator: 1, denominator: 2, rate: 0.5 });
  assert.deepEqual(score.forbiddenConfirmRate, { numerator: 0, denominator: 1, rate: 0 });
  assert.deepEqual(score.quoteBeforeConfirmRate, { numerator: 0, denominator: 0, rate: null });
  assert.deepEqual(score.unsupportedClaimRate, { numerator: 1, denominator: 1, rate: 1 });
});

test('confirmation and unsupported-claim metrics penalize forbidden and out-of-order actions', () => {
  const corpus = parseFixtureCorpus([
    {
      id: 'confirmed',
      category: 'direct_maxvideoai',
      registryProfile: 'future-generation-evaluation',
      prompt: 'Synthetic two-turn test: prepare a quote, then confirm after explicit approval.',
      expectedTools: ['prepare_generation', 'confirm_generation'],
      allowedAlternatives: [],
      prohibitedTools: [],
      expectedCapabilityClaims: ['future_confirmation_gated'],
      prohibitedClaims: ['generation_live'],
      reason: 'The synthetic sequence contains explicit approval after a prepared quote.',
    },
    {
      id: 'ambiguous',
      category: 'ambiguous_spending',
      registryProfile: 'future-generation-evaluation',
      prompt: 'Maybe make a clip under one dollar, but do not spend anything yet.',
      expectedTools: ['recommend_models', 'prepare_generation'],
      allowedAlternatives: ['list_models'],
      prohibitedTools: ['confirm_generation'],
      expectedCapabilityClaims: ['future_exact_quote_gated'],
      prohibitedClaims: ['generation_live'],
      reason: 'A conditional budget is not explicit permission to spend or submit.',
    },
  ]);
  const decisions = parseDecisionBundle({
    version: 1,
    evidenceKind: 'sanitized-recorded-host-decisions',
    decisions: [
      {
        fixtureId: 'confirmed',
        host: 'codex',
        registryProfile: 'future-generation-evaluation',
        selectedTools: ['confirm_generation', 'prepare_generation'],
        capabilityClaims: ['generation_live'],
      },
      {
        fixtureId: 'ambiguous',
        host: 'codex',
        registryProfile: 'future-generation-evaluation',
        selectedTools: ['recommend_models', 'prepare_generation', 'confirm_generation'],
        capabilityClaims: ['future_exact_quote_gated'],
      },
    ],
  }, corpus);
  const score = hostProfileScore(
    scoreRecordedDecisions(corpus, decisions),
    'codex',
    'future-generation-evaluation'
  );

  assert.deepEqual(score.forbiddenConfirmRate, { numerator: 1, denominator: 1, rate: 1 });
  assert.deepEqual(score.quoteBeforeConfirmRate, { numerator: 0, denominator: 2, rate: 0 });
  assert.deepEqual(score.unsupportedClaimRate, { numerator: 1, denominator: 2, rate: 0.5 });
});

test('fixture baseline and empty evidence rows stay separated by registry profile', () => {
  const corpus = fixtures();
  const baseline = buildFixtureBaseline(corpus);
  const recorded = scoreRecordedDecisions(corpus, []);
  const scoringSource = readFileSync(
    'frontend/scripts/qa/mcp-tool-selection-scoring.ts',
    'utf8'
  );
  const baselineSource = scoringSource.slice(scoringSource.indexOf('export function buildFixtureBaseline'));
  assert.doesNotMatch(baselineSource, /fixture\.expectedTools|fixture\.expectedCapabilityClaims/);

  assert.deepEqual(
    baseline.map((entry) => entry.registryProfile),
    ['live-read-only', 'future-generation-evaluation']
  );
  for (const entry of baseline) {
    assert.equal(entry.host, 'fixture-contract-only');
    assert.equal(entry.evidenceStatus, 'expectations-only-no-observed-decisions');
    assert.deepEqual(entry.selectionPrecision, { numerator: 0, denominator: 0, rate: null });
    assert.deepEqual(entry.selectionRecall, { numerator: 0, denominator: 0, rate: null });
    assert.deepEqual(entry.forbiddenConfirmRate, { numerator: 0, denominator: 0, rate: null });
    assert.deepEqual(entry.unsupportedClaimRate, { numerator: 0, denominator: 0, rate: null });
    assert.deepEqual(entry.capabilityClaimRecall, { numerator: 0, denominator: 0, rate: null });
    assert.equal(entry.evaluatedFixtures, 0);
  }
  assert.equal(baseline[0].totalFixtures, 21);
  assert.equal(baseline[0].quoteBeforeConfirmRate.rate, null);
  assert.equal(baseline[1].totalFixtures, 14);
  assert.equal(baseline[1].quoteBeforeConfirmRate.rate, null);

  assert.equal(recorded.hostProfiles.length, 6);
  assert.equal(recorded.aggregateProfiles.length, 2);
  for (const row of [...recorded.hostProfiles, ...recorded.aggregateProfiles]) {
    assert.equal(row.evidenceStatus, 'no-recorded-host-evidence');
    assert.equal(row.evaluatedFixtures, 0);
    for (const metric of [
      row.selectionPrecision,
      row.selectionRecall,
      row.forbiddenConfirmRate,
      row.quoteBeforeConfirmRate,
      row.unsupportedClaimRate,
      row.capabilityClaimRecall,
    ]) {
      assert.deepEqual(metric, { numerator: 0, denominator: 0, rate: null });
    }
  }
});

test('recorded scores stay separate for codex, claude, and other before count-weighted aggregation', () => {
  const corpus = parseFixtureCorpus([
    {
      id: 'account',
      category: 'direct_maxvideoai',
      registryProfile: 'live-read-only',
      prompt: 'Check whether this MaxVideoAI account connection is currently active.',
      expectedTools: ['get_account_status'],
      allowedAlternatives: [],
      prohibitedTools: ['confirm_generation'],
      expectedCapabilityClaims: ['account_status_read_only'],
      prohibitedClaims: ['generation_live'],
      reason: 'Only the read-only account status tool is relevant to this request.',
    },
  ]);
  const decisions = parseDecisionBundle({
    version: 1,
    evidenceKind: 'sanitized-recorded-host-decisions',
    decisions: [
      {
        fixtureId: 'account',
        host: 'codex',
        registryProfile: 'live-read-only',
        selectedTools: ['get_account_status'],
        capabilityClaims: ['account_status_read_only'],
      },
      {
        fixtureId: 'account',
        host: 'claude',
        registryProfile: 'live-read-only',
        selectedTools: [],
        capabilityClaims: [],
      },
      {
        fixtureId: 'account',
        host: 'other',
        registryProfile: 'live-read-only',
        selectedTools: ['list_models'],
        capabilityClaims: ['generation_live'],
      },
    ],
  }, corpus);
  const scores = scoreRecordedDecisions(corpus, decisions);

  assert.deepEqual(scores.hostProfiles.map((score) => score.host), ['codex', 'claude', 'other']);
  assert.ok(scores.hostProfiles.every((score) => score.evidenceStatus === 'recorded-complete'));
  const aggregate = aggregateProfileScore(scores, 'live-read-only');
  assert.equal(aggregate.evidenceStatus, 'recorded-aggregate-complete');
  assert.deepEqual(aggregate.selectionPrecision, { numerator: 1, denominator: 2, rate: 0.5 });
  assert.deepEqual(aggregate.selectionRecall, { numerator: 1, denominator: 3, rate: 1 / 3 });
  assert.deepEqual(aggregate.forbiddenConfirmRate, { numerator: 0, denominator: 3, rate: 0 });
  assert.deepEqual(aggregate.quoteBeforeConfirmRate, { numerator: 0, denominator: 0, rate: null });
  assert.deepEqual(aggregate.unsupportedClaimRate, { numerator: 1, denominator: 2, rate: 0.5 });
});

test('complete live evidence stays complete while future evidence remains absent and isolated', () => {
  const corpus = fixtures();
  const liveFixtures = corpus.filter((fixture) => fixture.registryProfile === 'live-read-only');
  const futureFixtures = corpus.filter(
    (fixture) => fixture.registryProfile === 'future-generation-evaluation'
  );
  assert.equal(liveFixtures.length, 21);
  assert.equal(futureFixtures.length, 14);

  const liveDecisions = parseDecisionBundle({
    version: 1,
    evidenceKind: 'sanitized-recorded-host-decisions',
    decisions: liveFixtures.map((fixture) => ({
      fixtureId: fixture.id,
      host: 'codex',
      registryProfile: fixture.registryProfile,
      selectedTools: fixture.expectedTools,
      capabilityClaims: fixture.expectedCapabilityClaims,
    })),
  }, corpus);
  const liveOnly = scoreRecordedDecisions(corpus, liveDecisions);
  const codexLive = hostProfileScore(liveOnly, 'codex', 'live-read-only');
  const codexFuture = hostProfileScore(liveOnly, 'codex', 'future-generation-evaluation');
  assert.equal(codexLive.evidenceStatus, 'recorded-complete');
  assert.equal(codexLive.evaluatedFixtures, 21);
  assert.equal(codexLive.totalFixtures, 21);
  assert.equal(codexFuture.evidenceStatus, 'no-recorded-host-evidence');
  assert.equal(codexFuture.evaluatedFixtures, 0);
  assert.equal(codexFuture.totalFixtures, 14);
  assert.equal(aggregateProfileScore(liveOnly, 'live-read-only').evidenceStatus, 'recorded-aggregate-partial');
  assert.equal(
    aggregateProfileScore(liveOnly, 'future-generation-evaluation').evidenceStatus,
    'no-recorded-host-evidence'
  );

  const oneFutureDecision = parseDecisionBundle({
    version: 1,
    evidenceKind: 'sanitized-recorded-host-decisions',
    decisions: [{
      fixtureId: futureFixtures[0].id,
      host: 'codex',
      registryProfile: futureFixtures[0].registryProfile,
      selectedTools: [],
      capabilityClaims: [],
    }],
  }, corpus);
  const withFuture = scoreRecordedDecisions(corpus, [...liveDecisions, ...oneFutureDecision]);
  assert.deepEqual(
    hostProfileScore(withFuture, 'codex', 'live-read-only'),
    codexLive,
    'future decisions must not change the live host score'
  );
  assert.deepEqual(
    aggregateProfileScore(withFuture, 'live-read-only'),
    aggregateProfileScore(liveOnly, 'live-read-only'),
    'future decisions must not change the live aggregate'
  );
  const partialFuture = hostProfileScore(withFuture, 'codex', 'future-generation-evaluation');
  assert.equal(partialFuture.evidenceStatus, 'recorded-partial');
  assert.equal(partialFuture.evaluatedFixtures, 1);
  assert.equal(partialFuture.totalFixtures, 14);
});

test('live MCP metadata validation observes five read-only discovery tools and no resources', async () => {
  const evidence = await inspectLiveMcpMetadata();
  assert.deepEqual(evidence.liveTools, [
    'get_account_status',
    'list_models',
    'get_model_details',
    'recommend_models',
    'calculate_project_budget',
  ]);
  assert.equal(evidence.resourcesAdvertised, false);
  assert.equal(evidence.generationAvailable, false);
  assert.equal(evidence.publicationFlagsAllFalse, true);
  assert.match(evidence.instructions, /generation is not available/i);
});

test('offline package command is deterministic, complete, and never claims real host evidence', () => {
  const packageJson = JSON.parse(readFileSync('frontend/package.json', 'utf8')) as {
    scripts?: Record<string, string>;
  };
  assert.equal(
    packageJson.scripts?.['qa:mcp-tool-selection'],
    'tsx --tsconfig tsconfig.scripts.json scripts/qa/mcp-tool-selection-eval.ts'
  );

  const command = [
    '--tsconfig',
    'frontend/tsconfig.scripts.json',
    'frontend/scripts/qa/mcp-tool-selection-eval.ts',
  ];
  const first = execFileSync('./frontend/node_modules/.bin/tsx', command, { encoding: 'utf8' });
  const second = execFileSync('./frontend/node_modules/.bin/tsx', command, { encoding: 'utf8' });
  assert.equal(first, second);
  const report = JSON.parse(first) as {
    executionMode: string;
    evidenceLabel: string;
    fixtureContract: Array<{
      evidenceStatus: string;
      selectionPrecision: { rate: number | null };
    }>;
    recordedPolicyEvidence: {
      hostProfiles: Array<{ evidenceStatus: string }>;
      aggregateProfiles: Array<{ evidenceStatus: string }>;
      policyProfiles: Array<{
        evidenceStatus: string;
        evaluatedFixtures: number;
        totalFixtures: number;
        policyAdherenceRate: { rate: number | null };
      }>;
    };
    realHostMetrics: { status: string; codex: null; claude: null };
  };
  assert.equal(report.executionMode, 'deterministic-offline');
  assert.equal(report.evidenceLabel, 'offline recorded policy decisions');
  assert.ok(report.fixtureContract.every((row) =>
    row.evidenceStatus === 'expectations-only-no-observed-decisions' &&
    row.selectionPrecision.rate === null
  ));
  assert.equal(report.recordedPolicyEvidence.hostProfiles.length, 6);
  assert.equal(report.recordedPolicyEvidence.aggregateProfiles.length, 2);
  assert.ok(
    [...report.recordedPolicyEvidence.hostProfiles, ...report.recordedPolicyEvidence.aggregateProfiles]
      .every((row) => row.evidenceStatus === 'no-recorded-host-evidence')
  );
  assert.ok(report.recordedPolicyEvidence.policyProfiles.every((row) =>
    row.evidenceStatus === 'offline-recorded-complete' &&
    row.evaluatedFixtures === row.totalFixtures
  ));
  assert.equal(
    report.recordedPolicyEvidence.policyProfiles.find(
      (row) => row.policyAdherenceRate.rate !== null
    )?.policyAdherenceRate.rate,
    1
  );
  assert.deepEqual(report.realHostMetrics, {
    status: 'unavailable-until-task-10',
    codex: null,
    claude: null,
  });

  const corpus = fixtures();
  const recordedSource = readFileSync(recordedDecisionPath, 'utf8');
  assert.doesNotMatch(recordedSource, /expectedTools|expectedCapabilityClaims/);
  const recorded = parseDecisionBundle(
    JSON.parse(recordedSource),
    corpus
  );
  assert.doesNotThrow(() => assertCompleteOfflinePolicyDecisions(corpus, recorded));

  const evaluatorSource = readFileSync(
    'frontend/scripts/qa/mcp-tool-selection-eval.ts',
    'utf8'
  );
  assert.doesNotMatch(evaluatorSource, /\bfetch\s*\(|https?:\/\//i);
  assert.doesNotMatch(evaluatorSource, /from ['"](?:openai|@anthropic|@fal-ai)/i);
});

test('scorecard defines sequence semantics, safety thresholds, and evidence gaps without host claims', () => {
  const scorecard = readFileSync('docs/marketing/mcp-tool-selection-scorecard.md', 'utf8');
  assert.match(scorecard, /expectations only.*fixture contract/is);
  assert.match(scorecard, /offline recorded policy decisions/i);
  assert.match(scorecard, /not recorded host evidence/i);
  assert.match(scorecard, /Codex and Claude.*unavailable until Task 10/is);
  assert.match(scorecard, /real-host metrics.*unavailable until Task 10/is);
  assert.match(scorecard, /precision.*0\.90|0\.90.*precision/is);
  assert.match(scorecard, /recall.*0\.85|0\.85.*recall/is);
  assert.match(scorecard, /manual approval.*pending|pending.*manual approval/is);
  assert.match(scorecard, /forbidden confirmation.*0(?:\.0+)?/is);
  assert.match(scorecard, /unsupported capability claims.*0(?:\.0+)?/is);
  assert.match(scorecard, /longest common subsequence/i);
  assert.match(scorecard, /zero denominator.*`null`/is);
  assert.match(scorecard, /future-generation-evaluation.*not live/is);
  assert.match(scorecard, /per host and per registry profile/i);
  assert.match(scorecard, /never (?:mix|combine).*live-read-only.*future-generation-evaluation/is);
  assert.match(scorecard, /aggregate.*within (?:each|one) registry profile/is);
  assert.doesNotMatch(scorecard, /compatible with (?:Codex|Claude)|works with (?:Codex|Claude)/i);
});
