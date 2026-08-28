import { createHash } from 'node:crypto';

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
  'get_model_details',
  'recommend_models',
  'calculate_project_budget',
] as const;

export const FUTURE_GATED_TOOL_NAMES = [
  'list_media',
  'create_reference_upload_link',
  'import_reference_files',
  'prepare_generation',
  'confirm_generation',
  'get_generation_status',
  'list_recent_generations',
  'present_generation',
  'create_topup_link',
] as const;

const ALL_EVALUATION_TOOL_NAMES = [...LIVE_TOOL_NAMES, ...FUTURE_GATED_TOOL_NAMES] as const;
export const REGISTRY_PROFILES = ['live-read-only', 'future-generation-evaluation'] as const;
const CAPABILITY_CLAIMS = [
  'account_status_read_only',
  'account_destinations_read_only',
  'public_model_catalog_read_only',
  'model_details_read_only',
  'model_recommendations_read_only',
  'project_budget_read_only',
  'project_estimate_not_reservation',
  'host_prompt_drafting_only',
  'unsupported_by_live_registry',
  'no_maxvideoai_tool_needed',
  'generation_not_live',
  'future_exact_quote_gated',
  'future_confirmation_gated',
  'future_generation_status_gated',
  'future_topup_handoff_gated',
  'future_reference_upload_handoff_gated',
  'private_media_library_read_only',
  'generation_library_recovery',
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
export const POLICY_CHECKS = [
  'selected_seedance_details',
  'i2v_first_last_images',
  'ref2v_multimodal_media',
  'v2v_source_and_guidance',
  'extend_ordered_sources',
  'budget_only_no_quote_or_confirm',
  'quote_only_waits_for_approval',
  'confirmed_exact_quote_once',
  'ambiguous_approval_no_confirm',
  'recovery_without_resubmit',
  'account_destination_without_invention',
  'topup_from_prepared_quote',
  'funding_requote_before_confirm',
  'library_recovery_without_resubmit',
  'private_media_kind_selection',
  'reference_upload_then_list',
  'failure_status_without_resubmit',
  'no_payment_data_or_invented_url',
  'stale_quote_no_confirm',
] as const;

type FixtureCategory = (typeof ALL_FIXTURE_CATEGORIES)[number];
export type EvaluationToolName = (typeof ALL_EVALUATION_TOOL_NAMES)[number];
export type RegistryProfile = (typeof REGISTRY_PROFILES)[number];
export type CapabilityClaim = (typeof CAPABILITY_CLAIMS)[number];
export type PolicyCheck = (typeof POLICY_CHECKS)[number];

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
  policyChecks: PolicyCheck[];
  reason: string;
};

export type CuratedToolCall = {
  name: EvaluationToolName;
  arguments: Record<string, unknown>;
};

export type QuoteTranscriptEvent =
  | {
      type: 'prepare_result';
      quoteId: string;
      amountMinor: number;
      currency: string;
      expiresAt?: string;
    }
  | { type: 'assistant'; text: string }
  | { type: 'user'; text: string }
  | { type: 'confirm_call'; quoteId: string; confirmed: true };

