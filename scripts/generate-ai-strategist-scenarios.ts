import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

type SeedExpectation = {
  primaryTask: string;
  shouldRecommend?: boolean;
  shouldAskClarification?: boolean;
  shouldAnswerHelp?: boolean;
  shouldPreserveContext?: boolean;
};

type Seed = {
  id: string;
  language: string;
  persona: string;
  category: string;
  turns: string[];
  expected: SeedExpectation;
};

type SeedFixture = {
  version: 1;
  description?: string;
  seeds: Seed[];
};

type GeneratedScenario = {
  id: string;
  label: string;
  category: string;
  turns: Array<{
    label: string;
    userMessage: string;
    expect: Record<string, unknown>;
  }>;
};

export type GeneratedStrategistScenarioFixture = {
  version: 1;
  description: string;
  scenarios: GeneratedScenario[];
};

export function generateStrategistScenariosFromSeeds(input: {
  seedPath: string;
  batchSize: number;
  englishFirst: boolean;
  offset?: number;
}): GeneratedStrategistScenarioFixture {
  const fixture = JSON.parse(readFileSync(input.seedPath, 'utf8')) as SeedFixture;
  validateSeedFixture(fixture, input.seedPath);

  const ordered = orderSeeds(fixture.seeds, input.englishFirst);
  const selected = takeCycledBatch(ordered, input.batchSize, input.offset ?? 0);

  return {
    version: 1,
    description: 'Generated AI Strategist conversation scenarios from the English-first seed bank.',
    scenarios: selected.map(seedToScenario),
  };
}

function validateSeedFixture(fixture: SeedFixture, path: string) {
  if (fixture.version !== 1) throw new Error(`Unsupported scenario seed version in ${path}: ${fixture.version}`);
  if (!Array.isArray(fixture.seeds) || fixture.seeds.length === 0) throw new Error(`No scenario seeds found in ${path}`);
}

function orderSeeds(seeds: Seed[], englishFirst: boolean): Seed[] {
  if (!englishFirst) return [...seeds];
  return [
    ...seeds.filter((seed) => seed.language === 'en'),
    ...seeds.filter((seed) => seed.language !== 'en'),
  ];
}

function takeCycledBatch<T>(items: T[], batchSize: number, offset: number): T[] {
  if (!items.length || batchSize <= 0) return [];
  return Array.from({ length: batchSize }, (_, index) => items[(offset + index) % items.length]).filter((item): item is T => Boolean(item));
}

function seedToScenario(seed: Seed): GeneratedScenario {
  return {
    id: seed.id,
    label: `${seed.persona}: ${seed.category}`,
    category: mapCategory(seed.category),
    turns: seed.turns.map((message, index) => ({
      label: index === 0 ? 'initial user message' : `follow-up ${index}`,
      userMessage: message,
      expect: buildExpectation(seed, index),
    })),
  };
}

function buildExpectation(seed: Seed, turnIndex: number): Record<string, unknown> {
  if (seed.expected.shouldAskClarification) {
    return {
      action: 'ask_clarification',
      noRecommendations: true,
      quality: {
        actionableNextStep: true,
        avoidsTechnicalJargon: true,
        conversationalAdvisor: true,
      },
    };
  }

  if (seed.expected.shouldAnswerHelp) {
    return {
      task: seed.expected.primaryTask,
      noRecommendations: true,
      quality: {
        actionableNextStep: true,
        avoidsTechnicalJargon: true,
        preservesSafety: true,
        acquisitionFunnelForward: true,
      },
    };
  }

  if (turnIndex > 0 && seed.expected.shouldPreserveContext) {
    return {
      notStage: 'awaiting_model_choice',
      selectedModelPresent: true,
      quality: {
        actionableNextStep: true,
        conversationalAdvisor: true,
        acquisitionFunnelForward: true,
      },
    };
  }

  return {
    task: seed.expected.primaryTask,
    ...(seed.expected.shouldRecommend ? { hasRecommendations: true } : {}),
    quality: {
      actionableNextStep: true,
      avoidsTechnicalJargon: true,
      conversationalAdvisor: true,
      acquisitionFunnelForward: true,
    },
  };
}

function mapCategory(category: string): string {
  if (category === 'pricing') return 'pricing_or_catalog_gap';
  if (category === 'examples' || category === 'workflow_help') return 'site_or_navigation_help';
  if (category === 'prompt_improvement') return 'prompt_generation_issue';
  if (category === 'asset_reference') return 'asset_reference_routing';
  if (category === 'state_follow_up') return 'state_memory_error';
  if (category === 'messy_input') return 'language_issue';
  if (category === 'model_advice') return 'model_recommendation_issue';
  if (category === 'greeting') return 'safety_or_funnel';
  return 'routing_error';
}

function parseArgs(args: string[]) {
  return {
    outputPath: resolve(process.cwd(), args.find((arg) => !arg.startsWith('--')) ?? 'docs/ai-strategist/evals/generated-conversation-scenarios.json'),
    seedPath: resolve(process.cwd(), valueArg(args, '--seed-path') ?? 'docs/ai-strategist/evals/scenario-seeds.json'),
    batchSize: numberArg(args, '--batch-size', Number(process.env.AI_STRATEGIST_EVAL_BATCH_SIZE ?? 80)),
    offset: numberArg(args, '--offset', Number(process.env.AI_STRATEGIST_EVAL_OFFSET ?? 0)),
    englishFirst: !args.includes('--no-english-first'),
  };
}

function valueArg(args: string[], key: string): string | undefined {
  const direct = args.find((arg) => arg.startsWith(`${key}=`));
  if (direct) return direct.slice(key.length + 1);
  const index = args.indexOf(key);
  return index >= 0 ? args[index + 1] : undefined;
}

function numberArg(args: string[], key: string, fallback: number): number {
  const raw = valueArg(args, key);
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

if (process.argv[1]?.endsWith('generate-ai-strategist-scenarios.ts')) {
  const options = parseArgs(process.argv.slice(2));
  const generated = generateStrategistScenariosFromSeeds(options);
  mkdirSync(dirname(options.outputPath), { recursive: true });
  writeFileSync(options.outputPath, `${JSON.stringify(generated, null, 2)}\n`);
  console.log(`Wrote ${generated.scenarios.length} generated scenarios to ${options.outputPath}`);
}
