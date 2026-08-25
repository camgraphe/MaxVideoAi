import {
  RECORDED_HOSTS,
  REGISTRY_PROFILES,
  type CapabilityClaim,
  type EvaluationToolName,
  type RecordedDecision,
  type RecordedHost,
  type RegistryProfile,
  type PolicyCheck,
  type ToolSelectionFixture,
} from './mcp-tool-selection-contract';

type MetricFraction = {
  numerator: number;
  denominator: number;
  rate: number | null;
};

type ScoreCounts = {
  precisionNumerator: number;
  precisionDenominator: number;
  recallNumerator: number;
  recallDenominator: number;
  forbiddenConfirmNumerator: number;
  forbiddenConfirmDenominator: number;
  quoteBeforeConfirmNumerator: number;
  quoteBeforeConfirmDenominator: number;
  unsupportedClaimNumerator: number;
  unsupportedClaimDenominator: number;
  capabilityRecallNumerator: number;
  capabilityRecallDenominator: number;
  policyCheckNumerator: number;
  policyCheckDenominator: number;
};

export type ProfileScore = {
  host: RecordedHost | 'fixture-contract-only' | 'offline-policy' | 'aggregate';
  registryProfile: RegistryProfile;
  evidenceStatus:
    | 'expectations-only-no-observed-decisions'
    | 'recorded-partial'
    | 'recorded-complete'
    | 'recorded-aggregate-partial'
    | 'recorded-aggregate-complete'
    | 'no-recorded-host-evidence'
    | 'offline-recorded-complete'
    | 'offline-recorded-partial'
    | 'no-offline-policy-evidence';
  evaluatedFixtures: number;
  totalFixtures: number;
  selectionPrecision: MetricFraction;
  selectionRecall: MetricFraction;
  forbiddenConfirmRate: MetricFraction;
  quoteBeforeConfirmRate: MetricFraction;
  unsupportedClaimRate: MetricFraction;
  capabilityClaimRecall: MetricFraction;
  policyAdherenceRate: MetricFraction;
};

function emptyCounts(): ScoreCounts {
  return {
    precisionNumerator: 0,
    precisionDenominator: 0,
    recallNumerator: 0,
    recallDenominator: 0,
    forbiddenConfirmNumerator: 0,
    forbiddenConfirmDenominator: 0,
    quoteBeforeConfirmNumerator: 0,
    quoteBeforeConfirmDenominator: 0,
    unsupportedClaimNumerator: 0,
    unsupportedClaimDenominator: 0,
    capabilityRecallNumerator: 0,
    capabilityRecallDenominator: 0,
    policyCheckNumerator: 0,
    policyCheckDenominator: 0,
  };
}

function addCounts(target: ScoreCounts, addition: ScoreCounts): void {
  for (const key of Object.keys(target) as Array<keyof ScoreCounts>) {
    target[key] += addition[key];
  }
}

function fraction(numerator: number, denominator: number): MetricFraction {
  return { numerator, denominator, rate: denominator === 0 ? null : numerator / denominator };
}

function orderedMatchCount(
  selected: readonly EvaluationToolName[],
  expected: readonly EvaluationToolName[]
): number {
  const rows = expected.length + 1;
  const columns = selected.length + 1;
  const table = Array.from({ length: rows }, () => Array<number>(columns).fill(0));
  for (let expectedIndex = 1; expectedIndex < rows; expectedIndex += 1) {
    for (let selectedIndex = 1; selectedIndex < columns; selectedIndex += 1) {
      table[expectedIndex][selectedIndex] =
        expected[expectedIndex - 1] === selected[selectedIndex - 1]
          ? table[expectedIndex - 1][selectedIndex - 1] + 1
          : Math.max(table[expectedIndex - 1][selectedIndex], table[expectedIndex][selectedIndex - 1]);
    }
  }
  return table[expected.length][selected.length];
}

function alternativesMatchCount(
  selected: readonly EvaluationToolName[],
  alternatives: readonly EvaluationToolName[]
): number {
  return alternatives.filter((alternative) => selected.includes(alternative)).length;
}

function hasPairedQuoteBeforeEveryConfirmation(
  selected: readonly EvaluationToolName[]
): boolean {
  let unconsumedQuotes = 0;
  let confirmations = 0;
  for (const tool of selected) {
    if (tool === 'prepare_generation') unconsumedQuotes += 1;
    if (tool === 'confirm_generation') {
      confirmations += 1;
      if (unconsumedQuotes === 0) return false;
      unconsumedQuotes -= 1;
    }
  }
  return confirmations > 0;
}

function toolCalls(decision: RecordedDecision) {
  return decision.toolCalls ?? [];
}

