import type { QueryExecutor } from '@/lib/db';

export type TrialQuotePreparedAuditInput = Readonly<{
  quoteId: string;
  engineId: 'seedance-2-0-mini';
  aspectRatio: '16:9' | '9:16' | '1:1';
  audio: boolean;
  oauthClientId: string;
  outcome: 'success';
}>;

type Dependencies = { executor: QueryExecutor };

const INPUT_KEYS = new Set([
  'quoteId', 'engineId', 'aspectRatio', 'audio', 'oauthClientId', 'outcome',
]);
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ASPECT_RATIOS = new Set(['16:9', '9:16', '1:1']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function assertInput(value: unknown): asserts value is TrialQuotePreparedAuditInput {
  if (!isRecord(value)) {
    throw new Error('Invalid trial quote prepared audit input.');
  }
  const input = Object.create(null) as Record<string, unknown>;
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== INPUT_KEYS.size) {
    throw new Error('Invalid trial quote prepared audit input.');
  }
  for (const key of ownKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string'
      || !INPUT_KEYS.has(key)
      || !descriptor?.enumerable
      || !Object.hasOwn(descriptor, 'value')) {
      throw new Error('Invalid trial quote prepared audit input.');
    }
    input[key] = descriptor.value;
  }
  if (typeof input.quoteId !== 'string'
    || !UUID_V4_PATTERN.test(input.quoteId)
    || input.engineId !== 'seedance-2-0-mini'
    || typeof input.aspectRatio !== 'string'
    || !ASPECT_RATIOS.has(input.aspectRatio)
    || typeof input.audio !== 'boolean'
    || typeof input.oauthClientId !== 'string'
    || input.oauthClientId.length < 1
    || input.oauthClientId.length > 256
    || input.oauthClientId !== input.oauthClientId.trim()
    || input.outcome !== 'success') {
    throw new Error('Invalid trial quote prepared audit input.');
  }
}

export async function recordTrialQuotePreparedAudit(
  input: TrialQuotePreparedAuditInput,
  dependencies: Dependencies,
): Promise<boolean> {
  assertInput(input);
  const rows = await dependencies.executor.query<{ quote_id: unknown }>(
    `INSERT INTO mcp_trial_quote_prepared_audit (
      quote_id, engine_id, aspect_ratio, audio, oauth_client_id, outcome
    ) VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (quote_id) DO NOTHING
    RETURNING quote_id`,
    [
      input.quoteId,
      input.engineId,
      input.aspectRatio,
      input.audio,
      input.oauthClientId,
      input.outcome,
    ],
  );
  if (rows.length === 0) return false;
  if (rows.length !== 1 || rows[0]?.quote_id !== input.quoteId) {
    throw new Error('Invalid trial quote prepared audit result.');
  }
  return true;
}
