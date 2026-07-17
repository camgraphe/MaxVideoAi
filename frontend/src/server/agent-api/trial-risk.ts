import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

import {
  isTransactionQueryExecutor,
  query,
  type QueryExecutor,
  type TransactionQueryExecutor,
} from '@/lib/db';
import { ENV } from '@/lib/env';

import {
  countTrialRiskEvents,
  recordTrialRiskEvent,
  sumAcceptedTrialRiskProviderCost,
  type RecordTrialRiskEventInput,
} from './trial-risk-repository';

export const MCP_TRIAL_RISK_RETENTION_DAYS = 30;

export type TrialRiskInput = {
  userId: string;
  oauthClientId: string;
  clientIp: string | null;
  userAgent: string | null;
  providerCostCents: number;
};

export type TrialRiskDecision =
  | Readonly<{ allowed: true }>
  | Readonly<{
      allowed: false;
      code: 'TRIAL_NOT_ELIGIBLE' | 'RATE_LIMITED';
      nextAction: Readonly<{ type: 'use_paid_generation' | 'retry_later' }>;
    }>;

export type TrialRiskLimits = {
  perUserAcceptedPerUtcDay: number;
  perOauthClientAcceptedPerUtcDay: number;
  perFingerprintAcceptedPerUtcDay: number;
  globalAcceptedProviderCostCentsPerUtcDay: number;
};

type CheckDependencies = {
  executor: QueryExecutor;
  secret: string | undefined;
  limits: TrialRiskLimits;
};

type AcceptDependencies = {
  executor: TransactionQueryExecutor;
  secret?: string | undefined;
  limits?: TrialRiskLimits;
};

type InternalDecision = {
  decision: TrialRiskDecision;
  event: Pick<RecordTrialRiskEventInput, 'outcome' | 'reasonCode' | 'providerCostCents'>;
};

type DatabaseTimeRow = { current_time: unknown };

const INPUT_KEYS = new Set([
  'userId', 'oauthClientId', 'clientIp', 'userAgent', 'providerCostCents',
]);
const LIMIT_KEYS = new Set([
  'perUserAcceptedPerUtcDay',
  'perOauthClientAcceptedPerUtcDay',
  'perFingerprintAcceptedPerUtcDay',
  'globalAcceptedProviderCostCentsPerUtcDay',
]);
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@|+-]*$/u;
const DEFAULT_LIMITS: Readonly<TrialRiskLimits> = Object.freeze({
  perUserAcceptedPerUtcDay: 3,
  perOauthClientAcceptedPerUtcDay: 25,
  perFingerprintAcceptedPerUtcDay: 3,
  globalAcceptedProviderCostCentsPerUtcDay: 1_000,
});
const DEFAULT_CHECK_DEPENDENCIES: CheckDependencies = {
  executor: { query },
  secret: ENV.MCP_TRIAL_RISK_SECRET,
  limits: DEFAULT_LIMITS,
};
const ACCEPTANCE_LOCK_KEY = '5522039472000441';
const ALLOWED = Object.freeze({ allowed: true } as const);
const NOT_ELIGIBLE = Object.freeze({
  allowed: false,
  code: 'TRIAL_NOT_ELIGIBLE',
  nextAction: Object.freeze({ type: 'use_paid_generation' as const }),
} as const);
const RATE_LIMITED = Object.freeze({
  allowed: false,
  code: 'RATE_LIMITED',
  nextAction: Object.freeze({ type: 'retry_later' as const }),
} as const);

function exactPlainRecord(
  value: unknown,
  expectedKeys: ReadonlySet<string>,
): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
    || Object.getOwnPropertySymbols(value).length !== 0) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors);
  if (keys.length !== expectedKeys.size || !keys.every((key) => expectedKeys.has(key))) return null;
  if (keys.some((key) => !descriptors[key]?.enumerable || !('value' in descriptors[key]!))) return null;
  return Object.fromEntries(
    keys.map((key) => [key, descriptors[key]!.value]),
  ) as Record<string, unknown>;
}

function boundedIdentifier(value: unknown, maxLength: number): value is string {
  return typeof value === 'string'
    && value.length >= 1
    && value.length <= maxLength
    && value === value.trim()
    && IDENTIFIER_PATTERN.test(value);
}

