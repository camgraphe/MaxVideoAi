import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

import {
  runAiStrategistPlaygroundPipeline,
  type AiStrategistPlaygroundResult,
} from '../frontend/lib/ai-strategist/playground-pipeline.ts';
import { clusterStrategistFailures } from './judge-ai-strategist-conversations.ts';
import type {
  AiStrategistModelId,
  AiStrategistTierPosition,
  AiStrategistWorkflowId,
} from '../frontend/lib/ai-strategist/types.ts';

type UploadedAssetMetadata = {
  type?: string;
  hasPerson?: boolean;
  hasProduct?: boolean;
  hasLogo?: boolean;
  hasText?: boolean;
  isReferenceImage?: boolean;
};

type ConversationExpectation = {
  action?: string;
  task?: string;
  mode?: string;
  stage?: string;
  notStage?: string;
  workflow?: string;
  selectedModel?: string;
  selectedModelPresent?: boolean;
  selectedModelSameAsPrevious?: boolean;
  normalizedIntent?: string;
  normalizedHasVoiceover?: boolean;
  normalizedHasVisibleSpeaker?: boolean;
  hasRecommendations?: boolean;
  noRecommendations?: boolean;
  currentPromptPresent?: boolean;
  mustMention?: string[];
  mustMentionAny?: string[];
  mustMentionAnyGroup?: string[][];
  mustNotMention?: string[];
  warningsMention?: string[];
  warningsMentionAny?: string[];
  warningsMustNotMention?: string[];
  finalPromptMustMention?: string[];
  finalPromptMustMentionAny?: string[];
  finalPromptMustNotMention?: string[];
  quality?: {
    actionableNextStep?: boolean;
    avoidsTechnicalJargon?: boolean;
    preservesSafety?: boolean;
    conversationalAdvisor?: boolean;
    acquisitionFunnelForward?: boolean;
  };
};

type ConversationTurn = {
  label: string;
  userMessage: string;
  mode?: 'recommend' | 'build_prompt' | 'improve_prompt' | 'product_help';
  currentPrompt?: string;
  pickTier?: AiStrategistTierPosition;
  selectedModel?: AiStrategistModelId;
  selectedWorkflow?: AiStrategistWorkflowId;
  uploadedAsset?: UploadedAssetMetadata;
  expect: ConversationExpectation;
};

type ConversationScenario = {
  id: string;
  label: string;
  category: FailureCategory;
  turns: ConversationTurn[];
};

type ScenarioFixture = {
  version: number;
  description?: string;
  scenarios: ConversationScenario[];
};

type FailureCategory =
  | 'routing_error'
  | 'state_memory_error'
  | 'knowledge_gap'
  | 'bad_answer_copy'
  | 'prompt_generation_issue'
  | 'model_recommendation_issue'
  | 'pricing_or_catalog_gap'
  | 'site_or_navigation_help'
  | 'asset_reference_routing'
  | 'language_issue'
  | 'safety_or_funnel'
  | 'ui_flow_issue';

type EvalIssue = {
  scenarioId: string;
  scenarioLabel: string;
  turnLabel: string;
  category: FailureCategory;
  owner: string;
  message: string;
};

type TurnReport = {
  label: string;
  userMessage: string;
  passed: boolean;
  issues: EvalIssue[];
  stage: string;
  action: string;
  task: string;
  assistantMessage: string;
};

type ScenarioReport = {
  id: string;
  label: string;
  category: FailureCategory;
  passed: boolean;
  turns: TurnReport[];
};

type EvalReport = {
  generatedAt: string;
  liveLlm: boolean;
  scenarioCount: number;
  turnCount: number;
  passedScenarios: number;
  failedScenarios: number;
  passedTurns: number;
  failedTurns: number;
  passRate: number;
  failuresByCategory: Record<string, number>;
  failureClusters: ReturnType<typeof clusterStrategistFailures>;
  scenarios: ScenarioReport[];
};

type CliOptions = {
  cases: string[];
  fixturePath: string;
  jsonOutput?: string;
  markdownOutput?: string;
  liveLlm: boolean;
};

