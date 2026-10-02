import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { pricingCutoverConnection, loadPricingCutoverMigrations } from '../frontend/scripts/_lib/pricing-cutover-schema';

test('cutover inventory selects exact reviewed migration names and binds their bytes', async () => {
  const migrations = await loadPricingCutoverMigrations(process.cwd());
  assert.deepEqual(migrations.map(row => row.path), [
    'neon/migrations/53_seedance_draft_links.sql',
    'neon/migrations/54_customer_tariff_cells.sql',
    'neon/migrations/55_customer_tariff_versions.sql',
    'neon/migrations/56_direct_payment_quotes.sql',
    'neon/migrations/57_customer_tariff_local_activation_events.sql',
    'neon/migrations/58_customer_tariff_bulk_interval_lock.sql',
    'neon/migrations/59_seedance_draft_final_state.sql',
    'neon/migrations/60_mcp_trial_provider_rasters.sql',
  ]);
  for (const row of migrations) {
    assert.equal(row.sha256, createHash('sha256').update(readFileSync(row.path)).digest('hex'));
    assert.equal(row.transactionRequired, true);
  }
  assert.ok(!migrations.some(row => row.path.includes('playlist')));
});

test('read-only inventory target comes only from its explicit file and cannot override its host', () => {
  const neon = 'postgresql://reader:private@ep-example.eu-central-1.aws.neon.tech/app?sslmode=require&channel_binding=require';
  const socket = 'postgresql://postgres@localhost/postgres?host=%2Ftmp%2Fpricing-test';
  assert.equal(pricingCutoverConnection({ DATABASE_URL_UNPOOLED: neon, DATABASE_URL: 'bad' }), neon);
  assert.equal(pricingCutoverConnection({ DATABASE_URL: socket }), socket);
  for (const url of [undefined, 'bad', neon.replace('ep-example.', 'ep-example-pooler.'),
    `${neon}&host=other.example`, `${neon}&options=-c%20default_transaction_read_only=off`,
    neon.replace('neon.tech', 'supabase.co'), socket.replace('%2Ftmp%2Fpricing-test', 'other.example')]) {
    assert.throws(() => pricingCutoverConnection({ DATABASE_URL: url }), /explicit.*direct Neon.*Unix socket/i);
  }
});