export type CuratedPolicyDecision = {
  fixtureId: string;
  source: 'curated-offline-policy';
  registryProfile: RegistryProfile;
  fixturePromptSha256: string;
  toolCalls: CuratedToolCall[];
  assistantText: string;
  quoteTranscript?: QuoteTranscriptEvent[];
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

const OFFLINE_DECISION_FIELDS = [
  'fixtureId',
  'fixturePromptSha256',
  'source',
  'registryProfile',
  'toolCalls',
  'assistantText',
  'capabilityClaims',
] as const;

function parseQuoteTranscript(value: unknown, path: string): QuoteTranscriptEvent[] {
  if (!Array.isArray(value) || value.length < 2) {
    throw new Error(`${path} must contain at least a prepare result and assistant display`);
  }
  return value.map((entry, index) => {
    const eventPath = `${path}[${index}]`;
    const record = asRecord(entry, eventPath);
    const type = parseString(record.type, `${eventPath}.type`);
    if (type === 'prepare_result') {
      assertExactFields(
        record,
        ['type', 'quoteId', 'amountMinor', 'currency'],
        eventPath,
        ['expiresAt']
      );
      const amountMinor = record.amountMinor;
      if (!Number.isInteger(amountMinor) || (amountMinor as number) <= 0) {
        throw new Error(`${eventPath}.amountMinor must be a positive integer`);
      }
      const currency = parseString(record.currency, `${eventPath}.currency`);
      if (!/^[A-Z]{3}$/.test(currency)) {
        throw new Error(`${eventPath}.currency must be ISO uppercase`);
      }
      const quoteId = parseString(record.quoteId, `${eventPath}.quoteId`);
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
          quoteId
        )
      ) {
        throw new Error(`${eventPath}.quoteId must be a UUID v4`);
      }
      const result: QuoteTranscriptEvent = {
        type,
        quoteId,
        amountMinor: amountMinor as number,
        currency,
      };
      if (record.expiresAt !== undefined) {
        const expiresAt = parseString(record.expiresAt, `${eventPath}.expiresAt`);
        if (Number.isNaN(Date.parse(expiresAt))) {
          throw new Error(`${eventPath}.expiresAt must be ISO datetime`);
        }
        result.expiresAt = expiresAt;
      }
      return result;
    }
    if (type === 'assistant' || type === 'user') {
      assertExactFields(record, ['type', 'text'], eventPath);
      return { type, text: parseString(record.text, `${eventPath}.text`, 20) };
    }
    if (type === 'confirm_call') {
      assertExactFields(record, ['type', 'quoteId', 'confirmed'], eventPath);
      if (record.confirmed !== true) throw new Error(`${eventPath}.confirmed must be true`);
      return {
        type,
        quoteId: parseString(record.quoteId, `${eventPath}.quoteId`),
        confirmed: true,
      };
    }
    throw new Error(`${eventPath}.type is unsupported`);
  });
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}
function assertExactFields(
  value: Record<string, unknown>,
  expected: readonly string[],
  path: string,
  optional: readonly string[] = [],
): void {
  const expectedSet = new Set([...expected, ...optional]);
  for (const field of Object.keys(value)) {
    if (!expectedSet.has(field)) throw new Error(`${path} has unknown field ${field}`);
  }
  for (const field of expected) {
    if (!(field in value)) throw new Error(`${path} is missing field ${field}`);
  }
}

function parseToolArguments(value: unknown, path: string): Record<string, unknown> {
  const record = asRecord(value, path);
  const serialized = JSON.stringify(record);
  if (serialized.length > 8_192) throw new Error(`${path} is too large`);
  if (/(?:email|token|secret|credential|provider|storageUrl)/i.test(Object.keys(record).join(','))) {
    throw new Error(`${path} contains a private field`);
  }
  return record;
}

