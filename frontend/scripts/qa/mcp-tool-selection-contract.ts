export const ALL_FIXTURE_CATEGORIES = [
  'direct_maxvideoai',
  'indirect_video',
  'indirect_image',
  'prompt_writing_only',
  'unsupported_source_video',
  'unsupported_audio',
  'unsupported_document',
  'price_first',
  'ambiguous_spending',
  'references',
  'audio',
  'model_comparison',
  'unrelated_coding',
  'unrelated_research',
  'local_image_editing',
] as const;

export const LIVE_TOOL_NAMES = [
  'get_account_status',
  'list_models',
  'recommend_models',
] as const;

export const FUTURE_GATED_TOOL_NAMES = [
  'prepare_generation',
  'confirm_generation',
] as const;

const ALL_EVALUATION_TOOL_NAMES = [...LIVE_TOOL_NAMES, ...FUTURE_GATED_TOOL_NAMES] as const;
const REGISTRY_PROFILES = ['live-read-only', 'future-generation-evaluation'] as const;
export const RECORDED_HOSTS = ['codex', 'claude', 'other'] as const;
const CAPABILITY_CLAIMS = [
  'account_status_read_only',
  'public_model_catalog_read_only',
  'model_recommendations_read_only',
  'host_prompt_drafting_only',
  'unsupported_by_live_registry',
  'no_maxvideoai_tool_needed',
  'generation_not_live',
  'future_exact_quote_gated',
  'future_confirmation_gated',
  'model_specific_reference_support',
  'model_specific_audio_support',
  'generation_live',
  'exact_quote_live',
  'reference_upload_live',
  'audio_editing_live',
  'document_processing_live',
  'provider_acceptance_guaranteed',
  'universal_model_support',
  'payment_through_mcp_live',
] as const;

type FixtureCategory = (typeof ALL_FIXTURE_CATEGORIES)[number];
export type EvaluationToolName = (typeof ALL_EVALUATION_TOOL_NAMES)[number];
type RegistryProfile = (typeof REGISTRY_PROFILES)[number];
export type RecordedHost = (typeof RECORDED_HOSTS)[number];
export type CapabilityClaim = (typeof CAPABILITY_CLAIMS)[number];

export type ToolSelectionFixture = {
  id: string;
  category: FixtureCategory;
  registryProfile: RegistryProfile;
  prompt: string;
  expectedTools: EvaluationToolName[];
  allowedAlternatives: EvaluationToolName[];
  prohibitedTools: EvaluationToolName[];
  expectedCapabilityClaims: CapabilityClaim[];
  prohibitedClaims: CapabilityClaim[];
  reason: string;
};

export type RecordedDecision = {
  fixtureId: string;
  host: RecordedHost;
  registryProfile: RegistryProfile;
  selectedTools: EvaluationToolName[];
  capabilityClaims: CapabilityClaim[];
};

const FIXTURE_FIELDS = [
  'id',
  'category',
  'registryProfile',
  'prompt',
  'expectedTools',
  'allowedAlternatives',
  'prohibitedTools',
  'expectedCapabilityClaims',
  'prohibitedClaims',
  'reason',
] as const;

const DECISION_FIELDS = [
  'fixtureId',
  'host',
  'registryProfile',
  'selectedTools',
  'capabilityClaims',
] as const;

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}
function assertExactFields(
  value: Record<string, unknown>,
  expected: readonly string[],
  path: string
): void {
  const expectedSet = new Set(expected);
  for (const field of Object.keys(value)) {
    if (!expectedSet.has(field)) throw new Error(`${path} has unknown field ${field}`);
  }
  for (const field of expected) {
    if (!(field in value)) throw new Error(`${path} is missing field ${field}`);
  }
}

function parseString(value: unknown, path: string, minLength = 1): string {
  if (typeof value !== 'string' || value.trim() !== value || value.length < minLength) {
    throw new Error(`${path} must be a trimmed string of at least ${minLength} characters`);
  }
  return value;
}

function parseEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`${path} must be one of ${allowed.join(', ')}`);
  }
  return value as T;
}

function parseEnumArray<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
  options: { allowDuplicates?: boolean } = {}
): T[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
  const parsed = value.map((entry, index) => parseEnum(entry, allowed, `${path}[${index}]`));
  if (!options.allowDuplicates && new Set(parsed).size !== parsed.length) {
    throw new Error(`${path} must not contain duplicates`);
  }
  return parsed;
}

function assertDisjoint(
  left: readonly string[],
  right: readonly string[],
  path: string
): void {
  const overlap = left.filter((value) => right.includes(value));
  if (overlap.length > 0) throw new Error(`${path} overlap: ${overlap.join(', ')}`);
}