function parseInput(value: unknown): TrialRiskInput {
  const input = exactPlainRecord(value, INPUT_KEYS);
  if (!input
    || !boundedIdentifier(input.userId, 128)
    || !boundedIdentifier(input.oauthClientId, 256)
    || !(input.clientIp === null
      || (typeof input.clientIp === 'string'
        && input.clientIp === input.clientIp.trim()
        && !input.clientIp.includes('%')
        && isIP(input.clientIp) !== 0))
    || !(input.userAgent === null
      || (typeof input.userAgent === 'string'
        && input.userAgent.length <= 2_048
        && !/[\u0000\r\n]/u.test(input.userAgent)))
    || !Number.isSafeInteger(input.providerCostCents)
    || (input.providerCostCents as number) <= 0) {
    throw new Error('Invalid trial risk input.');
  }
  return input as TrialRiskInput;
}

function validSecret(secret: unknown): secret is string {
  return typeof secret === 'string'
    && Buffer.byteLength(secret, 'utf8') >= 32
    && Buffer.from(secret, 'utf8').toString('utf8') === secret;
}

function validLimits(value: unknown): value is TrialRiskLimits {
  const limits = exactPlainRecord(value, LIMIT_KEYS);
  return limits !== null
    && Object.values(limits).every(
      (limit) => Number.isSafeInteger(limit) && (limit as number) > 0,
    );
}

function expandIpv6(value: string): number[] {
  let normalized = value.toLowerCase();
  const tail = normalized.slice(normalized.lastIndexOf(':') + 1);
  if (tail.includes('.')) {
    const octets = tail.split('.').map(Number);
    const replacement = `${((octets[0]! << 8) | octets[1]!).toString(16)}:${(
      (octets[2]! << 8) | octets[3]!
    ).toString(16)}`;
    normalized = `${normalized.slice(0, normalized.length - tail.length)}${replacement}`;
  }
  const halves = normalized.split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const zeros = halves.length === 2 ? 8 - left.length - right.length : 0;
  return [...left, ...Array.from({ length: zeros }, () => '0'), ...right]
    .map((part) => Number.parseInt(part, 16));
}

function canonicalIpv6(groups: number[]): string {
  let bestStart = -1;
  let bestLength = 0;
  for (let index = 0; index < groups.length;) {
    if (groups[index] !== 0) {
      index += 1;
      continue;
    }
    let end = index;
    while (end < groups.length && groups[end] === 0) end += 1;
    if (end - index > bestLength && end - index >= 2) {
      bestStart = index;
      bestLength = end - index;
    }
    index = end;
  }
  const before = groups.slice(0, bestStart < 0 ? groups.length : bestStart)
    .map((group) => group.toString(16)).join(':');
  if (bestStart < 0) return before;
  const after = groups.slice(bestStart + bestLength).map((group) => group.toString(16)).join(':');
  return `${before}::${after}`;
}

function coarseIpPrefix(clientIp: string | null): string {
  if (clientIp === null) return 'unknown';
  if (isIP(clientIp) === 4) {
    const octets = clientIp.split('.');
    return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
  }
  const groups = expandIpv6(clientIp);
  return `${canonicalIpv6([...groups.slice(0, 3), 0, 0, 0, 0, 0])}/48`;
}

