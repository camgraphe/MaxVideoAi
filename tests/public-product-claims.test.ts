import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const locales = ['en', 'fr', 'es'] as const;
const docsDirectories = [
  'content/docs',
  'content/fr/docs',
  'content/es/docs',
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

function discoverDocsPaths(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = `${directory}/${entry.name}`;

      if (entry.isDirectory()) {
        return discoverDocsPaths(entryPath);
      }

      return entry.isFile() && /\.mdx?$/i.test(entry.name) ? [entryPath] : [];
    })
    .sort();
}

function loadDocsClaimBlocks(path: string): PublicCopy[] {
  return readFileSync(path, 'utf8')
    .split(/\r?\n\s*\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value, index) => ({ source: `${path}#block-${index + 1}`, value }));
}

function loadIndexableCopy(): PublicCopy[] {
  const copy = docsDirectories
    .flatMap((directory) => discoverDocsPaths(directory))
    .flatMap((path) => loadDocsClaimBlocks(path));

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
      /refunded within minutes|credited within minutes|processed automatically within minutes|refund[^.]*\b(?:within|under|in)\s+\d+\s+(?:seconds?|minutes?)|en quelques minutes|rembours[^.]*\b(?:moins de|dans)\s+\d+\s+(?:secondes?|minutes?)|en cuestión de minutos|reembols(?:a|an|os).*en minutos|reembols[^.]*\b(?:menos de|en)\s+\d+\s+(?:segundos?|minutos?)|acreditada en minutos/i,
  },
  {
    claim: 'hard-coded public prices',
    pattern:
      /(?:[$€£]\s*\d+(?:[.,]\d+)?|(?:USD|EUR|GBP)\s*\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?[\s\u00a0]*(?:(?:US)?[$€£]|USD|EUR|GBP))/i,
  },
  {
    claim: 'unsupported auto-top-up promise',
    pattern: /auto[ -]?top[ -]?up|recharge automatique|recarga automática/i,
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

test('the refund timing rule rejects numeric seconds and minutes in every public locale', () => {
  const refundTimingRule = prohibitedAssertions.find(
    ({ claim }) => claim === 'guaranteed refund timing'
  );
  assert.ok(refundTimingRule);

  for (const unsupportedClaim of [
    'Refunds are processed within 90 seconds.',
    'Refunds are processed within 5 minutes.',
    'Les remboursements sont traités dans 90 secondes.',
    'Les remboursements sont traités dans 5 minutes.',
    'Los reembolsos se procesan en 90 segundos.',
    'Los reembolsos se procesan en 5 minutos.',
  ]) {
    assert.match(unsupportedClaim, refundTimingRule.pattern);
  }
});

test('the public price rule catches localized currency claims without matching ordinary numbers', () => {
  const publicPriceRule = prohibitedAssertions.find(({ claim }) => claim === 'hard-coded public prices');
  assert.ok(publicPriceRule);

  for (const unsupportedClaim of [
    'Load $10 to start.',
    'Starting at USD 1.25.',
    'Prix dès 0,65 $.',
    'Precio desde 0,65 US$.',
  ]) {
    assert.match(unsupportedClaim, publicPriceRule.pattern);
  }

  for (const legitimateNumber of [
    'Generate a 10s video.',
    'Export at 1080p.',
    '3,000+ internal test renders.',
    'Save 10% with an eligible tier.',
    'Compare Model 2.0.',
  ]) {
    assert.doesNotMatch(legitimateNumber, publicPriceRule.pattern);
  }
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

test('the claims contract discovers localized docs instead of hard-coding filenames', () => {
  const source = readFileSync('tests/public-product-claims.test.ts', 'utf8');
  const hardCodedListPattern = new RegExp(['const', 'docsPaths'].join('\\s+'));
  const directoryDiscoveryPattern = new RegExp(['readdir', 'Sync'].join(''));

  assert.doesNotMatch(source, hardCodedListPattern);
  assert.match(source, directoryDiscoveryPattern);
});

test('localized MDX copy is evaluated as claim-local blocks', () => {
  const docsCopy = loadIndexableCopy().filter((entry) => entry.source.startsWith('content/'));
  const sourceFiles = new Set(docsCopy.map((entry) => entry.source.split('#')[0]));

  assert.ok(docsCopy.length > sourceFiles.size, 'each docs file should produce multiple claim blocks');
  for (const entry of docsCopy) {
    assert.doesNotMatch(entry.value, /\r?\n\s*\r?\n/, `${entry.source} should contain one local claim block`);
  }
});
