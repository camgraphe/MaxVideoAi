export function normalizeObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function findFileUrl(value: unknown, kind: 'audio' | 'video'): string | null {
  const queue: unknown[] = [value];
  const seen = new Set<unknown>();
  const extensionPattern =
    kind === 'audio'
      ? /\.(wav|mp3|m4a|aac|ogg|flac)(\?|$)/i
      : /\.(mp4|mov|webm|m4v)(\?|$)/i;

  while (queue.length) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);

    if (typeof current === 'string') {
      if (/^https?:\/\//i.test(current) && extensionPattern.test(current)) {
        return current;
      }
      continue;
    }

    if (Array.isArray(current)) {
      current.forEach((entry) => queue.push(entry));
      continue;
    }

    if (typeof current !== 'object') continue;
    const record = current as Record<string, unknown>;
    const keyed =
      kind === 'audio'
        ? [record.audio, record.audio_url, record.audioUrl]
        : [record.video, record.video_url, record.videoUrl];
    for (const candidate of keyed) {
      if (typeof candidate === 'string' && /^https?:\/\//i.test(candidate)) {
        return candidate;
      }
      const nested = normalizeObject(candidate);
      if (nested && typeof nested.url === 'string' && /^https?:\/\//i.test(nested.url)) {
        return nested.url;
      }
    }

    for (const entry of Object.values(record)) {
      queue.push(entry);
    }
  }

  return null;
}

export function findCustomVoiceId(value: unknown): string | null {
  const queue: unknown[] = [value];
  const seen = new Set<unknown>();

  while (queue.length) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    if (Array.isArray(current)) {
      current.forEach((entry) => queue.push(entry));
      continue;
    }
    const record = normalizeObject(current);
    if (!record) continue;
    const customVoiceId = record.custom_voice_id;
    if (typeof customVoiceId === 'string' && customVoiceId.trim().length) {
      return customVoiceId.trim();
    }
    const voiceId = record.voice_id;
    if (typeof voiceId === 'string' && voiceId.trim().length) {
      return voiceId.trim();
    }
    Object.values(record).forEach((entry) => queue.push(entry));
  }

  return null;
}
