import type { McpDistributionProfile } from './distribution-profile';
import { buildProtectedResourceMetadata } from './oauth-resource-metadata';

export type McpAuthenticationContext = {
  resourceUrl: string;
  distributionProfile: McpDistributionProfile;
};
export type OAuthResourcePolicy = {
  issuer: string;
  resourceUrl: string;
  requiredGrantScopes: readonly string[];
};

export function directoryOAuthResourcePolicy(resourceUrl: string, supabaseUrl: string): OAuthResourcePolicy {
  const metadata = buildProtectedResourceMetadata({ resourceUrl, supabaseUrl });
  return {
    issuer: metadata.authorization_servers[0], resourceUrl: metadata.resource,
    // Supabase OIDC scopes describe identity, not permission to spend credits.
    // Generation authorization remains with ownership, active consent and quotes.
    requiredGrantScopes: ['openid'],
  };
}

export function satisfiesOAuthResourcePolicy(
  claims: { iss?: unknown; aud?: unknown; exp?: unknown; nbf?: unknown },
  policy: OAuthResourcePolicy,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const audience = typeof claims.aud === 'string' ? [claims.aud] : claims.aud;
  return claims.iss === policy.issuer
    && Array.isArray(audience) && audience.every(value => typeof value === 'string')
    && audience.includes(policy.resourceUrl)
    && typeof claims.exp === 'number' && Number.isSafeInteger(claims.exp) && claims.exp > nowSeconds
    && (claims.nbf === undefined || (typeof claims.nbf === 'number' && Number.isSafeInteger(claims.nbf) && claims.nbf <= nowSeconds));
}