function callArguments(
  decision: RecordedDecision,
  name: EvaluationToolName
): Record<string, unknown>[] {
  return toolCalls(decision)
    .filter((call) => call.name === name)
    .map((call) => call.arguments);
}

function referenceRoles(argumentsValue: Record<string, unknown>): string[] {
  const references = argumentsValue.references;
  if (!Array.isArray(references)) return [];
  return references.flatMap((reference) => {
    if (!reference || typeof reference !== 'object' || Array.isArray(reference)) return [];
    const role = (reference as Record<string, unknown>).role;
    return typeof role === 'string' ? [role] : [];
  });
}

function hasMediaKinds(decision: RecordedDecision, expectedKinds: readonly string[]): boolean {
  const kinds = callArguments(decision, 'list_media').map((args) => args.kind);
  return expectedKinds.every((kind) => kinds.includes(kind));
}

function hasPrepareMode(decision: RecordedDecision, mode: string): boolean {
  return callArguments(decision, 'prepare_generation').some(
    (args) => args.mode === mode && args.engineId === 'seedance-2-5'
  );
}

function evaluatePolicyCheck(check: PolicyCheck, decision: RecordedDecision): boolean {
  const calls = toolCalls(decision);
  const selected = calls.map((call) => call.name);
  const assistantText = decision.assistantText ?? '';
  const prepares = callArguments(decision, 'prepare_generation');
  const confirms = callArguments(decision, 'confirm_generation');

  switch (check) {
    case 'selected_seedance_details':
      return callArguments(decision, 'get_model_details').some(
        (args) => args.id === 'seedance-2-5'
      );
    case 'i2v_first_last_images':
      return hasMediaKinds(decision, ['image']) && hasPrepareMode(decision, 'i2v') &&
        prepares.some((args) => {
          const roles = referenceRoles(args);
          return roles.includes('first_frame') && roles.includes('last_frame');
        });
    case 'ref2v_multimodal_media':
      return hasMediaKinds(decision, ['image', 'video', 'audio']) &&
        hasPrepareMode(decision, 'ref2v') &&
        prepares.some((args) => referenceRoles(args).filter((role) => role === 'reference').length >= 3);
    case 'v2v_source_and_guidance':
      return hasMediaKinds(decision, ['video', 'image', 'audio']) &&
        hasPrepareMode(decision, 'v2v') &&
        prepares.some((args) => {
          const roles = referenceRoles(args);
          return roles.includes('source') && roles.includes('reference');
        });
    case 'extend_ordered_sources':
      return hasMediaKinds(decision, ['video']) && hasPrepareMode(decision, 'extend') &&
        prepares.some((args) => {
          const references = args.references;
          if (!Array.isArray(references) || references.length < 3) return false;
          return references.every((reference) =>
            Boolean(reference) && typeof reference === 'object' && !Array.isArray(reference) &&
              (reference as Record<string, unknown>).role === 'source'
          );
        });
    case 'budget_only_no_quote_or_confirm':
      return !selected.includes('prepare_generation') && !selected.includes('confirm_generation');
    case 'quote_only_waits_for_approval':
      return prepares.length > 0 && confirms.length === 0 &&
        /exact (?:price|quote)|(?:price|quote) is exact/i.test(assistantText) &&
        /explicit approval|approve explicitly|wait(?:ing)? for (?:your )?approval/i.test(assistantText) &&
        /not (?:started|submitted|confirmed)|have not (?:started|submitted|confirmed)/i.test(assistantText);
    case 'confirmed_exact_quote_once': {
      if (prepares.length === 0 || confirms.length !== 1) return false;
      const prepareIndex = selected.indexOf('prepare_generation');
      const confirmIndex = selected.indexOf('confirm_generation');
      const confirm = confirms[0];
      return prepareIndex >= 0 && confirmIndex > prepareIndex && confirm.confirmed === true &&
        typeof confirm.quoteId === 'string' && confirm.quoteId.length > 0 &&
        /exact (?:price|quote)|(?:price|quote) was exact/i.test(assistantText) &&
        /explicit(?:ly)? approv/i.test(assistantText);
    }
    case 'ambiguous_approval_no_confirm':
      return confirms.length === 0 && /explicit|clear approval|please approve/i.test(assistantText);
    case 'recovery_without_resubmit':
      return (selected.includes('get_generation_status') || selected.includes('list_recent_generations')) &&
        !selected.includes('prepare_generation') && !selected.includes('confirm_generation') &&
        /recover|status|refund/i.test(assistantText) &&
        /no (?:duplicate|new)|without (?:resubmitting|starting another)/i.test(assistantText);
  }
}