export function fixturePromptSha256(prompt: string): string {
  return createHash('sha256').update(prompt).digest('hex');
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
    assertExactFields(record, FIXTURE_FIELDS, path, ['policyChecks']);

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
      policyChecks: record.policyChecks === undefined
        ? []
        : parseEnumArray(record.policyChecks, POLICY_CHECKS, `${path}.policyChecks`),
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

export function parseCuratedPolicyBundle(
  value: unknown,
  fixtures: readonly ToolSelectionFixture[]
): CuratedPolicyDecision[] {
  const bundle = asRecord(value, 'decision bundle');
  assertExactFields(
    bundle,
    [
      'version',
      'evidenceKind',
      'policyFingerprintSha256',
      'fixtureContractSha256',
      'policyCoverage',
      'provenance',
      'decisions',
    ],
    'decision bundle',
  );
  if (bundle.evidenceKind !== 'curated-offline-policy-expectations') {
    throw new Error('decision bundle must contain curated offline policy expectations');
  }
  if (bundle.version !== 3) throw new Error('curated policy bundle.version must be 3');
  const fingerprint = parseString(
    bundle.policyFingerprintSha256,
    'decision bundle.policyFingerprintSha256'
  );
  if (!/^[a-f0-9]{64}$/.test(fingerprint)) {
    throw new Error('decision bundle.policyFingerprintSha256 must be lowercase SHA-256');
  }
  const fixtureContractFingerprint = parseString(
    bundle.fixtureContractSha256,
    'decision bundle.fixtureContractSha256'
  );
  if (!/^[a-f0-9]{64}$/.test(fixtureContractFingerprint)) {
    throw new Error('decision bundle.fixtureContractSha256 must be lowercase SHA-256');
  }
  const coverage = asRecord(bundle.policyCoverage, 'decision bundle.policyCoverage');
  assertExactFields(
    coverage,
    ['fixtureCount', 'policyCheckCount', 'requiredChecks'],
    'decision bundle.policyCoverage'
  );
  for (const field of ['fixtureCount', 'policyCheckCount'] as const) {
    if (!Number.isInteger(coverage[field]) || (coverage[field] as number) <= 0) {
      throw new Error(`decision bundle.policyCoverage.${field} must be a positive integer`);
    }
  }
  const requiredChecks = asRecord(
    coverage.requiredChecks,
    'decision bundle.policyCoverage.requiredChecks'
  );
  assertExactFields(
    requiredChecks,
    POLICY_CHECKS,
    'decision bundle.policyCoverage.requiredChecks'
  );
  for (const check of POLICY_CHECKS) {
    if (!Number.isInteger(requiredChecks[check]) || (requiredChecks[check] as number) <= 0) {
      throw new Error(
        `decision bundle.policyCoverage.requiredChecks.${check} must be a positive integer`
      );
    }
  }
  const provenance = asRecord(bundle.provenance, 'decision bundle.provenance');
  assertExactFields(provenance, ['kind', 'authoring', 'noRealHost'], 'decision bundle.provenance');
  if (
    provenance.kind !== 'curated_offline_policy' ||
    provenance.authoring !== 'manual_reviewed' ||
    provenance.noRealHost !== true
  ) {
    throw new Error('decision bundle.provenance must identify manual curated policy expectations');
  }
  if (!Array.isArray(bundle.decisions)) throw new Error('decision bundle.decisions must be an array');

  const fixtureById = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
  const decisionKeys = new Set<string>();
  return bundle.decisions.map((entry, index) => {
    const path = `decision bundle.decisions[${index}]`;
    const record = asRecord(entry, path);
    assertExactFields(record, OFFLINE_DECISION_FIELDS, path, ['quoteTranscript']);
    const fixtureId = parseString(record.fixtureId, `${path}.fixtureId`);
    const fixture = fixtureById.get(fixtureId);
    if (!fixture) throw new Error(`${path}.fixtureId is unknown: ${fixtureId}`);
    const registryProfile = parseEnum(
      record.registryProfile,
      REGISTRY_PROFILES,
      `${path}.registryProfile`
    );
    if (record.source !== 'curated-offline-policy') {
      throw new Error(`${path}.source must be curated-offline-policy`);
    }
    const hash = parseString(record.fixturePromptSha256, `${path}.fixturePromptSha256`);
    if (!/^[a-f0-9]{64}$/.test(hash) || hash !== fixturePromptSha256(fixture.prompt)) {
      throw new Error(`${path} is stale for fixture ${fixture.id}`);
    }
    if (!Array.isArray(record.toolCalls)) throw new Error(`${path}.toolCalls must be an array`);
    const decision: CuratedPolicyDecision = {
      fixtureId,
      source: 'curated-offline-policy',
      registryProfile,
      fixturePromptSha256: hash,
      toolCalls: record.toolCalls.map((toolCall, toolIndex) => {
        const toolPath = `${path}.toolCalls[${toolIndex}]`;
        const toolRecord = asRecord(toolCall, toolPath);
        assertExactFields(toolRecord, ['name', 'arguments'], toolPath);
        return {
          name: parseEnum(toolRecord.name, ALL_EVALUATION_TOOL_NAMES, `${toolPath}.name`),
          arguments: parseToolArguments(toolRecord.arguments, `${toolPath}.arguments`),
        };
      }),
      assistantText: parseString(record.assistantText, `${path}.assistantText`, 20),
      capabilityClaims: parseEnumArray(
        record.capabilityClaims,
        CAPABILITY_CLAIMS,
        `${path}.capabilityClaims`
      ),
    };
    const hasPrepare = decision.toolCalls.some((call) => call.name === 'prepare_generation');
    if (hasPrepare) {
      decision.quoteTranscript = parseQuoteTranscript(
        record.quoteTranscript,
        `${path}.quoteTranscript`
      );
    } else if (record.quoteTranscript !== undefined) {
      throw new Error(`${path}.quoteTranscript is allowed only with prepare_generation`);
    }
    if (decision.registryProfile !== fixture.registryProfile) {
      throw new Error(`${path}.registryProfile does not match fixture ${fixture.id}`);
    }
    const decisionKey = decision.fixtureId;
    if (decisionKeys.has(decisionKey)) throw new Error(`duplicate curated policy decision ${decisionKey}`);
    decisionKeys.add(decisionKey);
    return decision;
  });
}
