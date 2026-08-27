type ProtectedResourceMetadataInput = {
  resourceUrl: string;
  supabaseUrl: string;
};

export type AuthorizationServerCompatibilityMetadata = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  scopes_supported: ['openid', 'email', 'profile', 'offline_access'];
  response_types_supported: ['code'];
  response_modes_supported: ['query'];
  grant_types_supported: ['authorization_code', 'refresh_token'];
  token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'];
  code_challenge_methods_supported: ['S256'];
};

export type ProtectedResourceMetadata = {
  resource: string;
  resource_name: string;
  authorization_servers: string[];
  bearer_methods_supported: ['header'];
  scopes_supported: ['openid', 'email', 'profile'];
};

function isLoopback(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
}

function parseServiceUrl(value: string, label: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute URL.`);
  }
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLoopback(parsed.hostname))) {
    throw new Error(`${label} must use HTTPS outside loopback development.`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${label} must not include credentials.`);
  }
  return parsed;
}

export function buildProtectedResourceMetadata(
  input: ProtectedResourceMetadataInput
): ProtectedResourceMetadata {
  const resource = parseServiceUrl(input.resourceUrl, 'MCP resource URL');
  const supabase = parseServiceUrl(input.supabaseUrl, 'Supabase authorization server URL');
  const authorizationServer = new URL('/auth/v1', supabase.origin).toString();

  return {
    resource: resource.toString(),
    resource_name: 'MaxVideoAI MCP',
    authorization_servers: [authorizationServer],
    bearer_methods_supported: ['header'],
    scopes_supported: ['openid', 'email', 'profile'],
  };
}

export function buildAuthorizationServerCompatibilityMetadata(
  input: ProtectedResourceMetadataInput
): AuthorizationServerCompatibilityMetadata {
  const resource = parseServiceUrl(input.resourceUrl, 'MCP resource URL');
  const supabase = parseServiceUrl(input.supabaseUrl, 'Supabase authorization server URL');
  const oauthBase = new URL('/auth/v1/oauth/', supabase.origin);

  return {
    issuer: resource.origin,
    authorization_endpoint: new URL('authorize', oauthBase).toString(),
    token_endpoint: new URL('token', oauthBase).toString(),
    registration_endpoint: new URL('clients/register', oauthBase).toString(),
    scopes_supported: ['openid', 'email', 'profile', 'offline_access'],
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
    code_challenge_methods_supported: ['S256'],
  };
}
