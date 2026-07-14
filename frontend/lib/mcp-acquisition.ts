import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const MCP_ACQUISITION_COOKIE_NAME = 'mv_mcp_acquisition';
export const MCP_ACQUISITION_COOKIE_MAX_AGE_SECONDS = 10 * 60;
export const MCP_ACQUISITION_COOKIE_MAX_BYTES = 512;
export const MCP_ACQUISITION_REQUEST_MAX_BYTES = 1024;

const COOKIE_PREFIX = 'v1';
const CLOCK_SKEW_SECONDS = 30;
const ACQUISITION_ID_PATTERN = /^acq_[A-Za-z0-9_-]{24}$/;
const REQUEST_KEYS = new Set(['action', 'source', 'medium', 'campaign', 'client']);
const SIGNED_KEYS = new Set([
  'version',
  'acquisitionId',
  'source',
  'medium',
  'campaign',
  'client',
  'issuedAt',
  'expiresAt',
]);

export type McpAcquisitionClient = 'claude' | 'codex';
export type McpAcquisitionAction = 'connect' | 'copy_endpoint';
export type McpLandingAcquisition = {
  source: 'mcp_landing';
  medium: 'owned';
  campaign: 'mcp_connect';
  client: McpAcquisitionClient;
};
export type McpAcquisitionRequest = McpLandingAcquisition & {
  action: McpAcquisitionAction;
};
export type SignedMcpAcquisition = McpLandingAcquisition & {
  version: 1;
  acquisitionId: string;
  issuedAt: number;
  expiresAt: number;
};
export type McpConnectionAcquisition = {
  acquisitionId: string | null;
  source: 'mcp_landing' | 'direct_mcp';
  medium: 'owned' | 'mcp';
  campaign: 'mcp_connect' | 'none';
  client: McpAcquisitionClient | 'other';
};

type SigningOptions = {
  secret: string;
  nowSeconds?: number;
};

type CreateSigningOptions = SigningOptions & {
  acquisitionId?: string;
};

type McpAcquisitionEnv = Readonly<Record<string, string | undefined>>;

function hasExactKeys(record: Record<string, unknown>, allowed: Set<string>): boolean {
  const keys = Object.keys(record);
  return keys.length === allowed.size && keys.every((key) => allowed.has(key));
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isLandingAcquisition<TRecord extends Record<string, unknown>>(
  record: TRecord,
): record is TRecord & McpLandingAcquisition {
  return (
    record.source === 'mcp_landing' &&
    record.medium === 'owned' &&
    record.campaign === 'mcp_connect' &&
    (record.client === 'claude' || record.client === 'codex')
  );
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function validateSecret(secret: string): void {
  if (Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('MCP acquisition signing secret must contain at least 32 bytes.');
  }
}

function signature(signingInput: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(signingInput, 'utf8').digest();
}

function nowInSeconds(value?: number): number {
  return value ?? Math.floor(Date.now() / 1000);
}

export function resolveMcpAcquisitionSigningSecret(
  env: McpAcquisitionEnv = process.env,
): string {
  const secret = env.MCP_ACQUISITION_SIGNING_SECRET?.trim() ?? '';
  validateSecret(secret);
  return secret;
}

export function parseMcpAcquisitionRequest(value: unknown): McpAcquisitionRequest | null {
  if (!isPlainRecord(value) || !hasExactKeys(value, REQUEST_KEYS) || !isLandingAcquisition(value)) {
    return null;
  }
  if (value.action !== 'connect' && value.action !== 'copy_endpoint') return null;
  return {
    action: value.action,
    source: value.source,
    medium: value.medium,
    campaign: value.campaign,
    client: value.client,
  };
}

export function createSignedMcpAcquisitionCookie(
  acquisition: McpLandingAcquisition,
  options: CreateSigningOptions,
): { value: string; context: SignedMcpAcquisition } {
  validateSecret(options.secret);
  const issuedAt = nowInSeconds(options.nowSeconds);
  const acquisitionId = options.acquisitionId ?? `acq_${randomBytes(18).toString('base64url')}`;
  if (!ACQUISITION_ID_PATTERN.test(acquisitionId)) {
    throw new Error('Invalid MCP acquisition id.');
  }
  const context: SignedMcpAcquisition = {
    version: 1,
    acquisitionId,
    source: acquisition.source,
    medium: acquisition.medium,
    campaign: acquisition.campaign,
    client: acquisition.client,
    issuedAt,
    expiresAt: issuedAt + MCP_ACQUISITION_COOKIE_MAX_AGE_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(context), 'utf8').toString('base64url');
  const signingInput = `${COOKIE_PREFIX}.${encodedPayload}`;
  const value = `${signingInput}.${signature(signingInput, options.secret).toString('base64url')}`;
  if (Buffer.byteLength(value, 'utf8') > MCP_ACQUISITION_COOKIE_MAX_BYTES) {
    throw new Error('MCP acquisition cookie exceeds its size limit.');
  }
  return { value, context };
}

export function verifySignedMcpAcquisitionCookie(
  value: unknown,
  options: SigningOptions,
): SignedMcpAcquisition | null {
  if (
    typeof value !== 'string' ||
    Buffer.byteLength(value, 'utf8') > MCP_ACQUISITION_COOKIE_MAX_BYTES
  ) {
    return null;
  }
  try {
    validateSecret(options.secret);
    const parts = value.split('.');
    if (parts.length !== 3) return null;
    const [prefix, encodedPayload, encodedSignature] = parts;
    if (!prefix || !encodedPayload || !encodedSignature) return null;

    const actualSignature = Buffer.from(encodedSignature, 'base64url');
    const expectedSignature = signature(`${prefix}.${encodedPayload}`, options.secret);
    if (
      actualSignature.length !== expectedSignature.length ||
      !timingSafeEqual(actualSignature, expectedSignature)
    ) {
      return null;
    }
    if (prefix !== COOKIE_PREFIX) return null;

    const parsed = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as unknown;
    if (
      !isPlainRecord(parsed) ||
      !hasExactKeys(parsed, SIGNED_KEYS) ||
      parsed.version !== 1 ||
      !ACQUISITION_ID_PATTERN.test(String(parsed.acquisitionId)) ||
      !isLandingAcquisition(parsed) ||
      !isSafeInteger(parsed.issuedAt) ||
      !isSafeInteger(parsed.expiresAt) ||
      parsed.expiresAt - parsed.issuedAt !== MCP_ACQUISITION_COOKIE_MAX_AGE_SECONDS
    ) {
      return null;
    }
    const now = nowInSeconds(options.nowSeconds);
    if (parsed.issuedAt > now + CLOCK_SKEW_SECONDS || parsed.expiresAt <= now) return null;
    return parsed as SignedMcpAcquisition;
  } catch {
    return null;
  }
}

export function mcpAcquisitionCookieOptions(env: McpAcquisitionEnv = process.env) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/oauth/consent',
    maxAge: MCP_ACQUISITION_COOKIE_MAX_AGE_SECONDS,
  };
}

export function createDirectMcpAcquisition(): McpConnectionAcquisition {
  return {
    acquisitionId: null,
    source: 'direct_mcp',
    medium: 'mcp',
    campaign: 'none',
    client: 'other',
  };
}
