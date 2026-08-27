import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import mcpPublication from '../../config/mcp-publication.json';
import type { AgentPrincipal } from '../../src/server/agent-api/principal';
import {
  createMaxVideoAiMcpServer,
  type MaxVideoAiMcpServices,
} from '../../src/server/mcp/server';
import {
  MCP_TOOL_INPUT_SCHEMAS,
  type McpToolInputSchemaName,
} from '../../src/server/mcp/tool-input-schemas';
import {
  ALL_FIXTURE_CATEGORIES,
  FUTURE_GATED_TOOL_NAMES,
  LIVE_TOOL_NAMES,
  parseCuratedPolicyBundle,
  parseFixtureCorpus,
  type ToolSelectionFixture,
} from './mcp-tool-selection-contract';
import {
  assertCompleteCuratedPolicyDecisions,
  assertCuratedPolicyReleaseGates,
  assertUniqueCuratedPolicyDecisions,
  buildFixtureBaseline,
  scoreCuratedPolicyDecisions,
} from './mcp-tool-selection-scoring';

export {
  ALL_FIXTURE_CATEGORIES,
  FUTURE_GATED_TOOL_NAMES,
  LIVE_TOOL_NAMES,
  parseCuratedPolicyBundle,
  parseFixtureCorpus,
} from './mcp-tool-selection-contract';
export type {
  CuratedPolicyDecision,
  ToolSelectionFixture,
} from './mcp-tool-selection-contract';
export {
  assertCompleteCuratedPolicyDecisions,
  assertCuratedPolicyReleaseGates,
  buildFixtureBaseline,
  scoreCuratedPolicyDecisions,
} from './mcp-tool-selection-scoring';
export type { ProfileScore } from './mcp-tool-selection-scoring';

export type PolicyFingerprintInput = {
  instructions: string;
  packagedSkills: Record<string, string>;
  references: Record<string, string>;
  tools: Array<{
    name: string;
    description: string;
    annotations: Record<string, unknown>;
    inputSchema: Record<string, unknown>;
  }>;
};

export type RegistryEvidence = {
  liveTools: string[];
  resourcesAdvertised: boolean;
  generationAvailable: boolean;
  publicationFlagsAllFalse: boolean;
  instructions: string;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)])
    );
  }
  return value;
}

export function computePolicyFingerprintSha256(input: PolicyFingerprintInput): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(input))).digest('hex');
}

export function computeFixtureContractSha256(
  fixtures: readonly ToolSelectionFixture[]
): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(fixtures))).digest('hex');
}

const REQUIRED_POLICY_COVERAGE = {
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
} as const;

function policyCoverage(fixtures: readonly ToolSelectionFixture[]) {
  const requiredChecks = Object.fromEntries(
    Object.keys(REQUIRED_POLICY_COVERAGE.requiredChecks).map((check) => [check, 0])
  ) as Record<string, number>;
  let policyCheckCount = 0;
  for (const fixture of fixtures) {
    for (const check of fixture.policyChecks) {
      policyCheckCount += 1;
      requiredChecks[check] = (requiredChecks[check] ?? 0) + 1;
    }
  }
  return { fixtureCount: fixtures.length, policyCheckCount, requiredChecks };
}

function assertFixtureContractAndCoverage(
  bundle: Record<string, unknown>,
  fixtures: readonly ToolSelectionFixture[]
): void {
  const expectedHash = computeFixtureContractSha256(fixtures);
  if (bundle.fixtureContractSha256 !== expectedHash) {
    throw new Error(
      `stale curated fixture contract fingerprint: expected ${String(bundle.fixtureContractSha256)}, current ${expectedHash}`
    );
  }
  const actualCoverage = policyCoverage(fixtures);
  if (
    JSON.stringify(canonicalize(actualCoverage)) !==
      JSON.stringify(canonicalize(REQUIRED_POLICY_COVERAGE)) ||
    JSON.stringify(canonicalize(bundle.policyCoverage)) !==
      JSON.stringify(canonicalize(REQUIRED_POLICY_COVERAGE))
  ) {
    throw new Error('curated policy coverage is missing or does not match required global counts');
  }
}

export function authoritativeToolSchemaNames(): string[] {
  return [...LIVE_TOOL_NAMES, ...FUTURE_GATED_TOOL_NAMES];
}

function isAppOnlyTool(meta: unknown): boolean {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return false;
  const ui = (meta as { ui?: unknown }).ui;
  if (!ui || typeof ui !== 'object' || Array.isArray(ui)) return false;
  const visibility = (ui as { visibility?: unknown }).visibility;
  return Array.isArray(visibility)
    && visibility.includes('app')
    && !visibility.includes('model');
}

