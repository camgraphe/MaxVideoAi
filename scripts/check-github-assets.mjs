import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { readImageDimensions, validateImageDecode } from './register-github-asset.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const manifestPath = path.join(repositoryRoot, 'docs/marketing/github-asset-manifest.json');
const states = new Set(['reference_only', 'draft_editorial', 'publishable_proof', 'retired']);
const kinds = new Set(['host_proof', 'product_proof', 'editorial']);
const environments = new Set(['production', 'controlled_demo', 'generated_editorial']);
const semanticIdPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const revisionPattern = /^[a-f0-9]{40}$/;
const dayMilliseconds = 24 * 60 * 60 * 1000;

function isNonEmptyString(value) { return typeof value === 'string' && value.trim().length > 0; }
function isNullableString(value) { return value === null || typeof value === 'string'; }
function isDate(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)?$/.test(value) && !Number.isNaN(Date.parse(value)); }
function validateAlt(value) { return isNonEmptyString(value) && value.trim().split(/\s+/).length >= 4 && !/^(screenshot|image|demo)$/i.test(value.trim()); }

function isSafeRelativePath(value, rootDirectory) {
  if (!isNonEmptyString(value) || path.isAbsolute(value) || value.includes('\\') || value.split('/').includes('..')) return false;
  return path.resolve(rootDirectory, value).startsWith(`${rootDirectory}${path.sep}`);
}

function hasAncestorCommit(revision, rootDirectory) {
  if (!revisionPattern.test(revision ?? '')) return false;
  const resolve = spawnSync('git', ['-C', rootDirectory, 'rev-parse', '--verify', `${revision}^{commit}`], { encoding: 'utf8' });
  if (resolve.status !== 0) return false;
  return spawnSync('git', ['-C', rootDirectory, 'merge-base', '--is-ancestor', revision, 'HEAD'], { encoding: 'utf8' }).status === 0;
}

function validateFreshDate(value, field, maxAgeDays, now, prefix, errors) {
  if (!isDate(value)) {
    errors.push(`${prefix}: ${field} must be an ISO date`);
    return;
  }
  const age = now.getTime() - Date.parse(value);
  if (age < 0 || age > maxAgeDays * dayMilliseconds) errors.push(`${prefix}: ${field} must be no older than ${maxAgeDays} days and cannot be in the future`);
}

function validateRequiredProvenance(record, state, rootDirectory, now, prefix, errors) {
  for (const field of ['capturedAt', 'maxvideoaiRevision', 'approvedBy']) {
    if (!isNonEmptyString(record[field])) errors.push(`${prefix}: ${state} requires ${field}`);
  }
  if (isNonEmptyString(record.maxvideoaiRevision) && !hasAncestorCommit(record.maxvideoaiRevision, rootDirectory)) {
    errors.push(`${prefix}: ${state} maxvideoaiRevision must be a real ancestor commit`);
  }
  if (state === 'publishable_proof') {
    validateFreshDate(record.capturedAt, 'capturedAt', 90, now, prefix, errors);
    validateFreshDate(record.lastReviewedAt, 'lastReviewedAt', 30, now, prefix, errors);
    if (!isNonEmptyString(record.lastReviewedRevision)) errors.push(`${prefix}: publishable_proof requires lastReviewedRevision`);
    else if (!hasAncestorCommit(record.lastReviewedRevision, rootDirectory)) errors.push(`${prefix}: publishable_proof lastReviewedRevision must be a real ancestor commit`);
    if (record.freshnessStatus !== 'current') errors.push(`${prefix}: publishable_proof freshnessStatus must be current`);
  }
}

