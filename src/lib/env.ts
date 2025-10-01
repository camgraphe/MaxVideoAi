import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  STRIPE_PRICE_SMALL: z.string().min(1).optional(),
  STRIPE_PRICE_MEDIUM: z.string().min(1).optional(),
  STRIPE_PRICE_LARGE: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  VEO_API_KEY: z.string().optional(),
  FAL_API_KEY: z.string().optional(),
  FAL_KEY: z.string().optional(),
  FAL_QUEUE_LOGS_DEFAULT: z.enum(["0", "1"]).optional(),
  APP_URL: z.string().url().optional(),
  FAL_WEBHOOK_PATH: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.string().optional(),
  FAL_PRICE_MARKUP: z.coerce.number().optional(),
  FAL_PRICE_CACHE_TTL_MS: z.coerce.number().optional(),
});

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  STRIPE_PRICE_SMALL: process.env.STRIPE_PRICE_SMALL,
  STRIPE_PRICE_MEDIUM: process.env.STRIPE_PRICE_MEDIUM,
  STRIPE_PRICE_LARGE: process.env.STRIPE_PRICE_LARGE,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY,
  VEO_API_KEY: process.env.VEO_API_KEY,
  FAL_API_KEY: process.env.FAL_API_KEY,
  FAL_KEY: process.env.FAL_KEY,
  FAL_QUEUE_LOGS_DEFAULT: process.env.FAL_QUEUE_LOGS_DEFAULT,
  APP_URL: process.env.APP_URL,
  FAL_WEBHOOK_PATH: process.env.FAL_WEBHOOK_PATH,
  S3_BUCKET: process.env.S3_BUCKET,
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
  S3_ENDPOINT: process.env.S3_ENDPOINT,
  S3_REGION: process.env.S3_REGION,
  S3_PUBLIC_BASE_URL: process.env.S3_PUBLIC_BASE_URL,
  S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE,
  FAL_PRICE_MARKUP: process.env.FAL_PRICE_MARKUP,
  FAL_PRICE_CACHE_TTL_MS: process.env.FAL_PRICE_CACHE_TTL_MS,
});

export function getFalCredentials(): string {
  const key = process.env.FAL_KEY ?? process.env.FAL_API_KEY;
  if (!key) {
    throw new Error("Missing Fal credentials. Set FAL_KEY or FAL_API_KEY on the server.");
  }
  return key;
}

export function getFalWebhookUrl(): string | undefined {
  const baseUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) {
    return undefined;
  }
  const path = process.env.FAL_WEBHOOK_PATH ?? "/api/fal/webhook";
  const normalizedBase = baseUrl.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export function shouldRequestFalLogs(): boolean {
  return process.env.FAL_QUEUE_LOGS_DEFAULT === "1";
}
