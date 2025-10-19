const webhookUrl = (process.env.SLACK_WEBHOOK_URL ?? '').trim();

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    if (value.length > 120) return `${value.slice(0, 117)}…`;
    return value;
  }
  if (value && typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.slice(0, 10).map((entry) => sanitizeValue(entry));
    }
    const record = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(record)) {
      if (key.toLowerCase().includes('token') || key.toLowerCase().includes('secret') || key.toLowerCase().includes('password')) {
        result[key] = '[redacted]';
      } else {
        result[key] = sanitizeValue(entry);
      }
    }
    return result;
  }
  return value;
}

export async function postSlackMessage(summary: string, meta?: Record<string, unknown>): Promise<void> {
  if (!webhookUrl) return;

  const payload =
    meta && Object.keys(meta).length
      ? `${summary}\n\`\`\`${JSON.stringify(sanitizeValue(meta), null, 2)}\`\`\``
      : summary;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: payload }),
    });
  } catch (error) {
    console.warn('[slack] Failed to post message', error instanceof Error ? error.message : error);
  }
}