export function validateCuratedToolArguments(
  name: string,
  argumentsValue: Record<string, unknown>
): void {
  const schema = MCP_TOOL_INPUT_SCHEMAS[name as McpToolInputSchemaName];
  if (!schema) throw new Error(`curated tool argument schema is unavailable for ${name}`);
  const result = schema.safeParse(argumentsValue);
  if (!result.success) {
    throw new Error(`curated tool arguments are invalid for ${name}`);
  }
}

export function assertPolicyFingerprint(
  expectedFingerprint: string,
  input: PolicyFingerprintInput
): void {
  const actualFingerprint = computePolicyFingerprintSha256(input);
  if (expectedFingerprint !== actualFingerprint) {
    throw new Error(
      `stale curated policy fingerprint: expected ${expectedFingerprint}, current ${actualFingerprint}`
    );
  }
}

export async function collectPolicyFingerprintInput(): Promise<PolicyFingerprintInput> {
  const principal: AgentPrincipal = {
    userId: 'offline-policy-fingerprint-user',
    clientId: 'offline-policy-fingerprint-client',
    emailVerified: true,
    authMethod: 'oauth',
  };
  const unavailable = async (): Promise<never> => {
    throw new Error('policy fingerprint inspection must not invoke a tool service');
  };
  const services: MaxVideoAiMcpServices = {
    getAccountStatus: unavailable,
    listModels: unavailable,
    getModelDetails: unavailable,
    recommendModels: unavailable,
    calculateProjectBudget: unavailable,
    listMedia: unavailable,
    createReferenceUploadLink: unavailable,
    prepareGeneration: unavailable,
    confirmGeneration: unavailable,
    getGenerationStatus: unavailable,
    listRecentGenerations: unavailable,
    createTopupLink: unavailable,
  };
  const server = createMaxVideoAiMcpServer(principal, services, {
    paidGeneration: true,
    referenceUploads: true,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'offline-policy-fingerprint', version: '1.0.0' });
  await client.connect(clientTransport);
  try {
    const tools = (await client.listTools()).tools
      .filter((tool) => !isAppOnlyTool(tool._meta))
      .map((tool) => ({
        name: tool.name,
        description: tool.description ?? '',
        annotations: (tool.annotations ?? {}) as Record<string, unknown>,
        inputSchema: tool.inputSchema as Record<string, unknown>,
      }));
    if (JSON.stringify(tools.map((tool) => tool.name)) !== JSON.stringify([
      ...LIVE_TOOL_NAMES,
      ...FUTURE_GATED_TOOL_NAMES,
    ])) {
      throw new Error('policy fingerprint tool inventory drifted');
    }
    return {
      instructions: client.getInstructions() ?? '',
      packagedSkills: {
        'generate/SKILL.md': readFileSync(fileURLToPath(new URL(
          '../../../plugins/maxvideoai/skills/generate/SKILL.md',
          import.meta.url
        )), 'utf8'),
        'plan/SKILL.md': readFileSync(fileURLToPath(new URL(
          '../../../plugins/maxvideoai/skills/plan/SKILL.md',
          import.meta.url
        )), 'utf8'),
      },
      references: {
        'generate/generation-safety.md': readFileSync(fileURLToPath(new URL(
          '../../../plugins/maxvideoai/skills/generate/references/generation-safety.md',
          import.meta.url
        )), 'utf8'),
        'generate/reference-inputs.md': readFileSync(fileURLToPath(new URL(
          '../../../plugins/maxvideoai/skills/generate/references/reference-inputs.md',
          import.meta.url
        )), 'utf8'),
        'plan/budget-planning.md': readFileSync(fileURLToPath(new URL(
          '../../../plugins/maxvideoai/skills/plan/references/budget-planning.md',
          import.meta.url
        )), 'utf8'),
      },
      tools,
    };
  } finally {
    await client.close();
    await server.close();
  }
}

function assertFixtureCoverage(fixtures: readonly ToolSelectionFixture[]): void {
  const categories = new Set(fixtures.map((fixture) => fixture.category));
  const missing = ALL_FIXTURE_CATEGORIES.filter((category) => !categories.has(category));
  if (missing.length > 0) throw new Error(`fixture corpus is missing categories: ${missing.join(', ')}`);
}
function assertToolDescription(
  name: string,
  description: string | undefined,
  requiredNegativeCases: RegExp
): void {
  if (!description || !/Use this when/i.test(description) || !/Do not use/i.test(description)) {
    throw new Error(`${name} must state narrow Use this when and Do not use guidance`);
  }
  if (!requiredNegativeCases.test(description)) {
    throw new Error(`${name} is missing required negative cases`);
  }
}

