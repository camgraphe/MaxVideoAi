import {
  RECORDED_HOSTS,
  type CapabilityClaim,
  type EvaluationToolName,
  type RecordedDecision,
  type RecordedHost,
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

export type HostScore = {
  host: RecordedHost | 'fixture-only-baseline' | 'aggregate';
  evidenceStatus:
    | 'synthetic-fixture-only'
    | 'recorded-partial'
    | 'recorded-complete'
    | 'recorded-aggregate'
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

function toHostScore(
  host: HostScore['host'],
  evidenceStatus: HostScore['evidenceStatus'],
  evaluatedFixtures: number,
  totalFixtures: number,
  counts: ScoreCounts
): HostScore {
  return {
    host,
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

export function scoreRecordedDecisions(
  fixtures: readonly ToolSelectionFixture[],
  decisions: readonly RecordedDecision[]
): { hosts: HostScore[]; aggregate: HostScore } {
  assertUniqueRecordedDecisions(decisions);
  const fixtureById = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
  const hosts: HostScore[] = [];
  const aggregateCounts = emptyCounts();

  for (const host of RECORDED_HOSTS) {
    const hostDecisions = decisions.filter((decision) => decision.host === host);
    if (hostDecisions.length === 0) continue;
    const hostCounts = emptyCounts();
    for (const decision of hostDecisions) {
      const fixture = fixtureById.get(decision.fixtureId);
      if (!fixture) throw new Error(`unknown fixture ${decision.fixtureId}`);
      if (fixture.registryProfile !== decision.registryProfile) {
        throw new Error(`registry profile mismatch for ${host}:${fixture.id}`);
      }
      addCounts(hostCounts, scoreOne(fixture, decision.selectedTools, decision.capabilityClaims));
    }
    addCounts(aggregateCounts, hostCounts);
    hosts.push(
      toHostScore(
        host,
        hostDecisions.length === fixtures.length ? 'recorded-complete' : 'recorded-partial',
        hostDecisions.length,
        fixtures.length,
        hostCounts
      )
    );
  }

  return {
    hosts,
    aggregate: toHostScore(
      'aggregate',
      decisions.length === 0 ? 'no-recorded-host-evidence' : 'recorded-aggregate',
      decisions.length,
      fixtures.length * RECORDED_HOSTS.length,
      aggregateCounts
    ),
  };
}

export function buildFixtureBaseline(fixtures: readonly ToolSelectionFixture[]): HostScore {
  const counts = emptyCounts();
  for (const fixture of fixtures) {
    addCounts(counts, scoreOne(fixture, fixture.expectedTools, fixture.expectedCapabilityClaims));
  }
  return toHostScore(
    'fixture-only-baseline',
    'synthetic-fixture-only',
    fixtures.length,
    fixtures.length,
    counts
  );
}
