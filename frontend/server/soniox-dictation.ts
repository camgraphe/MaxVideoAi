import { createHash } from 'node:crypto';
import { query } from '@/lib/db';

export const DICTATION_SESSION_SECONDS = 300;
export const SONIOX_DICTATION_REFERENCE_PREFIX = 'maxvideoai-dictation:';

export function sonioxApiUrl(path: '/v1/auth/temporary-api-key' | '/v1/usage-logs', region?: string) {
  if (region && !['us', 'eu', 'jp', 'in'].includes(region)) throw new Error('Invalid Soniox region');
  const domain = !region || region === 'us' ? 'soniox.com' : region + '.soniox.com';
  return new URL(path, 'https://api.' + domain);
}

export async function reserveDictationSession(userId: string, runQuery = query) {
  // An atomic upsert applies the hourly budget across tabs and server instances.
  const rows = await runQuery<{ sessions: number }>(`
    INSERT INTO dictation_session_windows (user_id, window_start, sessions)
    VALUES ($1, date_trunc('hour', now()), 1)
    ON CONFLICT (user_id) DO UPDATE SET
      window_start = EXCLUDED.window_start,
      sessions = CASE WHEN dictation_session_windows.window_start < EXCLUDED.window_start
                      THEN 1 ELSE dictation_session_windows.sessions + 1 END
    WHERE dictation_session_windows.window_start < EXCLUDED.window_start
       OR (dictation_session_windows.window_start = EXCLUDED.window_start AND dictation_session_windows.sessions < 30)
    RETURNING sessions`, [userId]);
  return rows.length > 0;
}

export async function issueDictationKey(apiKey: string, region: string | undefined, userId: string, signal: AbortSignal) {
  const accountDigest = createHash('sha256').update(SONIOX_DICTATION_REFERENCE_PREFIX + userId).digest('hex');
  const response = await fetch(sonioxApiUrl('/v1/auth/temporary-api-key', region).href, {
    method: 'POST', cache: 'no-store', signal,
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      usage_type: 'transcribe_websocket', expires_in_seconds: 60,
      single_use: true, max_session_duration_seconds: DICTATION_SESSION_SECONDS,
      client_reference_id: SONIOX_DICTATION_REFERENCE_PREFIX + accountDigest,
    }),
  });
  if (!response.ok) throw new Error('Soniox temporarily unavailable: HTTP ' + response.status);
  const { api_key } = await response.json();
  if (typeof api_key !== 'string' || !api_key || api_key === apiKey) throw new Error('Invalid Soniox temporary key');
  return { api_key, region: region === 'us' ? undefined : region };
}
