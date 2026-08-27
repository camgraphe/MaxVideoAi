import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { readImageDimensions } from './register-github-asset.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const manifestPath = path.join(repositoryRoot, 'docs/marketing/github-asset-manifest.json');
const states = new Set(['reference_only', 'draft_editorial', 'publishable_proof', 'retired']);
const kinds = new Set(['host_proof', 'product_proof', 'editorial']);
const environments = new Set(['production', 'controlled_demo', 'generated_editorial']);
const semanticIdPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const revisionPattern = /^[a-f0-9]{40}$/;

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isSafeRelativePath(value, rootDirectory) {
  if (!isNonEmptyString(value) || path.isAbsolute(value) || value.includes('\\') || value.split('/').includes('..')) return false;
  const resolved = path.resolve(rootDirectory, value);
  return resolved.startsWith(`${rootDirectory}${path.sep}`);
}

function isDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)?$/.test(value) && !Number.isNaN(Date.parse(value));
}

function isNullableString(value) {
  return value === null || typeof value === 'string';
}

function validateAlt(value) {
  return isNonEmptyString(value) && value.trim().split(/\s+/).length >= 4 && !/^(screenshot|image|demo)$/i.test(value.trim());
}

function absoluteAssetPath(assetPath, rootDirectory) {
  return path.resolve(rootDirectory, assetPath);
}

function validateRecord(record, rootDirectory, seenIds, seenPaths) {
  const errors = [];
  const prefix = isNonEmptyString(record?.id) ? record.id : 'asset';
  if (!record || typeof record !== 'object' || Array.isArray(record)) return ['Asset record must be an object'];
  if (!semanticIdPattern.test(record.id ?? '')) errors.push(`${prefix}: id must be a semantic kebab-case identifier`);
  if (seenIds.has(record.id)) errors.push(`${prefix}: duplicate asset id`);
  seenIds.add(record.id);
  if (!isSafeRelativePath(record.path, rootDirectory)) {
    errors.push(`${prefix}: path must be a safe repository-relative path`);
  } else {
    if (seenPaths.has(record.path)) errors.push(`${prefix}: duplicate asset path`);
    seenPaths.add(record.path);
    const absolutePath = absoluteAssetPath(record.path, rootDirectory);
    if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
      errors.push(`${prefix}: asset path does not exist as a file: ${record.path}`);
    } else {
      try {
        const bytes = readFileSync(absolutePath);
        const image = readImageDimensions(bytes);
        if (record.width !== image.width || record.height !== image.height) {
          errors.push(`${prefix}: dimensions do not match current ${image.format.toUpperCase()} bytes`);
        }
        const actualHash = createHash('sha256').update(bytes).digest('hex');
        if (record.sha256 !== actualHash) errors.push(`${prefix}: sha256 does not match current bytes`);
      } catch (error) {
        errors.push(`${prefix}: image must be a supported, well-formed PNG, JPEG, or WebP (${error.message})`);
      }
    }
  }
  if (!kinds.has(record.kind)) errors.push(`${prefix}: kind must be host_proof, product_proof, or editorial`);
  if (!states.has(record.state)) errors.push(`${prefix}: state must be reference_only, draft_editorial, publishable_proof, or retired`);
  if (!environments.has(record.sourceEnvironment)) errors.push(`${prefix}: sourceEnvironment is invalid`);
  if (!Number.isInteger(record.width) || record.width < 1 || !Number.isInteger(record.height) || record.height < 1) errors.push(`${prefix}: dimensions must be positive integers`);
  if (!sha256Pattern.test(record.sha256 ?? '')) errors.push(`${prefix}: sha256 must be a 64-character lowercase hexadecimal hash`);
  if (!isNonEmptyString(record.claim)) errors.push(`${prefix}: claim is required`);
  if (!Array.isArray(record.placements) || record.placements.length === 0 || record.placements.some((placement) => !isNonEmptyString(placement))) errors.push(`${prefix}: placements must contain one or more non-empty values`);
  if (!validateAlt(record.alt)) errors.push(`${prefix}: alt must be descriptive, not a generic image label`);
  if (!isNonEmptyString(record.reviewTrigger)) errors.push(`${prefix}: reviewTrigger is required`);
  if (!isNullableString(record.capturedAt)) errors.push(`${prefix}: capturedAt must be an ISO date or null`);
  if (record.capturedAt !== null && !isDate(record.capturedAt)) errors.push(`${prefix}: capturedAt must be an ISO date`);
  if (!isNullableString(record.host)) errors.push(`${prefix}: host must be a string or null`);
  if (!isNullableString(record.hostVersion)) errors.push(`${prefix}: hostVersion must be a string or null`);
  if (!isNullableString(record.maxvideoaiRevision)) errors.push(`${prefix}: maxvideoaiRevision must be a 40-character revision or null`);
  if (record.maxvideoaiRevision !== null && !revisionPattern.test(record.maxvideoaiRevision)) errors.push(`${prefix}: maxvideoaiRevision must be a 40-character lowercase hexadecimal revision`);
  if (!isNullableString(record.approvedBy)) errors.push(`${prefix}: approvedBy must be a string or null`);

  if (record.state === 'publishable_proof') {
    for (const field of ['capturedAt', 'maxvideoaiRevision', 'approvedBy']) {
      if (!isNonEmptyString(record[field])) errors.push(`${prefix}: publishable_proof requires ${field}`);
    }
    if (record.kind === 'host_proof') {
      for (const field of ['host', 'hostVersion']) {
        if (!isNonEmptyString(record[field])) errors.push(`${prefix}: publishable host_proof requires ${field}`);
      }
    }
  }
  if (record.state === 'draft_editorial') {
    if (record.kind !== 'editorial' || record.sourceEnvironment !== 'generated_editorial') errors.push(`${prefix}: draft_editorial must be generated editorial, never proof`);
    if (!/editorial/i.test(record.claim ?? '')) errors.push(`${prefix}: draft_editorial claim must explicitly identify editorial use`);
  }
  return errors;
}

