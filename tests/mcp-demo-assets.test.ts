import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import test from 'node:test';

const provenancePath = 'docs/marketing/mcp-asset-provenance.md';
const evidencePath = 'docs/marketing/mcp-demo-evidence.md';
const proofPath = 'frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-proof.ts';
const unpublishedMediaPaths = [
  'frontend/public/mcp/mcp-brief.webp',
  'frontend/public/mcp/mcp-reference.webp',
  'frontend/public/mcp/mcp-quote.webp',
  'frontend/public/mcp/mcp-result-poster.webp',
  'frontend/public/mcp/mcp-result.mp4',
] as const;

const officialClaudeArchiveSha256 = 'c68ac92df86c825f95177e24016fcc9a8863a3fd4ca344fe6f0700b2c1e07151';
const officialClaudeMemberSha256 = '6d53db4be375e899c937c26cf16684a80d6e869b1928d72b37748bef2560e219';
const officialClaudeMemberPath =
  'Anthropic media resources/Anthropic logos/Claude logos/3 Claude Spark/SVG/Claude Spark - Clay.svg';
const rejectedCandidateSha256 = '5db66cfa848a021afaabe3a0a47a2a44643980966ef5aa8a055fe438cf678771';
const rejectedProviderExampleSha256 = '6430e711dca4f2e1d8b7c6e8cf333d444bebabf48ef4662e196554270bc29b19';
const rejectedVideoStreamSha256 = 'a70320cdd31f395c3081cb1557cf5ef2958332330234d2d8bb6e650305a56449';
const rejectedAudioStreamSha256 = 'f2cc3c3cdaf1de1d028fe5aaf09c434a5c2b64d55413a343852e9ea04ce6e135';
const rejectedDerivativeHashes = new Set([
  'df66302c8b34f3a79dcc39d906b69ed30184a8299e179e116ab600adb69436f7',
  '648f1e34cef686151898067d96880f5959d3f37a5b997477a0f97a7783a35634',
]);

type AssetProvenanceRecord = {
  path: string;
  officialOwner: string;
  origin: string;
  sourceUrl: string;
  sourceArchivePath: string | null;
  sourceArchiveSha256?: string;
  verifiedAt: string;
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
  proofLabel: string | null;
  mcpGenerationVerified: boolean;
  captureAssets: Record<'brief' | 'reference' | 'quote', string>;
  resultProof: {
    status: string;
    jobEvidenceReference: string | null;
    auditEvidenceReference: string | null;
    sourceUrl: string | null;
    sourceSha256: string | null;
  };
  hostUiProof: {
    status: string;
    host: string;
    assetPath: string;
    mimeType: string;
    width: number;
    height: number;
    sha256: string;
    capturedAt: string;
    hostVersion: string;
    hostLocale: string;
    operatingSystem: string;
    environment: string;
    serverOrigin: string;
    deploymentId: string;
    sourceRevision: string;
    resourceUri: string;
    manualPlaybackExerciseRecorded: boolean;
    firstPartyCtaVerified: boolean;
    marketingPermission: boolean;
    privacyReview: string;
    evidenceReference: string;
  };
  rejectedCandidate: {
    reasonCode: string;
    candidateSourceUrl: string;
    candidateSha256: string;
    providerExampleUrl: string;
    providerExampleSha256: string;
    videoStreamSha256: string;
    audioStreamSha256: string;
  };
};

function sha256(content: string | Buffer) {
  return createHash('sha256').update(content).digest('hex');
}

function readMarkedJson<T>(path: string, marker: string): T {
  assert.equal(existsSync(path), true, `${path} should exist`);
  const source = readFileSync(path, 'utf8');
  const fence = '`'.repeat(3);
  const match = source.match(new RegExp(`<!-- ${marker} -->\\s*${fence}json\\s*([\\s\\S]*?)\\s*${fence}`));
  assert.ok(match, `${path} should contain the ${marker} JSON manifest`);
  return JSON.parse(match[1]) as T;
}

