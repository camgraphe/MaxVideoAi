export const ACCESS_TOKEN_COOKIE_NAMES = ['sb-access-token', 'supabase-access-token'] as const;
export type AccessTokenCookieName = (typeof ACCESS_TOKEN_COOKIE_NAMES)[number];
