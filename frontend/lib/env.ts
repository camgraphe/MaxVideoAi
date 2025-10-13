const RESULT_PROVIDER = (process.env.NEXT_PUBLIC_RESULT_PROVIDER ?? '').trim();
const FAL_API_KEY = (process.env.NEXT_PUBLIC_FAL_API_KEY ?? process.env.NEXT_PUBLIC_FAL_KEY ?? '').trim();
const WORKSPACE_CENTER_GALLERY = (process.env.NEXT_PUBLIC_WORKSPACE_CENTER_GALLERY ?? '').trim().toLowerCase();

export const ENV = {
  RESULT_PROVIDER: RESULT_PROVIDER || null,
  FAL_API_KEY: FAL_API_KEY || null,
  FAL_KEY: FAL_API_KEY || null,
  WORKSPACE_CENTER_GALLERY,
} as const;

export type EnvShape = typeof ENV;
