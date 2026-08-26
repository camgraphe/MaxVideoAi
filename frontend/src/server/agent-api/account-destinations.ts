import type {
  AgentAccountDestinations,
  AgentDestinationPurpose,
  AgentOpenUrlDestination,
} from './types';

const ACCOUNT_CONNECTIONS_PATH = '/account/connections';
const MAX_JOB_ID_CHARS = 256;

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === 'localhost'
    || normalized === '127.0.0.1'
    || normalized === '[::1]'
    || normalized === '::1';
}

function parseTrustedAccountUrl(value: string): URL {
  if (typeof value !== 'string' || value !== value.trim()) {
    throw new Error('Expected a trusted MaxVideoAI account URL.');
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Expected a trusted MaxVideoAI account URL.');
  }

  const hostname = parsed.hostname.toLowerCase();
  const production = parsed.protocol === 'https:'
    && hostname === 'maxvideoai.com'
    && parsed.port === '';
  const officialStaging = parsed.protocol === 'https:'
    && hostname === 'maxvideoai-mcp-staging.vercel.app'
    && parsed.port === '';
  const loopback = isLoopbackHostname(hostname)
    && (parsed.protocol === 'http:' || parsed.protocol === 'https:');

  if (
    parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
    || parsed.pathname !== ACCOUNT_CONNECTIONS_PATH
    || (!production && !officialStaging && !loopback)
  ) {
    throw new Error('Expected a trusted MaxVideoAI account URL.');
  }

  return parsed;
}

function destination(
  origin: string,
  path: string,
  purpose: AgentDestinationPurpose,
  label: string,
): AgentOpenUrlDestination {
  return {
    type: 'open_url',
    purpose,
    label,
    url: new URL(path, origin).toString(),
  };
}

export function buildAgentAccountDestinations(accountUrl: string): AgentAccountDestinations {
  const trusted = parseTrustedAccountUrl(accountUrl);
  const origin = trusted.origin;
  return {
    connections: destination(
      origin,
      ACCOUNT_CONNECTIONS_PATH,
      'account_connections',
      'Manage the MaxVideoAI connection',
    ),
    billing: destination(origin, '/billing', 'billing', 'Add MaxVideoAI credits'),
    library: destination(
      origin,
      '/app/library',
      'media_library',
      'Open the MaxVideoAI media library',
    ),
    videoWorkspace: destination(
      origin,
      '/app',
      'video_workspace',
      'Open the MaxVideoAI video workspace',
    ),
    imageWorkspace: destination(
      origin,
      '/app/image',
      'image_workspace',
      'Open the MaxVideoAI image workspace',
    ),
    support: destination(origin, '/contact', 'support', 'Contact MaxVideoAI support'),
  };
}

export function buildAgentGenerationDestination(
  accountUrl: string,
  surface: 'video' | 'image',
  jobId: string,
): AgentOpenUrlDestination {
  if (
    typeof jobId !== 'string'
    || jobId.length < 1
    || jobId.length > MAX_JOB_ID_CHARS
    || jobId !== jobId.trim()
  ) {
    throw new Error('Expected a valid owned job ID.');
  }

  const trusted = parseTrustedAccountUrl(accountUrl);
  const url = new URL(surface === 'image' ? '/app/image' : '/app', trusted.origin);
  url.searchParams.set('job', jobId);
  return {
    type: 'open_url',
    purpose: 'generation',
    label: `Open this ${surface} in MaxVideoAI`,
    url: url.toString(),
  };
}
