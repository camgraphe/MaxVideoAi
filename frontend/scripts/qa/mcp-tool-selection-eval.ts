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
  ALL_FIXTURE_CATEGORIES,
  FUTURE_GATED_TOOL_NAMES,
  LIVE_TOOL_NAMES,
  parseDecisionBundle,
  parseFixtureCorpus,
  type ToolSelectionFixture,
} from './mcp-tool-selection-contract';
import {
  assertUniqueRecordedDecisions,
  buildFixtureBaseline,
  scoreRecordedDecisions,
} from './mcp-tool-selection-scoring';

export {
  ALL_FIXTURE_CATEGORIES,
  FUTURE_GATED_TOOL_NAMES,
  LIVE_TOOL_NAMES,
  parseDecisionBundle,
  parseFixtureCorpus,
} from './mcp-tool-selection-contract';
export type {
  RecordedDecision,
  ToolSelectionFixture,
} from './mcp-tool-selection-contract';
export {
  buildFixtureBaseline,
  scoreRecordedDecisions,
} from './mcp-tool-selection-scoring';
export type { ProfileScore } from './mcp-tool-selection-scoring';

export type RegistryEvidence = {
  liveTools: string[];
  resourcesAdvertised: boolean;
  generationAvailable: boolean;
  publicationFlagsAllFalse: boolean;
  instructions: string;
};

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
      /charge.*trial.*email.*generate/i
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
  const decisions = (options.decisionPaths ?? []).flatMap((path) =>
    parseDecisionBundle(JSON.parse(readFileSync(path, 'utf8')), fixtures)
  );
  assertUniqueRecordedDecisions(decisions);
  return {
    schemaVersion: 1,
    executionMode: 'deterministic-offline',
    registry: await inspectLiveMcpMetadata(),
    corpus: {
      fixtureCount: fixtures.length,
      categories: [...ALL_FIXTURE_CATEGORIES],
      liveProfileFixtures: fixtures.filter((fixture) => fixture.registryProfile === 'live-read-only').length,
      futureGatedProfileFixtures: fixtures.filter(
        (fixture) => fixture.registryProfile === 'future-generation-evaluation'
      ).length,
    },
    fixtureBaseline: buildFixtureBaseline(fixtures),
    recordedEvidence: scoreRecordedDecisions(fixtures, decisions),
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
