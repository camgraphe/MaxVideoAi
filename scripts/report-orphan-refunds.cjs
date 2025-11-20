#!/usr/bin/env node

/**
 * Utility to list refunds inserted by the cron reconcile job so they can be reviewed or reverted.
 *
 * Usage:
 *   node scripts/report-orphan-refunds.cjs [--since=2025-11-01] [--emit-delete]
 *
 * Set DATABASE_URL in your environment before running.
 */

require('dotenv/config');
const { Client } = require('pg');

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error('DATABASE_URL is required to inspect refunds.');
    process.exit(1);
  }

  const sinceArg = process.argv.find((arg) => arg.startsWith('--since='));
  let sinceIso = null;
  if (sinceArg) {
    const value = sinceArg.split('=')[1];
    if (value) {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        console.error(`Invalid --since value "${value}". Use YYYY-MM-DD or ISO datetime.`);
        process.exit(1);
      }
      sinceIso = parsed.toISOString();
    }
  }
  const emitDelete = process.argv.includes('--emit-delete');

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  const params = [];
  let sinceClause = '';
  if (sinceIso) {
    params.push(sinceIso);
    sinceClause = `AND created_at >= $${params.length}`;
  }

  const refundRows = await client.query(
    `
      SELECT id, user_id, job_id, amount_cents, currency, created_at
      FROM app_receipts
      WHERE type = 'refund'
        AND metadata ->> 'source' = 'cron-reconcile'
        ${sinceClause}
      ORDER BY created_at ASC
    `,
    params
  );

  if (!refundRows.rowCount) {
    console.log('No cron-reconcile refunds matched the filters.');
    await client.end();
    return;
  }

  const totals = await client.query(
    `
      SELECT user_id,
             MAX(currency) AS currency,
             COUNT(*)::integer AS refund_count,
             SUM(amount_cents)::bigint AS total_cents,
             MIN(created_at) AS first_refund,
             MAX(created_at) AS last_refund
      FROM app_receipts
      WHERE type = 'refund'
        AND metadata ->> 'source' = 'cron-reconcile'
        ${sinceClause}
      GROUP BY user_id
      ORDER BY total_cents DESC
    `,
    params
  );

  console.log(`Found ${refundRows.rowCount} refund rows inserted by cron-reconcile.`);
  console.log('Top impacted users:');
  totals.rows.slice(0, 15).forEach((row) => {
    const amount = (Number(row.total_cents) / 100).toFixed(2);
    console.log(
      `- ${row.user_id}: ${row.refund_count} refunds, $${amount} ${row.currency || 'USD'} (first ${row.first_refund}, last ${row.last_refund})`
    );
  });

  console.log('\nFull refund list:');
  refundRows.rows.forEach((row) => {
    const amount = (Number(row.amount_cents) / 100).toFixed(2);
    console.log(
      `#${row.id} | user=${row.user_id} | job=${row.job_id} | amount=$${amount} ${row.currency || 'USD'} | ${row.created_at}`
    );
  });

  if (emitDelete) {
    const idList = refundRows.rows.map((row) => row.id).join(', ');
    console.log('\nDELETE statement (not executed):');
    console.log(`DELETE FROM app_receipts WHERE id IN (${idList});`);
  }

  await client.end();
}

main().catch((error) => {
  console.error('Failed to inspect cron refunds:', error);
  process.exit(1);
});