async function validateRecord(record, rootDirectory, now, seenIds, seenPaths) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return ['Asset record must be an object'];
  const errors = [];
  let detectedFormat = null;
  const prefix = isNonEmptyString(record.id) ? record.id : 'asset';
  if (!semanticIdPattern.test(record.id ?? '')) errors.push(`${prefix}: id must be a semantic kebab-case identifier`);
  if (seenIds.has(record.id)) errors.push(`${prefix}: duplicate asset id`);
  seenIds.add(record.id);
  if (!isSafeRelativePath(record.path, rootDirectory)) errors.push(`${prefix}: path must be a safe repository-relative path`);
  else {
    if (seenPaths.has(record.path)) errors.push(`${prefix}: duplicate asset path`);
    seenPaths.add(record.path);
    const absolutePath = path.resolve(rootDirectory, record.path);
    if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) errors.push(`${prefix}: asset path does not exist as a file: ${record.path}`);
    else {
      try {
        const bytes = readFileSync(absolutePath);
        const image = readImageDimensions(bytes);
        detectedFormat = image.format;
        await validateImageDecode(bytes);
        if (record.width !== image.width || record.height !== image.height) errors.push(`${prefix}: dimensions do not match current ${image.format.toUpperCase()} bytes`);
        if (record.sha256 !== createHash('sha256').update(bytes).digest('hex')) errors.push(`${prefix}: sha256 does not match current bytes`);
      } catch (error) {
        errors.push(`${prefix}: image must be a supported, well-formed PNG, JPEG, WebP, or safe SVG (${error.message})`);
      }
    }
  }
  if (!kinds.has(record.kind)) errors.push(`${prefix}: kind must be host_proof, product_proof, or editorial`);
  if (!states.has(record.state)) errors.push(`${prefix}: state must be reference_only, draft_editorial, publishable_proof, or retired`);
  if (!environments.has(record.sourceEnvironment)) errors.push(`${prefix}: sourceEnvironment is invalid`);
  const validDimensions =
    detectedFormat === 'svg'
      ? Number.isFinite(record.width) && record.width > 0 && Number.isFinite(record.height) && record.height > 0
      : Number.isInteger(record.width) && record.width >= 1 && Number.isInteger(record.height) && record.height >= 1;
  if (!validDimensions) errors.push(`${prefix}: dimensions must be positive integers for raster assets or positive finite numbers for SVG assets`);
  if (!sha256Pattern.test(record.sha256 ?? '')) errors.push(`${prefix}: sha256 must be a 64-character lowercase hexadecimal hash`);
  if (!isNonEmptyString(record.claim)) errors.push(`${prefix}: claim is required`);
  if (!Array.isArray(record.placements) || record.placements.length === 0 || record.placements.some((placement) => !isNonEmptyString(placement))) errors.push(`${prefix}: placements must contain one or more non-empty values`);
  if (!validateAlt(record.alt)) errors.push(`${prefix}: alt must be descriptive, not a generic image label`);
  if (!isNonEmptyString(record.reviewTrigger)) errors.push(`${prefix}: reviewTrigger is required`);
  if (!isNullableString(record.capturedAt) || (record.capturedAt !== null && !isDate(record.capturedAt))) errors.push(`${prefix}: capturedAt must be an ISO date or null`);
  if (!isNullableString(record.host)) errors.push(`${prefix}: host must be a string or null`);
  if (!isNullableString(record.hostVersion)) errors.push(`${prefix}: hostVersion must be a string or null`);
  if (!isNullableString(record.maxvideoaiRevision) || (record.maxvideoaiRevision !== null && !revisionPattern.test(record.maxvideoaiRevision))) errors.push(`${prefix}: maxvideoaiRevision must be a 40-character lowercase hexadecimal revision or null`);
  if (!isNullableString(record.approvedBy)) errors.push(`${prefix}: approvedBy must be a string or null`);

  if (record.state === 'publishable_proof') {
    validateRequiredProvenance(record, 'publishable_proof', rootDirectory, now, prefix, errors);
    if (record.kind === 'host_proof') {
      for (const field of ['host', 'hostVersion']) if (!isNonEmptyString(record[field])) errors.push(`${prefix}: publishable host_proof requires ${field}`);
    }
  }
  if (record.state === 'draft_editorial') {
    if (record.kind !== 'editorial' || record.sourceEnvironment !== 'generated_editorial') errors.push(`${prefix}: draft_editorial must be generated editorial, never proof`);
    if (!/editorial/i.test(record.claim ?? '')) errors.push(`${prefix}: draft_editorial claim must explicitly identify editorial use`);
    validateRequiredProvenance(record, 'draft_editorial', rootDirectory, now, prefix, errors);
  }
  return errors;
}

export async function validateGithubAssetManifest(manifest, { repositoryRoot: rootDirectory = repositoryRoot, now = new Date() } = {}) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return ['Asset manifest must be an object'];
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) return ['Validation now must be a valid Date'];
  const errors = [];
  if (manifest.version !== 1) errors.push('Asset manifest version must be 1');
  if (!Array.isArray(manifest.assets)) return [...errors, 'Asset manifest assets must be an array'];
  const seenIds = new Set();
  const seenPaths = new Set();
  for (const record of manifest.assets) {
    const recordErrors = await validateRecord(record, rootDirectory, now, seenIds, seenPaths);
    errors.push(...recordErrors);
  }
  return errors;
}

