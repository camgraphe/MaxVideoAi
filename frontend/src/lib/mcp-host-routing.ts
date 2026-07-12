function normalizedHost(host: string): string | null {
  const trimmed = host.trim();
  if (!trimmed || trimmed.includes(',') || /[\s/@?#]/.test(trimmed)) return null;

  const bracketed = trimmed.match(/^\[([0-9a-fA-F:]+)\](?::([0-9]+))?$/);
  const named = trimmed.match(/^([^:]+?)(?::([0-9]+))?$/);
  const match = bracketed ?? named;
  if (!match) return null;

  const rawHostname = match[1];
  const rawPort = match[2];
  const hostname = rawHostname.toLowerCase().replace(/\.+$/, '');
  if (!hostname) return null;

  let port = '';
  if (rawPort != null) {
    const portNumber = Number(rawPort);
    if (!Number.isSafeInteger(portNumber) || portNumber < 1 || portNumber > 65535) return null;
    port = `:${portNumber}`;
  }

  try {
    const authority = bracketed ? `[${hostname}]${port}` : `${hostname}${port}`;
    const parsed = new URL(`http://${authority}`);
    if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) return null;
    return authority;
  } catch {
    return null;
  }
}

export function getMcpRequestHost(headers: Pick<Headers, 'get'>): string | null {
  const host = headers.get('host');
  return host && normalizedHost(host) ? host : null;
}

export function isMcpApiHost(host: string, configuredApiHost: string): boolean {
  const actual = normalizedHost(host);
  const configured = normalizedHost(configuredApiHost);
  return actual != null && configured != null && actual === configured;
}

export function getMcpApiRewritePath(
  host: string,
  pathname: string,
  configuredApiHost: string
): '/api/mcp' | null {
  return pathname === '/mcp' && isMcpApiHost(host, configuredApiHost) ? '/api/mcp' : null;
}
