#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { dirname, extname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { homedir, tmpdir } from 'node:os';

import { findReadmeImageUsages } from './check-github-assets.mjs';
import { readImageDimensions } from './register-github-asset.mjs';

const CURRENT_PUBLIC_FILES = [
  '.claude-plugin/marketplace.json',
  '.claude-plugin/plugin.json',
  '.codex-plugin/plugin.json',
  '.github/ISSUE_TEMPLATE/bug-report.yml',
  '.github/ISSUE_TEMPLATE/compatibility-report.yml',
  '.github/ISSUE_TEMPLATE/config.yml',
  '.github/ISSUE_TEMPLATE/feature-request.yml',
  '.github/PULL_REQUEST_TEMPLATE.md',
  '.mcp.json',
  'CHANGELOG.md',
  'CODE_OF_CONDUCT.md',
  'CONTRIBUTING.md',
  'LICENSE',
  'README.md',
  'SECURITY.md',
  'SUPPORT.md',
  'VERSION',
  'assets/demos/brief-to-video-workflow.webp',
  'assets/demos/library-continuity.webp',
  'assets/demos/model-choice-and-budget.webp',
  'assets/demos/readme-proof-hero.webp',
  'assets/logo-mark.svg',
  'assets/screenshots/maxvideoai-library-continuity-production.jpg',
  'assets/screenshots/maxvideoai-workspace-production.jpg',
  'assets/social/directory-thumbnail.png',
  'assets/social/github-social-preview.png',
  'docs/chatgpt.md',
  'docs/claude.md',
  'docs/codex.md',
  'docs/generic-mcp.md',
  'docs/how-it-works.md',
  'docs/privacy-and-permissions.md',
  'docs/troubleshooting.md',
  'examples/README.md',
  'examples/creator-budget-comparison.md',
  'examples/product-launch-plan.md',
  'examples/recover-a-generation.md',
  'examples/reference-to-video.md',
  'skills/generate/SKILL.md',
  'skills/generate/agents/openai.yaml',
  'skills/generate/references/generation-safety.md',
  'skills/generate/references/reference-inputs.md',
  'skills/plan/SKILL.md',
  'skills/plan/agents/openai.yaml',
  'skills/plan/references/budget-planning.md',
];

const VERSION_0_3_PUBLIC_FILES = [
  'assets/social/release-0.3.0.png',
  'docs/discovery.md',
  'server.json',
];

const DEFAULT_ASSET_MANIFEST = 'docs/marketing/github-asset-manifest.json';
const PLUGIN_MANIFEST_PREFIX = 'plugins/maxvideoai/';
const OUTPUT_MARKER = '.maxvideoai-plugin-release-output.json';
const OUTPUT_MARKER_CONTENT = `${JSON.stringify({
  owner: 'maxvideoai-plugin-release-builder',
  schemaVersion: 1,
})}\n`;
const APPROVED_ASSET_EXTENSIONS = new Set(['.jpeg', '.jpg', '.png', '.svg', '.webp']);
const FORBIDDEN_NAME =
  /(^|\/)(\.env(?:\..*)?|.*\.(?:key|pem|p12|pfx|map)|credentials?\.json)$/i;
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

function parseArguments(argv) {
  const supported = new Set(['--source', '--out', '--asset-manifest']);
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!supported.has(key) || !value || value.startsWith('--')) {
      fail('expected --source <path>, --out <path>, and optional --asset-manifest <path>');
    }
    if (values.has(key)) fail(`duplicate argument: ${key}`);
    values.set(key, value);
  }
  return {
    source: resolve(values.get('--source') ?? 'plugins/maxvideoai'),
    out: resolve(values.get('--out') ?? 'dist/maxvideoai-plugin-release'),
    assetManifest: resolve(values.get('--asset-manifest') ?? DEFAULT_ASSET_MANIFEST),
  };
}

function normalizedName(root, path) {
  return relative(root, path).split(sep).join('/');
}

function isInside(parent, candidate) {
  const relationship = relative(parent, candidate);
  return (
    relationship === '' ||
    (!relationship.startsWith(`..${sep}`) && relationship !== '..' && !isAbsolute(relationship))
  );
}