function userAgentFamily(userAgent: string | null): string {
  if (userAgent === null || userAgent.trim().length === 0) return 'unknown';
  const normalized = userAgent.toLowerCase();
  if (/\bclaude\b/u.test(normalized)) return 'claude';
  if (/\bcodex\b/u.test(normalized)) return 'codex';
  if (/\b(?:edg|edge)\//u.test(normalized)) return 'edge';
  if (/\b(?:firefox|fxios)\//u.test(normalized)) return 'firefox';
  if (/\b(?:chrome|crios)\//u.test(normalized)) return 'chrome';
  if (/\bsafari\//u.test(normalized)) return 'safari';
  return 'other';
}

function riskFingerprint(input: TrialRiskInput, secret: string): string {
  const value = `v1|ip=${coarseIpPrefix(input.clientIp)}|ua=${userAgentFamily(input.userAgent)}`;
  return createHmac('sha256', secret).update(value, 'utf8').digest('hex');
}

function finiteDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? new Date(value.getTime()) : null;
  if (typeof value !== 'string' || value.length === 0) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

async function readDatabaseTime(executor: QueryExecutor): Promise<Date> {
  const rows = await executor.query<DatabaseTimeRow>(
    'SELECT clock_timestamp() AS current_time',
  );
  const currentTime = rows.length === 1 ? finiteDate(rows[0]?.current_time) : null;
  if (!currentTime) throw new Error('Invalid trial risk database time.');
  return currentTime;
}

function utcDayStart(currentTime: Date): Date {
  return new Date(Date.UTC(
    currentTime.getUTCFullYear(),
    currentTime.getUTCMonth(),
    currentTime.getUTCDate(),
  ));
}

function blocked(
  outcome: 'blocked' | 'rate_limited',
  reasonCode: 'user_daily_limit' | 'oauth_client_daily_limit'
    | 'fingerprint_daily_limit' | 'global_daily_cost_cap',
): InternalDecision {
  return {
    decision: outcome === 'blocked' ? NOT_ELIGIBLE : RATE_LIMITED,
    event: { outcome, reasonCode, providerCostCents: 0 },
  };
}

async function evaluateRisk(
  input: TrialRiskInput,
  fingerprint: string,
  executor: QueryExecutor,
  limits: TrialRiskLimits,
): Promise<InternalDecision> {
  const since = utcDayStart(await readDatabaseTime(executor));
  const outcomes = ['allowed'] as const;
  const userCount = await countTrialRiskEvents(
    { scope: 'user', scopeValue: input.userId, since, outcomes: [...outcomes] },
    { executor },
  );
  const oauthClientCount = await countTrialRiskEvents(
    { scope: 'oauth_client', scopeValue: input.oauthClientId, since, outcomes: [...outcomes] },
    { executor },
  );
  const fingerprintCount = await countTrialRiskEvents(
    { scope: 'fingerprint', scopeValue: fingerprint, since, outcomes: [...outcomes] },
    { executor },
  );
  await countTrialRiskEvents(
    { scope: 'global', scopeValue: null, since, outcomes: [...outcomes] },
    { executor },
  );
  const acceptedProviderCostCents = await sumAcceptedTrialRiskProviderCost({ since }, { executor });

  if (userCount >= limits.perUserAcceptedPerUtcDay) {
    return blocked('blocked', 'user_daily_limit');
  }
  if (oauthClientCount >= limits.perOauthClientAcceptedPerUtcDay) {
    return blocked('rate_limited', 'oauth_client_daily_limit');
  }
  if (fingerprintCount >= limits.perFingerprintAcceptedPerUtcDay) {
    return blocked('rate_limited', 'fingerprint_daily_limit');
  }
  if (acceptedProviderCostCents >= limits.globalAcceptedProviderCostCentsPerUtcDay
    || input.providerCostCents
      > limits.globalAcceptedProviderCostCentsPerUtcDay - acceptedProviderCostCents) {
    return blocked('rate_limited', 'global_daily_cost_cap');
  }
  return {
    decision: ALLOWED,
    event: {
      outcome: 'allowed',
      reasonCode: 'accepted',
      providerCostCents: input.providerCostCents,
    },
  };
}

export async function checkTrialRisk(
  value: TrialRiskInput,
  overrides: Partial<CheckDependencies> = {},
): Promise<TrialRiskDecision> {
  const input = parseInput(value);
  const dependencies = { ...DEFAULT_CHECK_DEPENDENCIES, ...overrides };
  if (!validSecret(dependencies.secret) || !validLimits(dependencies.limits)) {
    return NOT_ELIGIBLE;
  }
  const fingerprint = riskFingerprint(input, dependencies.secret);
  try {
    return (await evaluateRisk(
      input,
      fingerprint,
      dependencies.executor,
      dependencies.limits,
    )).decision;
  } catch {
    return NOT_ELIGIBLE;
  }
}

export async function acceptTrialRisk(
  value: TrialRiskInput,
  dependencies: AcceptDependencies,
): Promise<TrialRiskDecision> {
  const input = parseInput(value);
  const secret = Object.prototype.hasOwnProperty.call(dependencies, 'secret')
    ? dependencies.secret
    : ENV.MCP_TRIAL_RISK_SECRET;
  const limits = dependencies.limits ?? DEFAULT_LIMITS;
  if (!isTransactionQueryExecutor(dependencies.executor)
    || !validSecret(secret)
    || !validLimits(limits)) {
    return NOT_ELIGIBLE;
  }
  const fingerprint = riskFingerprint(input, secret);
  try {
    await dependencies.executor.query(
      'SELECT pg_advisory_xact_lock($1::bigint)',
      [ACCEPTANCE_LOCK_KEY],
    );
    const evaluated = await evaluateRisk(input, fingerprint, dependencies.executor, limits);
    await recordTrialRiskEvent({
      userId: input.userId,
      oauthClientId: input.oauthClientId,
      riskFingerprintHash: fingerprint,
      ...evaluated.event,
    }, { executor: dependencies.executor });
    return evaluated.decision;
  } catch {
    return NOT_ELIGIBLE;
  }
}
