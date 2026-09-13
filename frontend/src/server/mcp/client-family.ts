// Client identity is self-reported protocol metadata, never an authorization signal.
// Persist only a coarse family; discard the raw client name and version.
export const MCP_CLIENT_FAMILIES = [
  'chatgpt',
  'claude',
  'codex',
  'openclaw',
  'n8n',
  'cursor',
  'githubCopilot',
  'geminiCli',
  'microsoftCopilot',
  'other',
] as const;

export type McpClientFamily = (typeof MCP_CLIENT_FAMILIES)[number];

export function classifyMcpClient(body: unknown): McpClientFamily {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'other';
  const params = (body as { params?: { clientInfo?: { name?: unknown } } }).params;
  const name = params?.clientInfo?.name;
  if (typeof name !== 'string' || name.length > 128) return 'other';
  const normalized = name.trim().toLowerCase();
  if (/^(codex|openai[-_ ]codex)(?:[-_ /]|$)/u.test(normalized)) return 'codex';
  if (/^(chatgpt|openai[-_ ]chatgpt)(?:[-_ /]|$)/u.test(normalized)) return 'chatgpt';
  if (/^claude(?:[-_ /]|$)/u.test(normalized)) return 'claude';
  if (/^(?:openclaw|open[-_ ]claw)(?:[-_ /]|$)/u.test(normalized)) return 'openclaw';
  if (/^n8n(?:[-_ /]|$)/u.test(normalized)) return 'n8n';
  if (/^cursor(?:[-_ /]|$)/u.test(normalized)) return 'cursor';
  if (/^(?:github[-_ ]copilot|copilot[-_ ]cli)(?:[-_ /]|$)/u.test(normalized)) return 'githubCopilot';
  if (/^(?:gemini(?:[-_ ]cli)?|google[-_ ]gemini[-_ ]cli)(?:[-_ /]|$)/u.test(normalized)) return 'geminiCli';
  if (/^(?:microsoft[-_ ]copilot|copilot[-_ ]studio|microsoft[-_ ]agents)(?:[-_ /]|$)/u.test(normalized)) return 'microsoftCopilot';
  return 'other';
}
