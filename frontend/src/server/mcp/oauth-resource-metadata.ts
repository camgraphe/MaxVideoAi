type ProtectedResourceMetadataInput = {
  resourceUrl: string;
  supabaseUrl: string;
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
