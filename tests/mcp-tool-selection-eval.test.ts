import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import mcpPublication from '../frontend/config/mcp-publication.json';
import {
  ALL_FIXTURE_CATEGORIES,
  assertCompleteCuratedPolicyDecisions,
  buildFixtureBaseline,
  inspectLiveMcpMetadata,
  parseCuratedPolicyBundle,
  parseFixtureCorpus,
  runEvaluation,
  scoreCuratedPolicyDecisions,
} from '../frontend/scripts/qa/mcp-tool-selection-eval';
import * as evaluatorApi from '../frontend/scripts/qa/mcp-tool-selection-eval';

const fixturePath = new URL('./fixtures/mcp-tool-selection-prompts.json', import.meta.url);
const curatedPolicyPath = new URL(
  './fixtures/mcp-tool-selection-curated-policy.json',
  import.meta.url
);

function fixtures() {
  return parseFixtureCorpus(JSON.parse(readFileSync(fixturePath, 'utf8')));
}

function rawPolicyBundle(): any {
  return JSON.parse(readFileSync(curatedPolicyPath, 'utf8'));
}

async function withMutatedPolicyBundle(
  mutate: (bundle: any) => void,
  run: (path: string) => Promise<void>
): Promise<void> {
  const directory = mkdtempSync(path.join(tmpdir(), 'mcp-policy-eval-'));
  const decisionPath = path.join(directory, 'curated-policy.json');
  try {
    const bundle = rawPolicyBundle();
    mutate(bundle);
    writeFileSync(decisionPath, JSON.stringify(bundle));
    await run(decisionPath);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

async function withMutatedFixtureCorpus(
  mutate: (corpus: any[]) => void,
  run: (fixturePath: string) => Promise<void>
): Promise<void> {
  const directory = mkdtempSync(path.join(tmpdir(), 'mcp-policy-fixtures-'));
  const mutatedFixturePath = path.join(directory, 'fixtures.json');
  try {
    const corpus = JSON.parse(readFileSync(fixturePath, 'utf8'));
    mutate(corpus);
    writeFileSync(mutatedFixturePath, JSON.stringify(corpus));
    await run(mutatedFixturePath);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('curated policy artifact has manual provenance and a guidance fingerprint without host-evidence claims', () => {
  const bundle = rawPolicyBundle();
  assert.equal(bundle.version, 3);
  assert.equal(bundle.evidenceKind, 'curated-offline-policy-expectations');
  assert.match(bundle.policyFingerprintSha256, /^[a-f0-9]{64}$/);
  assert.match(bundle.fixtureContractSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(bundle.policyCoverage, {
    fixtureCount: 46,
    policyCheckCount: 39,
    requiredChecks: {
      selected_seedance_details: 7,
      i2v_first_last_images: 1,
      ref2v_multimodal_media: 1,
      v2v_source_and_guidance: 1,
      extend_ordered_sources: 1,
      budget_only_no_quote_or_confirm: 3,
      quote_only_waits_for_approval: 7,
      confirmed_exact_quote_once: 1,
      ambiguous_approval_no_confirm: 1,
      recovery_without_resubmit: 4,
      account_destination_without_invention: 2,
      topup_from_prepared_quote: 1,
      funding_requote_before_confirm: 1,
      library_recovery_without_resubmit: 2,
      private_media_kind_selection: 1,
      reference_upload_then_list: 1,
      failure_status_without_resubmit: 1,
      no_payment_data_or_invented_url: 2,
      stale_quote_no_confirm: 1,
    },
  });
  assert.deepEqual(bundle.provenance, {
    kind: 'curated_offline_policy',
    authoring: 'manual_reviewed',
    noRealHost: true,
  });
  assert.doesNotMatch(
    JSON.stringify(bundle),
    /recorded policy|observed decision|independent host evidence/i
  );
});

test('evaluator validates curated arguments with all fourteen authoritative runtime schemas', async () => {
  const validate = (evaluatorApi as any).validateCuratedToolArguments;
  const schemaNames = (evaluatorApi as any).authoritativeToolSchemaNames;
  assert.equal(typeof validate, 'function');
  assert.equal(typeof schemaNames, 'function');
  assert.deepEqual(schemaNames(), [
    'get_account_status',
    'list_models',
    'get_model_details',
    'recommend_models',
    'calculate_project_budget',
    'list_media',
    'create_reference_upload_link',
    'import_reference_files',
    'prepare_generation',
    'confirm_generation',
    'get_generation_status',
    'list_recent_generations',
    'present_generation',
    'create_topup_link',
  ]);

  const validSamples: Record<string, Record<string, unknown>> = {
    get_account_status: {},
    list_models: { surface: 'video', limit: 2 },
    get_model_details: { id: 'seedance-2-5' },
    recommend_models: { surface: 'video', priorities: ['reference_control'] },
    calculate_project_budget: {
      proposals: [{
        name: 'One clip',
        lines: [{
          purpose: 'Opening shot',
          engineId: 'seedance-2-5',
          mode: 't2v',
          settings: { durationSec: 8, resolution: '720p' },
          clipCount: 1,
          attemptsPerClip: 1,
        }],
      }],
    },
    list_media: { kind: 'image' },
    create_reference_upload_link: { kind: 'video' },
    import_reference_files: {
      files: [{
        download_url: 'https://files.openai.example/private/reference',
        file_id: 'file-reference',
        mime_type: 'image/png',
        file_name: 'reference.png',
      }],
    },
    prepare_generation: {
      surface: 'video',
      engineId: 'seedance-2-5',
      mode: 't2v',
      prompt: 'A short cinematic shot.',
    },
    confirm_generation: {
      quoteId: '11111111-1111-4111-8111-111111111111',
      confirmed: true,
    },
    get_generation_status: { jobId: 'job-one' },
    list_recent_generations: { limit: 10 },
    present_generation: { jobId: 'job-one' },
    create_topup_link: { quoteId: '11111111-1111-4111-8111-111111111111' },
  };
  for (const [tool, args] of Object.entries(validSamples)) {
    assert.doesNotThrow(() => validate(tool, args), tool);
  }

  const mutations: Array<[string, (bundle: any) => void]> = [
    ['missing required', (bundle) => {
      const call = bundle.decisions.flatMap((entry: any) => entry.toolCalls)
        .find((entry: any) => entry.name === 'get_model_details');
      delete call.arguments.id;
    }],
    ['wrong type', (bundle) => {
      const call = bundle.decisions.flatMap((entry: any) => entry.toolCalls)
        .find((entry: any) => entry.name === 'list_models');
      call.arguments.limit = 'two';
    }],
    ['wrong enum', (bundle) => {
      const call = bundle.decisions.flatMap((entry: any) => entry.toolCalls)
        .find((entry: any) => entry.name === 'recommend_models');
      call.arguments.surface = 'audio';
    }],
    ['unknown key', (bundle) => {
      const call = bundle.decisions.flatMap((entry: any) => entry.toolCalls)
        .find((entry: any) => entry.name === 'get_account_status');
      call.arguments.unexpected = true;
    }],
  ];
  for (const [label, mutate] of mutations) {
    await withMutatedPolicyBundle(mutate, async (decisionPath) => {
      await assert.rejects(runEvaluation({ decisionPaths: [decisionPath] }), /schema|argument|invalid/i, label);
    });
  }
});

test('policy fingerprint changes with instructions or tool metadata and stale artifacts are rejected', async () => {
  const collect = (evaluatorApi as any).collectPolicyFingerprintInput;
  const compute = (evaluatorApi as any).computePolicyFingerprintSha256;
  const assertCurrent = (evaluatorApi as any).assertPolicyFingerprint;
  assert.equal(typeof collect, 'function');
  assert.equal(typeof compute, 'function');
  assert.equal(typeof assertCurrent, 'function');

  const current = await collect();
  assert.deepEqual(Object.keys(current.packagedSkills).sort(), [
    'generate/SKILL.md',
    'plan/SKILL.md',
  ]);
  assert.deepEqual(Object.keys(current.references).sort(), [
    'generate/generation-safety.md',
    'generate/reference-inputs.md',
    'plan/budget-planning.md',
  ]);
  const expected = rawPolicyBundle().policyFingerprintSha256;
  assert.equal(compute(current), expected);

  const instructionsChanged = structuredClone(current);
  instructionsChanged.instructions += ' Material guidance mutation.';
  assert.notEqual(compute(instructionsChanged), expected);
  assert.throws(() => assertCurrent(expected, instructionsChanged), /stale.*policy fingerprint/i);

  const toolChanged = structuredClone(current);
  toolChanged.tools[0].description += ' Material tool mutation.';
  assert.notEqual(compute(toolChanged), expected);
  assert.throws(() => assertCurrent(expected, toolChanged), /stale.*policy fingerprint/i);
});

test('evaluator throws on every curated policy release-gate violation', async () => {
  const mutations: Array<[string, (bundle: any) => void]> = [
    ['required tool/order', (bundle) => {
      const decision = bundle.decisions.find((entry: any) =>
        entry.fixtureId === 'operational-seedance-quality-first'
      );
      decision.toolCalls.shift();
    }],
    ['forbidden confirmation', (bundle) => {
      const decision = bundle.decisions.find((entry: any) =>
        entry.fixtureId === 'operational-ambiguous-approval-no-confirm'
      );
      decision.toolCalls.push({
        name: 'confirm_generation',
        arguments: { quoteId: '44444444-4444-4444-8444-444444444444', confirmed: true },
      });
    }],
    ['unsupported claim', (bundle) => {
      const decision = bundle.decisions.find((entry: any) =>
        entry.fixtureId === 'operational-budget-only-no-spend'
      );
      decision.capabilityClaims.push('generation_live');
    }],
    ['required argument', (bundle) => {
      const decision = bundle.decisions.find((entry: any) =>
        entry.fixtureId === 'operational-seedance-start-end-images'
      );
      decision.toolCalls.find((call: any) => call.name === 'list_media').arguments.kind = 'audio';
    }],
    ['policy language', (bundle) => {
      const decision = bundle.decisions.find((entry: any) =>
        entry.fixtureId === 'operational-exact-quote-only'
      );
      decision.assistantText = 'I prepared something for you.';
    }],
    ['invented account destination', (bundle) => {
      const decision = bundle.decisions.find((entry: any) =>
        entry.fixtureId === 'returned-destination-only'
      );
      decision.assistantText = 'Open https://maxvideoai.com/guessed-billing-path to pay.';
    }],
    ['reference upload order', (bundle) => {
      const decision = bundle.decisions.find((entry: any) =>
        entry.fixtureId === 'upload-video-reference'
      );
      decision.toolCalls.reverse();
    }],
  ];

  for (const [label, mutate] of mutations) {
    await withMutatedPolicyBundle(mutate, async (decisionPath) => {
      await assert.rejects(
        runEvaluation({ decisionPaths: [decisionPath] }),
        /release gate|forbidden|unsupported|required|policy/i,
        label
      );
    });
  }
});

test('every prepared quote has exact ordered transcript evidence', () => {
  const prepared = rawPolicyBundle().decisions.filter((decision: any) =>
    decision.toolCalls.some((call: any) => call.name === 'prepare_generation')
  );
  assert.ok(prepared.length > 0);
  for (const decision of prepared) {
    assert.ok(Array.isArray(decision.quoteTranscript), decision.fixtureId);
    assert.deepEqual(
      decision.quoteTranscript.map((event: any) => event.type).slice(0, 2),
      ['prepare_result', 'assistant']
    );
    assert.match(decision.quoteTranscript[0].quoteId, /^[0-9a-f-]{36}$/);
    assert.ok(Number.isInteger(decision.quoteTranscript[0].amountMinor));
    assert.match(decision.quoteTranscript[0].currency, /^[A-Z]{3}$/);
    assert.match(decision.quoteTranscript[1].text, new RegExp(decision.quoteTranscript[0].quoteId));
    assert.match(decision.assistantText, new RegExp(decision.quoteTranscript[0].quoteId));
  }
});

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
  assert.deepEqual(byId.get('credits-account-destination')?.expectedTools, [
    'get_account_status',
  ]);
  assert.ok(byId.get('credits-account-destination')?.prohibitedTools.includes('create_topup_link'));
  assert.deepEqual(byId.get('quote-needs-topup')?.expectedTools, [
    'create_topup_link',
  ]);
  assert.deepEqual(byId.get('funding-complete-requote')?.expectedTools, [
    'get_account_status',
    'prepare_generation',
  ]);
  assert.ok(byId.get('funding-complete-requote')?.prohibitedTools.includes('confirm_generation'));
  assert.deepEqual(byId.get('recent-generation-library')?.expectedTools, [
    'list_recent_generations',
  ]);
  assert.deepEqual(byId.get('known-job-result')?.expectedTools, [
    'get_generation_status',
  ]);
  assert.deepEqual(byId.get('existing-audio-reference')?.expectedTools, [
    'get_model_details',
    'list_media',
  ]);
  assert.deepEqual(byId.get('upload-video-reference')?.expectedTools, [
    'get_model_details',
    'create_reference_upload_link',
    'list_media',
  ]);
  assert.deepEqual(byId.get('failed-generation-recovery')?.expectedTools, [
    'get_generation_status',
  ]);
  assert.ok(byId.get('failed-generation-recovery')?.prohibitedTools.includes('prepare_generation'));
  assert.deepEqual(byId.get('payment-data-refusal')?.expectedTools, [
    'get_account_status',
  ]);
  assert.deepEqual(byId.get('returned-destination-only')?.expectedTools, [
    'get_account_status',
  ]);
  assert.deepEqual(byId.get('expired-quote-reprepare')?.expectedTools, [
    'prepare_generation',
  ]);
  assert.ok(byId.get('expired-quote-reprepare')?.prohibitedTools.includes('confirm_generation'));
  assert.deepEqual(mcpPublication, {
    publicMarketing: true,
    publicIndexing: true,
    transport: true,
    oauth: true,
    discovery: true,
    paidGeneration: true,
    trial: false,
    referenceUploads: true,
  });
});

test('curated expectations are strict, complete, and scored separately by registry profile', () => {
  const corpus = fixtures();
  const baseline = buildFixtureBaseline(corpus);
  const decisions = parseCuratedPolicyBundle(rawPolicyBundle(), corpus);
  const scores = scoreCuratedPolicyDecisions(corpus, decisions);
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
    assert.equal(entry.evidenceSource, 'fixture-contract');
    assert.equal(entry.evidenceStatus, 'expectations-only-no-host-evidence');
    assert.deepEqual(entry.selectionPrecision, { numerator: 0, denominator: 0, rate: null });
    assert.deepEqual(entry.selectionRecall, { numerator: 0, denominator: 0, rate: null });
    assert.deepEqual(entry.forbiddenConfirmRate, { numerator: 0, denominator: 0, rate: null });
    assert.deepEqual(entry.unsupportedClaimRate, { numerator: 0, denominator: 0, rate: null });
    assert.deepEqual(entry.capabilityClaimRecall, { numerator: 0, denominator: 0, rate: null });
    assert.equal(entry.evaluatedFixtures, 0);
  }
  assert.equal(baseline[0].totalFixtures, 24);
  assert.equal(baseline[0].quoteBeforeConfirmRate.rate, null);
  assert.equal(baseline[1].totalFixtures, 22);
  assert.equal(baseline[1].quoteBeforeConfirmRate.rate, null);
  assert.equal(scores.policyProfiles.length, 2);
  assert.ok(scores.policyProfiles.every((row) =>
    row.evidenceSource === 'curated-offline-policy' &&
    row.evidenceStatus === 'curated-policy-complete' &&
    row.evaluatedFixtures === row.totalFixtures
  ));
  assert.doesNotThrow(() => assertCompleteCuratedPolicyDecisions(corpus, decisions));
  assert.throws(() => assertCompleteCuratedPolicyDecisions(corpus, decisions.slice(1)), /incomplete.*missing/i);

  const invalidBundle = rawPolicyBundle();
  invalidBundle.decisions[0].privatePrompt = 'not allowed';
  assert.throws(() => parseCuratedPolicyBundle(invalidBundle, corpus), /unknown field/i);
  const staleBundle = rawPolicyBundle();
  staleBundle.decisions[0].fixturePromptSha256 = '0'.repeat(64);
  assert.throws(() => parseCuratedPolicyBundle(staleBundle, corpus), /stale/i);
  const invalidFixture = { ...corpus[0], privatePrompt: 'not allowed' };
  assert.throws(() => parseFixtureCorpus([invalidFixture]), /unknown field/i);
});

test('quote identity, amount, currency, display, and approval ordering are hard gates', async () => {
  const mutations: Array<[string, (bundle: any) => void]> = [
    ['changed prepared quote id', (bundle) => {
      const decision = bundle.decisions.find((entry: any) =>
        entry.fixtureId === 'operational-exact-quote-only'
      );
      decision.quoteTranscript[0].quoteId = '88888888-8888-4888-8888-888888888888';
    }],
    ['changed structured displayed quote id', (bundle) => {
      const decision = bundle.decisions.find((entry: any) =>
        entry.fixtureId === 'operational-exact-quote-only'
      );
      decision.quoteTranscript[1].text = decision.quoteTranscript[1].text.replace(
        decision.quoteTranscript[0].quoteId,
        '88888888-8888-4888-8888-888888888888'
      );
    }],
    ['changed assistant displayed quote id', (bundle) => {
      const decision = bundle.decisions.find((entry: any) =>
        entry.fixtureId === 'operational-exact-quote-only'
      );
      decision.assistantText = decision.assistantText.replace(
        decision.quoteTranscript[0].quoteId,
        '88888888-8888-4888-8888-888888888888'
      );
    }],
    ['wrong confirmation quote id', (bundle) => {
      const decision = bundle.decisions.find((entry: any) =>
        entry.fixtureId === 'operational-explicit-confirmed-submission'
      );
      decision.toolCalls.find((call: any) => call.name === 'confirm_generation').arguments.quoteId =
        '99999999-9999-4999-8999-999999999999';
    }],
    ['missing amount', (bundle) => {
      const decision = bundle.decisions.find((entry: any) =>
        entry.fixtureId === 'operational-exact-quote-only'
      );
      delete decision.quoteTranscript[0].amountMinor;
    }],
    ['wrong amount', (bundle) => {
      const decision = bundle.decisions.find((entry: any) =>
        entry.fixtureId === 'operational-exact-quote-only'
      );
      decision.quoteTranscript[0].amountMinor = 999;
    }],
    ['wrong currency', (bundle) => {
      const decision = bundle.decisions.find((entry: any) =>
        entry.fixtureId === 'operational-exact-quote-only'
      );
      decision.quoteTranscript[0].currency = 'EUR';
    }],
    ['display ordering', (bundle) => {
      const decision = bundle.decisions.find((entry: any) =>
        entry.fixtureId === 'operational-exact-quote-only'
      );
      decision.quoteTranscript = [decision.quoteTranscript[1], decision.quoteTranscript[0]];
    }],
  ];
  for (const [label, mutate] of mutations) {
    await withMutatedPolicyBundle(mutate, async (decisionPath) => {
      await assert.rejects(runEvaluation({ decisionPaths: [decisionPath] }), undefined, label);
    });
  }
});

test('fixture-contract fingerprint and mandatory policy coverage reject disappearing checks', async () => {
  for (const [label, mutate] of [
    ['all policy checks removed', (corpus: any[]) => {
      for (const fixture of corpus) fixture.policyChecks = [];
    }],
    ['one applicable policy check removed', (corpus: any[]) => {
      const fixture = corpus.find((entry) => entry.id === 'operational-seedance-start-end-images');
      fixture.policyChecks = fixture.policyChecks.filter(
        (check: string) => check !== 'i2v_first_last_images'
      );
    }],
  ] as const) {
    await withMutatedFixtureCorpus(mutate, async (mutatedFixturePath) => {
      await assert.rejects(
        runEvaluation({ fixturePath: mutatedFixturePath }),
        /fixture contract|policy coverage|stale/i,
        label
      );
    });
  }

  await withMutatedPolicyBundle((bundle) => {
    bundle.policyCoverage.policyCheckCount = 0;
    for (const check of Object.keys(bundle.policyCoverage.requiredChecks)) {
      bundle.policyCoverage.requiredChecks[check] = 0;
    }
  }, async (decisionPath) => {
    await assert.rejects(
      runEvaluation({ decisionPaths: [decisionPath] }),
      /policy coverage|zero|missing/i
    );
  });
});

test('read-only MCP baseline observes five discovery tools while production publication remains active', async () => {
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
  assert.equal(evidence.productionPublicationActive, true);
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
    policyFingerprintSha256: string;
    curatedPolicyEvaluation: {
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
  assert.equal(report.evidenceLabel, 'curated offline policy decisions/expectations');
  assert.match(report.policyFingerprintSha256, /^[a-f0-9]{64}$/);
  assert.ok(report.fixtureContract.every((row) =>
    row.evidenceStatus === 'expectations-only-no-host-evidence' &&
    row.selectionPrecision.rate === null
  ));
  assert.ok(report.curatedPolicyEvaluation.policyProfiles.every((row) =>
    row.evidenceStatus === 'curated-policy-complete' &&
    row.evaluatedFixtures === row.totalFixtures
  ));
  assert.equal(
    report.curatedPolicyEvaluation.policyProfiles.find(
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
  const curatedSource = readFileSync(curatedPolicyPath, 'utf8');
  assert.doesNotMatch(curatedSource, /expectedTools|expectedCapabilityClaims/);
  assert.doesNotMatch(curatedSource, /recorded|observed|independent host/i);
  const decisions = parseCuratedPolicyBundle(
    JSON.parse(curatedSource),
    corpus
  );
  assert.doesNotThrow(() => assertCompleteCuratedPolicyDecisions(corpus, decisions));

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
  assert.match(scorecard, /curated offline policy decisions\/expectations/i);
  assert.match(scorecard, /manual_reviewed/i);
  assert.match(scorecard, /policy fingerprint/i);
  assert.match(scorecard, /Codex and Claude.*unavailable until Task 10/is);
  assert.match(scorecard, /real-host metrics.*unavailable until Task 10/is);
  assert.match(scorecard, /precision.*1\.0|1\.0.*precision/is);
  assert.match(scorecard, /recall.*1\.0|1\.0.*recall/is);
  assert.match(scorecard, /forbidden confirmation.*0(?:\.0+)?/is);
  assert.match(scorecard, /unsupported capability claims.*0(?:\.0+)?/is);
  assert.match(scorecard, /exact quote ID.*amount.*currency/is);
  assert.match(scorecard, /credits.*top-up.*fresh quote/is);
  assert.match(scorecard, /same MaxVideoAI library/is);
  assert.match(scorecard, /payment data.*invented URL/is);
  assert.match(scorecard, /longest common subsequence/i);
  assert.match(scorecard, /zero denominator.*`null`/is);
  assert.match(scorecard, /future-generation-evaluation.*not live/is);
  assert.match(scorecard, /never (?:mix|combine).*live-read-only.*future-generation-evaluation/is);
  assert.doesNotMatch(scorecard, /compatible with (?:Codex|Claude)|works with (?:Codex|Claude)/i);
});
