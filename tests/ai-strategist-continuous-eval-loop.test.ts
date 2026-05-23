import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { generateStrategistScenariosFromSeeds } from '../scripts/generate-ai-strategist-scenarios.ts';
import {
  clusterStrategistFailures,
  scoreStrategistTranscript,
} from '../scripts/judge-ai-strategist-conversations.ts';
import { shouldStopStrategistLoop } from '../scripts/run-ai-strategist-improvement-loop.ts';
import { runAiStrategistPlaygroundPipeline } from '../frontend/lib/ai-strategist/playground-pipeline.ts';

test('AI Strategist scenario seeds are English-first and cover real-life client behavior', () => {
  const fixture = JSON.parse(readFileSync('docs/ai-strategist/evals/scenario-seeds.json', 'utf8')) as {
    version: number;
    seeds: Array<{
      id: string;
      language: string;
      persona: string;
      category: string;
      turns: string[];
      expected: {
        primaryTask: string;
        shouldRecommend?: boolean;
        shouldAskClarification?: boolean;
        shouldAnswerHelp?: boolean;
        shouldPreserveContext?: boolean;
      };
    }>;
  };

  assert.equal(fixture.version, 1);
  assert.ok(fixture.seeds.length >= 60, 'seed bank should be large enough to simulate real traffic');

  const englishCount = fixture.seeds.filter((seed) => seed.language === 'en').length;
  assert.ok(englishCount / fixture.seeds.length >= 0.7, 'seed bank must be English-first');

  const categories = new Set(fixture.seeds.map((seed) => seed.category));
  for (const category of [
    'greeting',
    'new_brief',
    'model_advice',
    'pricing',
    'examples',
    'workflow_help',
    'prompt_improvement',
    'asset_reference',
    'state_follow_up',
    'messy_input',
  ]) {
    assert.ok(categories.has(category), `missing category: ${category}`);
  }
});

test('scenario generator creates runnable English-first eval scenarios', () => {
  const generated = generateStrategistScenariosFromSeeds({
    seedPath: 'docs/ai-strategist/evals/scenario-seeds.json',
    batchSize: 40,
    englishFirst: true,
  });

  assert.equal(generated.version, 1);
  assert.equal(generated.scenarios.length, 40);
  assert.ok(generated.scenarios.every((scenario) => scenario.turns.length >= 1));

  const englishCount = generated.scenarios.filter((scenario) => scenario.id.includes('en-')).length;
  assert.ok(englishCount / generated.scenarios.length >= 0.7);
});

test('quality judge scores advisor behavior and clusters failures by owner', () => {
  const score = scoreStrategistTranscript({
    userMessage: 'hi',
    assistantMessage: 'What video are you trying to create or improve?',
    task: 'new_video_brief',
    action: 'recommend_models',
    stage: 'collecting_brief',
  });

  assert.ok(score.score < 7);
  assert.ok(score.issues.some((issue) => issue.includes('generic clarification')));

  const clusters = clusterStrategistFailures([
    { owner: 'conversation state merge / planner follow-up handling', message: 'lost selected model' },
    { owner: 'conversation state merge / planner follow-up handling', message: 'lost previous brief' },
    { owner: 'engine catalog pricing tool', message: 'missing quote' },
  ]);

  assert.equal(clusters[0]?.owner, 'conversation state merge / planner follow-up handling');
  assert.equal(clusters[0]?.count, 2);
});

test('continuous loop stops only after repeated clean runs or max iterations', () => {
  assert.equal(shouldStopStrategistLoop({ cleanRuns: 0, stopAfterCleanRuns: 3, iteration: 1, maxIterations: 20 }), false);
  assert.equal(shouldStopStrategistLoop({ cleanRuns: 2, stopAfterCleanRuns: 3, iteration: 10, maxIterations: 20 }), false);
  assert.equal(shouldStopStrategistLoop({ cleanRuns: 3, stopAfterCleanRuns: 3, iteration: 10, maxIterations: 20 }), true);
  assert.equal(shouldStopStrategistLoop({ cleanRuns: 0, stopAfterCleanRuns: 3, iteration: 20, maxIterations: 20 }), true);
});

test('rough upload image phrasing routes to asset reference help', async () => {
  const result = await runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'where upload img??',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.equal(result.orchestrationPlan.task, 'asset_reference_help');
});
