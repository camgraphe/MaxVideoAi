export const MCP_X_ROBOTS_TAG = 'noindex, nofollow';
const MCP_STAGING_X_ROBOTS_TAG = 'noindex, nofollow, noarchive';

export function withMcpNoindexHeaders(headers?: HeadersInit): Headers {
  const result = new Headers(headers);
  result.set(
    'X-Robots-Tag',
    process.env.MCP_STAGING_ENABLED === 'true' ? MCP_STAGING_X_ROBOTS_TAG : MCP_X_ROBOTS_TAG,
  );
  result.set('X-Content-Type-Options', 'nosniff');
  return result;
}
