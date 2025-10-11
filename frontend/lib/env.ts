const RESULT_PROVIDER = (process.env.NEXT_PUBLIC_RESULT_PROVIDER ?? '').trim();
const FAL_API_KEY = (process.env.NEXT_PUBLIC_FAL_API_KEY ?? '').trim();

export const ENV = {
  RESULT_PROVIDER: RESULT_PROVIDER || null,
  FAL_API_KEY: FAL_API_KEY || null,
} as const;

export type EnvShape = typeof ENV;
