export const MCP_X_ROBOTS_TAG = 'noindex, nofollow';

export function withMcpNoindexHeaders(headers?: HeadersInit): Headers {
  const result = new Headers(headers);
  result.set('X-Robots-Tag', MCP_X_ROBOTS_TAG);
  result.set('X-Content-Type-Options', 'nosniff');
  return result;
}