export function parseFixtureCorpus(value: unknown): ToolSelectionFixture[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('fixture corpus must be a non-empty array');
  }

  const ids = new Set<string>();
  return value.map((entry, index) => {
    const path = `fixtures[${index}]`;
    const record = asRecord(entry, path);
    assertExactFields(record, FIXTURE_FIELDS, path);

    const fixture: ToolSelectionFixture = {
      id: parseString(record.id, `${path}.id`),
      category: parseEnum(record.category, ALL_FIXTURE_CATEGORIES, `${path}.category`),
      registryProfile: parseEnum(record.registryProfile, REGISTRY_PROFILES, `${path}.registryProfile`),
      prompt: parseString(record.prompt, `${path}.prompt`, 20),
      expectedTools: parseEnumArray(
        record.expectedTools,
        ALL_EVALUATION_TOOL_NAMES,
        `${path}.expectedTools`
      ),
      allowedAlternatives: parseEnumArray(
        record.allowedAlternatives,
        ALL_EVALUATION_TOOL_NAMES,
        `${path}.allowedAlternatives`
      ),
      prohibitedTools: parseEnumArray(
        record.prohibitedTools,
        ALL_EVALUATION_TOOL_NAMES,
        `${path}.prohibitedTools`
      ),
      expectedCapabilityClaims: parseEnumArray(
        record.expectedCapabilityClaims,
        CAPABILITY_CLAIMS,
        `${path}.expectedCapabilityClaims`
      ),
      prohibitedClaims: parseEnumArray(
        record.prohibitedClaims,
        CAPABILITY_CLAIMS,
        `${path}.prohibitedClaims`
      ),
      reason: parseString(record.reason, `${path}.reason`, 20),
    };

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fixture.id)) {
      throw new Error(`${path}.id must be lower kebab-case`);
    }
    if (ids.has(fixture.id)) throw new Error(`duplicate fixture id ${fixture.id}`);
    ids.add(fixture.id);
    assertDisjoint(fixture.expectedTools, fixture.allowedAlternatives, `${path} expected/alternative tools`);
    assertDisjoint(fixture.expectedTools, fixture.prohibitedTools, `${path} expected/prohibited tools`);
    assertDisjoint(fixture.allowedAlternatives, fixture.prohibitedTools, `${path} alternative/prohibited tools`);
    assertDisjoint(
      fixture.expectedCapabilityClaims,
      fixture.prohibitedClaims,
      `${path} expected/prohibited claims`
    );

    if (
      fixture.registryProfile === 'live-read-only' &&
      fixture.expectedTools.some((tool) =>
        FUTURE_GATED_TOOL_NAMES.includes(tool as (typeof FUTURE_GATED_TOOL_NAMES)[number])
      )
    ) {
      throw new Error(`${path} cannot expect future tools from the live read-only profile`);
    }
    const confirmIndex = fixture.expectedTools.indexOf('confirm_generation');
    if (confirmIndex >= 0) {
      const prepareIndex = fixture.expectedTools.indexOf('prepare_generation');
      if (prepareIndex < 0 || prepareIndex > confirmIndex) {
        throw new Error(`${path} must expect prepare_generation before confirm_generation`);
      }
    }
    return fixture;
  });
}

export function parseDecisionBundle(
  value: unknown,
  fixtures: readonly ToolSelectionFixture[]
): RecordedDecision[] {
  const bundle = asRecord(value, 'decision bundle');
  assertExactFields(bundle, ['version', 'evidenceKind', 'decisions'], 'decision bundle');
  if (bundle.version !== 1) throw new Error('decision bundle.version must be 1');
  if (bundle.evidenceKind !== 'sanitized-recorded-host-decisions') {
    throw new Error('decision bundle.evidenceKind must identify sanitized recorded host decisions');
  }
  if (!Array.isArray(bundle.decisions)) throw new Error('decision bundle.decisions must be an array');

  const fixtureById = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
  const decisionKeys = new Set<string>();
  return bundle.decisions.map((entry, index) => {
    const path = `decision bundle.decisions[${index}]`;
    const record = asRecord(entry, path);
    assertExactFields(record, DECISION_FIELDS, path);
    const fixtureId = parseString(record.fixtureId, `${path}.fixtureId`);
    const fixture = fixtureById.get(fixtureId);
    if (!fixture) throw new Error(`${path}.fixtureId is unknown: ${fixtureId}`);
    const decision: RecordedDecision = {
      fixtureId,
      host: parseEnum(record.host, RECORDED_HOSTS, `${path}.host`),
      registryProfile: parseEnum(
        record.registryProfile,
        REGISTRY_PROFILES,
        `${path}.registryProfile`
      ),
      selectedTools: parseEnumArray(
        record.selectedTools,
        ALL_EVALUATION_TOOL_NAMES,
        `${path}.selectedTools`,
        { allowDuplicates: true }
      ),
      capabilityClaims: parseEnumArray(
        record.capabilityClaims,
        CAPABILITY_CLAIMS,
        `${path}.capabilityClaims`
      ),
    };
    if (decision.registryProfile !== fixture.registryProfile) {
      throw new Error(`${path}.registryProfile does not match fixture ${fixture.id}`);
    }
    const decisionKey = `${decision.host}:${decision.fixtureId}`;
    if (decisionKeys.has(decisionKey)) throw new Error(`duplicate recorded decision ${decisionKey}`);
    decisionKeys.add(decisionKey);
    return decision;
  });
}
