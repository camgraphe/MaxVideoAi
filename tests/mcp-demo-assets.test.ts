import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines';
import { computeCanonicalPublicSnapshot } from '../frontend/server/pricing/quote-public';

const provenancePath = 'docs/marketing/mcp-asset-provenance.md';
const evidencePath = 'docs/marketing/mcp-demo-evidence.md';
const proofPath = 'frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-proof.ts';
const capturePaths = [
  'frontend/public/mcp/mcp-brief.webp',
  'frontend/public/mcp/mcp-reference.webp',
  'frontend/public/mcp/mcp-quote.webp',
] as const;
const resultVideoPath = 'frontend/public/mcp/mcp-result.mp4';
const resultPosterPath = 'frontend/public/mcp/mcp-result-poster.webp';

type AssetProvenanceRecord = {
  path: string;
  officialOwner: string;
  origin: string;
  sourceUrl: string;
  sourceArchivePath: string | null;
  retrievedAt: string;
  usageNote: string;
  sha256: string;
};

type AssetProvenanceManifest = {
  version: number;
  assets: AssetProvenanceRecord[];
};

type DemoEvidenceManifest = {
  version: number;
  publicationStatus: string;
  proofLabel: string;
  mcpGenerationVerified: boolean;
  captureAssets: Record<'brief' | 'reference' | 'quote', string>;
  result: {
    engineId: string;
    durationSeconds: number;
    aspectRatio: string;
    resolution: string;
    sourceMode: string | null;
    historicalAmountCents: number | null;
    historicalCurrency: string | null;
    originalJobId: string | null;
    internalAuditId: string | null;
  };
};

function sha256(path: string) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function readMarkedJson<T>(path: string, marker: string): T {
  assert.equal(existsSync(path), true, `${path} should exist`);
  const source = readFileSync(path, 'utf8');
  const fence = '`'.repeat(3);
  const match = source.match(new RegExp(`<!-- ${marker} -->\\s*${fence}json\\s*([\\s\\S]*?)\\s*${fence}`));
  assert.ok(match, `${path} should contain the ${marker} JSON manifest`);
  return JSON.parse(match[1]) as T;
}

function validateOfficialClaudeSource(record: AssetProvenanceRecord) {
  assert.equal(record.officialOwner, 'Anthropic PBC');
  assert.equal(record.origin, 'official-anthropic-press-kit');
  assert.match(record.sourceArchivePath ?? '', /Claude Spark - Clay\.svg$/);
  assert.match(record.retrievedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(record.usageNote.trim().length >= 20, 'Claude usage note should be meaningful');
  assert.match(record.sha256, /^[a-f0-9]{64}$/);

  const source = new URL(record.sourceUrl);
  assert.equal(source.protocol, 'https:');
  assert.equal(
    source.hostname === 'anthropic.com' || source.hostname.endsWith('.anthropic.com'),
    true,
    `Claude source host ${source.hostname} is not Anthropic-owned`
  );
  assert.doesNotMatch(`${record.origin} ${record.sourceUrl} ${record.usageNote}`, /imagegen|hand[ -]?craft|synthe(?:tic|sized)|unknown cdn/i);
}

function probe(path: string) {
  const result = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration,size:format_tags:stream=codec_name,codec_type,width,height', '-of', 'json', path],
    { encoding: 'utf8' }
  );
  assert.equal(result.status, 0, `${path} should be readable by ffprobe\n${result.stderr}`);
  return JSON.parse(result.stdout) as {
    streams: Array<{ codec_name?: string; codec_type?: string; width?: number; height?: number; tags?: Record<string, string> }>;
    format: { duration?: string; size?: string; tags?: Record<string, string> };
  };
}