export async function inspectLiveMcpMetadata(): Promise<RegistryEvidence> {
  const principal: AgentPrincipal = {
    userId: 'offline-evaluator-user',
    clientId: 'offline-evaluator-client',
    emailVerified: true,
    authMethod: 'oauth',
  };
  const unavailable = async (): Promise<never> => {
    throw new Error('offline metadata inspection must not invoke a tool service');
  };
  const services: MaxVideoAiMcpServices = {
    getAccountStatus: unavailable,
    listModels: unavailable,
    getModelDetails: unavailable,
    recommendModels: unavailable,
  };
  const server = createMaxVideoAiMcpServer(principal, services);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'offline-tool-selection-evaluator', version: '1.0.0' });
  await client.connect(clientTransport);
  try {
    const result = await client.listTools();
    const liveTools = result.tools.map((tool) => tool.name);
    if (JSON.stringify(liveTools) !== JSON.stringify(LIVE_TOOL_NAMES)) {
      throw new Error(`live MCP tool registry drifted: ${liveTools.join(', ')}`);
    }
    for (const tool of result.tools) {
      if (
        tool.annotations?.readOnlyHint !== true ||
        tool.annotations.destructiveHint !== false ||
        tool.annotations.openWorldHint !== false
      ) {
        throw new Error(`${tool.name} must remain read-only, non-destructive, and closed-world`);
      }
    }
    const toolByName = new Map(result.tools.map((tool) => [tool.name, tool]));
    assertToolDescription(
      'get_account_status',
      toolByName.get('get_account_status')?.description,
      /trial.*email.*charge.*generate/i
    );
    assertToolDescription(
      'list_models',
      toolByName.get('list_models')?.description,
      /generation.*exact pricing.*private models.*provider guarantees/i
    );
    assertToolDescription(
      'get_model_details',
      toolByName.get('get_model_details')?.description,
      /pricing.*generation.*hidden models.*provider guarantees/i
    );
    assertToolDescription(
      'recommend_models',
      toolByName.get('recommend_models')?.description,
      /exact quote.*generation command.*provider.*accept/i
    );
    const recommendationDescription = toolByName.get('recommend_models')?.description ?? '';
    if (!/user is undecided.*asks for advice/i.test(recommendationDescription)) {
      throw new Error('recommend_models must be scoped to undecided or advice-seeking users');
    }
    if (!/do not use.*user already chose.*validation.*pricing.*execution/i.test(recommendationDescription)) {
      throw new Error('recommend_models must preserve an explicit compatible model choice');
    }
    assertToolDescription(
      'calculate_project_budget',
      toolByName.get('calculate_project_budget')?.description,
      /invent the creative plan.*reserve a price.*generation quote.*wallet.*spend funds/i
    );

    const instructions = client.getInstructions() ?? '';
    if (!/host owns creative discussion, scripts, prompts, shot plans, and reference ideas/i.test(instructions)) {
      throw new Error('server instructions must keep creative work with the host agent');
    }
    if (!/live MaxVideoAI tools for current model facts and prices instead of model memory/i.test(instructions)) {
      throw new Error('server instructions must require live facts and prices');
    }
    if (!/project estimates do not reserve price/i.test(instructions)) {
      throw new Error('server instructions must distinguish project estimates from quotes');
    }
    if (!/generation is not available/i.test(instructions)) {
      throw new Error('server instructions must say generation is unavailable');
    }
    if (!/recommendations are capability matches, not quotes or guarantees/i.test(instructions)) {
      throw new Error('server instructions must reject quote and provider guarantees');
    }
    if (!/explicit model choice.*do not call recommend_models/i.test(instructions)) {
      throw new Error('server instructions must preserve an explicit model choice');
    }
    if (!/never substitute a named model without the user’s approval/i.test(instructions)) {
      throw new Error('server instructions must prohibit silent model substitution');
    }
    if (!/quality is ambiguous.*clarify.*story coherence.*delivery resolution/i.test(instructions)) {
      throw new Error('server instructions must clarify quality instead of inferring it from resolution');
    }
    if (!/aspectRatios list is empty, omit aspectRatio.*non-empty, include a supported aspectRatio/i.test(instructions)) {
      throw new Error('server instructions must follow selected-mode aspect-ratio details literally');
    }

    const resourcesAdvertised = Boolean(client.getServerCapabilities()?.resources);
    if (resourcesAdvertised) {
      throw new Error('foundation registry must not advertise unvalidated MCP resources');
    }
    const generationAvailable = liveTools.some((tool) =>
      FUTURE_GATED_TOOL_NAMES.includes(tool as (typeof FUTURE_GATED_TOOL_NAMES)[number])
    );
    if (generationAvailable) throw new Error('future generation tools must not be live');
    const publicationFlagsAllFalse = Object.values(mcpPublication).every((value) => value === false);
    if (!publicationFlagsAllFalse) {
      throw new Error('Task 9 evidence assumes the checked-in MCP publication gates remain false');
    }
    return {
      liveTools,
      resourcesAdvertised,
      generationAvailable,
      publicationFlagsAllFalse,
      instructions,
    };
  } finally {
    await client.close();
    await server.close();
  }
}

