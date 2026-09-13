import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { WorkspaceTimelineExportQualityPreset } from '../../../app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-export';
import type { TimelineExportBillingKind } from './contracts';

const ESTIMATE_TOKEN_VERSION = 1;
export const TIMELINE_EXPORT_ESTIMATE_TTL_SECONDS = 5 * 60;

export type TimelineExportEstimateTokenClaims = {
  version: typeof ESTIMATE_TOKEN_VERSION;
  userId: string;
  manifestHash: string;
  qualityPreset: WorkspaceTimelineExportQualityPreset;
  idempotencyKey: string;
  billingKind: TimelineExportBillingKind;
  amountCents: number;
  issuedAt: number;
  expiresAt: number;
};

type TimelineExportEstimateTokenExpected = Omit<TimelineExportEstimateTokenClaims, 'version' | 'issuedAt' | 'expiresAt'>
  & Partial<Pick<TimelineExportEstimateTokenClaims, 'issuedAt' | 'expiresAt'>>;

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(',')}}`;
}

function assertSecret(secret: string): string {
  const normalized = secret.trim();
  if (Buffer.byteLength(normalized, 'utf8') < 32) {
    throw new Error('TIMELINE_EXPORT_ESTIMATE_SECRET_TOO_SHORT');
  }
  return normalized;
}

function signatureForPayload(payload: string, secret: string): Buffer {
  return createHmac('sha256', assertSecret(secret)).update(payload, 'utf8').digest();
}

function invalidEstimateToken(): never {
  throw new Error('EXPORT_ESTIMATE_INVALID');
}

function isClaims(value: unknown): value is TimelineExportEstimateTokenClaims {
  if (!value || typeof value !== 'object') return false;
  const claims = value as Partial<TimelineExportEstimateTokenClaims>;
  return claims.version === ESTIMATE_TOKEN_VERSION
    && typeof claims.userId === 'string'
    && claims.userId.length > 0
    && typeof claims.manifestHash === 'string'
    && /^[a-f0-9]{64}$/.test(claims.manifestHash)
    && (claims.qualityPreset === 'draft' || claims.qualityPreset === 'standard' || claims.qualityPreset === 'high')
    && typeof claims.idempotencyKey === 'string'
    && claims.idempotencyKey.length > 0
    && (claims.billingKind === 'free' || claims.billingKind === 'paid')
    && Number.isSafeInteger(claims.amountCents)
    && (claims.amountCents ?? -1) >= 0
    && Number.isSafeInteger(claims.issuedAt)
    && Number.isSafeInteger(claims.expiresAt)
    && (claims.expiresAt ?? 0) > (claims.issuedAt ?? 0)
    && (claims.expiresAt ?? 0) - (claims.issuedAt ?? 0) <= TIMELINE_EXPORT_ESTIMATE_TTL_SECONDS;
}

export function resolveTimelineExportEstimateSecret(): string {
  const secret = process.env.TIMELINE_EXPORT_ESTIMATE_SECRET?.trim()
    || process.env.CHECKOUT_GUARD_HASH_SECRET?.trim()
    || process.env.STRIPE_WEBHOOK_SECRET?.trim()
    || process.env.CRON_SECRET?.trim();
  if (!secret) throw new Error('TIMELINE_EXPORT_ESTIMATE_SECRET_MISSING');
  return assertSecret(secret);
}

export function timelineExportManifestHash(manifest: unknown): string {
  return createHash('sha256').update(stableJson(manifest), 'utf8').digest('hex');
}

export function createTimelineExportEstimateTokenClaims(params: {
  userId: string;
  manifestHash: string;
  qualityPreset: WorkspaceTimelineExportQualityPreset;
  idempotencyKey: string;
  billingKind: TimelineExportBillingKind;
  amountCents: number;
  now?: number;
}): TimelineExportEstimateTokenClaims {
  const issuedAt = Math.floor(params.now ?? Date.now() / 1000);
  return {
    version: ESTIMATE_TOKEN_VERSION,
    userId: params.userId,
    manifestHash: params.manifestHash,
    qualityPreset: params.qualityPreset,
    idempotencyKey: params.idempotencyKey,
    billingKind: params.billingKind,
    amountCents: params.amountCents,
    issuedAt,
    expiresAt: issuedAt + TIMELINE_EXPORT_ESTIMATE_TTL_SECONDS,
  };
}

export function signTimelineExportEstimateToken(params: {
  claims: Omit<TimelineExportEstimateTokenClaims, 'version'> & { version?: typeof ESTIMATE_TOKEN_VERSION };
  secret: string;
}): string {
  const claims: TimelineExportEstimateTokenClaims = {
    ...params.claims,
    version: ESTIMATE_TOKEN_VERSION,
  };
  if (!isClaims(claims)) invalidEstimateToken();
  const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  return `${payload}.${signatureForPayload(payload, params.secret).toString('base64url')}`;
}

export function verifyTimelineExportEstimateToken(params: {
  token: string;
  expected: TimelineExportEstimateTokenExpected;
  secret: string;
  now?: number;
}): TimelineExportEstimateTokenClaims {
  if (!params.token || params.token.length > 4096) invalidEstimateToken();
  const parts = params.token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) invalidEstimateToken();
  const [payload, encodedSignature] = parts;
  let providedSignature: Buffer;
  let claims: unknown;
  try {
    providedSignature = Buffer.from(encodedSignature, 'base64url');
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return invalidEstimateToken();
  }
  const expectedSignature = signatureForPayload(payload, params.secret);
  if (
    providedSignature.length !== expectedSignature.length
    || !timingSafeEqual(providedSignature, expectedSignature)
    || !isClaims(claims)
  ) invalidEstimateToken();

  const now = Math.floor(params.now ?? Date.now() / 1000);
  if (claims.expiresAt < now) throw new Error('EXPORT_ESTIMATE_EXPIRED');
  if (claims.issuedAt > now + 30) invalidEstimateToken();

  const boundFields: Array<keyof TimelineExportEstimateTokenExpected> = [
    'userId',
    'manifestHash',
    'qualityPreset',
    'idempotencyKey',
    'billingKind',
    'amountCents',
    'issuedAt',
    'expiresAt',
  ];
  if (boundFields.some((field) => params.expected[field] !== undefined && params.expected[field] !== claims[field])) {
    throw new Error('EXPORT_ESTIMATE_CHANGED');
  }
  return claims;
}
