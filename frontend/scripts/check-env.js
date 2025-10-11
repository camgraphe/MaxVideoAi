#!/usr/bin/env node

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'FAL_KEY',
  'DATABASE_URL',
  'NEXT_PUBLIC_RESULT_PROVIDER',
  'RESULT_PROVIDER',
];

const missing = required.filter((name) => {
  const value = process.env[name];
  return typeof value !== 'string' || value.length === 0;
});

if (missing.length > 0) {
  console.error('❌ Missing ENV:\n' + missing.join('\n'));
  process.exit(1);
}

console.log('✅ ENV ok');
