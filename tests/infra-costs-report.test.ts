import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchInfraCostsReport } from '../frontend/server/infra-costs.ts';

const GIB = 1024 ** 3;

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function textResponse(value: string) {
  return new Response(value, {
    status: 200,
    headers: { 'content-type': 'application/jsonl' },
  });
}

test('infra costs report combines Neon estimates and Vercel billed charges with month-end projection', async () => {
  const fetchFn = async (input: string | URL) => {
    const url = new URL(String(input));

    if (url.pathname === '/api/v2/consumption_history/v2/projects') {
      return jsonResponse({
        projects: [
          {
            project_id: 'shy-flower-71253790',
            project_name: 'DATAMAXVIDEOAI',
            periods: [
              {
                period_start: '2026-06-01T00:00:00.000Z',
                consumption: [
                  {
                    timeframe_start: '2026-06-01T00:00:00.000Z',
                    metrics: [
                      { metric_name: 'compute_unit_seconds', value: 3600 },
                      { metric_name: 'root_branch_bytes_month', value: GIB },
                      { metric_name: 'child_branch_bytes_month', value: 0 },
                      { metric_name: 'instant_restore_bytes_month', value: 0 },
                      { metric_name: 'snapshot_storage_bytes_month', value: 0 },
                      { metric_name: 'public_network_transfer_bytes', value: 260 * GIB },
                      { metric_name: 'private_network_transfer_bytes', value: 0 },
                      { metric_name: 'extra_branches_month', value: 2 },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });
    }

    if (url.pathname === '/api/v2/projects/shy-flower-71253790/branches') {
      return jsonResponse({
        branches: [
          { id: 'br-main', primary: true, current_state: 'ready', created_at: '2026-01-01T00:00:00.000Z' },
          { id: 'br-preview', primary: false, current_state: 'ready', created_at: '2026-06-01T00:00:00.000Z' },
        ],
      });
    }

    if (url.pathname === '/v1/billing/charges') {
      return textResponse(
        [
          JSON.stringify({
            BilledCost: 50,
            EffectiveCost: 48,
            ChargeCategory: 'Usage',
            ChargePeriodStart: '2026-06-01T00:00:00.000Z',
            ChargePeriodEnd: '2026-06-02T00:00:00.000Z',
            ConsumedQuantity: 100,
            ConsumedUnit: 'GB',
            ServiceName: 'Fast Data Transfer',
            ServiceCategory: 'Networking',
            Tags: { ProjectId: 'prj_123', ProjectName: 'maxvideoai' },
          }),
          JSON.stringify({
            BilledCost: 25,
            EffectiveCost: 25,
            ChargeCategory: 'Usage',
            ChargePeriodStart: '2026-06-02T00:00:00.000Z',
            ChargePeriodEnd: '2026-06-03T00:00:00.000Z',
            ConsumedQuantity: 10,
            ConsumedUnit: 'GB-Hours',
            ServiceName: 'Fluid Compute',
            ServiceCategory: 'Compute',
            Tags: { ProjectId: 'prj_123', ProjectName: 'maxvideoai' },
          }),
        ].join('\n')
      );
    }

    throw new Error(`unexpected fetch ${url.pathname}`);
  };

  const report = await fetchInfraCostsReport({
    now: new Date('2026-06-16T00:00:00.000Z'),
    fetchFn,
    env: {
      NEON_API_KEY: 'neon-token',
      VERCEL_TOKEN: 'vercel-token',
      INFRA_COST_MONTHLY_WARNING_USD: '100',
      INFRA_COST_MONTHLY_CRITICAL_USD: '300',
      NEON_PUBLIC_TRANSFER_INCLUDED_GB: '1000',
      NEON_USAGE_MONTHLY_CRITICAL_USD: '200',
      VERCEL_USAGE_MONTHLY_CRITICAL_USD: '300',
    },
  });

  assert.equal(report.period.projectionFactor, 2);
  assert.equal(report.providers.vercel.money.currentUsd, 75);
  assert.equal(report.providers.vercel.money.projectedMonthUsd, 150);
  assert.equal(report.providers.neon.details?.totals.currentBranchCount, 2);
  assert.equal(report.providers.neon.details?.projectedTotals.publicTransferGb, 520);
  assert.ok(report.providers.neon.money.currentUsd > 3, 'Neon estimate should include branch and usage costs');
  assert.ok(report.providers.neon.money.projectedMonthUsd > report.providers.neon.money.currentUsd);
  assert.equal(report.notificationLevel, 'warning');
  assert.ok(report.alerts.some((alert) => alert.provider === 'total' && alert.kind === 'cost'));
});

test('infra costs report remains readable when provider credentials are missing', async () => {
  const report = await fetchInfraCostsReport({
    now: new Date('2026-06-04T12:00:00.000Z'),
    env: {},
    fetchFn: async () => {
      throw new Error('fetch should not run without credentials');
    },
  });

  assert.equal(report.providers.neon.configured, false);
  assert.equal(report.providers.vercel.configured, false);
  assert.equal(report.money.currentUsd, 0);
  assert.equal(report.notificationLevel, 'ok');
  assert.ok(report.alerts.some((alert) => alert.kind === 'configuration' && alert.provider === 'neon'));
  assert.ok(report.alerts.some((alert) => alert.kind === 'configuration' && alert.provider === 'vercel'));
});
