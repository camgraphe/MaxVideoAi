// Public package content guards shared by all distribution builders.
const WHOLE_SOURCE_FORBIDDEN_CONTENT = [
  {
    label: 'staging or preview origin',
    pattern: /https?:\/\/[^\s<>"')]*(?:staging|preview|\.vercel\.app)[^\s<>"')]*/i,
  },
  { label: 'private key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { label: 'GitHub token', pattern: /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}\b/ },
  { label: 'OpenAI secret', pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { label: 'Stripe live secret', pattern: /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/ },
  { label: 'AWS access key', pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/ },
  { label: 'Google API key', pattern: /\bAIza[A-Za-z0-9_-]{35}\b/ },
  { label: 'Slack token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  {
    label: 'assigned secret',
    pattern:
      /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password|secret)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{8,}/i,
  },
];
const EXPORTED_FORBIDDEN_CONTENT = [
  {
    label: 'local absolute path',
    pattern:
      /(?:^|[\s("'`])(?:\/(?:Users|home|root|tmp|private|workspace|etc|opt|srv|mnt|var\/folders)\/[^\s)"'`]+|[A-Za-z]:[\\/][^\s)"'`]+)/m,
  },
  {
    label: 'internal UUID',
    pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
  },
  {
    label: 'internal job or evidence identifier',
    pattern: /\b(?:job|evidence|generation|request|operation)[_-][A-Za-z0-9][A-Za-z0-9_-]{7,}\b/i,
  },
];

function fail(message) {
  throw new Error(`Plugin release rejected: ${message}`);
}

function decodeText(name, contents) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(contents);
  } catch {
    fail(`invalid UTF-8 text found at ${name}`);
  }
}

export function inspectPluginText(name, contents, exported) {
  const text = decodeText(name, contents);
  for (const rule of WHOLE_SOURCE_FORBIDDEN_CONTENT) {
    if (rule.pattern.test(text)) {
      fail(`${rule.label} found at ${name}`);
    }
  }
  if (exported) {
    for (const rule of EXPORTED_FORBIDDEN_CONTENT) {
      if (rule.pattern.test(text)) fail(`${rule.label} found at ${name}`);
    }
  }
  return text;
}
