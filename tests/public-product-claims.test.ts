import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const locales = ['en', 'fr', 'es'] as const;
const docsPaths = [
  'content/docs/get-started.mdx',
  'content/docs/brand-safety.mdx',
  'content/fr/docs/get-started.mdx',
  'content/fr/docs/brand-safety.mdx',
  'content/es/docs/get-started.mdx',
  'content/es/docs/brand-safety.mdx',
] as const;

const privateMessageNamespaces = new Set([
  'auth',
  'cookieBanner',
  'nav',
  'notFound',
  'systemMessages',
  'workspace',
]);

type PublicCopy = {
  source: string;
  value: string;
};

function collectStrings(value: unknown, source: string, result: PublicCopy[]): void {
  if (typeof value === 'string') {
    result.push({ source, value });
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectStrings(item, `${source}.${index}`, result));
    return;
  }

  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => collectStrings(item, `${source}.${key}`, result));
  }
}

function loadIndexableCopy(): PublicCopy[] {
  const copy = docsPaths.map((path) => ({ source: path, value: readFileSync(path, 'utf8') }));

  for (const locale of locales) {
    const messages = JSON.parse(readFileSync(`frontend/messages/${locale}.json`, 'utf8')) as Record<
      string,
      unknown
    >;

    for (const [namespace, value] of Object.entries(messages)) {
      if (!privateMessageNamespaces.has(namespace)) {
        collectStrings(value, `frontend/messages/${locale}.json:${namespace}`, copy);
      }
    }
  }

  return copy;
}

const prohibitedAssertions = [
  {
    claim: 'public API credentials',
    pattern: /request credentials|demandez des identifiants|solicita credenciales/i,
  },
  {
    claim: 'webhook callbacks',
    pattern: /webhooks?|callbacks? webhook/i,
  },
  {
    claim: 'public SDK examples',
    pattern: /\bSDK\b/i,
  },
  {
    claim: 'live team-role configuration',
    pattern: /configure roles|configurer les rôles|configurar roles/i,
  },
  {
    claim: 'invoice or wire funding',
    pattern:
      /\bwire\b|\bvirement\b|\btransferencia\b|invoice billing|process invoices|facturation européenne|facturación europea|\bfacturas?\b/i,
  },
  {
    claim: 'white-label documentation',
    pattern: /white[- ]label docs|documentation white[- ]label/i,
  },
  {
    claim: 'live integration guides',
    pattern:
      /deeper integration guides live|guides d’intégration plus approfondis se trouvent|guías de integración más detalladas están/i,
  },
  {
    claim: 'guaranteed refund timing',
    pattern:
      /refunded within minutes|credited within minutes|processed automatically within minutes|en quelques minutes|en cuestión de minutos|reembols(?:a|an|os).*en minutos|acreditada en minutos/i,
  },
] as const;

test('indexable docs and messages contain no unsupported live-product assertions', () => {
  const copy = loadIndexableCopy();
  const violations: string[] = [];

  for (const { claim, pattern } of prohibitedAssertions) {
    for (const entry of copy) {
      if (pattern.test(entry.value)) {
        violations.push(`${claim}: ${entry.source}`);
      }
    }
  }

  const sharedWalletPattern = /shared wallets?|wallets? partagés?|portefeuilles? partagés?|billeteras? compartidas?/i;
  const nonLivePattern =
    /coming soon|roll out next|private beta|planned|arrivent bientôt|bêta privée|prévu|próximamente|beta privada|previst/i;

  for (const entry of copy) {
    if (sharedWalletPattern.test(entry.value) && !nonLivePattern.test(entry.value)) {
      violations.push(`shared wallets presented without a non-live label: ${entry.source}`);
    }
  }

  assert.deepEqual(violations, []);
});

test('the public claims matrix covers every required acquisition claim family', () => {
  const matrixPath = 'docs/marketing/mcp-public-claims-matrix.md';
  assert.equal(existsSync(matrixPath), true, 'public claims matrix must exist');

  const matrix = readFileSync(matrixPath, 'utf8');
  assert.match(
    matrix,
    /\| Claim \| Source of truth \| Live flag \| Evidence URL\/test \| Allowed wording \| Prohibited wording \| Owner \|/
  );

  for (const claimFamily of [
    'MCP',
    'OAuth',
    'Trial',
    'Model',
    'Pricing',
    'Reference',
    'Privacy',
    'Client compatibility',
  ]) {
    assert.match(matrix, new RegExp(`\\| ${claimFamily}[^|]*\\|`, 'i'), `${claimFamily} claim row is required`);
  }
});
