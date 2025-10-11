import "@testing-library/jest-dom/vitest";

if (!process.env.CI) {
  process.env.CI = "true";
}

process.env.DATABASE_URL ??= "postgres://example:example@localhost:5432/example";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "public-anon-key";