function toRepositoryPath(assetReference, readmePath, rootDirectory) {
  if (/^(?:[a-z]+:|\/\/)/i.test(assetReference)) return `REMOTE:${assetReference}`;
  if (assetReference.startsWith('#')) return `INVALID:${assetReference}`;
  const decoded = decodeURIComponent(assetReference.replace(/^<|>$/g, ''));
  const absolutePath = path.resolve(path.dirname(readmePath), decoded);
  if (!absolutePath.startsWith(`${rootDirectory}${path.sep}`)) return `INVALID:${assetReference}`;
  return path.relative(rootDirectory, absolutePath).split(path.sep).join('/');
}

function parseAttributes(tag) {
  const attributes = {};
  for (const match of tag.matchAll(/([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    const name = match[1].toLowerCase();
    if (name === 'img' || name === 'source' || name === 'picture') continue;
    attributes[name] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attributes;
}

function srcsetCandidates(srcset) {
  return srcset.split(',').map((candidate) => candidate.trim().split(/\s+/)[0]).filter(Boolean);
}

function addUsage(collected, assetReference, metadata, readmePath, rootDirectory) {
  const assetPath = toRepositoryPath(assetReference, readmePath, rootDirectory);
  addCollectedUsage(collected, assetPath, metadata);
}

function addCollectedUsage(collected, assetPath, metadata) {
  const entry = collected.get(assetPath) ?? { path: assetPath, usages: [] };
  entry.usages.push(metadata);
  collected.set(assetPath, entry);
}

function addInvalidUsage(collected, reason, metadata) {
  addCollectedUsage(collected, `INVALID:${reason}`, metadata);
}

function normalizeReferenceLabel(label) {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

function findHtmlImageTags(markdown) {
  const tags = [];
  const openingTag = /<(img|source)\b/gi;
  let match;
  while ((match = openingTag.exec(markdown)) !== null) {
    let quote = null;
    let end = -1;
    for (let index = openingTag.lastIndex; index < markdown.length; index += 1) {
      const character = markdown[index];
      if (quote !== null) {
        if (character === quote) quote = null;
        continue;
      }
      if (character === '"' || character === "'") {
        quote = character;
        continue;
      }
      if (character === '>') {
        end = index + 1;
        break;
      }
    }
    if (end === -1) {
      tags.push({ tagName: match[1].toLowerCase(), source: null });
      break;
    }
    tags.push({ tagName: match[1].toLowerCase(), source: markdown.slice(match.index, end) });
    openingTag.lastIndex = end;
  }
  return tags;
}

export function findReadmeImageUsages(markdown, readmePath, rootDirectory = repositoryRoot) {
  const collected = new Map();
  const definitions = new Map();
  for (const match of markdown.matchAll(/^\s*\[([^\]]+)\]:\s*(<[^>]+>|\S+)(?:\s+.*)?$/gm)) definitions.set(normalizeReferenceLabel(match[1]), match[2]);
  for (const match of markdown.matchAll(/!\[([^\]]*)\]\((<[^>]+>|[^\s)]+)(?:\s+[^)]*)?\)/g)) addUsage(collected, match[2], { source: 'markdown_inline', alt: match[1], role: null }, readmePath, rootDirectory);
  for (const match of markdown.matchAll(/!\[([^\]]*)\]\[([^\]]*)\]/g)) {
    const id = normalizeReferenceLabel(match[2] || match[1]);
    const metadata = { source: 'markdown_reference', alt: match[1], role: null };
    if (definitions.has(id)) addUsage(collected, definitions.get(id), metadata, readmePath, rootDirectory);
    else addInvalidUsage(collected, `unresolved Markdown image reference: ${match[0]}`, metadata);
  }
  for (const match of markdown.matchAll(/!\[([^\]]+)\](?![\[(])/g)) {
    const id = normalizeReferenceLabel(match[1]);
    const metadata = { source: 'markdown_reference', alt: match[1], role: null };
    if (definitions.has(id)) addUsage(collected, definitions.get(id), metadata, readmePath, rootDirectory);
    else addInvalidUsage(collected, `unresolved Markdown image reference: ${match[0]}`, metadata);
  }
  for (const tag of findHtmlImageTags(markdown)) {
    const metadata = { source: tag.tagName === 'img' ? 'html_img' : 'html_source', alt: '', role: null };
    if (tag.source === null) {
      addInvalidUsage(collected, `unterminated HTML ${tag.tagName} tag`, metadata);
      continue;
    }
    const attributes = parseAttributes(tag.source);
    metadata.alt = attributes.alt ?? '';
    metadata.role = attributes['data-asset-role'] ?? null;
    if (attributes.src) addUsage(collected, attributes.src, metadata, readmePath, rootDirectory);
    if (attributes.srcset) for (const candidate of srcsetCandidates(attributes.srcset)) addUsage(collected, candidate, metadata, readmePath, rootDirectory);
  }
  return [...collected.values()];
}

