import {
  RECORDED_HOSTS,
  REGISTRY_PROFILES,
  type CapabilityClaim,
  type EvaluationToolName,
  type RecordedDecision,
  type RecordedHost,
  type RegistryProfile,
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
};

export type ProfileScore = {
  host: RecordedHost | 'fixture-only-baseline' | 'aggregate';
  registryProfile: RegistryProfile;
  evidenceStatus:
    | 'synthetic-fixture-only'
    | 'recorded-partial'
    | 'recorded-complete'
    | 'recorded-aggregate-partial'
    | 'recorded-aggregate-complete'
    | 'no-recorded-host-evidence';
  evaluatedFixtures: number;
  totalFixtures: number;
  selectionPrecision: MetricFraction;
  selectionRecall: MetricFraction;
  forbiddenConfirmRate: MetricFraction;
  quoteBeforeConfirmRate: MetricFraction;
  unsupportedClaimRate: MetricFraction;
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

function scoreOne(
  fixture: ToolSelectionFixture,
  selectedTools: readonly EvaluationToolName[],
  capabilityClaims: readonly CapabilityClaim[]
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
  };
}

export function assertUniqueRecordedDecisions(decisions: readonly RecordedDecision[]): void {
  const seen = new Set<string>();
  for (const decision of decisions) {
    const key = `${decision.host}:${decision.fixtureId}`;
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
      throw new Error(`registry profile mismatch for ${decision.host}:${fixture.id}`);
    }
    addCounts(counts, scoreOne(fixture, decision.selectedTools, decision.capabilityClaims));
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
): { hostProfiles: ProfileScore[]; aggregateProfiles: ProfileScore[] } {
  assertUniqueRecordedDecisions(decisions);
  const fixtureById = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
  for (const decision of decisions) {
    const fixture = fixtureById.get(decision.fixtureId);
    if (!fixture) throw new Error(`unknown fixture ${decision.fixtureId}`);
    if (fixture.registryProfile !== decision.registryProfile) {
      throw new Error(`registry profile mismatch for ${decision.host}:${fixture.id}`);
    }
  }
  const hostProfiles: ProfileScore[] = [];
  const aggregateProfiles: ProfileScore[] = [];

  for (const registryProfile of relevantProfiles(fixtures)) {
    const profileFixtures = fixtures.filter(
      (fixture) => fixture.registryProfile === registryProfile
    );
    const profileFixtureIds = new Set(profileFixtures.map((fixture) => fixture.id));
    const profileDecisions = decisions.filter((decision) =>
      profileFixtureIds.has(decision.fixtureId)
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
  }

  return { hostProfiles, aggregateProfiles };
}

export function buildFixtureBaseline(
  fixtures: readonly ToolSelectionFixture[]
): ProfileScore[] {
  return relevantProfiles(fixtures).map((registryProfile) => {
    const profileFixtures = fixtures.filter(
      (fixture) => fixture.registryProfile === registryProfile
    );
    const counts = emptyCounts();
    for (const fixture of profileFixtures) {
      addCounts(counts, scoreOne(fixture, fixture.expectedTools, fixture.expectedCapabilityClaims));
    }
    return toProfileScore(
      'fixture-only-baseline',
      registryProfile,
      'synthetic-fixture-only',
      profileFixtures.length,
      profileFixtures.length,
      counts
    );
  });
}