function scoreOne(
  fixture: ToolSelectionFixture,
  selectedTools: readonly EvaluationToolName[],
  capabilityClaims: readonly CapabilityClaim[],
  decision?: RecordedDecision,
): ScoreCounts {
  const counts = emptyCounts();
  const requiredMatches = orderedMatchCount(selectedTools, fixture.expectedTools);
  const alternativeMatches = alternativesMatchCount(selectedTools, fixture.allowedAlternatives);
  counts.precisionNumerator = Math.min(selectedTools.length, requiredMatches + alternativeMatches);
  counts.precisionDenominator = selectedTools.length;
  counts.recallNumerator = requiredMatches;
  counts.recallDenominator = fixture.expectedTools.length;

  if (fixture.prohibitedTools.includes('confirm_generation')) {
    counts.forbiddenConfirmDenominator = 1;
    counts.forbiddenConfirmNumerator = selectedTools.includes('confirm_generation') ? 1 : 0;
  }

  const expectsConfirmation = fixture.expectedTools.includes('confirm_generation');
  const selectedConfirmation = selectedTools.includes('confirm_generation');
  if (expectsConfirmation || selectedConfirmation) {
    counts.quoteBeforeConfirmDenominator = 1;
    counts.quoteBeforeConfirmNumerator =
      expectsConfirmation &&
      !fixture.prohibitedTools.includes('confirm_generation') &&
      hasPairedQuoteBeforeEveryConfirmation(selectedTools)
        ? 1
        : 0;
  }

  counts.unsupportedClaimDenominator = capabilityClaims.length;
  counts.unsupportedClaimNumerator = capabilityClaims.filter(
    (claim) =>
      fixture.prohibitedClaims.includes(claim) ||
      !fixture.expectedCapabilityClaims.includes(claim)
  ).length;
  counts.capabilityRecallDenominator = fixture.expectedCapabilityClaims.length;
  counts.capabilityRecallNumerator = fixture.expectedCapabilityClaims.filter((claim) =>
    capabilityClaims.includes(claim)
  ).length;
  if (decision?.source === 'offline-policy') {
    counts.policyCheckDenominator = fixture.policyChecks.length;
    counts.policyCheckNumerator = fixture.policyChecks.filter((check) =>
      evaluatePolicyCheck(check, decision)
    ).length;
  }
  return counts;
}

function toProfileScore(
  host: ProfileScore['host'],
  registryProfile: RegistryProfile,
  evidenceStatus: ProfileScore['evidenceStatus'],
  evaluatedFixtures: number,
  totalFixtures: number,
  counts: ScoreCounts
): ProfileScore {
  return {
    host,
    registryProfile,
    evidenceStatus,
    evaluatedFixtures,
    totalFixtures,
    selectionPrecision: fraction(counts.precisionNumerator, counts.precisionDenominator),
    selectionRecall: fraction(counts.recallNumerator, counts.recallDenominator),
    forbiddenConfirmRate: fraction(
      counts.forbiddenConfirmNumerator,
      counts.forbiddenConfirmDenominator
    ),
    quoteBeforeConfirmRate: fraction(
      counts.quoteBeforeConfirmNumerator,
      counts.quoteBeforeConfirmDenominator
    ),
    unsupportedClaimRate: fraction(
      counts.unsupportedClaimNumerator,
      counts.unsupportedClaimDenominator
    ),
    capabilityClaimRecall: fraction(
      counts.capabilityRecallNumerator,
      counts.capabilityRecallDenominator
    ),
    policyAdherenceRate: fraction(counts.policyCheckNumerator, counts.policyCheckDenominator),
  };
}

export function assertUniqueRecordedDecisions(decisions: readonly RecordedDecision[]): void {
  const seen = new Set<string>();
  for (const decision of decisions) {
    const key = `${decision.source ?? decision.host}:${decision.fixtureId}`;
    if (seen.has(key)) throw new Error(`duplicate recorded decision ${key}`);
    seen.add(key);
  }
}

function scoreDecisionSet(
  fixtures: readonly ToolSelectionFixture[],
  decisions: readonly RecordedDecision[]
): ScoreCounts {
  const counts = emptyCounts();
  const fixtureById = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
  for (const decision of decisions) {
    const fixture = fixtureById.get(decision.fixtureId);
    if (!fixture) throw new Error(`unknown fixture ${decision.fixtureId}`);
    if (fixture.registryProfile !== decision.registryProfile) {
      throw new Error(`registry profile mismatch for ${decision.source ?? decision.host}:${fixture.id}`);
    }
    const selectedTools = decision.toolCalls
      ? [...new Set(decision.toolCalls.map((call) => call.name))]
      : decision.selectedTools ?? [];
    addCounts(counts, scoreOne(fixture, selectedTools, decision.capabilityClaims, decision));
  }
  return counts;
}

