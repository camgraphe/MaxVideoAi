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
  expandScenarios?: boolean;
  expansionRound?: number;
}): GeneratedStrategistScenarioFixture {
  const fixture = JSON.parse(readFileSync(input.seedPath, 'utf8')) as SeedFixture;
  validateSeedFixture(fixture, input.seedPath);

  const ordered = orderSeeds(fixture.seeds, input.englishFirst);
  const selected = takeCycledBatch(ordered, input.batchSize, input.offset ?? 0);
  const expansionRound = Math.max(1, Math.floor(input.expansionRound ?? 1));
  const scenarios = selected.map((seed, index) => input.expandScenarios
    ? seedToScenario(expandSeed(seed, index, expansionRound))
    : seedToScenario(seed)
  );

  return {
    version: 1,
    description: input.expandScenarios
      ? `Generated expanded AI Strategist conversation scenarios from the English-first seed bank. Expansion round: ${expansionRound}.`
      : 'Generated AI Strategist conversation scenarios from the English-first seed bank.',
    scenarios,
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

const expansionStrategies = [
  { id: 'context', wrap: contextualizeTurn },
  { id: 'hesitant', wrap: hesitateTurn },
  { id: 'messy', wrap: addMessyClientLanguage },
  { id: 'handoff', wrap: addAcquisitionHandoff },
] as const;

function expandSeed(seed: Seed, index: number, expansionRound: number): Seed {
  const strategy = expansionStrategies[(index + expansionRound - 1) % expansionStrategies.length] ?? expansionStrategies[0];
  return {
    ...seed,
    id: `${seed.id}-exp-r${expansionRound}-${strategy.id}`,
    turns: seed.turns.map((turn, turnIndex) => strategy.wrap(seed, turn, turnIndex)),
  };
}

function contextualizeTurn(seed: Seed, turn: string, turnIndex: number): string {
  if (turnIndex > 0) return turn;
  if (seed.category === 'greeting') return `I just landed on MaxVideoAI and need direction. ${turn}`;
  if (seed.category === 'pricing') return `Before I spend credits, ${turn}`;
  if (seed.category === 'examples') return `Before I choose an engine, ${turn}`;
  if (seed.category === 'workflow_help') return `I'm trying to pick the right workflow. ${turn}`;
  if (seed.category === 'prompt_improvement') return `I have a rough prompt to improve. ${turn}`;
  if (seed.category === 'model_advice') return `For a real client project, ${turn}`;
  return `For a client campaign, ${turn}`;
}

function hesitateTurn(seed: Seed, turn: string, turnIndex: number): string {
  if (turnIndex > 0) return turn;
  if (seed.category === 'greeting') return `${turn} - I'm not sure what I should ask first.`;
  if (seed.category === 'prompt_improvement') return `${turn} I can paste it if needed.`;
  if (seed.category === 'pricing') return `${turn} I want to avoid surprises before checkout.`;
  if (seed.category === 'workflow_help') return `${turn} I only need the right path, not a render yet.`;
  return `${turn} Not sure which model or workflow is best.`;
}

function addMessyClientLanguage(seed: Seed, turn: string, turnIndex: number): string {
  if (turnIndex > 0) return turn;
  if (seed.category === 'greeting') return `hey, ${turn}, can u guide me?`;
  if (seed.category === 'pricing') return `${turn} pls, no credits spent yet`;
  if (seed.category === 'examples') return `${turn} b4 I pay pls`;
  if (seed.category === 'workflow_help') return `${turn} idk workflow`;
  if (seed.category === 'prompt_improvement') return `${turn} pls make it less basic`;
  return `${turn} pls, make smart assumptions if needed`;
}

function addAcquisitionHandoff(seed: Seed, turn: string, turnIndex: number): string {
  if (turnIndex > 0) return turn;
  if (seed.category === 'greeting') return `I came from an ad and I need help. ${turn}`;
  if (seed.category === 'pricing') return `I'm comparing tools before signup. ${turn}`;
  if (seed.category === 'examples') return `I need proof before choosing. ${turn}`;
  if (seed.category === 'workflow_help') return `I have assets but I'm not technical. ${turn}`;
  if (seed.category === 'prompt_improvement') return `I want the strategist to improve a prompt. ${turn}`;
  return `I'm testing MaxVideoAI for a campaign. ${turn}`;
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
    expandScenarios: args.includes('--expand-scenarios') || args.includes('--scenario-expansion'),
    expansionRound: numberArg(args, '--expansion-round', Number(process.env.AI_STRATEGIST_EXPANSION_ROUND ?? 1)),
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