function addProtectedPath(paths, candidate) {
  const normalized = resolve(candidate);
  paths.add(normalized);
  try {
    paths.add(realpathSync(normalized));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

function protectedOutputPaths(source, out) {
  const paths = new Set();
  const filesystemRoot = parse(out).root;
  const userHome = homedir();
  const temporaryRoot = tmpdir();
  for (const candidate of [
    filesystemRoot,
    process.cwd(),
    source,
    userHome,
    temporaryRoot,
    dirname(userHome),
    '/Applications',
    '/Library',
    '/System',
    '/Users',
    '/bin',
    '/boot',
    '/dev',
    '/etc',
    '/home',
    '/lib',
    '/lib64',
    '/mnt',
    '/opt',
    '/private',
    '/proc',
    '/root',
    '/run',
    '/sbin',
    '/srv',
    '/sys',
    '/tmp',
    '/usr',
    '/var',
    join(filesystemRoot, 'Program Files'),
    join(filesystemRoot, 'Program Files (x86)'),
    join(filesystemRoot, 'Users'),
    join(filesystemRoot, 'Windows'),
  ]) {
    if (candidate) addProtectedPath(paths, candidate);
  }
  return paths;
}

function assertNoSymlinkedOutputAncestor(out) {
  const root = parse(out).root;
  const segments = relative(root, out).split(sep).filter(Boolean);
  let current = root;
  for (const segment of segments) {
    current = join(current, segment);
    let info;
    try {
      info = lstatSync(current);
    } catch (error) {
      if (error?.code === 'ENOENT') return;
      throw error;
    }
    if (info.isSymbolicLink()) {
      fail(`symlinked output ancestor found at ${current}`);
    }
  }
}

function validateOutput(source, out) {
  assertNoSymlinkedOutputAncestor(out);
  if (protectedOutputPaths(source, out).has(out)) fail('output path is protected or too broad');
  if (isInside(source, out)) {
    fail('output path must not be inside the source directory');
  }
  if (isInside(out, source)) {
    fail('output path must not contain the source directory');
  }
  try {
    if (lstatSync(out).isSymbolicLink()) fail('output path must not be a symlink');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

function treeInventory(root, current = root) {
  return readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
    const path = join(current, entry.name);
    const name = normalizedName(root, path);
    const info = lstatSync(path);
    if (info.isSymbolicLink()) fail(`owned output entry must not be a symlink: ${name}`);
    if (info.isDirectory()) return [{ name, kind: 'directory' }, ...treeInventory(root, path)];
    if (!info.isFile()) fail(`owned output entry must be a regular file: ${name}`);
    return [{ name, kind: 'file' }];
  });
}

function expectedBundleInventory(files) {
  const inventory = new Map(files.map((name) => [name, 'file']));
  for (const name of files) {
    let parent = dirname(name).split(sep).join('/');
    while (parent !== '.') {
      inventory.set(parent, 'directory');
      parent = dirname(parent).split(sep).join('/');
    }
  }
  return [...inventory.entries()]
    .map(([name, kind]) => ({ name, kind }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function assertExactInventory(actual, expected) {
  const expectedByName = new Map(expected.map((entry) => [entry.name, entry.kind]));
  for (const entry of actual) {
    if (expectedByName.get(entry.name) !== entry.kind) {
      fail(`unexpected owned output entry: maxvideoai-plugin/${entry.name}`);
    }
  }
  const actualByName = new Map(actual.map((entry) => [entry.name, entry.kind]));
  for (const entry of expected) {
    if (actualByName.get(entry.name) !== entry.kind) {
      fail(`owned output entry is missing: maxvideoai-plugin/${entry.name}`);
    }
  }
}

function validateExistingBundle(bundleRoot) {
  const bundleInfo = lstatSync(bundleRoot);
  if (!bundleInfo.isDirectory() || bundleInfo.isSymbolicLink()) {
    fail('owned output maxvideoai-plugin entry must be a real directory');
  }

  const versionPath = join(bundleRoot, 'VERSION');
  let versionInfo;
  try {
    versionInfo = lstatSync(versionPath);
  } catch {
    fail('owned output entry is missing: maxvideoai-plugin/VERSION');
  }
  if (!versionInfo.isFile() || versionInfo.isSymbolicLink()) {
    fail('owned output VERSION must be a regular file');
  }
  const version = readFileSync(versionPath, 'utf8').trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) fail('owned output VERSION must use semantic versioning');

  const publicFiles = publicFilesForVersion(version);
  const bundleFiles = [...publicFiles, 'checksums.json'].sort();
  assertExactInventory(treeInventory(bundleRoot), expectedBundleInventory(bundleFiles));

  let checksums;
  try {
    checksums = JSON.parse(readFileSync(join(bundleRoot, 'checksums.json'), 'utf8'));
  } catch {
    fail('owned output checksums.json is not valid JSON');
  }
  if (checksums?.algorithm !== 'sha256' || !checksums.files || typeof checksums.files !== 'object') {
    fail('owned output checksums.json must use sha256 and contain a files object');
  }
  const checksumNames = Object.keys(checksums.files);
  if (
    checksumNames.length !== publicFiles.length ||
    checksumNames.some((name, index) => name !== publicFiles[index])
  ) {
    fail('owned output checksums.json does not match the exact public file inventory');
  }
  for (const name of publicFiles) {
    const expected = sha256(readFileSync(join(bundleRoot, name)));
    if (checksums.files[name] !== expected) {
      fail(`owned output checksum mismatch: maxvideoai-plugin/${name}`);
    }
  }
  validatePackageVersions(bundleRoot, version);
  return version;
}

function validateExistingArchive(out, version) {
  const archiveName = `maxvideoai-plugin-${version}.zip`;
  const checksumName = `${archiveName}.sha256`;
  for (const name of [archiveName, checksumName]) {
    const info = lstatSync(join(out, name));
    if (!info.isFile() || info.isSymbolicLink()) {
      fail(`owned output entry must be a regular file: ${name}`);
    }
  }
  const archiveDigest = sha256(readFileSync(join(out, archiveName)));
  if (readFileSync(join(out, checksumName), 'utf8') !== `${archiveDigest}  ${archiveName}\n`) {
    fail(`owned output archive checksum mismatch: ${archiveName}`);
  }
}

function prepareOutput(out) {
  if (!existsSync(out)) {
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, OUTPUT_MARKER), OUTPUT_MARKER_CONTENT);
    return;
  }

  const outputInfo = lstatSync(out);
  if (!outputInfo.isDirectory() || outputInfo.isSymbolicLink()) {
    fail('output path must be a real directory');
  }
  const entries = readdirSync(out);
  if (entries.length === 0) {
    writeFileSync(join(out, OUTPUT_MARKER), OUTPUT_MARKER_CONTENT);
    return;
  }

  const markerPath = join(out, OUTPUT_MARKER);
  let markerInfo;
  try {
    markerInfo = lstatSync(markerPath);
  } catch {
    fail('non-empty output directory is not owned by this builder');
  }
  if (
    !markerInfo.isFile() ||
    markerInfo.isSymbolicLink() ||
    readFileSync(markerPath, 'utf8') !== OUTPUT_MARKER_CONTENT
  ) {
    fail('non-empty output directory has an invalid builder ownership marker');
  }

  const generatedEntries = entries.filter((entry) => entry !== OUTPUT_MARKER);
  if (generatedEntries.length === 0) return;

  const bundleName = 'maxvideoai-plugin';
  if (!generatedEntries.includes(bundleName)) {
    fail('owned output entry is missing: maxvideoai-plugin');
  }
  const previousVersion = validateExistingBundle(join(out, bundleName));
  const archiveName = `maxvideoai-plugin-${previousVersion}.zip`;
  const expectedTopLevel = [archiveName, `${archiveName}.sha256`, bundleName].sort();
  const actualTopLevel = [...generatedEntries].sort();
  const unexpected = actualTopLevel.filter((name) => !expectedTopLevel.includes(name));
  if (unexpected.length > 0) fail(`unexpected output entry would not be removed: ${unexpected.join(', ')}`);
  const missing = expectedTopLevel.filter((name) => !actualTopLevel.includes(name));
  if (missing.length > 0) fail(`owned output entry is missing: ${missing.join(', ')}`);
  validateExistingArchive(out, previousVersion);

  for (const name of generatedEntries) {
    rmSync(join(out, name), { recursive: true, force: true });
  }
}

function walk(root, current = root) {
  return readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
    const path = join(current, entry.name);
    const info = lstatSync(path);
    if (info.isSymbolicLink()) {
      fail(`symlink found at ${normalizedName(root, path)}`);
    }
    if (info.isDirectory()) {
      return walk(root, path);
    }
    if (!info.isFile()) {
      fail(`unsupported filesystem entry at ${normalizedName(root, path)}`);
    }
    return [path];
  });
}