const defaultFixturePath = resolve(process.cwd(), 'docs/ai-strategist/evals/conversation-scenarios.json');

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  const fixture = loadFixture(options.fixturePath);
  const selected = filterScenarios(fixture.scenarios, options.cases);
  const report = await runEvaluation(selected, options);

  printConsoleReport(report);
  if (options.jsonOutput) writeJsonReport(report, options.jsonOutput);
  if (options.markdownOutput) writeMarkdownReport(report, options.markdownOutput);

  if (report.failedTurns > 0) process.exitCode = 1;
}

function parseCliOptions(args: string[]): CliOptions {
  const options: CliOptions = {
    cases: [],
    fixturePath: defaultFixturePath,
    liveLlm: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? '';
    if (arg === '--live') {
      options.liveLlm = true;
      continue;
    }
    if (arg === '--case') {
      const value = args[index + 1];
      if (value) options.cases.push(value);
      index += 1;
      continue;
    }
    if (arg.startsWith('--case=')) {
      options.cases.push(arg.slice('--case='.length));
      continue;
    }
    if (arg === '--fixture') {
      const value = args[index + 1];
      if (value) options.fixturePath = resolve(process.cwd(), value);
      index += 1;
      continue;
    }
    if (arg.startsWith('--fixture=')) {
      options.fixturePath = resolve(process.cwd(), arg.slice('--fixture='.length));
      continue;
    }
    if (arg === '--json-output') {
      const value = args[index + 1];
      if (value) options.jsonOutput = resolve(process.cwd(), value);
      index += 1;
      continue;
    }
    if (arg.startsWith('--json-output=')) {
      options.jsonOutput = resolve(process.cwd(), arg.slice('--json-output='.length));
      continue;
    }
    if (arg === '--markdown-output') {
      const value = args[index + 1];
      if (value) options.markdownOutput = resolve(process.cwd(), value);
      index += 1;
      continue;
    }
    if (arg.startsWith('--markdown-output=')) {
      options.markdownOutput = resolve(process.cwd(), arg.slice('--markdown-output='.length));
    }
  }

  return options;
}

function loadFixture(path: string): ScenarioFixture {
  if (!existsSync(path)) throw new Error(`AI Strategist conversation fixture not found: ${path}`);
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as ScenarioFixture;
  validateFixture(parsed, path);
  return parsed;
}

function validateFixture(fixture: ScenarioFixture, path: string) {
  if (fixture.version !== 1) throw new Error(`Unsupported fixture version in ${path}: ${fixture.version}`);
  if (!Array.isArray(fixture.scenarios) || fixture.scenarios.length === 0) {
    throw new Error(`Fixture has no scenarios: ${path}`);
  }
}

function filterScenarios(allScenarios: ConversationScenario[], filters: string[]): ConversationScenario[] {
  const normalizedFilters = filters.map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (normalizedFilters.length === 0) return allScenarios;

  const selected = allScenarios.filter((scenario) => {
    const haystack = [scenario.id, scenario.label, scenario.category].join(' ').toLowerCase();
    return normalizedFilters.some((filter) => haystack.includes(filter));
  });

  if (selected.length === 0) {
    throw new Error(`No AI Strategist eval scenarios matched: ${normalizedFilters.join(', ')}`);
  }

  return selected;
}

async function runEvaluation(scenarios: ConversationScenario[], options: CliOptions): Promise<EvalReport> {
  const scenarioReports: ScenarioReport[] = [];
  let turnCount = 0;
  let passedTurns = 0;
  const failuresByCategory: Record<string, number> = {};

  for (const scenario of scenarios) {
    const scenarioReport = await runScenario(scenario, options);
    scenarioReports.push(scenarioReport);
    for (const turn of scenarioReport.turns) {
      turnCount += 1;
      if (turn.passed) {
        passedTurns += 1;
      } else {
        failuresByCategory[scenario.category] = (failuresByCategory[scenario.category] ?? 0) + turn.issues.length;
      }
    }
  }

  const passedScenarios = scenarioReports.filter((scenario) => scenario.passed).length;
  const failedTurns = turnCount - passedTurns;
  const allIssues = scenarioReports.flatMap((scenario) => scenario.turns.flatMap((turn) => turn.issues));
  return {
    generatedAt: new Date().toISOString(),
    liveLlm: options.liveLlm,
    scenarioCount: scenarioReports.length,
    turnCount,
    passedScenarios,
    failedScenarios: scenarioReports.length - passedScenarios,
    passedTurns,
    failedTurns,
    passRate: turnCount === 0 ? 0 : Number((passedTurns / turnCount).toFixed(4)),
    failuresByCategory,
    failureClusters: clusterStrategistFailures(allIssues),
    scenarios: scenarioReports,
  };
}

