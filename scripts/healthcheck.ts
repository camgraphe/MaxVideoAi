#!/usr/bin/env ts-node

import process from 'node:process';

import Stripe from 'stripe';
import { Pool } from 'pg';

const skipFlag = (process.env.SKIP_HEALTHCHECK ?? '').trim().toLowerCase();
if (skipFlag && skipFlag !== '0' && skipFlag !== 'false') {
  console.log('Skipping healthcheck because SKIP_HEALTHCHECK is set.');
  process.exit(0);
}

interface CheckResult {
  name: string;
  status: 'ok' | 'warn' | 'error' | 'skip';
  message: string;
  details?: Record<string, unknown> | undefined;
}

type EndpointFailureSeverity = 'warn' | 'error';

interface EndpointCheck {
  name: string;
  path: string;
  method?: 'GET' | 'POST' | 'HEAD' | 'OPTIONS';
  body?: Record<string, unknown> | string;
  headers?: Record<string, string>;
  expectStatus: number | number[];
  failureSeverity?: EndpointFailureSeverity;
  timeoutMs?: number;
}

function formatStatus(status: CheckResult['status']): string {
  switch (status) {
    case 'ok':
      return '✅';
    case 'warn':
      return '⚠️';
    case 'skip':
      return '➖';
    default:
      return '❌';
  }
}

function logResult(result: CheckResult) {
  const icon = formatStatus(result.status);
  const suffix = result.details ? `\n    ${JSON.stringify(result.details, null, 2).replace(/\n/g, '\n    ')}` : '';
  console.log(`${icon} ${result.name}: ${result.message}${suffix}`);
}

function hasValue(key: string): boolean {
  const value = process.env[key];
  return typeof value === 'string' && value.trim().length > 0;
}

function checkEnvGroup(name: string, keys: string[], required: boolean): CheckResult {
  const missing = keys.filter((key) => !hasValue(key));
  if (missing.length === 0) {
    return { name, status: 'ok', message: 'All keys present' };
  }
  if (!required) {
    return { name, status: 'warn', message: 'Optional keys missing', details: { missing } };
  }
  return { name, status: 'error', message: 'Required keys missing', details: { missing } };
}

function checkAtLeastOne(name: string, keys: string[], required: boolean): CheckResult {
  const present = keys.filter((key) => hasValue(key));
  if (present.length > 0) {
    return { name, status: 'ok', message: `Available (${present.join(', ')})` };
  }
  if (!required) {
    return { name, status: 'warn', message: 'No keys provided', details: { expected: keys } };
  }
  return { name, status: 'error', message: 'No keys provided', details: { expected: keys } };
}

function checkEnvWhitespace(key: string): CheckResult | null {
  const raw = process.env[key];
  if (typeof raw !== 'string') return null;
  if (raw.trim() === raw) return null;

  return {
    name: `${key} whitespace`,
    status: 'warn',
    message: 'Value contains leading or trailing whitespace',
    details: { original: raw, trimmed: raw.trim() },
  };
}

function checkEnvPattern(
  key: string,
  pattern: RegExp,
  guidance: string,
  severity: EndpointFailureSeverity = 'warn'
): CheckResult | null {
  const raw = process.env[key];
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (pattern.test(trimmed)) return null;
  return {
    name: `${key} format`,
    status: severity,
    message: guidance,
    details: { value: trimmed },
  };
}

function checkEnvEnumeration(key: string, allowed: readonly string[]): CheckResult | null {
  const raw = process.env[key];
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = trimmed.toUpperCase();
  const allowedNormalized = allowed.map((value) => value.toUpperCase());
  if (allowedNormalized.includes(normalized)) return null;
  return {
    name: `${key} value`,
    status: 'warn',
    message: `Unexpected value "${trimmed}". Expected one of: ${allowed.join(', ')}`,
  };
}

function toArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