function validateOfficialClaudeRecord(record: AssetProvenanceRecord, bytes: Buffer) {
  assert.equal(record.officialOwner, 'Anthropic PBC');
  assert.equal(record.origin, 'official-anthropic-press-kit');
  assert.equal(record.sourceUrl, 'https://www.anthropic.com/press-kit');
  assert.equal(record.sourceArchivePath, officialClaudeMemberPath);
  assert.equal(record.sourceArchiveSha256, officialClaudeArchiveSha256);
  assert.equal(record.sha256, officialClaudeMemberSha256);
  assert.equal(sha256(bytes), officialClaudeMemberSha256, 'Claude member bytes must match the independently pinned hash');
  assert.match(record.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(record.usageNote.trim().length >= 20, 'Claude usage note should be meaningful');
}

test('Claude marks match independently pinned official archive and member checksums', () => {
  const manifest = readMarkedJson<AssetProvenanceManifest>(provenancePath, 'mcp-asset-provenance:v1');
  const claudePaths = [
    'frontend/public/brand/partners/anthropic/claude-mark-light.svg',
    'frontend/public/brand/partners/anthropic/claude-mark-dark.svg',
  ];

  for (const path of claudePaths) {
    assert.equal(existsSync(path), true, `${path} should exist`);
    const bytes = readFileSync(path);
    assert.ok(bytes.byteLength > 100, `${path} should not be empty`);
    const record = manifest.assets.find((candidate) => candidate.path === path);
    assert.ok(record, `${path} should have a provenance record`);
    validateOfficialClaudeRecord(record, bytes);
  }

  const validRecord = manifest.assets.find((record) => record.path === claudePaths[0])!;
  const tamperedBytes = Buffer.concat([readFileSync(claudePaths[0]), Buffer.from('tampered')]);
  assert.throws(
    () => validateOfficialClaudeRecord({ ...validRecord, sha256: sha256(tamperedBytes) }, tamperedBytes),
    /independently pinned hash|6d53db4b/
  );
  assert.throws(() => validateOfficialClaudeRecord({ ...validRecord, origin: 'ImageGen' }, readFileSync(claudePaths[0])));
  assert.throws(() => validateOfficialClaudeRecord({ ...validRecord, origin: 'handcrafted-svg' }, readFileSync(claudePaths[0])));
  assert.throws(() =>
    validateOfficialClaudeRecord(
      { ...validRecord, sourceUrl: 'https://assets.example-cdn.invalid/claude.svg' },
      readFileSync(claudePaths[0])
    )
  );
});

test('reused OpenAI marks record verification dates instead of invented retrieval dates', () => {
  const manifest = readMarkedJson<AssetProvenanceManifest>(provenancePath, 'mcp-asset-provenance:v1');
  const openAiPaths = [
    'frontend/public/brand/partners/openai/openai-mark-light.svg',
    'frontend/public/brand/partners/openai/openai-mark-dark.svg',
  ];

  for (const path of openAiPaths) {
    assert.equal(existsSync(path), true, `${path} should exist`);
    assert.ok(statSync(path).size > 100, `${path} should not be empty`);
    const record = manifest.assets.find((candidate) => candidate.path === path);
    assert.ok(record, `${path} should have a provenance record`);
    assert.equal(record.origin, 'repository-reuse');
    assert.match(record.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal('retrievedAt' in record, false);
    assert.equal(record.sha256, sha256(readFileSync(path)));
  }
});

test('unverified MCP captures and result proof fail closed as absent and null', async () => {
  unpublishedMediaPaths.forEach((path) => assert.equal(existsSync(path), false, `${path} must remain absent`));

  const source = readFileSync(proofPath, 'utf8');
  assert.match(source, /Promise<McpProof \| null>/);
  assert.doesNotMatch(source, /computeCanonicalPublicSnapshot|mcp-result\.(?:mp4|webp)|Real MaxVideoAI output/);
  const { getMcpProof } = await import('../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-proof');
  for (const locale of ['en', 'fr', 'es'] as const) {
    assert.equal(await getMcpProof(locale), null);
  }

  const evidence = readMarkedJson<DemoEvidenceManifest>(evidencePath, 'mcp-demo-evidence:v1');
  assert.equal(evidence.publicationStatus, 'gated');
  assert.equal(evidence.proofLabel, null);
  assert.equal(evidence.mcpGenerationVerified, false);
  assert.deepEqual(evidence.captureAssets, {
    brief: 'withheld-unverified',
    reference: 'withheld-unverified',
    quote: 'withheld-unverified',
  });
  assert.deepEqual(evidence.resultProof, {
    status: 'withheld-unverified',
    jobEvidenceReference: null,
    auditEvidenceReference: null,
    sourceUrl: null,
    sourceSha256: null,
  });
  assert.deepEqual(evidence.hostUiProof, {
    status: 'verified-host-ui',
    host: 'claudeDesktop',
    assetPath: 'frontend/public/media/mcp/claude-inline-video-proof.jpg',
    mimeType: 'image/jpeg',
    width: 1152,
    height: 768,
    sha256: '2f54400a0287e7930295718beabb7c51b93cc927eb4abdd2dd9108d268a0780e',
    capturedAt: '2026-08-26T16:31:42+02:00',
    hostVersion: 'Claude Desktop 1.37937.1',
    hostLocale: 'fr-FR',
    operatingSystem: 'macOS 26.5.1 (25F80)',
    environment: 'controlled-staging',
    serverOrigin: 'https://maxvideoai-mcp-staging.vercel.app',
    deploymentId: 'dpl_3i6XgnZ6KVCZmQPhhKBrHDVrm1TD',
    sourceRevision: '621881dae621e9aec1d68a2a86f5065c6325cdb8',
    resourceUri: 'ui://maxvideoai/generation-result-v1.html',
    manualPlaybackExerciseRecorded: true,
    firstPartyCtaVerified: true,
    marketingPermission: true,
    privacyReview: 'passed-no-visible-account-identifier',
    evidenceReference: 'host-ui-claude-2026-08-26-v1',
  });
  const hostProofBytes = readFileSync(evidence.hostUiProof.assetPath);
  assert.equal(sha256(hostProofBytes), evidence.hostUiProof.sha256);
  assert.equal(getMcpProof('en') instanceof Promise, true);
  assert.doesNotMatch(JSON.stringify(evidence.hostUiProof), /job[_-]?id|audit[_-]?id|oauth|@|private.*url/i);

  const publicEvidence = `${readFileSync(evidencePath, 'utf8')}\n${readFileSync(provenancePath, 'utf8')}\n${source}`;
  assert.doesNotMatch(publicEvidence, /Real MaxVideoAI output|MaxVideoAI-owned proof|product-owned-production-registry/i);
});

test('the rejected provider example can never satisfy result provenance', () => {
  const evidence = readMarkedJson<DemoEvidenceManifest>(evidencePath, 'mcp-demo-evidence:v1');
  assert.deepEqual(evidence.rejectedCandidate, {
    reasonCode: 'provider-example-not-job-backed',
    candidateSourceUrl: 'https://media.maxvideoai.com/renders/marketing/f9711b1e-53d5-4a1d-9adf-8186784538e3.mp4',
    candidateSha256: rejectedCandidateSha256,
    providerExampleUrl: 'https://storage.googleapis.com/falserverless/example_outputs/veo3-i2v-output.mp4',
    providerExampleSha256: rejectedProviderExampleSha256,
    videoStreamSha256: rejectedVideoStreamSha256,
    audioStreamSha256: rejectedAudioStreamSha256,
  });

  const manifest = readMarkedJson<AssetProvenanceManifest>(provenancePath, 'mcp-asset-provenance:v1');
  const forbiddenHashes = new Set([
    rejectedCandidateSha256,
    rejectedProviderExampleSha256,
    rejectedVideoStreamSha256,
    rejectedAudioStreamSha256,
    ...rejectedDerivativeHashes,
  ]);
  for (const asset of manifest.assets) {
    assert.equal(forbiddenHashes.has(asset.sha256), false, `${asset.path} must not reuse rejected proof bytes`);
    assert.equal(asset.path.startsWith('frontend/public/mcp/'), false, `${asset.path} must not publish rejected proof media`);
  }
});

test('any future McpProof requires job, audit, and source evidence in its type and value', async () => {
  const source = readFileSync(proofPath, 'utf8');
  assert.match(source, /export type McpProofEvidence/);
  for (const field of ['jobEvidenceReference', 'auditEvidenceReference', 'sourceUrl', 'sourceSha256'] as const) {
    assert.match(source, new RegExp(`${field}: string`));
  }
  assert.match(source, /evidence: McpProofEvidence/);

  const { getMcpProof } = await import('../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-proof');
  const proof = await getMcpProof('en');
  if (proof) {
    const evidence = readMarkedJson<DemoEvidenceManifest>(evidencePath, 'mcp-demo-evidence:v1');
    assert.equal(evidence.publicationStatus, 'verified');
    assert.equal(evidence.mcpGenerationVerified, true);
    assert.ok(proof.evidence.jobEvidenceReference.trim().length >= 8);
    assert.ok(proof.evidence.auditEvidenceReference.trim().length >= 8);
    assert.match(proof.evidence.sourceUrl, /^https:\/\//);
    assert.match(proof.evidence.sourceSha256, /^[a-f0-9]{64}$/);
    assert.deepEqual(evidence.resultProof, {
      status: 'verified',
      jobEvidenceReference: proof.evidence.jobEvidenceReference,
      auditEvidenceReference: proof.evidence.auditEvidenceReference,
      sourceUrl: proof.evidence.sourceUrl,
      sourceSha256: proof.evidence.sourceSha256,
    });
    assert.equal(existsSync(`frontend/public${proof.posterSrc}`), true);
    assert.equal(existsSync(`frontend/public${proof.videoSrc}`), true);
  }
});