function sha256(contents) {
  return createHash('sha256').update(contents).digest('hex');
}

function loadAssetManifest(path) {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`asset manifest could not be read at ${path}: ${error instanceof Error ? error.message : error}`);
  }
  if (!Array.isArray(manifest?.assets)) {
    fail('asset manifest must contain an assets array');
  }

  const records = new Map();
  for (const asset of manifest.assets) {
    if (typeof asset?.path !== 'string' || !asset.path.startsWith(PLUGIN_MANIFEST_PREFIX)) continue;
    const name = asset.path.slice(PLUGIN_MANIFEST_PREFIX.length).replaceAll('\\', '/');
    if (!name.startsWith('assets/') || name.includes('../') || name.startsWith('/')) {
      fail(`asset manifest contains an unsafe plugin path: ${asset.path}`);
    }
    if (records.has(name)) fail(`asset manifest contains a duplicate path: ${name}`);
    records.set(name, asset);
  }
  return records;
}

function inspectAsset(name, contents, assetRecords, exportedFiles) {
  const extension = extname(name).toLowerCase();
  if (!APPROVED_ASSET_EXTENSIONS.has(extension)) {
    fail(`unsupported asset extension found at ${name}`);
  }
  const record = assetRecords.get(name);
  if (!record) fail(`unregistered asset found at ${name}`);
  if (typeof record.sha256 !== 'string' || record.sha256 !== sha256(contents)) {
    fail(`asset manifest hash mismatch at ${name}`);
  }
  if (exportedFiles.has(name) && record.state !== 'publishable_proof') {
    fail(`exported asset must be publishable_proof: ${name}`);
  }
  let image;
  try {
    image = readImageDimensions(contents);
  } catch (error) {
    fail(`unsupported or malformed asset at ${name}: ${error instanceof Error ? error.message : error}`);
  }
  const expectedFormat = extension === '.jpg' || extension === '.jpeg' ? 'jpeg' : extension.slice(1);
  if (image.format !== expectedFormat) {
    fail(`asset extension does not match its bytes at ${name}`);
  }
}

