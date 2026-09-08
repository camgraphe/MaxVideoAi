import assert from 'node:assert/strict';
import { request } from 'node:http';

/** Real HTTP to the owned IPv4 child; the localhost authority matches NextURL rewrites. */
export function postStudioMcpRequest(
  runtime: { origin: string; mcpHost: string },
  body: unknown,
  credentials: { token?: string; cookie?: string } = {},
): Promise<Response> {
  const endpoint = new URL('/mcp', runtime.origin);
  assert.equal(endpoint.protocol, 'http:');
  assert.equal(endpoint.hostname, '127.0.0.1');
  assert.notEqual(endpoint.port, '3026');
  assert.equal(runtime.mcpHost, `localhost:${endpoint.port}`);
  return new Promise((resolve, reject) => {
    const outgoing = request(endpoint, { method: 'POST', headers: {
      Host: runtime.mcpHost, Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json',
      ...(credentials.token ? { Authorization: `Bearer ${credentials.token}` } : {}),
      ...(credentials.cookie ? { Cookie: credentials.cookie } : {}),
    } }, (incoming) => {
      const chunks: Buffer[] = [];
      let size = 0;
      incoming.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > 1024 * 1024) outgoing.destroy(new Error('MCP fixture response exceeds 1 MiB.'));
        else chunks.push(chunk);
      });
      incoming.once('error', reject);
      incoming.once('end', () => {
        const headers = new Headers();
        for (const [key, value] of Object.entries(incoming.headers)) {
          for (const item of Array.isArray(value) ? value : value ? [value] : []) headers.append(key, item);
        }
        resolve(new Response(Buffer.concat(chunks), { status: incoming.statusCode ?? 500, headers }));
      });
    });
    outgoing.setTimeout(30_000, () => outgoing.destroy(new Error('Owned MCP fixture request timed out.')));
    outgoing.once('error', reject);
    outgoing.end(JSON.stringify(body));
  });
}

export async function readStudioMcpResponse(response: Response) {
  assert.equal(response.status, 200, (await response.clone().text()).slice(0, 1000));
  assert.equal(response.headers.get('cache-control'), 'private, no-store, no-transform');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.match(response.headers.get('content-type') ?? '', /^text\/event-stream/);
  const data = (await response.text()).split(/\r?\n/).filter((line) => line.startsWith('data:'));
  assert.equal(data.length, 1);
  return JSON.parse(data[0].slice(5));
}
