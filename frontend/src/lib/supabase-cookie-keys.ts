export const ACCESS_TOKEN_COOKIE_NAMES = ['sb-access-token', 'supabase-access-token'] as const;
export const REFRESH_TOKEN_COOKIE_NAMES = ['sb-refresh-token', 'supabase-refresh-token'] as const;

export type AccessTokenCookieName = (typeof ACCESS_TOKEN_COOKIE_NAMES)[number];
export type RefreshTokenCookieName = (typeof REFRESH_TOKEN_COOKIE_NAMES)[number];