function decodeText(name, contents) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(contents);
  } catch {
    fail(`invalid UTF-8 text found at ${name}`);
  }
}

function inspectText(name, contents, exported) {
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

function resolveMarkdownImageReferences(source, publicFiles) {
  const publicFileSet = new Set(publicFiles);

  for (const documentName of publicFiles.filter((name) => name.endsWith('.md'))) {
    const documentPath = join(source, documentName);
    const markdown = readFileSync(documentPath, 'utf8');
    for (const usage of findReadmeImageUsages(markdown, documentPath, source)) {
      if (usage.path.startsWith('REMOTE:')) {
        fail(`remote Markdown image reference is not allowed in ${documentName}: ${usage.path.slice(7)}`);
      }
      if (usage.path.startsWith('INVALID:')) {
        fail(`local Markdown image reference is unsafe in ${documentName}: ${usage.path.slice(8)}`);
      }
      const referencedName = usage.path;
      if (!publicFileSet.has(referencedName)) {
        fail(`Markdown image reference is not allowlisted in ${documentName}: ${referencedName}`);
      }
    }
  }
}

function assertRequiredFiles(source, publicFiles) {
  for (const name of publicFiles) {
    const path = join(source, name);
    let info;
    try {
      info = lstatSync(path);
    } catch {
      fail(`required public file is missing: ${name}`);
    }
    if (!info.isFile() || info.isSymbolicLink()) {
      fail(`required public file is not a regular file: ${name}`);
    }
  }
}

function inspectSource(source, publicFiles, assetRecords) {
  const sourceInfo = lstatSync(source);
  if (!sourceInfo.isDirectory() || sourceInfo.isSymbolicLink()) {
    fail('source must be a real directory');
  }

  const exportedFiles = new Set(publicFiles);
  for (const path of walk(source)) {
    const name = normalizedName(source, path);
    if (FORBIDDEN_NAME.test(name)) {
      fail(`forbidden file found at ${name}`);
    }
    const contents = readFileSync(path);
    const exported = exportedFiles.has(name);
    if (name.startsWith('assets/')) {
      inspectAsset(name, contents, assetRecords, exportedFiles);
      if (extname(name).toLowerCase() === '.svg') inspectText(name, contents, exported);
      continue;
    }
    inspectText(name, contents, exported);
  }

  assertRequiredFiles(source, publicFiles);
  resolveMarkdownImageReferences(source, publicFiles);
}

function versionAtLeast(version, minimum) {
  const left = version.split('.').map(Number);
  const right = minimum.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] > right[index]) return true;
    if (left[index] < right[index]) return false;
  }
  return true;
}

