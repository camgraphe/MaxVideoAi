import { AgentApiError } from '@/server/agent-api/errors';

export async function readBoundedJsonBody(request: Request, limit: number): Promise<unknown> {
  const tooLarge = () => new AgentApiError('PARAMETER_INVALID', 'The request is too large.');
  if (Number(request.headers.get('content-length')) > limit) throw tooLarge();
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError('Missing body');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw tooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
