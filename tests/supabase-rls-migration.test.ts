import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

const legacyMigrationPath = new URL(
  '../docs/legacy/supabase-public-db-migrations/20260430000100_harden_public_rls.sql',
  import.meta.url,
);
const activeSupabaseMigrationsPath = new URL('../supabase/migrations/', import.meta.url);

const exposedTables = [
  'presets',
  'job_assets',
  'job_events',
  'usage_snapshots',
  'users',
  'jobs',
  'organization_invites',
  'organization_members',
  'organizations',
  'organization_credit_ledger',
];

const privateTables = exposedTables.filter((table) => table !== 'presets');

test('legacy Supabase RLS migration enables and forces RLS on every Advisor-exposed table', () => {
  const sql = readFileSync(legacyMigrationPath, 'utf8').toLowerCase();

  for (const table of exposedTables) {
    assert.match(sql, new RegExp(`alter table if exists public\\.${table}\\s+enable row level security`));
    assert.match(sql, new RegExp(`alter table if exists public\\.${table}\\s+force row level security`));
  }
});

test('legacy Supabase RLS migration keeps anon access limited to public presets', () => {
  const sql = readFileSync(legacyMigrationPath, 'utf8').toLowerCase();

  assert.match(sql, /create policy "[^"]*presets[^"]*"/);
  assert.match(sql, /on public\.presets[\s\S]*for select[\s\S]*to anon, authenticated/);

  for (const table of privateTables) {
    const anonPolicy = new RegExp(`create policy "[^"]*"\\s+on public\\.${table}[\\s\\S]*?to anon`);
    assert.doesNotMatch(sql, anonPolicy, `${table} must not expose anon policies`);
  }
});

test('legacy Supabase RLS migration uses auth.uid ownership or organization membership for private data', () => {
  const sql = readFileSync(legacyMigrationPath, 'utf8').toLowerCase();

  assert.match(sql, /create schema if not exists private/);
  assert.doesNotMatch(sql, /function public\.current_user_is_org_/);
  assert.match(sql, /auth\.uid\(\) = id/);
  assert.match(sql, /auth\.uid\(\) = user_id/);
  assert.match(sql, /exists\s*\([\s\S]*from public\.organization_members/);
  assert.match(sql, /private\.current_user_is_org_member\(public\.organizations\.id\)/);
  assert.match(sql, /private\.current_user_is_org_member\(public\.jobs\.organization_id\)/);
  assert.match(sql, /private\.current_user_is_org_admin\(public\.organization_invites\.organization_id\)/);
  assert.match(sql, /private\.current_user_is_org_member\(public\.organization_credit_ledger\.organization_id\)/);
});

test('active Supabase migrations directory contains no application SQL migrations', () => {
  const sqlFiles = readdirSync(activeSupabaseMigrationsPath).filter((file) => file.endsWith('.sql'));

  assert.deepEqual(sqlFiles, []);
});
