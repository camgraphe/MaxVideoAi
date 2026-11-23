import { z } from 'zod';
import { SONIOX_DICTATION_REFERENCE_PREFIX, sonioxApiUrl } from './soniox-dictation';

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const usageCount = z.number().int().nonnegative().safe();
const usagePage = z.object({
  usage_logs: z.array(z.object({
    uuid: z.string().min(1),
    request_scope: z.string(),
    model: z.string(),
    client_reference_id: z.string().nullish(),
    input_audio_duration_ms: usageCount,
    input_audio_tokens: usageCount,
    input_text_tokens: usageCount,
    output_text_tokens: usageCount,
    cost_usd: z.string().regex(/^\d+(?:\.\d+)?$/).transform(Number).pipe(z.number().finite()),
  })),
  next_page_cursor: z.string().min(1).nullish(),
});

export async function loadSonioxDictationUsage({
  apiKey,
  region,
  now = new Date(),
}: {
  apiKey?: string;
  region?: string;
  now?: Date;
}) {
  const key = apiKey?.trim();
  if (!key) return { status: 'not-configured' } as const;

  try {
    const url = sonioxApiUrl('/v1/usage-logs', region?.trim());
    url.searchParams.set('start_time', new Date(now.getTime() - WINDOW_MS).toISOString());
    url.searchParams.set('end_time', now.toISOString());

    const signal = AbortSignal.timeout(5000);
    const accounts = new Set<string>();
    const sessions = new Set<string>();
    const cursors = new Set<string>();
    const totals = {
      audioMs: 0,
      inputAudioTokens: 0,
      inputTextTokens: 0,
      outputTextTokens: 0,
      costUsd: 0,
    };

    while (true) {
      const response = await fetch(url, {
        cache: 'no-store',
        redirect: 'error',
        headers: { Authorization: 'Bearer ' + key },
        signal,
      });
      if (response.status === 401 || response.status === 403) return { status: 'access-denied' } as const;
      if (!response.ok) return { status: 'unavailable' } as const;

      const page = usagePage.parse(await response.json());
      for (const log of page.usage_logs) {
        const account = log.client_reference_id;
        if (!account?.startsWith(SONIOX_DICTATION_REFERENCE_PREFIX) || log.request_scope !== 'api' ||
            !log.model.startsWith('stt-rt-') || sessions.has(log.uuid)) continue;

        accounts.add(account);
        sessions.add(log.uuid);
        totals.audioMs += log.input_audio_duration_ms;
        totals.inputAudioTokens += log.input_audio_tokens;
        totals.inputTextTokens += log.input_text_tokens;
        totals.outputTextTokens += log.output_text_tokens;
        totals.costUsd += log.cost_usd;
      }

      const cursor = page.next_page_cursor;
      if (!cursor) {
        return { status: 'ready', accounts: accounts.size, sessions: sessions.size, ...totals } as const;
      }
      if (cursors.has(cursor)) return { status: 'unavailable' } as const;
      cursors.add(cursor);
      url.searchParams.set('cursor', cursor);
    }
  } catch {
    return { status: 'unavailable' } as const;
  }
}
