import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createRequire } from 'node:module';
import { pricingCutoverConnection, loadPricingCutoverMigrations,
  pricingCutoverTarget } from '../frontend/scripts/_lib/pricing-cutover-schema';

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
    'neon/migrations/61_customer_tariff_cutover_events.sql',
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
    `${neon}&sslmode=disable`, `${neon}&channel_binding=disable`, `${socket}&host=%2Ftmp%2Fother`,
    neon.replace('neon.tech', 'supabase.co'), socket.replace('%2Ftmp%2Fpricing-test', 'other.example')]) {
    assert.throws(() => pricingCutoverConnection({ DATABASE_URL: url }), /explicit.*direct Neon.*Unix socket/i);
  }
});

test('effective target identity includes port and socket and ignores ambient authentication/target settings', async () => {
  const require = createRequire(import.meta.url);
  const ConnectionParameters = require('pg/lib/connection-parameters');
  const previous = { ...process.env };
  Object.assign(process.env, { PGPORT: '6432', PGPASSWORD: 'ambient-private', PGHOST: 'ambient-host',
    PGDATABASE: 'ambient-db', PGUSER: 'ambient-user', PGSSLMODE: 'no-verify' });
  try {
    const original = pricingCutoverTarget({ DATABASE_URL: 'postgresql://postgres@localhost/postgres?host=%2Ftmp%2Fone' });
    const other = pricingCutoverTarget({ DATABASE_URL: 'postgresql://postgres@localhost/postgres?host=%2Ftmp%2Ftwo' });
    const port = pricingCutoverTarget({ DATABASE_URL: 'postgresql://postgres@localhost:5433/postgres?host=%2Ftmp%2Fone' });
    assert.notEqual(original.databaseIdentity, other.databaseIdentity);
    assert.notEqual(original.databaseIdentity, port.databaseIdentity);
    const actual = new ConnectionParameters(original.config);
    assert.equal(actual.host, '/tmp/one');
    assert.equal(actual.port, 5432);
    assert.equal(actual.database, 'postgres');
    assert.equal(actual.user, 'postgres');
    assert.equal(await actual.password(), '');
    assert.equal(actual.ssl, false);
    const neon = pricingCutoverTarget({ DATABASE_URL: 'postgresql://reader:explicit%21@ep-example.aws.neon.tech/app?sslmode=require' });
    const tls = new ConnectionParameters(neon.config);
    assert.equal(await tls.password(), 'explicit!');
    assert.deepEqual(tls.ssl, { rejectUnauthorized: true });
    assert.notEqual(neon.databaseIdentity, original.databaseIdentity);
  } finally {
    for (const key of ['PGPORT','PGPASSWORD','PGHOST','PGDATABASE','PGUSER','PGSSLMODE']) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  }
});
