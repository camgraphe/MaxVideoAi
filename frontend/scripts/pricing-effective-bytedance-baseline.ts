import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PricingPolicyRule } from '@maxvideoai/pricing';
import { Pool } from 'pg';
import { parse } from 'dotenv';

import { getFalEngineById } from '@/config/falEngines';
import { loadPricingPolicyOverridesWithExecutor } from '@/lib/pricing-rule-store';
import { computeCanonicalBillingSnapshot } from '@/server/pricing/quote-billing';
import type { PricingPolicyOverrideLoadResult } from '@/lib/pricing-rule-store';
import type { Mode } from '@/types/engines';

export type ByteDanceBaselineScenario = {
  scenarioId: string;
  engineId: string;
  mode: string;
  resolution: string;
  durationSec: number;
  audio: boolean;
  hasVideoInput: boolean;
  customerTotalCents: number;
  quoteVendorSubtotalCents: number;
  pricingSource: 'versioned';
  ruleId: string;
  compatibilityProfile: string;
};

export type ByteDanceEffectiveQuote = Pick<ByteDanceBaselineScenario,
  'scenarioId' | 'engineId' | 'mode' | 'resolution' | 'durationSec' | 'audio' | 'hasVideoInput'
> & {
  customerTotalCents: number;
  legacyQuoteBasisCents: number;
  marginCents: number;
  policySource: 'database' | 'versioned';
  ruleId: string;
  compatibilityProfile: string;
};

type SnapshotPricingPolicy = {
  source?: unknown;
  sourceRuleId?: unknown;
  compatibilityProfile?: unknown;
};

/** The fixture covers representative and edge scenarios, not all sellable ByteDance options. */
export async function quoteByteDanceBaselineRows(
  rows: readonly ByteDanceBaselineScenario[],
  databaseRules: readonly PricingPolicyRule[],
): Promise<ByteDanceEffectiveQuote[]> {
  const overrides: PricingPolicyOverrideLoadResult = {
    status: 'loaded', rules: [...databaseRules], routingRules: [],
  };
  const quotes: ByteDanceEffectiveQuote[] = [];
  for (const row of rows) {
    const entry = getFalEngineById(row.engineId);
    if (!entry || !row.scenarioId.trim()) throw new Error(`Unknown ByteDance baseline scenario ${row.scenarioId}`);
    const snapshot = await computeCanonicalBillingSnapshot({
      engine: entry.engine,
      mode: row.mode as Mode,
      resolution: row.resolution,
      durationSec: row.durationSec,
      hasVideoInput: row.hasVideoInput,
      addons: { audio: row.audio },
    }, { pricingPolicy: { loadOverrides: async () => overrides } });
    const provenance = snapshot.meta?.pricingPolicy as SnapshotPricingPolicy | undefined;
    if ((provenance?.source !== 'database' && provenance?.source !== 'versioned') ||
        typeof provenance.sourceRuleId !== 'string' || typeof provenance.compatibilityProfile !== 'string' ||
        !Number.isSafeInteger(snapshot.totalCents) ||
        typeof snapshot.vendorShareCents !== 'number' || !Number.isSafeInteger(snapshot.vendorShareCents)) {
      throw new Error(`Incomplete canonical quote for ${row.scenarioId}`);
    }
    quotes.push({
      scenarioId: row.scenarioId,
      engineId: row.engineId,
      mode: row.mode,
      resolution: row.resolution,
      durationSec: row.durationSec,
      audio: row.audio,
      hasVideoInput: row.hasVideoInput,
      customerTotalCents: snapshot.totalCents,
      legacyQuoteBasisCents: snapshot.vendorShareCents,
      marginCents: snapshot.margin.amountCents,
      policySource: provenance.source,
      ruleId: provenance.sourceRuleId,
      compatibilityProfile: provenance.compatibilityProfile,
    });
  }
  return quotes;
}

