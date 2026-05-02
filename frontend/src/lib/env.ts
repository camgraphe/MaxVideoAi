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
  getOptionalEnv('FAL_KEY');

const RECEIPTS_PRICE_ONLY =
  (getOptionalEnv('RECEIPTS_PRICE_ONLY', 'true') ?? 'true').toLowerCase() === 'true';

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
  STRIPE_TAX_CODE_ELECTRONIC_SERVICES: getOptionalEnv('STRIPE_TAX_CODE_ELECTRONIC_SERVICES'),
  CRON_SECRET: getOptionalEnv('CRON_SECRET'),
  EMAIL_FROM: getOptionalEnv('EMAIL_FROM'),
  EMAIL_FROM_NAME: getOptionalEnv('EMAIL_FROM_NAME'),
  BREVO_SMTP_HOST: getOptionalEnv('BREVO_SMTP_HOST') ?? 'smtp-relay.sendinblue.com',
  BREVO_SMTP_PORT: getOptionalEnv('BREVO_SMTP_PORT') ?? '587',
  BREVO_SMTP_USERNAME: getOptionalEnv('BREVO_SMTP_USERNAME'),
  BREVO_SMTP_PASSWORD: getOptionalEnv('BREVO_SMTP_PASSWORD'),
  CONTACT_SENDER_EMAIL: getOptionalEnv('CONTACT_SENDER_EMAIL'),
  CONTACT_RECIPIENT_EMAIL: getOptionalEnv('CONTACT_RECIPIENT_EMAIL'),
  LEGAL_NOTIFY_EMAIL: getOptionalEnv('LEGAL_NOTIFY_EMAIL'),
  SUPABASE_SITE_URL: getOptionalEnv('SUPABASE_SITE_URL'),
  NEXT_PUBLIC_SITE_URL: getOptionalEnv('NEXT_PUBLIC_SITE_URL'),
  GA4_MEASUREMENT_ID:
    getOptionalEnv('GA4_MEASUREMENT_ID') ??
    getOptionalEnv('NEXT_PUBLIC_GOOGLE_ANALYTICS_ID') ??
    getOptionalEnv('NEXT_PUBLIC_GA4_ID') ??
    getOptionalEnv('NEXT_PUBLIC_GA_ID'),
  GA4_API_SECRET: getOptionalEnv('GA4_API_SECRET'),
  FAL_API_KEY: falKey,
  FAL_KEY: falKey,
  BYTEPLUS_ARK_API_KEY: getOptionalEnv('BYTEPLUS_ARK_API_KEY'),
  BYTEPLUS_ARK_REGION: getOptionalEnv('BYTEPLUS_ARK_REGION', 'ap-southeast-1'),
  BYTEPLUS_ARK_BASE_URL: getOptionalEnv('BYTEPLUS_ARK_BASE_URL', 'https://ark.ap-southeast.bytepluses.com/api/v3'),
  BYTEPLUS_ARK_SEEDANCE_FAST_MODEL_ID: getOptionalEnv(
    'BYTEPLUS_ARK_SEEDANCE_FAST_MODEL_ID',
    'dreamina-seedance-2-0-fast-260128'
  ),
  BYTEPLUS_ARK_SEEDANCE_MODEL_ID: getOptionalEnv('BYTEPLUS_ARK_SEEDANCE_MODEL_ID', 'dreamina-seedance-2-0-260128'),
  BYTEPLUS_ARK_ENABLED: getOptionalEnv('BYTEPLUS_ARK_ENABLED', 'false'),
  SEEDANCE_2_PROVIDER: getOptionalEnv('SEEDANCE_2_PROVIDER', 'fal'),
  SEEDANCE_2_BYTEPLUS_ADMIN_ONLY: getOptionalEnv('SEEDANCE_2_BYTEPLUS_ADMIN_ONLY', 'true'),
  SEEDANCE_2_BYTEPLUS_MODES: getOptionalEnv('SEEDANCE_2_BYTEPLUS_MODES', 't2v,i2v,ref2v'),
  SEEDANCE_FAST_PROVIDER: getOptionalEnv('SEEDANCE_FAST_PROVIDER', 'fal'),
  SEEDANCE_FAST_BYTEPLUS_ADMIN_ONLY: getOptionalEnv('SEEDANCE_FAST_BYTEPLUS_ADMIN_ONLY', 'true'),
  SEEDANCE_FAST_BYTEPLUS_MODES: getOptionalEnv('SEEDANCE_FAST_BYTEPLUS_MODES', 't2v,i2v,ref2v'),
  RESULT_PROVIDER:
    getOptionalEnv('NEXT_PUBLIC_RESULT_PROVIDER') ??
    getOptionalEnv('RESULT_PROVIDER'),
  LUMARAY2_BASE_5S_540P_USD: getOptionalEnv('LUMARAY2_BASE_5S_540P_USD'),
  LUMARAY2_FLASH_BASE_5S_540P_USD: getOptionalEnv('LUMARAY2_FLASH_BASE_5S_540P_USD'),
  LUMARAY2_MODIFY_PER_SECOND_USD: getOptionalEnv('LUMARAY2_MODIFY_PER_SECOND_USD'),
  LUMARAY2_FLASH_MODIFY_PER_SECOND_USD: getOptionalEnv('LUMARAY2_FLASH_MODIFY_PER_SECOND_USD'),
  LUMARAY2_REFRAME_PER_SECOND_USD: getOptionalEnv('LUMARAY2_REFRAME_PER_SECOND_USD'),
  LUMARAY2_FLASH_REFRAME_PER_SECOND_USD: getOptionalEnv('LUMARAY2_FLASH_REFRAME_PER_SECOND_USD'),
  TEST_VIDEO_BASE_URL: getOptionalEnv('TEST_VIDEO_BASE_URL'),
  WORKSPACE_CENTER_GALLERY: getOptionalEnv('NEXT_PUBLIC_WORKSPACE_CENTER_GALLERY'),
  FAL_USE_UPLOAD:
    (getOptionalEnv('FAL_USE_UPLOAD') ?? 'false').toLowerCase() === 'true',
  DEFAULT_CURRENCY: getOptionalEnv('DEFAULT_CURRENCY'),
  ENABLED_CURRENCIES: getOptionalEnv('ENABLED_CURRENCIES'),
  FX_MARGIN_BPS: getOptionalEnv('FX_MARGIN_BPS'),
  RECEIPTS_PRICE_ONLY,
};

export function receiptsPriceOnlyEnabled(): boolean {
  return ENV.RECEIPTS_PRICE_ONLY;
}