export function findReadmeImageReferences(markdown, readmePath, rootDirectory = repositoryRoot) {
  return findReadmeImageUsages(markdown, readmePath, rootDirectory).map((entry) => entry.path);
}

function readmePlacement(readmePath, rootDirectory) {
  const normalized = path.relative(rootDirectory, readmePath).split(path.sep).join('/');
  if (normalized === 'README.md') return 'root_readme';
  if (normalized === 'plugins/maxvideoai/README.md') return 'plugin_readme';
  return 'readme';
}

function validateEditorialUsage(record, usage, prefix, errors) {
  if (usage.source !== 'html_img' || usage.role !== 'editorial' || !/^Editorial illustration:\s+\S/i.test(usage.alt) || !validateAlt(usage.alt)) {
    errors.push(`${prefix}: draft_editorial README use must be an HTML img with data-asset-role="editorial" and alt beginning "Editorial illustration:"`);
  }
}

export async function validateReleaseReadmeAssets(manifest, { repositoryRoot: rootDirectory = repositoryRoot, now = new Date(), readmePaths = [path.join(rootDirectory, 'README.md'), path.join(rootDirectory, 'plugins/maxvideoai', 'README.md')] } = {}) {
  const errors = await validateGithubAssetManifest(manifest, { repositoryRoot: rootDirectory, now });
  const recordsByPath = new Map((manifest?.assets ?? []).map((record) => [record.path, record]));
  for (const readmePath of readmePaths) {
    if (!existsSync(readmePath)) { errors.push(`Release README does not exist: ${path.relative(rootDirectory, readmePath)}`); continue; }
    const placement = readmePlacement(readmePath, rootDirectory);
    for (const entry of findReadmeImageUsages(readFileSync(readmePath, 'utf8'), readmePath, rootDirectory)) {
      if (entry.path.startsWith('REMOTE:')) { errors.push(`${path.relative(rootDirectory, readmePath)} references a remote image path without a local provenance record: ${entry.path.slice(7)}`); continue; }
      if (entry.path.startsWith('INVALID:')) { errors.push(`${path.relative(rootDirectory, readmePath)} references an unsafe image path: ${entry.path.slice(8)}`); continue; }
      const record = recordsByPath.get(entry.path);
      if (!record) { errors.push(`${path.relative(rootDirectory, readmePath)} references an unregistered asset: ${entry.path}`); continue; }
      if (!record.placements?.includes(placement)) errors.push(`${record.id}: ${placement} is not an approved placement`);
      if (record.state === 'publishable_proof') continue;
      if (record.state === 'draft_editorial') {
        for (const usage of entry.usages) validateEditorialUsage(record, usage, record.id, errors);
        continue;
      }
      errors.push(`${record.id}: README release assets must be publishable_proof or explicitly labeled draft_editorial decorative assets`);
    }
  }
  return errors;
}

function parseArguments(argumentsList) {
  const releaseCount = argumentsList.filter((argument) => argument === '--release').length;
  if (releaseCount > 1 || argumentsList.some((argument) => argument !== '--release' && argument !== '--')) throw new Error(`Unsupported argument: ${argumentsList.join(' ')}`);
  return { release: releaseCount === 1 };
}

export async function runGithubAssetCheck(argumentsList = process.argv.slice(2)) {
  const { release } = parseArguments(argumentsList);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const errors = release ? await validateReleaseReadmeAssets(manifest) : await validateGithubAssetManifest(manifest);
  if (errors.length > 0) throw new Error(`Invalid GitHub asset manifest:\n- ${errors.join('\n- ')}`);
  process.stdout.write(`GitHub asset manifest passed ${release ? 'release' : 'default'} validation.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runGithubAssetCheck().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
