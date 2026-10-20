import test from 'node:test';
import { qualifyPaidSeedanceEdit } from './helpers/seedance-edit-paid-mcp-postgres-fixture';

test('paid MCP and Studio qualify las Edit acceptance, immutable pricing, refunds and durable Library recovery',
  { timeout: 90_000, concurrency: false }, () => qualifyPaidSeedanceEdit('las'));