async function runScenario(scenario: ConversationScenario, options: CliOptions): Promise<ScenarioReport> {
  let state: ReturnType<typeof conversationStateFrom> | undefined;
  let previous: AiStrategistPlaygroundResult | undefined;
  const turns: TurnReport[] = [];

  for (const turn of scenario.turns) {
    const selectedTier = turn.pickTier;
    const selectedModel = turn.selectedModel ?? (selectedTier ? previous?.recommendations?.[selectedTier]?.model.id : undefined);
    const result = await runAiStrategistPlaygroundPipeline(
      {
        userMessage: turn.userMessage,
        mode: turn.mode ?? 'recommend',
        surface: 'chat',
        currentPrompt: turn.currentPrompt,
        uploadedAsset: turn.uploadedAsset,
        selectedTier,
        selectedModel,
        selectedWorkflow: turn.selectedWorkflow,
        conversationState: state,
      },
      { env: options.liveLlm ? process.env : {} }
    );

    const issues = evaluateTurn({ scenario, turn, result, previous });
    turns.push({
      label: turn.label,
      userMessage: turn.userMessage,
      passed: issues.length === 0,
      issues,
      stage: result.conversationStage,
      action: result.conversationPlan.action,
      task: result.orchestrationPlan.task,
      assistantMessage: oneLine(result.assistantMessage, 320),
    });

    previous = result;
    state = conversationStateFrom(result);
  }

  return {
    id: scenario.id,
    label: scenario.label,
    category: scenario.category,
    passed: turns.every((turn) => turn.passed),
    turns,
  };
}

function evaluateTurn(input: {
  scenario: ConversationScenario;
  turn: ConversationTurn;
  result: AiStrategistPlaygroundResult;
  previous?: AiStrategistPlaygroundResult;
}): EvalIssue[] {
  const { scenario, turn, result, previous } = input;
  const expect = turn.expect;
  const issues: EvalIssue[] = [];
  const assistantText = result.assistantMessage;
  const warningsText = result.warnings.join('\n');
  const finalPrompt = result.sanitizedFinalOutput?.finalPrompt ?? '';
  const currentPromptPresent = Boolean(result.promptGenerationContext?.currentPrompt);

  checkEqual(issues, scenario, turn, result.conversationPlan.action, expect.action, 'action');
  checkEqual(issues, scenario, turn, result.orchestrationPlan.task, expect.task, 'task');
  checkEqual(issues, scenario, turn, result.mode, expect.mode, 'mode');
  checkEqual(issues, scenario, turn, result.conversationStage, expect.stage, 'stage');
  checkEqual(issues, scenario, turn, result.workflow, expect.workflow, 'workflow');
  checkEqual(issues, scenario, turn, result.selectedModel, expect.selectedModel, 'selectedModel');
  checkEqual(issues, scenario, turn, result.normalizedBrief.intent, expect.normalizedIntent, 'normalizedIntent');

  if (expect.notStage !== undefined && result.conversationStage === expect.notStage) {
    issues.push(buildIssue(scenario, turn, `notStage: got disallowed stage ${expect.notStage}`));
  }
  if (expect.selectedModelPresent === true && !result.selectedModel) {
    issues.push(buildIssue(scenario, turn, 'selectedModelPresent: selected model is missing'));
  }
  if (expect.selectedModelSameAsPrevious === true && result.selectedModel !== previous?.selectedModel) {
    issues.push(buildIssue(scenario, turn, `selectedModelSameAsPrevious: expected ${previous?.selectedModel}, got ${result.selectedModel}`));
  }
  if (expect.normalizedHasVoiceover !== undefined && result.normalizedBrief.hasVoiceover !== expect.normalizedHasVoiceover) {
    issues.push(buildIssue(scenario, turn, `normalizedHasVoiceover: expected ${expect.normalizedHasVoiceover}, got ${result.normalizedBrief.hasVoiceover}`));
  }
  if (expect.normalizedHasVisibleSpeaker !== undefined && result.normalizedBrief.hasVisibleSpeaker !== expect.normalizedHasVisibleSpeaker) {
    issues.push(buildIssue(scenario, turn, `normalizedHasVisibleSpeaker: expected ${expect.normalizedHasVisibleSpeaker}, got ${result.normalizedBrief.hasVisibleSpeaker}`));
  }
  if (expect.hasRecommendations === true && !result.recommendations) {
    issues.push(buildIssue(scenario, turn, 'hasRecommendations: recommendations are missing'));
  }
  if (expect.noRecommendations === true && result.recommendations) {
    issues.push(buildIssue(scenario, turn, 'noRecommendations: recommendations were returned'));
  }
  if (expect.currentPromptPresent === true && !currentPromptPresent) {
    issues.push(buildIssue(scenario, turn, 'currentPromptPresent: prompt generation context has no currentPrompt'));
  }

  checkIncludes(issues, scenario, turn, assistantText, expect.mustMention, 'mustMention');
  checkIncludesAny(issues, scenario, turn, assistantText, expect.mustMentionAny, 'mustMentionAny');
  checkIncludesAnyGroup(issues, scenario, turn, assistantText, expect.mustMentionAnyGroup, 'mustMentionAnyGroup');
  checkExcludes(issues, scenario, turn, assistantText, expect.mustNotMention, 'mustNotMention');
  checkIncludes(issues, scenario, turn, warningsText, expect.warningsMention, 'warningsMention');
  checkIncludesAny(issues, scenario, turn, warningsText, expect.warningsMentionAny, 'warningsMentionAny');
  checkExcludes(issues, scenario, turn, warningsText, expect.warningsMustNotMention, 'warningsMustNotMention');
  checkIncludes(issues, scenario, turn, finalPrompt, expect.finalPromptMustMention, 'finalPromptMustMention');
  checkIncludesAny(issues, scenario, turn, finalPrompt, expect.finalPromptMustMentionAny, 'finalPromptMustMentionAny');
  checkExcludes(issues, scenario, turn, finalPrompt, expect.finalPromptMustNotMention, 'finalPromptMustNotMention');
  checkQuality(issues, scenario, turn, result, expect.quality);

  return issues;
}

