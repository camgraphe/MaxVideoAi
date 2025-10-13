export const runtime = 'edge';

const REQUIRED_KEYS = [
  'FAL_KEY',
  'FAL_API_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'DATABASE_URL',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_SECRET_KEY',
] as const;

type RequiredEnvKey = (typeof REQUIRED_KEYS)[number];

export async function GET() {
  const status = Object.fromEntries(
    REQUIRED_KEYS.map((key) => [key, Boolean(process.env[key as RequiredEnvKey])])
  );

  return new Response(JSON.stringify(status, null, 2), {
    headers: { 'content-type': 'application/json' },
  });
}

