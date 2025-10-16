export function getEnv(name: string, fallback?: string): string {
  const raw = process.env[name];
  const value = typeof raw === 'string' ? raw.trim() : raw;
  if (value === undefined || value === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required env var: ${name}`);
  }
  return String(value);
}

export function getOptionalEnv(name: string, fallback?: string): string | undefined {
  const raw = process.env[name];
  const value = typeof raw === 'string' ? raw.trim() : raw;
  if (value === undefined || value === '') return fallback;
  return String(value);
}

const falKey =
  getOptionalEnv('FAL_API_KEY') ??
  getOptionalEnv('FAL_KEY') ??
  getOptionalEnv('NEXT_PUBLIC_FAL_API_KEY') ??
  getOptionalEnv('NEXT_PUBLIC_FAL_KEY');

export const ENV = {
  NEXT_PUBLIC_API_BASE: getOptionalEnv('NEXT_PUBLIC_API_BASE', '/api'),
  NEXT_PUBLIC_SUPABASE_URL: getOptionalEnv('NEXT_PUBLIC_SUPABASE_URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: getOptionalEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  S3_BUCKET: getOptionalEnv('S3_BUCKET'),
  S3_REGION: getOptionalEnv('S3_REGION'),
  S3_PUBLIC_BASE_URL: getOptionalEnv('S3_PUBLIC_BASE_URL'),
  S3_UPLOAD_ACL: getOptionalEnv('S3_UPLOAD_ACL'),
  ASSET_MAX_IMAGE_MB: getOptionalEnv('ASSET_MAX_IMAGE_MB'),
  ASSET_HOST_ALLOWLIST: getOptionalEnv('ASSET_HOST_ALLOWLIST'),
  STRIPE_SECRET_KEY: getOptionalEnv('STRIPE_SECRET_KEY'),
  STRIPE_WEBHOOK_SECRET: getOptionalEnv('STRIPE_WEBHOOK_SECRET'),
  STRIPE_PRICE_PLUS: getOptionalEnv('STRIPE_PRICE_PLUS'),
  STRIPE_PRICE_PRO: getOptionalEnv('STRIPE_PRICE_PRO'),
  COGS_VAULT_ACCOUNT_ID: getOptionalEnv('COGS_VAULT_ACCOUNT_ID'),
  CRON_SECRET: getOptionalEnv('CRON_SECRET'),
  BATCH_TRANSFER_THRESHOLD_CENTS: getOptionalEnv('BATCH_TRANSFER_THRESHOLD_CENTS'),
  BATCH_TRANSFER_CURRENCY: getOptionalEnv('BATCH_TRANSFER_CURRENCY'),
  BATCH_TRANSFER_CRON: getOptionalEnv('BATCH_TRANSFER_CRON'),
  FAL_API_KEY: falKey,
  FAL_KEY: falKey,
  RESULT_PROVIDER:
    getOptionalEnv('NEXT_PUBLIC_RESULT_PROVIDER') ??
    getOptionalEnv('RESULT_PROVIDER'),
  TEST_VIDEO_BASE_URL: getOptionalEnv('TEST_VIDEO_BASE_URL'),
  WORKSPACE_CENTER_GALLERY: getOptionalEnv('NEXT_PUBLIC_WORKSPACE_CENTER_GALLERY'),
  FAL_USE_UPLOAD:
    (getOptionalEnv('FAL_USE_UPLOAD') ?? 'false').toLowerCase() === 'true',
};
