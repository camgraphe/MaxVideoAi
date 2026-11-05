import { OpenAIImageError } from './openai-image-error';
import type { OpenAIImagePayload } from './openai-image-payload';
import type { ImageGenerationMode } from '@/types/image-generation';

export const isOpenAIImageConfigured = (env: NodeJS.ProcessEnv = process.env): boolean => Boolean(env.OPENAI_API_KEY?.trim());

export class OpenAIImageClient {
  constructor(private readonly config: { apiKey?: string; fetchFn?: typeof fetch; timeoutMs?: number } = {}) {}
  async generate(mode: ImageGenerationMode, payload: OpenAIImagePayload): Promise<{ body: unknown; requestId: string | null }> {
    const apiKey = this.config.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey?.trim()) throw new OpenAIImageError('OpenAI image generation is unavailable.', { status: 503, code: 'OPENAI_IMAGE_UNAVAILABLE' });
    const body = JSON.stringify(payload);
    const headers = new Headers({ Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' });
    let requestId: string | null = null;
    // A quote covers one POST. Neither an error response nor an unreadable
    // acknowledgment authorizes retrying a possibly accepted paid request.
    try {
      const response = await (this.config.fetchFn ?? fetch)(`https://api.openai.com/v1/images/${mode === 'i2i' ? 'edits' : 'generations'}`, {
        method: 'POST', redirect: 'error', headers, body, signal: AbortSignal.timeout(this.config.timeoutMs ?? 240_000),
      });
      const rawId = response.headers.get('x-request-id');
      requestId = rawId && /^[a-zA-Z0-9_-]{1,200}$/u.test(rawId) ? rawId : null;
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new OpenAIImageError(`OpenAI rejected the image request (${response.status}).`, { status: response.status, code: 'OPENAI_IMAGE_HTTP_ERROR', requestId,
          submissionState: response.status >= 400 && response.status < 500 ? 'definitive' : 'uncertain' });
      }
      const json: unknown = await response.json();
      if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('Invalid response');
      return { body: json, requestId };
    } catch (error) {
      if (error instanceof OpenAIImageError) throw error;
      throw new OpenAIImageError('The OpenAI image request outcome could not be confirmed.', { code: 'OPENAI_IMAGE_OUTCOME_UNCERTAIN', submissionState: 'uncertain', requestId });
    }
  }
}
