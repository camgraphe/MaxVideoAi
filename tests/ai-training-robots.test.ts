import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import robotsParser from 'robots-parser';
import { buildRobotsText } from '../frontend/lib/seo/robots-text.ts';

const origin = 'https://maxvideoai.com';
const agents = ['GPTBot', 'ClaudeBot'];
const publicExamples = ['/', '/fr', '/es', '/models/wan-3-prime', '/fr/modeles/wan-3-prime', '/es/modelos/wan-3-prime', '/ai-video-engines/gemini-omni-flash-vs-veo-3-1', '/fr/comparatif', '/es/comparativa', '/docs/mcp', '/mcp', '/integrations/claude', '/pricing', '/examples', '/tools/video-background-changer', '/studio', '/llms.txt'];
const privateExamples = ['/app', '/app/library', '/fr/app', '/es/app', '/api', '/api/engines', '/api/legal/cookies/version', '/oauth', '/oauth/authorize', '/auth/callback', '/login', '/account', '/admin', '/uploads', '/library', '/workspace', '/jobs', '/billing', '/settings', '/connect', '/docs/private', '/docs/private-file', '/fr/docs/private', '/es/docs/private/guide', '/mcp/reference-upload/test-token', '/fr/mcp/reference-upload/test-token', '/es/mcp/reference-upload/test-token', '/s/test-token', '/video/test-private-id', '/v/test-token', '/draft', '/test', '/private/test', '/unknown-public-page', '/tools-private', '/models-private/wan-3-prime', '/docs/mcp-evil', '/pricing-not-public', '/studio/projects/test-private', '/fr/studio/conversation/test-private', '/fr/mcp?next=%2Fapp', '/docs/%6dcp?token=test-private', '/_next/image?url=%2Fapp%2Fprivate.png&w=640&q=75'];

function groupRules(source: string) {
  const result = new Map<string, string[]>();
  let names: string[] = [], rules: string[] = [];
  const flush = () => { for (const name of names) result.set(name, [...rules]); };
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.split('#')[0].trim(); if (!line) continue;
    const split = line.indexOf(':'); if (split < 0) continue;
    const key = line.slice(0, split).trim().toLowerCase(), value = line.slice(split + 1).trim();
    if (key === 'user-agent') { if (rules.length) { flush(); names = []; rules = []; } names.push(value); }
    else if (key === 'allow' || key === 'disallow') rules.push(`${key}:${value}`);
  }
  flush(); return result;
}
const legacyFingerprints = {
  "anthropic-ai": "879443e3e1a02de5e342c9e43caf27e34b82b0d263b10e357507e1eb34a8c9e2",
  "Claude-Web": "879443e3e1a02de5e342c9e43caf27e34b82b0d263b10e357507e1eb34a8c9e2",
  "CCBot": "879443e3e1a02de5e342c9e43caf27e34b82b0d263b10e357507e1eb34a8c9e2",
  "Bytespider": "879443e3e1a02de5e342c9e43caf27e34b82b0d263b10e357507e1eb34a8c9e2",
  "cohere-ai": "879443e3e1a02de5e342c9e43caf27e34b82b0d263b10e357507e1eb34a8c9e2",
  "OAI-SearchBot": "72f75b49193b2d10f35b0cb6e393d4045be3f465f55389c685c68ce73bc6352a",
  "ChatGPT-User": "72f75b49193b2d10f35b0cb6e393d4045be3f465f55389c685c68ce73bc6352a",
  "PerplexityBot": "72f75b49193b2d10f35b0cb6e393d4045be3f465f55389c685c68ce73bc6352a",
  "Perplexity-User": "72f75b49193b2d10f35b0cb6e393d4045be3f465f55389c685c68ce73bc6352a",
  "Claude-User": "72f75b49193b2d10f35b0cb6e393d4045be3f465f55389c685c68ce73bc6352a",
  "Claude-SearchBot": "72f75b49193b2d10f35b0cb6e393d4045be3f465f55389c685c68ce73bc6352a",
  "OAI-AdsBot": "72f75b49193b2d10f35b0cb6e393d4045be3f465f55389c685c68ce73bc6352a",
  "Google-Extended": "72f75b49193b2d10f35b0cb6e393d4045be3f465f55389c685c68ce73bc6352a",
  "*": "c18b496992ba28e578abc7e24a89a2ea5d8366959cbbcf6c073b6cd087ca19a5"
} as const;

test('approved training agents can read the actual public marketing and documentation targets', () => {
  const robots = robotsParser(`${origin}/robots.txt`, buildRobotsText('public'));
  for (const agent of agents) for (const path of publicExamples) assert.equal(robots.isAllowed(origin + path, agent), true, `${agent}: ${path}`);
});

test('training remains closed for private, API, tokened, unknown and false-prefix targets', () => {
  const robots = robotsParser(`${origin}/robots.txt`, buildRobotsText('public'));
  for (const agent of agents) for (const path of privateExamples) assert.equal(robots.isAllowed(origin + path, agent), false, `${agent}: ${path}`);
  for (const agent of agents) for (const path of publicExamples) {
    assert.equal(robots.isAllowed(origin + path + (path === '/' ? '__private-proof__' : '/__private-proof__'), agent), false);
    assert.equal(robots.isAllowed(origin + path + '?token=test-private-token', agent), false);
    assert.equal(robots.isAllowed(origin + path + '?utm_source=unqualified', agent), false);
  }
});

test('all other crawler groups retain their exact approved directives', () => {
  const groups = groupRules(buildRobotsText('public'));
  assert.equal(groups.size, Object.keys(legacyFingerprints).length + agents.length);
  for (const [agent, expected] of Object.entries(legacyFingerprints)) {
    assert.ok(groups.has(agent), agent);
    assert.equal(createHash('sha256').update(groups.get(agent)!.join('\n')).digest('hex'), expected, agent);
  }
});

