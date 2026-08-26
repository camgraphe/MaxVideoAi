import {
  REGISTRY_PROFILES,
  type CapabilityClaim,
  type EvaluationToolName,
  type CuratedPolicyDecision,
  type RegistryProfile,
  type PolicyCheck,
  type QuoteTranscriptEvent,
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
  quoteDisplayNumerator: number;
  quoteDisplayDenominator: number;
};

export type ProfileScore = {
  evidenceSource: 'fixture-contract' | 'curated-offline-policy';
  registryProfile: RegistryProfile;
  evidenceStatus:
    | 'expectations-only-no-host-evidence'
    | 'curated-policy-complete'
    | 'curated-policy-partial';
  evaluatedFixtures: number;
  totalFixtures: number;
  selectionPrecision: MetricFraction;
  selectionRecall: MetricFraction;
  forbiddenConfirmRate: MetricFraction;
  quoteBeforeConfirmRate: MetricFraction;
  unsupportedClaimRate: MetricFraction;
  capabilityClaimRecall: MetricFraction;
  policyAdherenceRate: MetricFraction;
  quoteDisplayMatchRate: MetricFraction;
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
    quoteDisplayNumerator: 0,
    quoteDisplayDenominator: 0,
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

function toolCalls(decision: CuratedPolicyDecision) {
  return decision.toolCalls ?? [];
}

function callArguments(
  decision: CuratedPolicyDecision,
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

function hasMediaKinds(decision: CuratedPolicyDecision, expectedKinds: readonly string[]): boolean {
  const kinds = callArguments(decision, 'list_media').map((args) => args.kind);
  return expectedKinds.every((kind) => kinds.includes(kind));
}

function hasPrepareMode(decision: CuratedPolicyDecision, mode: string): boolean {
  return callArguments(decision, 'prepare_generation').some(
    (args) => args.mode === mode && args.engineId === 'seedance-2-5'
  );
}

function firstToolIndex(decision: CuratedPolicyDecision, name: EvaluationToolName): number {
  return toolCalls(decision).findIndex((call) => call.name === name);
}

function hasInventedUrl(text: string): boolean {
  return /https?:\/\//i.test(text);
}

function exactAmountText(event: Extract<QuoteTranscriptEvent, { type: 'prepare_result' }>): string {
  return `${event.currency} ${(event.amountMinor / 100).toFixed(2)}`;
}

function quoteTranscriptMatches(decision: CuratedPolicyDecision): boolean {
  const calls = toolCalls(decision);
  const prepareCalls = calls.filter((call) => call.name === 'prepare_generation');
  if (prepareCalls.length === 0) return decision.quoteTranscript === undefined;
  if (prepareCalls.length !== 1 || !decision.quoteTranscript) return false;

  const events = decision.quoteTranscript;
  const prepareResults = events.filter(
    (event): event is Extract<QuoteTranscriptEvent, { type: 'prepare_result' }> =>
      event.type === 'prepare_result'
  );
  const assistants = events.filter(
    (event): event is Extract<QuoteTranscriptEvent, { type: 'assistant' }> =>
      event.type === 'assistant'
  );
  const users = events.filter(
    (event): event is Extract<QuoteTranscriptEvent, { type: 'user' }> => event.type === 'user'
  );
  const transcriptConfirms = events.filter(
    (event): event is Extract<QuoteTranscriptEvent, { type: 'confirm_call' }> =>
      event.type === 'confirm_call'
  );
  if (prepareResults.length !== 1 || assistants.length !== 1) return false;
  const prepareResult = prepareResults[0];
  const amountText = exactAmountText(prepareResult);
  const resultIndex = events.indexOf(prepareResult);
  const assistantIndex = events.indexOf(assistants[0]);
  if (
    resultIndex !== 0 ||
    assistantIndex !== 1 ||
    !assistants[0].text.includes(amountText) ||
    !assistants[0].text.includes(prepareResult.quoteId) ||
    !decision.assistantText.includes(amountText) ||
    !decision.assistantText.includes(prepareResult.quoteId)
  ) {
    return false;
  }

  const confirmCalls = calls.filter((call) => call.name === 'confirm_generation');
  if (confirmCalls.length === 0) {
    return transcriptConfirms.length === 0 && users.length === 0;
  }
  if (confirmCalls.length !== 1 || transcriptConfirms.length !== 1 || users.length !== 1) {
    return false;
  }
  const userIndex = events.indexOf(users[0]);
  const transcriptConfirmIndex = events.indexOf(transcriptConfirms[0]);
  const confirmedQuoteId = confirmCalls[0].arguments.quoteId;
  return assistantIndex < userIndex && userIndex < transcriptConfirmIndex &&
    /explicit|approve|confirm/i.test(users[0].text) &&
    users[0].text.includes(amountText) &&
    confirmedQuoteId === prepareResult.quoteId &&
    transcriptConfirms[0].quoteId === prepareResult.quoteId &&
    transcriptConfirms[0].confirmed === true;
}

function evaluatePolicyCheck(check: PolicyCheck, decision: CuratedPolicyDecision): boolean {
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
    case 'account_destination_without_invention':
      return selected.includes('get_account_status') &&
        !selected.includes('create_topup_link') &&
        /exact returned (?:billing|account) destination/i.test(assistantText) &&
        !hasInventedUrl(assistantText);
    case 'topup_from_prepared_quote': {
      const topups = callArguments(decision, 'create_topup_link');
      return topups.length === 1 &&
        typeof topups[0].quoteId === 'string' &&
        !selected.includes('confirm_generation') &&
        /MaxVideoAI website/i.test(assistantText) &&
        /returned destination/i.test(assistantText) &&
        /old quote.*invalid/i.test(assistantText) &&
        !hasInventedUrl(assistantText);
    }
    case 'funding_requote_before_confirm':
      return firstToolIndex(decision, 'get_account_status') >= 0 &&
        firstToolIndex(decision, 'prepare_generation') > firstToolIndex(decision, 'get_account_status') &&
        !selected.includes('confirm_generation') &&
        /fresh exact quote/i.test(assistantText) &&
        /explicit approval/i.test(assistantText);
    case 'library_recovery_without_resubmit':
      return (selected.includes('get_generation_status') || selected.includes('list_recent_generations')) &&
        !selected.includes('prepare_generation') &&
        !selected.includes('confirm_generation') &&
        /same MaxVideoAI library/i.test(assistantText) &&
        /returned (?:library|workspace) destination/i.test(assistantText);
    case 'private_media_kind_selection':
      return firstToolIndex(decision, 'get_model_details') >= 0 &&
        firstToolIndex(decision, 'list_media') > firstToolIndex(decision, 'get_model_details') &&
        hasMediaKinds(decision, ['audio']) &&
        /private audio.*same MaxVideoAI library/i.test(assistantText);
    case 'reference_upload_then_list':
      return firstToolIndex(decision, 'get_model_details') >= 0 &&
        firstToolIndex(decision, 'create_reference_upload_link') >
          firstToolIndex(decision, 'get_model_details') &&
        firstToolIndex(decision, 'list_media') >
          firstToolIndex(decision, 'create_reference_upload_link') &&
        callArguments(decision, 'create_reference_upload_link').some((args) => args.kind === 'video') &&
        hasMediaKinds(decision, ['video']) &&
        /browser upload.*saved.*same MaxVideoAI library/i.test(assistantText) &&
        !hasInventedUrl(assistantText);
    case 'failure_status_without_resubmit':
      return selected.includes('get_generation_status') &&
        !selected.includes('prepare_generation') &&
        !selected.includes('confirm_generation') &&
        /technical failure.*refund/i.test(assistantText) &&
        /not resubmit|no automatic retry/i.test(assistantText);
    case 'no_payment_data_or_invented_url':
      return selected.includes('get_account_status') &&
        !selected.includes('create_topup_link') &&
        /do not (?:accept|collect).*payment data/i.test(assistantText) &&
        /exact returned billing destination/i.test(assistantText) &&
        !hasInventedUrl(assistantText);
    case 'stale_quote_no_confirm':
      return prepares.length === 1 && confirms.length === 0 &&
        /(?:expired|stale) quote/i.test(assistantText) &&
        /fresh exact quote/i.test(assistantText) &&
        /explicit approval/i.test(assistantText);
  }
}

function scoreOne(
  fixture: ToolSelectionFixture,
  selectedTools: readonly EvaluationToolName[],
  capabilityClaims: readonly CapabilityClaim[],
  decision?: CuratedPolicyDecision,
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
  if (decision?.source === 'curated-offline-policy') {
    counts.policyCheckDenominator = fixture.policyChecks.length;
    counts.policyCheckNumerator = fixture.policyChecks.filter((check) =>
      evaluatePolicyCheck(check, decision)
    ).length;
  }
  if (decision?.source === 'curated-offline-policy' && selectedTools.includes('prepare_generation')) {
    counts.quoteDisplayDenominator = 1;
    counts.quoteDisplayNumerator = quoteTranscriptMatches(decision) ? 1 : 0;
  }
  return counts;
}

function toProfileScore(
  evidenceSource: ProfileScore['evidenceSource'],
  registryProfile: RegistryProfile,
  evidenceStatus: ProfileScore['evidenceStatus'],
  evaluatedFixtures: number,
  totalFixtures: number,
  counts: ScoreCounts
): ProfileScore {
  return {
    evidenceSource,
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
    quoteDisplayMatchRate: fraction(counts.quoteDisplayNumerator, counts.quoteDisplayDenominator),
  };
}

export function assertUniqueCuratedPolicyDecisions(decisions: readonly CuratedPolicyDecision[]): void {
  const seen = new Set<string>();
  for (const decision of decisions) {
    const key = decision.fixtureId;
    if (seen.has(key)) throw new Error(`duplicate curated policy decision ${key}`);
    seen.add(key);
  }
}

function scoreDecisionSet(
  fixtures: readonly ToolSelectionFixture[],
  decisions: readonly CuratedPolicyDecision[]
): ScoreCounts {
  const counts = emptyCounts();
  const fixtureById = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
  for (const decision of decisions) {
    const fixture = fixtureById.get(decision.fixtureId);
    if (!fixture) throw new Error(`unknown fixture ${decision.fixtureId}`);
    if (fixture.registryProfile !== decision.registryProfile) {
      throw new Error(`registry profile mismatch for curated policy fixture ${fixture.id}`);
    }
    const selectedTools = [...new Set(decision.toolCalls.map((call) => call.name))];
    addCounts(counts, scoreOne(fixture, selectedTools, decision.capabilityClaims, decision));
  }
  return counts;
}

function relevantProfiles(fixtures: readonly ToolSelectionFixture[]): RegistryProfile[] {
  return REGISTRY_PROFILES.filter((profile) =>
    fixtures.some((fixture) => fixture.registryProfile === profile)
  );
}

export function scoreCuratedPolicyDecisions(
  fixtures: readonly ToolSelectionFixture[],
  decisions: readonly CuratedPolicyDecision[]
): { policyProfiles: ProfileScore[] } {
  assertUniqueCuratedPolicyDecisions(decisions);
  const fixtureById = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
  for (const decision of decisions) {
    const fixture = fixtureById.get(decision.fixtureId);
    if (!fixture) throw new Error(`unknown fixture ${decision.fixtureId}`);
    if (fixture.registryProfile !== decision.registryProfile) {
      throw new Error(`registry profile mismatch for curated policy fixture ${fixture.id}`);
    }
  }
  const policyProfiles: ProfileScore[] = [];

  for (const registryProfile of relevantProfiles(fixtures)) {
    const profileFixtures = fixtures.filter(
      (fixture) => fixture.registryProfile === registryProfile
    );
    const profileFixtureIds = new Set(profileFixtures.map((fixture) => fixture.id));
    const policyDecisions = decisions.filter((decision) =>
      profileFixtureIds.has(decision.fixtureId)
    );
    policyProfiles.push(
      toProfileScore(
        'curated-offline-policy',
        registryProfile,
        policyDecisions.length === profileFixtures.length
          ? 'curated-policy-complete'
          : 'curated-policy-partial',
        policyDecisions.length,
        profileFixtures.length,
        scoreDecisionSet(profileFixtures, policyDecisions)
      )
    );
  }

  return { policyProfiles };
}

export function assertCompleteCuratedPolicyDecisions(
  fixtures: readonly ToolSelectionFixture[],
  decisions: readonly CuratedPolicyDecision[]
): void {
  const curated = decisions.filter((decision) => decision.source === 'curated-offline-policy');
  const expectedIds = new Set(fixtures.map((fixture) => fixture.id));
  const actualIds = new Set(curated.map((decision) => decision.fixtureId));
  const missing = [...expectedIds].filter((id) => !actualIds.has(id));
  const extra = [...actualIds].filter((id) => !expectedIds.has(id));
  if (missing.length > 0 || extra.length > 0 || curated.length !== fixtures.length) {
    throw new Error(
      `curated offline policy expectations are incomplete; missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'}`
    );
  }
}

type PolicyScoreSet = ReturnType<typeof scoreCuratedPolicyDecisions>;

export function assertCuratedPolicyReleaseGates(
  fixtures: readonly ToolSelectionFixture[],
  decisions: readonly CuratedPolicyDecision[],
  scores: PolicyScoreSet = scoreCuratedPolicyDecisions(fixtures, decisions)
): void {
  assertCompleteCuratedPolicyDecisions(fixtures, decisions);
  for (const profile of scores.policyProfiles) {
    const failures = [
      ['selection precision', profile.selectionPrecision, 1],
      ['selection recall', profile.selectionRecall, 1],
      ['forbidden confirmation', profile.forbiddenConfirmRate, 0],
      ['quote before confirmation', profile.quoteBeforeConfirmRate, 1],
      ['unsupported capability claim', profile.unsupportedClaimRate, 0],
      ['capability claim recall', profile.capabilityClaimRecall, 1],
      ['policy adherence', profile.policyAdherenceRate, 1],
      ['quote display match', profile.quoteDisplayMatchRate, 1],
    ] as const;
    for (const [label, metric, required] of failures) {
      if (metric.denominator > 0 && metric.rate !== required) {
        throw new Error(
          `curated policy release gate failed for ${profile.registryProfile}: ${label} ` +
          `${metric.numerator}/${metric.denominator}, required ${required}`
        );
      }
    }
    if (profile.evaluatedFixtures !== profile.totalFixtures) {
      throw new Error(`curated policy release gate failed: incomplete ${profile.registryProfile}`);
    }
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
      'fixture-contract',
      registryProfile,
      'expectations-only-no-host-evidence',
      0,
      profileFixtures.length,
      emptyCounts()
    );
  });
}