export function validateGithubAssetManifest(manifest, { repositoryRoot: rootDirectory = repositoryRoot } = {}) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return ['Asset manifest must be an object'];
  const errors = [];
  if (manifest.version !== 1) errors.push('Asset manifest version must be 1');
  if (!Array.isArray(manifest.assets)) return [...errors, 'Asset manifest assets must be an array'];
  const seenIds = new Set();
  const seenPaths = new Set();
  for (const record of manifest.assets) errors.push(...validateRecord(record, rootDirectory, seenIds, seenPaths));
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

export function findReadmeImageReferences(markdown, readmePath, rootDirectory = repositoryRoot) {
  const candidates = [];
  for (const match of markdown.matchAll(/!\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+[^)]*)?\)/g)) candidates.push(match[1]);
  for (const match of markdown.matchAll(/<img\b[^>]*?\bsrc=["']([^"']+)["'][^>]*>/gi)) candidates.push(match[1]);
  for (const match of markdown.matchAll(/<source\b[^>]*?\bsrcset=["']([^"']+)["'][^>]*>/gi)) candidates.push(match[1].split(',')[0].trim().split(/\s+/)[0]);
  return [...new Set(candidates.map((candidate) => toRepositoryPath(candidate, readmePath, rootDirectory)).filter((candidate) => candidate !== null))];
}

function readmePlacement(readmePath, rootDirectory) {
  const normalized = path.relative(rootDirectory, readmePath).split(path.sep).join('/');
  if (normalized === 'README.md') return 'root_readme';
  if (normalized === 'plugins/maxvideoai/README.md') return 'plugin_readme';
  return 'readme';
}

export function validateReleaseReadmeAssets(manifest, { repositoryRoot: rootDirectory = repositoryRoot, readmePaths = [path.join(rootDirectory, 'README.md'), path.join(rootDirectory, 'plugins/maxvideoai/README.md')] } = {}) {
  const errors = [];
  const recordsByPath = new Map((manifest?.assets ?? []).map((record) => [record.path, record]));
  for (const readmePath of readmePaths) {
    if (!existsSync(readmePath)) {
      errors.push(`Release README does not exist: ${path.relative(rootDirectory, readmePath)}`);
      continue;
    }
    const placement = readmePlacement(readmePath, rootDirectory);
    for (const assetPath of findReadmeImageReferences(readFileSync(readmePath, 'utf8'), readmePath, rootDirectory)) {
      if (assetPath.startsWith('REMOTE:')) {
        errors.push(`${path.relative(rootDirectory, readmePath)} references a remote image path without a local provenance record: ${assetPath.slice(7)}`);
        continue;
      }
      if (assetPath.startsWith('INVALID:')) {
        errors.push(`${path.relative(rootDirectory, readmePath)} references an unsafe image path: ${assetPath.slice(8)}`);
        continue;
      }
      const record = recordsByPath.get(assetPath);
      if (!record) {
        errors.push(`${path.relative(rootDirectory, readmePath)} references an unregistered asset: ${assetPath}`);
        continue;
      }
      if (!record.placements?.includes(placement)) errors.push(`${record.id}: ${placement} is not an approved placement`);
      if (record.state === 'publishable_proof') continue;
      if (record.state === 'draft_editorial' && record.kind === 'editorial' && record.sourceEnvironment === 'generated_editorial' && /editorial-only/i.test(record.claim ?? '')) continue;
      errors.push(`${record.id}: README release assets must be publishable_proof or explicitly labeled editorial-only draft_editorial decorative assets`);
    }
  }
  return errors;
}

function parseArguments(argumentsList) {
  const release = argumentsList.filter((argument) => argument === '--release').length === 1;
  if (argumentsList.some((argument) => argument !== '--release' && argument !== '--')) throw new Error(`Unsupported argument: ${argumentsList.join(' ')}`);
  return { release };
}

export function runGithubAssetCheck(argumentsList = process.argv.slice(2)) {
  const { release } = parseArguments(argumentsList);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const errors = validateGithubAssetManifest(manifest);
  if (release) errors.push(...validateReleaseReadmeAssets(manifest));
  if (errors.length > 0) throw new Error(`Invalid GitHub asset manifest:\n- ${errors.join('\n- ')}`);
  process.stdout.write(`GitHub asset manifest passed ${release ? 'release' : 'default'} validation.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runGithubAssetCheck();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