function publicFilesForVersion(version) {
  const files = versionAtLeast(version, '0.3.0')
    ? [...CURRENT_PUBLIC_FILES, ...VERSION_0_3_PUBLIC_FILES]
    : [...CURRENT_PUBLIC_FILES];
  return files.sort();
}

function validatePackageVersions(source, version) {
  for (const manifestName of ['.codex-plugin/plugin.json', '.claude-plugin/plugin.json']) {
    const manifest = JSON.parse(readFileSync(join(source, manifestName), 'utf8'));
    if (manifest.name !== 'maxvideoai' || manifest.version !== version) {
      fail(`${manifestName} name/version does not match maxvideoai@${version}`);
    }
  }

  const marketplaceName = '.claude-plugin/marketplace.json';
  const marketplace = JSON.parse(readFileSync(join(source, marketplaceName), 'utf8'));
  if (Object.hasOwn(marketplace, 'version') && marketplace.version !== version) {
    fail(`${marketplaceName} marketplace version does not match maxvideoai@${version}`);
  }
  for (const plugin of Array.isArray(marketplace.plugins) ? marketplace.plugins : []) {
    if (Object.hasOwn(plugin, 'version') && plugin.version !== version) {
      fail(`${marketplaceName} plugin marketplace version does not match maxvideoai@${version}`);
    }
  }
}

const CRC_TABLE = Array.from({ length: 256 }, (_, number) => {
  let crc = number;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function crc32(contents) {
  let crc = 0xffffffff;
  for (const byte of contents) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const dosDate = ((2020 - 1980) << 9) | (1 << 5) | 1;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const compressed = deflateRawSync(entry.contents, { level: 9 });
    const crc = crc32(entry.contents);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(entry.contents.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, name, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(0x0314, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(entry.contents.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);
    offset += localHeader.length + name.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function main() {
  const { source, out, assetManifest } = parseArguments(process.argv.slice(2));
  validateOutput(source, out);

  const version = readFileSync(join(source, 'VERSION'), 'utf8').trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) fail('VERSION must use semantic versioning');
  const publicFiles = publicFilesForVersion(version);
  const assetRecords = loadAssetManifest(assetManifest);
  inspectSource(source, publicFiles, assetRecords);
  validatePackageVersions(source, version);

  prepareOutput(out);
  const bundleRoot = join(out, 'maxvideoai-plugin');
  mkdirSync(bundleRoot, { recursive: true });
  for (const name of publicFiles) {
    const destination = join(bundleRoot, name);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(join(source, name), destination);
  }

  const checksums = Object.fromEntries(
    publicFiles.map((name) => [name, sha256(readFileSync(join(bundleRoot, name)))]),
  );
  writeFileSync(
    join(bundleRoot, 'checksums.json'),
    `${JSON.stringify({ algorithm: 'sha256', files: checksums }, null, 2)}\n`,
  );

  const archiveName = `maxvideoai-plugin-${version}.zip`;
  const archivePath = join(out, archiveName);
  const archiveFiles = [...publicFiles, 'checksums.json'].sort();
  const archive = createZip(
    archiveFiles.map((name) => ({
      name: `maxvideoai/${name}`,
      contents: readFileSync(join(bundleRoot, name)),
    })),
  );
  writeFileSync(archivePath, archive);
  const archiveDigest = sha256(archive);
  writeFileSync(join(out, `${archiveName}.sha256`), `${archiveDigest}  ${archiveName}\n`);

  process.stdout.write(
    `${JSON.stringify({ archive: archiveName, sha256: archiveDigest, version }, null, 2)}\n`,
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