function resolveBaseUrl(): { base: string | null; source?: string } {
  const candidates: Array<{ value: string | undefined; source: string }> = [
    { value: process.env.HEALTHCHECK_BASE_URL, source: 'HEALTHCHECK_BASE_URL' },
    { value: process.env.NEXT_PUBLIC_SITE_URL, source: 'NEXT_PUBLIC_SITE_URL' },
    { value: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined, source: 'VERCEL_URL' },
    { value: process.env.APP_BASE_URL, source: 'APP_BASE_URL' },
  ];

  for (const candidate of candidates) {
    const trimmed = candidate.value?.trim();
    if (trimmed && /^https?:\/\//i.test(trimmed)) {
      return { base: trimmed.replace(/\/$/, ''), source: candidate.source };
    }
  }

  return { base: null };
}

async function probeEndpoint(baseUrl: string, check: EndpointCheck): Promise<CheckResult> {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  const relativePath = check.path.startsWith('/') ? check.path : `/${check.path}`;
  const url = `${normalizedBase}${relativePath}`;
  const headers: Record<string, string> = { ...(check.headers ?? {}) };
  const method = check.method ?? (check.body ? 'POST' : 'GET');
  const timeoutMs = check.timeoutMs ?? 10000;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let body: string | undefined;
    if (typeof check.body === 'string') {
      body = check.body;
    } else if (check.body !== undefined) {
      body = JSON.stringify(check.body);
      if (!headers['content-type']) {
        headers['content-type'] = 'application/json';
      }
    }

    const response = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });
    const text = await response.text();
    const snippet = text ? text.slice(0, 4000) : '';
    const expected = toArray(check.expectStatus);
    const statusLabel = `${response.status} ${response.statusText || ''}`.trim();

    if (expected.includes(response.status)) {
      return {
        name: check.name,
        status: 'ok',
        message: statusLabel,
      };
    }

    const severity = check.failureSeverity ?? 'error';
    return {
      name: check.name,
      status: severity,
      message: `${statusLabel} (expected ${expected.join(', ')})`,
      details: snippet ? { body: snippet } : undefined,
    };
  } catch (error) {
    const severity = check.failureSeverity ?? 'error';
    return {
      name: check.name,
      status: severity,
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function probeEndpoints(baseUrl: string, endpoints: EndpointCheck[]): Promise<CheckResult[]> {
  return Promise.all(endpoints.map((endpoint) => probeEndpoint(baseUrl, endpoint)));
}

async function checkDatabase(): Promise<CheckResult> {
  if (!hasValue('DATABASE_URL')) {
    return {
      name: 'Database connection',
      status: 'skip',
      message: 'DATABASE_URL not set – skipping connection test',
    };
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const client = await pool.connect();
    try {
      const result = await client.query<{ ok: number }>('SELECT 1 as ok');
      if (result.rows?.[0]?.ok === 1) {
        return { name: 'Database connection', status: 'ok', message: 'Connected successfully' };
      }
      return {
        name: 'Database connection',
        status: 'warn',
        message: 'Query succeeded but unexpected payload',
        details: { rows: result.rows },
      };
    } finally {
      client.release();
    }
  } catch (error) {
    return {
      name: 'Database connection',
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await pool.end().catch(() => undefined);
  }
}

async function checkStripe(): Promise<CheckResult> {
  if (!hasValue('STRIPE_SECRET_KEY')) {
    return {
      name: 'Stripe API',
      status: 'skip',
      message: 'STRIPE_SECRET_KEY not set – skipping API probe',
    };
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
      apiVersion: '2023-10-16',
      maxNetworkRetries: 1,
      timeout: 10000,
    });
    const response = await stripe.prices.list({ limit: 1 });
    return {
      name: 'Stripe API',
      status: 'ok',
      message: 'Reachable',
      details: { pricesFound: response.data.length },
    };
  } catch (error) {
    return {
      name: 'Stripe API',
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function checkBatchPayoutMode(): CheckResult {
  const thresholdRaw = process.env.BATCH_TRANSFER_THRESHOLD_CENTS;
  const cronSecretSet = hasValue('CRON_SECRET');
  if (!thresholdRaw) {
    return {
      name: 'Stripe batch payouts',
      status: 'warn',
      message: 'BATCH_TRANSFER_THRESHOLD_CENTS not set – batched transfers disabled',
    };
  }

  const threshold = Number(thresholdRaw);
  if (!Number.isFinite(threshold) || threshold <= 0) {
    return {
      name: 'Stripe batch payouts',
      status: 'warn',
      message: 'Invalid BATCH_TRANSFER_THRESHOLD_CENTS value',
      details: { value: thresholdRaw },
    };
  }

  const currency = (process.env.BATCH_TRANSFER_CURRENCY || 'usd').toUpperCase();
  const cron = process.env.BATCH_TRANSFER_CRON || '0 3 * * *';
  const message = `Batch mode active, threshold = ${(threshold / 100).toFixed(2)} ${currency}`;

  return {
    name: 'Stripe batch payouts',
    status: cronSecretSet ? 'ok' : 'warn',
    message,
    details: {
      cron,
      cronSecret: cronSecretSet ? 'set' : 'missing',
    },
  };
}

async function checkFalProxy(): Promise<CheckResult> {
  const present = hasValue('FAL_KEY') || hasValue('FAL_API_KEY');
  if (!present) {
    return {
      name: 'FAL credentials',
      status: 'warn',
      message: 'Neither FAL_KEY nor FAL_API_KEY configured',
    };
  }
  return {
    name: 'FAL credentials',
    status: 'ok',
    message: 'Key detected',
    details: { keys: ['FAL_KEY', 'FAL_API_KEY'].filter((key) => hasValue(key)) },
  };
}

async function checkHealthEndpoints(baseUrl: string): Promise<CheckResult[]> {
  const healthEndpoints: EndpointCheck[] = [
    {
      name: 'Health /api/health/env',
      path: '/api/health/env',
      method: 'GET',
      expectStatus: [200],
    },
    {
      name: 'Health /api/health/db',
      path: '/api/health/db',
      method: 'GET',
      expectStatus: [200, 503],
      failureSeverity: 'warn',
    },
    {
      name: 'Health /api/health/stripe',
      path: '/api/health/stripe',
      method: 'GET',
      expectStatus: [200, 503],
      failureSeverity: 'warn',
    },
  ];

  return probeEndpoints(baseUrl, healthEndpoints);
}

async function checkCriticalApiEndpoints(baseUrl: string): Promise<CheckResult[]> {
  const endpoints: EndpointCheck[] = [
    {
      name: 'POST /api/generate guardrail',
      path: '/api/generate',
      method: 'POST',
      body: {
        engineId: '__healthcheck__invalid__',
        prompt: 'integration healthcheck',
        durationSec: 2,
      },
      expectStatus: [400],
    },
    {
      name: 'POST /api/audio persistence',
      path: '/api/audio',
      method: 'POST',
      body: { jobId: '__healthcheck__' },
      expectStatus: [200],
      failureSeverity: 'warn',
    },
    {
      name: 'POST /api/upscale persistence',
      path: '/api/upscale',
      method: 'POST',
      body: { jobId: '__healthcheck__' },
      expectStatus: [200],
      failureSeverity: 'warn',
    },
    {
      name: 'GET /api/wallet authorization',
      path: '/api/wallet',
      method: 'GET',
      expectStatus: [401],
    },
    {
      name: 'POST /api/wallet authorization',
      path: '/api/wallet',
      method: 'POST',
      body: { amountCents: 100 },
      expectStatus: [401],
    },
    {
      name: 'POST /api/stripe/webhook readiness',
      path: '/api/stripe/webhook',
      method: 'POST',
      body: '{}',
      expectStatus: [400, 501],
      failureSeverity: 'warn',
    },
  ];

  return probeEndpoints(baseUrl, endpoints);
}

async function main() {
  const results: CheckResult[] = [];

  results.push(
    checkEnvGroup('Supabase client keys', ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'], true)
  );
  results.push(checkEnvGroup('Supabase service role (optional)', ['SUPABASE_SERVICE_ROLE_KEY'], false));
  results.push(checkEnvGroup('Database URL', ['DATABASE_URL'], false));
  results.push(checkEnvGroup('Stripe server keys', ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'], true));
  results.push(checkEnvGroup('Stripe pricing IDs (optional)', ['STRIPE_PRICE_PLUS', 'STRIPE_PRICE_PRO'], false));
  results.push(checkEnvGroup('Stripe publishable key', ['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'], true));
  results.push(checkBatchPayoutMode());
  results.push(checkAtLeastOne('FAL API keys', ['FAL_KEY', 'FAL_API_KEY'], true));

  const hygieneChecks: CheckResult[] = [];
  const whitespaceKeys = [
    'DATABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'FAL_KEY',
    'FAL_API_KEY',
    'NEXT_PUBLIC_SITE_URL',
    'HEALTHCHECK_BASE_URL',
  ];

  for (const key of whitespaceKeys) {
    const check = checkEnvWhitespace(key);
    if (check) hygieneChecks.push(check);
  }

  const patternChecks: Array<{ key: string; pattern: RegExp; guidance: string; severity?: EndpointFailureSeverity }> = [
    {
      key: 'DATABASE_URL',
      pattern: /^postgres(ql)?:\/\//i,
      guidance: 'DATABASE_URL should be a postgres:// or postgresql:// URI',
      severity: 'warn',
    },
    {
      key: 'NEXT_PUBLIC_SUPABASE_URL',
      pattern: /^https?:\/\//i,
      guidance: 'Supabase URL should be an absolute https:// URL',
      severity: 'warn',
    },
    {
      key: 'STRIPE_SECRET_KEY',
      pattern: /^sk_(live|test)_/i,
      guidance: 'Stripe secret keys begin with sk_test_ or sk_live_',
      severity: 'error',
    },
    {
      key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
      pattern: /^pk_(live|test)_/i,
      guidance: 'Stripe publishable keys begin with pk_test_ or pk_live_',
      severity: 'warn',
    },
    {
      key: 'STRIPE_WEBHOOK_SECRET',
      pattern: /^whsec_[A-Za-z0-9]+$/i,
      guidance: 'Stripe webhook signing secrets should resemble whsec_xxx',
      severity: 'warn',
    },
    {
      key: 'NEXT_PUBLIC_SITE_URL',
      pattern: /^https?:\/\//i,
      guidance: 'NEXT_PUBLIC_SITE_URL should be an absolute http(s):// URL',
      severity: 'warn',
    },
    {
      key: 'HEALTHCHECK_BASE_URL',
      pattern: /^https?:\/\//i,
      guidance: 'HEALTHCHECK_BASE_URL should be an absolute http(s):// URL',
      severity: 'warn',
    },
  ];

  for (const { key, pattern, guidance, severity } of patternChecks) {
    const check = checkEnvPattern(key, pattern, guidance, severity);
    if (check) hygieneChecks.push(check);
  }

  const enumChecks: Array<{ key: string; allowed: readonly string[] }> = [
    { key: 'RESULT_PROVIDER', allowed: ['TEST', 'FAL', 'HYBRID'] },
    { key: 'NEXT_PUBLIC_RESULT_PROVIDER', allowed: ['test', 'fal', 'hybrid'] },
  ];
  for (const { key, allowed } of enumChecks) {
    const check = checkEnvEnumeration(key, allowed);
    if (check) hygieneChecks.push(check);
  }

  results.push(...hygieneChecks);

  const asyncChecks = await Promise.all([checkDatabase(), checkStripe(), checkFalProxy()]);
  results.push(...asyncChecks);

  const { base: baseUrl, source } = resolveBaseUrl();
  if (!baseUrl) {
    results.push({
      name: 'Endpoint probes',
      status: 'skip',
      message: 'No absolute base URL configured (set HEALTHCHECK_BASE_URL or NEXT_PUBLIC_SITE_URL)',
    });
  } else {
    results.push({
      name: 'Endpoint target',
      status: 'ok',
      message: `Using ${baseUrl}`,
      details: source ? { source } : undefined,
    });
    const [healthResults, criticalResults] = await Promise.all([
      checkHealthEndpoints(baseUrl),
      checkCriticalApiEndpoints(baseUrl),
    ]);
    results.push(...healthResults);
    results.push(...criticalResults);
  }

  let exitCode = 0;
  for (const result of results) {
    logResult(result);
    if (result.status === 'error') {
      exitCode = 1;
    }
  }

  process.exitCode = exitCode;
}

main().catch((error) => {
  console.error('Healthcheck failed to run:', error);
  process.exitCode = 1;
});