export async function runEvaluation(options: {
  fixturePath?: string;
  decisionPaths?: string[];
} = {}) {
  const fixturePath = options.fixturePath ?? fileURLToPath(
    new URL('../../../tests/fixtures/mcp-tool-selection-prompts.json', import.meta.url)
  );
  const fixtures = parseFixtureCorpus(JSON.parse(readFileSync(fixturePath, 'utf8')));
  assertFixtureCoverage(fixtures);
  const requestedDecisionPaths = options.decisionPaths ?? [];
  const usingDefaultPolicyBundle = requestedDecisionPaths.length === 0;
  const decisionPaths = usingDefaultPolicyBundle
    ? [fileURLToPath(new URL('../../../tests/fixtures/mcp-tool-selection-curated-policy.json', import.meta.url))]
    : requestedDecisionPaths;
  const policyFingerprintInput = await collectPolicyFingerprintInput();
  const decisions = decisionPaths.flatMap((path) => {
    const bundle = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    if (bundle.evidenceKind === 'curated-offline-policy-expectations') {
      assertPolicyFingerprint(String(bundle.policyFingerprintSha256 ?? ''), policyFingerprintInput);
      assertFixtureContractAndCoverage(bundle, fixtures);
    }
    return parseCuratedPolicyBundle(bundle, fixtures);
  });
  for (const decision of decisions) {
    for (const toolCall of decision.toolCalls) {
      validateCuratedToolArguments(toolCall.name, toolCall.arguments);
    }
  }
  assertUniqueCuratedPolicyDecisions(decisions);
  if (usingDefaultPolicyBundle || decisions.some((decision) => decision.source === 'curated-offline-policy')) {
    assertCompleteCuratedPolicyDecisions(fixtures, decisions);
  }
  const policyScores = scoreCuratedPolicyDecisions(fixtures, decisions);
  assertCuratedPolicyReleaseGates(fixtures, decisions, policyScores);
  return {
    schemaVersion: 3,
    executionMode: 'deterministic-offline',
    evidenceLabel: 'curated offline policy decisions/expectations',
    registry: await inspectLiveMcpMetadata(),
    corpus: {
      fixtureCount: fixtures.length,
      categories: [...ALL_FIXTURE_CATEGORIES],
      liveProfileFixtures: fixtures.filter((fixture) => fixture.registryProfile === 'live-read-only').length,
      futureGatedProfileFixtures: fixtures.filter(
        (fixture) => fixture.registryProfile === 'future-generation-evaluation'
      ).length,
    },
    fixtureContract: buildFixtureBaseline(fixtures),
    fixtureContractSha256: computeFixtureContractSha256(fixtures),
    policyCoverage: REQUIRED_POLICY_COVERAGE,
    policyFingerprintSha256: computePolicyFingerprintSha256(policyFingerprintInput),
    curatedPolicyEvaluation: policyScores,
    realHostMetrics: {
      status: 'unavailable-until-task-10',
      codex: null,
      claude: null,
    },
  };
}

function parseCliArguments(argv: string[]): { fixturePath?: string; decisionPaths: string[] } {
  const options: { fixturePath?: string; decisionPaths: string[] } = { decisionPaths: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument !== '--fixtures' && argument !== '--decisions') {
      throw new Error(`unknown argument ${argument}`);
    }
    const path = argv[index + 1];
    if (!path || path.startsWith('--')) throw new Error(`${argument} requires a JSON path`);
    index += 1;
    if (argument === '--fixtures') {
      if (options.fixturePath) throw new Error('--fixtures may be provided only once');
      options.fixturePath = path;
    } else {
      options.decisionPaths.push(path);
    }
  }
  return options;
}

async function main(): Promise<void> {
  const report = await runEvaluation(parseCliArguments(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