function checkQuality(
  issues: EvalIssue[],
  scenario: ConversationScenario,
  turn: ConversationTurn,
  result: AiStrategistPlaygroundResult,
  quality: ConversationExpectation['quality']
) {
  if (!quality) return;
  const text = result.assistantMessage;

  if (quality.actionableNextStep && !containsAnyPhrase(text, [
    'choose',
    'pick',
    'open',
    'use',
    'generate the prompt',
    'colle ton prompt',
    'compare',
    'devis',
    'I will not navigate',
    'I’ll check',
    'next',
    'give me',
    'quick direction check',
    'what prompt do you want me to improve',
    'paste the prompt',
  ])) {
    issues.push(buildIssue(scenario, turn, 'quality.actionableNextStep: assistant did not provide a clear next step'));
  }

  if (quality.avoidsTechnicalJargon && containsAnyPhrase(text, [
    'normalizedbrief',
    'orchestration',
    'pipeline',
    'toolresult',
    'json',
    'deterministic',
  ])) {
    issues.push(buildIssue(scenario, turn, 'quality.avoidsTechnicalJargon: assistant exposed internal implementation language'));
  }

  if (quality.preservesSafety && !containsAnyPhrase(text, [
    'I will not run generation',
    'I will not navigate',
    'ne lance',
    'ne dépense',
    'ne depense',
    'generator quote',
    'devis',
    'spend credits',
    'crédits',
    'credits',
  ])) {
    issues.push(buildIssue(scenario, turn, 'quality.preservesSafety: assistant did not preserve no-generation/no-credit safety'));
  }

  if (quality.conversationalAdvisor && !containsAnyPhrase(text, [
    'I’d route',
    'I’m showing',
    'Here’s what I’ll build',
    'Great',
    'Je peux',
    'Pour la vidéo',
    'Oui, colle',
    'Use these',
    'Open',
    'Paste the prompt',
    'What prompt do you want me to improve',
  ])) {
    issues.push(buildIssue(scenario, turn, 'quality.conversationalAdvisor: response reads too mechanical or lacks advisory framing'));
  }

  if (quality.acquisitionFunnelForward && !containsAnyPhrase(text, [
    'compare',
    'examples',
    'generate',
    'pricing',
    'price',
    'cheapest',
    'engine',
    'engines',
    'quote',
    'devis',
    'quick direction check',
    'choose',
    'pick',
    'model',
    'workflow',
    'prompt',
    'générateur',
    'generateur',
  ])) {
    issues.push(buildIssue(scenario, turn, 'quality.acquisitionFunnelForward: response does not move user toward a useful MaxVideoAI funnel step'));
  }
}