/** Proves this collector still reproduces the independently frozen 202-row versioned reference. */
export function assertVersionedByteDanceParity(
  rows: readonly ByteDanceBaselineScenario[],
  quotes: readonly ByteDanceEffectiveQuote[],
): void {
  const expectedIds = new Set<string>();
  for (const row of rows) {
    if (!row.scenarioId.trim() || expectedIds.has(row.scenarioId)) {
      throw new Error(`Frozen versioned baseline duplicate scenario: ${row.scenarioId}`);
    }
    expectedIds.add(row.scenarioId);
  }
  const quotesById = new Map<string, ByteDanceEffectiveQuote>();
  for (const quote of quotes) {
    if (quotesById.has(quote.scenarioId) || !expectedIds.has(quote.scenarioId)) {
      throw new Error(`Frozen versioned baseline unexpected quote: ${quote.scenarioId}`);
    }
    quotesById.set(quote.scenarioId, quote);
  }
  for (const row of rows) {
    const quote = quotesById.get(row.scenarioId);
    if (!quote) throw new Error(`Frozen versioned baseline missing quote: ${row.scenarioId}`);
    if (quote.customerTotalCents !== row.customerTotalCents ||
        quote.legacyQuoteBasisCents !== row.quoteVendorSubtotalCents ||
        quote.policySource !== row.pricingSource || quote.ruleId !== row.ruleId ||
        quote.compatibilityProfile !== row.compatibilityProfile) {
      throw new Error(`Frozen versioned baseline drift: ${row.scenarioId}`);
    }
  }
}

async function loadReadOnlyEffectiveRules(databaseUrl: string): Promise<{
  capturedAt: string;
  rules: PricingPolicyRule[];
}> {
  const pool = new Pool({ connectionString: databaseUrl });
  let client: Awaited<ReturnType<Pool['connect']>> | null = null;
  try {
    const connected = await pool.connect();
    client = connected;
    await connected.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const status = await connected.query<{ read_only: string; captured_at: Date }>(
      "SELECT current_setting('transaction_read_only') AS read_only, transaction_timestamp() AS captured_at"
    );
    if (status.rows[0]?.read_only !== 'on') throw new Error('Pricing baseline transaction is not read-only');
    const loaded = await loadPricingPolicyOverridesWithExecutor({
      async query<TRecord>(sql: string, params?: ReadonlyArray<unknown>) {
        const result = await connected.query<TRecord>(sql, params);
        return result.rows;
      },
    });
    if (loaded.status !== 'loaded') throw new Error('Effective pricing rules are unavailable');
    return {
      capturedAt: status.rows[0]!.captured_at.toISOString(),
      rules: loaded.rules,
    };
  } finally {
    if (client) {
      await client.query('ROLLBACK').catch(() => undefined);
      client.release();
    }
    await pool.end();
  }
}

async function main(): Promise<void> {
  const outputPath = process.env.PRICING_BASELINE_OUTPUT?.trim();
  if (!outputPath) throw new Error('Set PRICING_BASELINE_OUTPUT to a new report path');
  const envFile = process.env.PRICING_BASELINE_ENV_FILE?.trim();
  const fileEnv = envFile ? parse(await readFile(envFile)) : {};
  const databaseUrl = process.env.DATABASE_URL?.trim() || fileEnv.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error('DATABASE_URL is required for an effective baseline');
  const fixturePath = new URL('../../tests/fixtures/bytedance-versioned-price-baseline-2026-09-28.json', import.meta.url);
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8')) as { rows: ByteDanceBaselineScenario[] };
  const versionedQuotes = await quoteByteDanceBaselineRows(fixture.rows, []);
  assertVersionedByteDanceParity(fixture.rows, versionedQuotes);
  const effective = await loadReadOnlyEffectiveRules(databaseUrl);
  const effectiveQuotes = await quoteByteDanceBaselineRows(fixture.rows, effective.rules);
  const report = {
    capturedAt: effective.capturedAt,
    source: 'configured_database_read_only',
    environmentIdentity: 'unverified',
    coverage: '202 representative and edge scenarios; not all sellable ByteDance options',
    frozenFixture: 'bytedance-versioned-price-baseline-2026-09-28.json',
    databaseRuleCount: effective.rules.length,
    databaseRulesSha256: createHash('sha256').update(JSON.stringify(
      [...effective.rules].sort((left, right) => left.id.localeCompare(right.id))
    )).digest('hex'),
    changedFromFrozenCount: effectiveQuotes.filter((quote, index) =>
      quote.customerTotalCents !== fixture.rows[index]!.customerTotalCents).length,
    rows: effectiveQuotes.map((quote, index) => ({
      ...quote,
      frozenVersionedCustomerCents: fixture.rows[index]!.customerTotalCents,
    })),
  };
  await writeFile(resolve(outputPath), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  console.log(`[pricing-effective-bytedance-baseline] read-only ${report.rows.length} rows; ${report.changedFromFrozenCount} differ from the versioned fixture; environment identity unverified`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main().catch((error: unknown) => {
    console.error('[pricing-effective-bytedance-baseline] failed:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
