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

export const ENV = {
  NEXT_PUBLIC_API_BASE: getOptionalEnv('NEXT_PUBLIC_API_BASE', '/api'),
  NEXT_PUBLIC_SUPABASE_URL: getOptionalEnv('NEXT_PUBLIC_SUPABASE_URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: getOptionalEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: getOptionalEnv('SUPABASE_SERVICE_ROLE_KEY'),
  STRIPE_SECRET_KEY: getOptionalEnv('STRIPE_SECRET_KEY'),
  STRIPE_WEBHOOK_SECRET: getOptionalEnv('STRIPE_WEBHOOK_SECRET'),
  STRIPE_PRICE_PLUS: getOptionalEnv('STRIPE_PRICE_PLUS'),
  STRIPE_PRICE_PRO: getOptionalEnv('STRIPE_PRICE_PRO'),
  FAL_API_KEY: getOptionalEnv('FAL_API_KEY'),
  RESULT_PROVIDER: getOptionalEnv('RESULT_PROVIDER'),
  TEST_VIDEO_BASE_URL: getOptionalEnv('TEST_VIDEO_BASE_URL'),
};