function checkEqual(
  issues: EvalIssue[],
  scenario: ConversationScenario,
  turn: ConversationTurn,
  actual: unknown,
  expected: unknown,
  label: string
) {
  if (expected === undefined) return;
  if (actual !== expected) {
    issues.push(buildIssue(scenario, turn, `${label}: expected ${String(expected)}, got ${String(actual)}`));
  }
}

function checkIncludes(
  issues: EvalIssue[],
  scenario: ConversationScenario,
  turn: ConversationTurn,
  text: string,
  needles: string[] | undefined,
  label: string
) {
  if (!needles?.length) return;
  for (const needle of needles) {
    if (!includesNormalized(text, needle)) {
      issues.push(buildIssue(scenario, turn, `${label}: missing "${needle}"`));
    }
  }
}

function checkIncludesAny(
  issues: EvalIssue[],
  scenario: ConversationScenario,
  turn: ConversationTurn,
  text: string,
  needles: string[] | undefined,
  label: string
) {
  if (!needles?.length) return;
  if (!needles.some((needle) => includesNormalized(text, needle))) {
    issues.push(buildIssue(scenario, turn, `${label}: none matched [${needles.join(', ')}]`));
  }
}

function checkIncludesAnyGroup(
  issues: EvalIssue[],
  scenario: ConversationScenario,
  turn: ConversationTurn,
  text: string,
  groups: string[][] | undefined,
  label: string
) {
  if (!groups?.length) return;
  if (!groups.some((group) => group.every((needle) => includesNormalized(text, needle)))) {
    issues.push(buildIssue(scenario, turn, `${label}: no full group matched`));
  }
}

function checkExcludes(
  issues: EvalIssue[],
  scenario: ConversationScenario,
  turn: ConversationTurn,
  text: string,
  needles: string[] | undefined,
  label: string
) {
  if (!needles?.length) return;
  for (const needle of needles) {
    if (includesNormalized(text, needle)) {
      issues.push(buildIssue(scenario, turn, `${label}: found disallowed "${needle}"`));
    }
  }
}

function buildIssue(scenario: ConversationScenario, turn: ConversationTurn, message: string): EvalIssue {
  return {
    scenarioId: scenario.id,
    scenarioLabel: scenario.label,
    turnLabel: turn.label,
    category: scenario.category,
    owner: ownerForCategory(scenario.category),
    message,
  };
}

function ownerForCategory(category: FailureCategory): string {
  const owners: Record<FailureCategory, string> = {
    routing_error: 'conversation planner / orchestrator intent router',
    state_memory_error: 'conversation state merge / planner follow-up handling',
    knowledge_gap: 'structured knowledge tools / future RAG boundary',
    bad_answer_copy: 'advisor response templates / prompt writer instructions',
    prompt_generation_issue: 'brief completion / prompt generation context / prompt writer',
    model_recommendation_issue: 'recommendation rules / model catalog',
    pricing_or_catalog_gap: 'engine catalog pricing tool',
    site_or_navigation_help: 'site navigation knowledge tool',
    asset_reference_routing: 'uploaded asset normalization / workflow router',
    language_issue: 'brief refinement / response language handling',
    safety_or_funnel: 'safety guardrails / funnel guidance',
    ui_flow_issue: 'admin playground chat UI',
  };
  return owners[category];
}

function conversationStateFrom(result: AiStrategistPlaygroundResult) {
  return {
    lastNormalizedBrief: result.normalizedBrief,
    lastRecommendations: result.recommendations,
    lastSelectedWorkflow: result.workflow ?? undefined,
    lastSelectedModel: result.selectedModel ?? undefined,
    lastSelectedTier: result.selectedTier,
    stage: result.conversationStage,
    lastBriefCompletion: result.briefCompletion,
    lastFinalPrompt: result.sanitizedFinalOutput?.finalPrompt,
  };
}