function relevantProfiles(fixtures: readonly ToolSelectionFixture[]): RegistryProfile[] {
  return REGISTRY_PROFILES.filter((profile) =>
    fixtures.some((fixture) => fixture.registryProfile === profile)
  );
}

export function scoreRecordedDecisions(
  fixtures: readonly ToolSelectionFixture[],
  decisions: readonly RecordedDecision[]
): { hostProfiles: ProfileScore[]; aggregateProfiles: ProfileScore[]; policyProfiles: ProfileScore[] } {
  assertUniqueRecordedDecisions(decisions);
  const fixtureById = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
  for (const decision of decisions) {
    const fixture = fixtureById.get(decision.fixtureId);
    if (!fixture) throw new Error(`unknown fixture ${decision.fixtureId}`);
    if (fixture.registryProfile !== decision.registryProfile) {
      throw new Error(`registry profile mismatch for ${decision.source ?? decision.host}:${fixture.id}`);
    }
  }
  const hostProfiles: ProfileScore[] = [];
  const aggregateProfiles: ProfileScore[] = [];
  const policyProfiles: ProfileScore[] = [];

  for (const registryProfile of relevantProfiles(fixtures)) {
    const profileFixtures = fixtures.filter(
      (fixture) => fixture.registryProfile === registryProfile
    );
    const profileFixtureIds = new Set(profileFixtures.map((fixture) => fixture.id));
    const profileDecisions = decisions.filter((decision) =>
      profileFixtureIds.has(decision.fixtureId) && decision.host !== undefined
    );
    const policyDecisions = decisions.filter((decision) =>
      profileFixtureIds.has(decision.fixtureId) && decision.source === 'offline-policy'
    );
    let everyHostComplete = true;

    for (const host of RECORDED_HOSTS) {
      const hostDecisions = profileDecisions.filter((decision) => decision.host === host);
      const evidenceStatus: ProfileScore['evidenceStatus'] =
        hostDecisions.length === 0
          ? 'no-recorded-host-evidence'
          : hostDecisions.length === profileFixtures.length
            ? 'recorded-complete'
            : 'recorded-partial';
      if (evidenceStatus !== 'recorded-complete') everyHostComplete = false;
      hostProfiles.push(
        toProfileScore(
          host,
          registryProfile,
          evidenceStatus,
          hostDecisions.length,
          profileFixtures.length,
          scoreDecisionSet(profileFixtures, hostDecisions)
        )
      );
    }

    const aggregateStatus: ProfileScore['evidenceStatus'] =
      profileDecisions.length === 0
        ? 'no-recorded-host-evidence'
        : everyHostComplete
          ? 'recorded-aggregate-complete'
          : 'recorded-aggregate-partial';
    aggregateProfiles.push(
      toProfileScore(
        'aggregate',
        registryProfile,
        aggregateStatus,
        profileDecisions.length,
        profileFixtures.length * RECORDED_HOSTS.length,
        scoreDecisionSet(profileFixtures, profileDecisions)
      )
    );
    policyProfiles.push(
      toProfileScore(
        'offline-policy',
        registryProfile,
        policyDecisions.length === 0
          ? 'no-offline-policy-evidence'
          : policyDecisions.length === profileFixtures.length
            ? 'offline-recorded-complete'
            : 'offline-recorded-partial',
        policyDecisions.length,
        profileFixtures.length,
        scoreDecisionSet(profileFixtures, policyDecisions)
      )
    );
  }

  return { hostProfiles, aggregateProfiles, policyProfiles };
}

export function assertCompleteOfflinePolicyDecisions(
  fixtures: readonly ToolSelectionFixture[],
  decisions: readonly RecordedDecision[]
): void {
  const offline = decisions.filter((decision) => decision.source === 'offline-policy');
  const expectedIds = new Set(fixtures.map((fixture) => fixture.id));
  const actualIds = new Set(offline.map((decision) => decision.fixtureId));
  const missing = [...expectedIds].filter((id) => !actualIds.has(id));
  const extra = [...actualIds].filter((id) => !expectedIds.has(id));
  if (missing.length > 0 || extra.length > 0 || offline.length !== fixtures.length) {
    throw new Error(
      `offline recorded policy decisions are incomplete; missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'}`
    );
  }
}

export function buildFixtureBaseline(
  fixtures: readonly ToolSelectionFixture[]
): ProfileScore[] {
  return relevantProfiles(fixtures).map((registryProfile) => {
    const profileFixtures = fixtures.filter(
      (fixture) => fixture.registryProfile === registryProfile
    );
    return toProfileScore(
      'fixture-contract-only',
      registryProfile,
      'expectations-only-no-observed-decisions',
      0,
      profileFixtures.length,
      emptyCounts()
    );
  });
}
