// Client identity is self-reported protocol metadata, never an authorization signal.
// Persist only a coarse family; discard the raw client name and version.
export function classifyMcpClient(body: unknown): 'chatgpt' | 'claude' | 'codex' | 'other' {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'other';
  const params = (body as { params?: { clientInfo?: { name?: unknown } } }).params;
  const name = params?.clientInfo?.name;
  if (typeof name !== 'string' || name.length > 128) return 'other';
  const normalized = name.trim().toLowerCase();
  if (/^(codex|openai[-_ ]codex)(?:[-_ /]|$)/u.test(normalized)) return 'codex';
  if (/^(chatgpt|openai[-_ ]chatgpt)(?:[-_ /]|$)/u.test(normalized)) return 'chatgpt';
  if (/^claude(?:[-_ /]|$)/u.test(normalized)) return 'claude';
  return 'other';
}