function printConsoleReport(report: EvalReport) {
  console.log('AI Strategist Conversation QA');
  console.log(`Live LLM: ${report.liveLlm ? 'yes' : 'disabled for deterministic regression pass'}`);
  console.log('Auto-generation/credit spend/publish: no');
  console.log(`Scenarios: ${report.passedScenarios}/${report.scenarioCount} passed`);
  console.log(`Turns: ${report.passedTurns}/${report.turnCount} passed`);
  console.log(`Pass rate: ${(report.passRate * 100).toFixed(1)}%`);
  if (Object.keys(report.failuresByCategory).length) {
    console.log(`Failures by category: ${JSON.stringify(report.failuresByCategory)}`);
  }
  if (report.failureClusters.length) {
    console.log(`Top failure cluster: ${report.failureClusters[0]?.owner} (${report.failureClusters[0]?.count})`);
  }
  console.log('');

  for (const scenario of report.scenarios) {
    console.log(`Scenario: ${scenario.label}`);
    for (const turn of scenario.turns) {
      console.log(`  ${turn.passed ? 'PASS' : 'FAIL'} ${turn.label}`);
      console.log(`    stage=${turn.stage}; action=${turn.action}; task=${turn.task}`);
      console.log(`    message=${turn.assistantMessage}`);
      for (const issue of turn.issues) {
        console.log(`    - [${issue.category}] ${issue.message}`);
        console.log(`      owner: ${issue.owner}`);
      }
    }
    console.log('');
  }

  console.log(report.failedTurns === 0 ? 'Overall: PASS' : `Overall: FAIL (${report.failedTurns} failed turn${report.failedTurns === 1 ? '' : 's'})`);
}

function writeJsonReport(report: EvalReport, path: string) {
  ensureParentDir(path);
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`JSON report: ${relative(process.cwd(), path)}`);
}

function writeMarkdownReport(report: EvalReport, path: string) {
  ensureParentDir(path);
  const lines = [
    '# AI Strategist Conversation QA Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Live LLM: ${report.liveLlm ? 'yes' : 'no'}`,
    `Scenarios: ${report.passedScenarios}/${report.scenarioCount} passed`,
    `Turns: ${report.passedTurns}/${report.turnCount} passed`,
    `Pass rate: ${(report.passRate * 100).toFixed(1)}%`,
    '',
    '## Failure Categories',
    '',
    Object.keys(report.failuresByCategory).length
      ? Object.entries(report.failuresByCategory).map(([category, count]) => `- ${category}: ${count}`).join('\n')
      : '- None',
    '',
    '## Failure Clusters',
    '',
    report.failureClusters.length
      ? report.failureClusters.map((cluster) => [
          `- ${cluster.owner}: ${cluster.count}`,
          ...cluster.examples.map((example) => `  - ${example}`),
        ].join('\n')).join('\n')
      : '- None',
    '',
    '## Scenarios',
    '',
    ...report.scenarios.flatMap((scenario) => [
      `### ${scenario.passed ? 'PASS' : 'FAIL'} ${scenario.label}`,
      '',
      `Category: \`${scenario.category}\``,
      '',
      ...scenario.turns.flatMap((turn) => [
        `- ${turn.passed ? 'PASS' : 'FAIL'} ${turn.label}`,
        `  - stage/action/task: \`${turn.stage}\` / \`${turn.action}\` / \`${turn.task}\``,
        `  - assistant: ${turn.assistantMessage}`,
        ...turn.issues.map((issue) => `  - issue: [${issue.category}] ${issue.message} (owner: ${issue.owner})`),
      ]),
      '',
    ]),
  ];

  writeFileSync(path, `${lines.join('\n')}\n`, 'utf8');
  console.log(`Markdown report: ${relative(process.cwd(), path)}`);
}

function ensureParentDir(path: string) {
  mkdirSync(dirname(path), { recursive: true });
}

function includesNormalized(text: string, needle: string): boolean {
  return normalizeText(text).includes(normalizeText(needle));
}

function containsAnyPhrase(text: string, phrases: string[]): boolean {
  return phrases.some((phrase) => includesNormalized(text, phrase));
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function oneLine(value: string, maxLength: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