test('official Claude and OpenAI marks are non-empty and provenance hashes match', () => {
  const manifest = readMarkedJson<AssetProvenanceManifest>(provenancePath, 'mcp-asset-provenance:v1');
  assert.equal(manifest.version, 1);

  const markPaths = [
    'frontend/public/brand/partners/anthropic/claude-mark-light.svg',
    'frontend/public/brand/partners/anthropic/claude-mark-dark.svg',
    'frontend/public/brand/partners/openai/openai-mark-light.svg',
    'frontend/public/brand/partners/openai/openai-mark-dark.svg',
  ];

  for (const path of markPaths) {
    assert.equal(existsSync(path), true, `${path} should exist`);
    assert.ok(statSync(path).size > 100, `${path} should not be empty`);
    assert.match(readFileSync(path, 'utf8'), /^<svg\b/);
    const record = manifest.assets.find((candidate) => candidate.path === path);
    assert.ok(record, `${path} should have a provenance record`);
    assert.match(record.sourceUrl, /^https:\/\//);
    assert.match(record.retrievedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(record.usageNote.trim().length >= 20, `${path} should have a usage note`);
    assert.equal(record.sha256, sha256(path), `${path} provenance SHA-256 should match its bytes`);
  }

  const claudeRecords = markPaths
    .filter((path) => path.includes('/anthropic/'))
    .map((path) => manifest.assets.find((record) => record.path === path)!);
  claudeRecords.forEach(validateOfficialClaudeSource);
  assert.equal(claudeRecords[0].sha256, claudeRecords[1].sha256, 'one official Claude mark should be reused unchanged in both themes');
});

test('Claude provenance validation rejects ImageGen, handcrafted SVGs, and unknown CDNs', () => {
  const valid: AssetProvenanceRecord = {
    path: 'frontend/public/brand/partners/anthropic/claude-mark-light.svg',
    officialOwner: 'Anthropic PBC',
    origin: 'official-anthropic-press-kit',
    sourceUrl: 'https://www.anthropic.com/press-kit',
    sourceArchivePath: 'Anthropic media resources/Anthropic logos/Claude logos/3 Claude Spark/SVG/Claude Spark - Clay.svg',
    retrievedAt: '2026-07-14',
    usageNote: 'Use unchanged on one neutral, theme-safe tile.',
    sha256: 'a'.repeat(64),
  };

  assert.throws(() => validateOfficialClaudeSource({ ...valid, origin: 'ImageGen' }), /official-anthropic-press-kit/);
  assert.throws(
    () => validateOfficialClaudeSource({ ...valid, origin: 'handcrafted-svg' }),
    /official-anthropic-press-kit/
  );
  assert.throws(
    () => validateOfficialClaudeSource({ ...valid, sourceUrl: 'https://assets.example-cdn.invalid/claude.svg' }),
    /not Anthropic-owned/
  );
});

test('unverified brief, reference, and quote captures remain gated instead of fabricated', () => {
  const manifest = readMarkedJson<DemoEvidenceManifest>(evidencePath, 'mcp-demo-evidence:v1');
  assert.equal(manifest.publicationStatus, 'gated');
  assert.equal(manifest.mcpGenerationVerified, false);
  assert.deepEqual(manifest.captureAssets, {
    brief: 'withheld-unverified',
    reference: 'withheld-unverified',
    quote: 'withheld-unverified',
  });
  capturePaths.forEach((path) => assert.equal(existsSync(path), false, `${path} must stay absent until real evidence exists`));

  const evidence = readFileSync(evidencePath, 'utf8');
  assert.doesNotMatch(evidence, /Generated through MCP/i);
  assert.doesNotMatch(evidence, /(?:access|refresh|api)[_-]?token|secret|password|account[_ -]?id|private url/i);
});

test('the fallback result is a small muted 720p MP4 with a metadata-sanitized poster', () => {
  assert.equal(existsSync(resultVideoPath), true, `${resultVideoPath} should exist`);
  assert.equal(existsSync(resultPosterPath), true, `${resultPosterPath} should exist`);

  const video = probe(resultVideoPath);
  const videoStream = video.streams.find((stream) => stream.codec_type === 'video');
  assert.equal(videoStream?.codec_name, 'h264');
  assert.equal(videoStream?.width, 1280);
  assert.equal(videoStream?.height, 720);
  assert.equal(video.streams.some((stream) => stream.codec_type === 'audio'), false, 'proof video should be muted');
  assert.ok(Math.abs(Number(video.format.duration) - 8) < 0.05, 'proof video should stay eight seconds');
  assert.ok(Number(video.format.size) <= 2_000_000, 'proof video should stay under 2 MB');

  const poster = probe(resultPosterPath);
  const posterStream = poster.streams.find((stream) => stream.codec_type === 'video');
  assert.equal(posterStream?.codec_name, 'webp');
  assert.equal(posterStream?.width, 1280);
  assert.equal(posterStream?.height, 720);
  assert.ok(Number(poster.format.size) <= 250_000, 'proof poster should stay under 250 KB');

  const metadata = JSON.stringify({ video: video.format.tags ?? {}, poster: poster.format.tags ?? {} });
  assert.doesNotMatch(metadata, /creation_time|location|comment|artist|author|copyright|description|account|email|https?:|token|secret/i);
});

test('McpProof derives the visible current price snapshot from canonical pricing', async () => {
  assert.equal(existsSync(proofPath), true, `${proofPath} should exist`);
  const source = readFileSync(proofPath, 'utf8');
  assert.match(source, /computeCanonicalPublicSnapshot/);
  assert.doesNotMatch(source, /amountCents\s*:\s*\d+/);
  assert.doesNotMatch(source, /Generated through MCP/i);

  const { getMcpProof } = await import('../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-proof');
  const engine = listFalEngines().find((candidate) => candidate.id === 'veo-3-1');
  assert.ok(engine);
  const canonicalPrice = await computeCanonicalPublicSnapshot({
    engine: engine.engine,
    durationSec: 8,
    resolution: '720p',
    aspectRatio: '16:9',
    mode: 't2v',
    membershipTier: 'member',
  });

  for (const locale of ['en', 'fr', 'es'] as const) {
    const proof = await getMcpProof(locale);
    assert.equal(proof.posterSrc, '/mcp/mcp-result-poster.webp');
    assert.equal(proof.videoSrc, '/mcp/mcp-result.mp4');
    assert.equal(proof.badge, 'Real MaxVideoAI output');
    assert.equal(proof.engineId, 'veo-3-1');
    assert.equal(proof.mode, 'source-mode-unverified');
    assert.equal(proof.durationSeconds, 8);
    assert.equal(proof.aspectRatio, '16:9');
    assert.equal(proof.resolution, '720p');
    assert.equal(proof.amountCents, canonicalPrice.totalCents);
    assert.equal(proof.currency, canonicalPrice.currency);
    assert.equal(proof.verifiedAt, '2026-07-14');
    assert.ok(proof.alt.trim().length > 30);
    assert.match(proof.caption, /current|actuel|actual/i);
    assert.match(proof.caption, /historical|historique|hist[oó]rico/i);
    assert.doesNotMatch(`${proof.alt} ${proof.badge} ${proof.caption}`, /Generated through MCP/i);
  }
});