test('the protocol host still denies every target and keeps its original text', () => {
  const text = buildRobotsText('protocol');
  assert.equal(text, '# MaxVideoAI protocol host\n\nUser-agent: *\nDisallow: /\n');
  const robots = robotsParser('https://api.maxvideoai.com/robots.txt', text);
  for (const agent of [...agents, 'Google-Extended', 'OAI-SearchBot', 'CCBot']) for (const path of [...publicExamples, ...privateExamples]) assert.equal(robots.isAllowed('https://api.maxvideoai.com' + path, agent), false);
});


test('every qualified target is allowed exactly without opening descendants or token parameters', () => {
  const policy = JSON.parse(readFileSync('frontend/config/ai-training-public-policy.json', 'utf8'));
  assert.ok(policy.pageTargets.length > 1000);
  assert.equal(policy.schemaVersion, 1);
  assert.equal(decodeURIComponent(JSON.stringify(policy)).includes('/user-assets/'), false);
  assert.equal(new Set(policy.pageTargets).size, policy.pageTargets.length);
  assert.equal(new Set(policy.renderTargets).size, policy.renderTargets.length);
  assert.equal(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(JSON.stringify(policy)), false);
  const robots = robotsParser(`${origin}/robots.txt`, buildRobotsText('public'));
  for (const agent of agents) {
    for (const target of policy.pageTargets as string[]) {
      assert.equal(robots.isAllowed(origin + target, agent), true, `${agent}: declared ${target}`);
      assert.equal(robots.isAllowed(origin + target + (target.includes('?') ? '&' : '?') + 'token=test-private-token', agent), false);
      if (!target.includes('?')) assert.equal(robots.isAllowed(origin + target + (target === '/' ? '__private-proof__' : '/__private-proof__'), agent), false);
    }
    for (const target of policy.renderTargets as string[]) {
      assert.equal(robots.isAllowed(origin + target, agent), true);
      assert.equal(robots.isAllowed(origin + target + (target.includes('?') ? '&' : '?') + 'token=test-private-token', agent), false);
    }
    assert.equal(robots.isAllowed(origin + '/_next/static/chunks/public-runtime.js', agent), true);
    assert.equal(robots.isAllowed(origin + '/_next/staticevil/private', agent), false);
    assert.equal(robots.isAllowed(origin + '/docs/mcp', agent.toLowerCase() + '/1.0'), true);
  }
  assert.ok(Buffer.byteLength(buildRobotsText('public'), 'utf8') < 500000);
});

test('invalid or private snapshot entries fail closed without creating a proxy or another robots directive', async () => {
  const owner = await import('../frontend/lib/seo/training-crawl-policy.ts').catch(() => null);
  assert.ok(owner, 'the closed training rule owner must exist');
  const invalidPages = ['/docs/private', '/docs/private-file', '/fr/docs/private/test', '/mcp/reference-upload/test-token', '/es/mcp/reference-upload/test-token', '/app', '/models/wan-3-prime?token=test', '/docs/mcp/private', '/models-private/foo', '/docs/%70rivate', '/docs/%2570rivate', '/docs/%2e%2e%2fapi/test-private', '/models/%2e%2e%2foauth/callback', '/docs/mcp\\private', '/docs/mcp\nAllow: /'];
  const invalidResources = ['/api/legal/cookies/version', '/_next/image?url=%2Fapi%2Fprivate&w=640&q=75', '/_next/image?url=%2Fassets%2Fpublic.png&w=640&q=75&token=test', '/_next/image?url=%2Fassets%2Fpublic.png&url=%2Fapp%2Fprivate&w=640&q=75', '/_next/image?url=https%3A%2F%2Fmedia.maxvideoai.com%2Fuser-assets%2F00000000-0000-0000-0000-000000000000%2Fprivate.png&w=640&q=75', '/assets/private/test.png', '/_next/image?url=%2Fassets%2F%252e%252e%252fapi%2Fdata.png&w=640&q=75', '/assets/public.svg\nAllow: /'];
  const rules = owner.buildTrainingPublicRules({ pageTargets: ['/docs/mcp', ...invalidPages], renderTargets: invalidResources });
  const robots = robotsParser(`${origin}/robots.txt`, ['User-agent: GPTBot', ...rules].join('\n'));
  assert.equal(robots.isAllowed(origin + '/docs/mcp', 'GPTBot'), true);
  for (const target of [...invalidPages, ...invalidResources].filter(t => !t.includes('\n') && !t.includes('\\'))) assert.equal(robots.isAllowed(origin + target, 'GPTBot'), false, target);
  assert.ok(!rules.some(rule => rule === 'Allow: /'));
});

test('optimizer sources cannot hide malformed control characters through URL normalization', async () => {
  const { isSafeTrainingRenderTarget } = await import('../frontend/lib/seo/training-crawl-policy.ts');
  assert.equal(isSafeTrainingRenderTarget('/_next/image?url=%2Fassets%2F%0Apublic.png&w=640&q=75'), false);
});

test('owned by-content media remains outside training rendering exceptions even with a pseudonymous owner folder', async () => {
  const { isSafeTrainingRenderTarget } = await import('../frontend/lib/seo/training-crawl-policy.ts');
  const owned = 'https://media.maxvideoai.com/user-assets/by-content/' + '0'.repeat(32) + '/' + 'a'.repeat(64) + '.webp';
  const target = '/_next/image?url=' + encodeURIComponent(owned) + '&w=640&q=75';
  assert.equal(isSafeTrainingRenderTarget(target), false);
});
