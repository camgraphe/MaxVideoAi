function normalizedHost(host: string): string | null {
  const trimmed = host.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(`http://${trimmed}`);
    const port = parsed.port && parsed.port !== '80' && parsed.port !== '443' ? `:${parsed.port}` : '';
    return `${parsed.hostname.toLowerCase()}${port}`;
  } catch {
    return null;
  }
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
