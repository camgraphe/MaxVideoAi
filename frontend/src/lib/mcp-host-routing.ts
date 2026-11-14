import openaiDirectory from '@/config/mcp-openai-directory.json';

// Authored candidate address, reserved even before activation. Routing it to
// the transport lets the server return a closed response instead of marketing.
export const MCP_OPENAI_DIRECTORY_RESOURCE_URL = openaiDirectory.resourceUrl;
const OPENAI_DIRECTORY_HOST = new URL(MCP_OPENAI_DIRECTORY_RESOURCE_URL).host;

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

export function isMcpOpenaiDirectoryHost(host: string): boolean {
  return isMcpApiHost(host, OPENAI_DIRECTORY_HOST);
}

export function getMcpApiRewritePath(
  host: string,
  pathname: string,
  configuredApiHost: string,
  options: {
    allowHtmlMarketing?: boolean;
    method?: string;
    accept?: string | null;
  } = {},
): '/api/mcp' | null {
  const isDirectoryHost = isMcpOpenaiDirectoryHost(host);
  if (pathname !== '/mcp' || (!isDirectoryHost && !isMcpApiHost(host, configuredApiHost))) return null;
  const method = options.method?.toUpperCase();
  const accept = options.accept?.toLowerCase() ?? '';
  const isHtmlNavigation = (method === 'GET' || method === 'HEAD')
    && accept.includes('text/html')
    && !accept.includes('application/json')
    && !accept.includes('text/event-stream');
  return !isDirectoryHost && options.allowHtmlMarketing && isHtmlNavigation ? null : '/api/mcp';
}
