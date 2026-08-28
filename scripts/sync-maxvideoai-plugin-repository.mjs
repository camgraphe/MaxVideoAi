#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC_MARKER = '.maxvideoai-public-repository';
const PUBLIC_MARKER_CONTENT = `${JSON.stringify({
  repository: 'camgraphe/maxvideoai-plugin',
  schemaVersion: 1,
})}\n`;
const SOURCE_REPOSITORY = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));

function fail(message) {
  throw new Error(`Plugin repository sync rejected: ${message}`);
}

function parseArguments(argv) {
  const values = new Map();
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--dry-run') {
      if (dryRun) fail('duplicate argument: --dry-run');
      dryRun = true;
      continue;
    }
    if (argument !== '--source' && argument !== '--target') {
      fail('expected --source <bundle-path> --target <repository-path> [--dry-run]');
    }
    if (values.has(argument)) fail(`duplicate argument: ${argument}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      fail(`missing value for ${argument}`);
    }
    values.set(argument, value);
    index += 1;
  }

  if (!values.has('--source') || !values.has('--target')) {
    fail('both --source and --target are required');
  }
  return {
    dryRun,
    requestedSource: resolve(values.get('--source')),
    requestedTarget: resolve(values.get('--target')),
  };
}

function isInside(parent, candidate) {
  const relationship = relative(parent, candidate);
  return (
    relationship === '' ||
    (!relationship.startsWith(`..${sep}`) && relationship !== '..' && !isAbsolute(relationship))
  );
}

function assertExistingRealDirectory(path, label) {
  if (!existsSync(path)) fail(`${label} path does not exist`);
  const info = lstatSync(path);
  if (info.isSymbolicLink()) fail(`${label} path must not be a symlink`);
  if (!info.isDirectory()) fail(`${label} path must be a directory`);
  const canonical = realpathSync(path);
  if (canonical !== path) fail(`${label} path must be fully resolved`);
  return canonical;
}

function assertNoSymlinkedAncestor(path, label) {
  const root = parse(path).root;
  const segments = relative(root, path).split(sep).filter(Boolean);
  let current = root;
  for (const segment of segments) {
    current = join(current, segment);
    const info = lstatSync(current);
    if (info.isSymbolicLink()) fail(`${label} path has a symlinked ancestor: ${current}`);
  }
}

function protectedTargetPaths(target) {
  const filesystemRoot = parse(target).root;
  return new Set(
    [
      filesystemRoot,
      SOURCE_REPOSITORY,
      homedir(),
      dirname(homedir()),
      tmpdir(),
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
    ]
      .filter(Boolean)
      .map((path) => resolve(path)),
  );
}

function validatePaths(requestedSource, requestedTarget) {
  const source = assertExistingRealDirectory(requestedSource, 'source');
  const target = assertExistingRealDirectory(requestedTarget, 'target');
  assertNoSymlinkedAncestor(target, 'target');

  if (protectedTargetPaths(target).has(target)) {
    fail('target path is protected or is the source repository workspace');
  }
  if (isInside(SOURCE_REPOSITORY, target)) {
    fail('target path must not be inside the source repository workspace');
  }
  if (isInside(source, target) || isInside(target, source)) {
    fail('source and target paths must not overlap');
  }
  return { source, target };
}

function normalizedName(root, path) {
  return relative(root, path).split(sep).join('/');
}

function treeInventory(root, current = root, excludedRootNames = new Set()) {
  return readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
    if (current === root && excludedRootNames.has(entry.name)) return [];
    const path = join(current, entry.name);
    const name = normalizedName(root, path);
    const info = lstatSync(path);
    if (info.isSymbolicLink()) fail(`symlink entry found at ${name}`);
    if (info.isDirectory()) {
      return [{ name, kind: 'directory' }, ...treeInventory(root, path, excludedRootNames)];
    }
    if (!info.isFile()) fail(`unsupported filesystem entry found at ${name}`);
    return [{ name, kind: 'file' }];
  });
}

function expectedInventory(files) {
  const entries = new Map(files.map((name) => [name, 'file']));
  for (const name of files) {
    let parent = dirname(name).split(sep).join('/');
    while (parent !== '.') {
      entries.set(parent, 'directory');
      parent = dirname(parent).split(sep).join('/');
    }
  }
  return [...entries.entries()]
    .map(([name, kind]) => ({ name, kind }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function assertExactInventory(actual, expected, label) {
  const expectedByName = new Map(expected.map((entry) => [entry.name, entry.kind]));
  for (const entry of actual) {
    if (expectedByName.get(entry.name) !== entry.kind) {
      fail(`unexpected ${label} entry: ${entry.name}`);
    }
  }
  const actualByName = new Map(actual.map((entry) => [entry.name, entry.kind]));
  for (const entry of expected) {
    if (actualByName.get(entry.name) !== entry.kind) {
      fail(`${label} entry is missing: ${entry.name}`);
    }
  }
}

function sha256(contents) {
  return createHash('sha256').update(contents).digest('hex');
}

function assertSafeManifestPath(name) {
  if (
    typeof name !== 'string' ||
    name.length === 0 ||
    name.startsWith('/') ||
    name.includes('\\') ||
    name.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    fail(`unsafe checksum path: ${String(name)}`);
  }
  if (name === 'checksums.json' || name === PUBLIC_MARKER || name === '.git' || name.startsWith('.git/')) {
    fail(`reserved checksum path: ${name}`);
  }
}

function validateBundle(source) {
  const checksumPath = join(source, 'checksums.json');
  let checksumInfo;
  try {
    checksumInfo = lstatSync(checksumPath);
  } catch {
    fail('source checksums.json is missing');
  }
  if (!checksumInfo.isFile() || checksumInfo.isSymbolicLink()) {
    fail('source checksums.json must be a regular file');
  }

  const checksumContents = readFileSync(checksumPath);
  let manifest;
  try {
    manifest = JSON.parse(checksumContents.toString('utf8'));
  } catch {
    fail('source checksums.json must be valid JSON');
  }
  if (
    manifest?.algorithm !== 'sha256' ||
    !manifest.files ||
    typeof manifest.files !== 'object' ||
    Array.isArray(manifest.files)
  ) {
    fail('source checksums.json must use sha256 and contain a files object');
  }

  const files = Object.keys(manifest.files);
  if (files.length === 0) fail('source checksums.json must contain at least one file');
  for (const name of files) assertSafeManifestPath(name);
  const sortedFiles = [...files].sort();
  if (files.some((name, index) => name !== sortedFiles[index])) {
    fail('source checksums.json file inventory must be sorted');
  }

  const inventoryFiles = [...files, 'checksums.json'];
  assertExactInventory(
    treeInventory(source).sort((left, right) => left.name.localeCompare(right.name)),
    expectedInventory(inventoryFiles),
    'source',
  );

  for (const name of files) {
    const digest = manifest.files[name];
    if (typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest)) {
      fail(`invalid checksum for source file: ${name}`);
    }
    if (sha256(readFileSync(join(source, name))) !== digest) {
      fail(`checksum mismatch for source file: ${name}`);
    }
  }

  if (!files.includes('VERSION')) fail('source checksum inventory must include VERSION');
  const version = readFileSync(join(source, 'VERSION'), 'utf8').trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) fail('source VERSION must use semantic versioning');
  return { checksumContents, checksums: manifest.files, files, version };
}

function validatePublicRepository(target) {
  const gitPath = join(target, '.git');
  let gitInfo;
  try {
    gitInfo = lstatSync(gitPath);
  } catch {
    fail('target .git directory is missing');
  }
  if (!gitInfo.isDirectory() || gitInfo.isSymbolicLink()) {
    fail('target .git must be a real directory');
  }

  const markerPath = join(target, PUBLIC_MARKER);
  let markerInfo;
  try {
    markerInfo = lstatSync(markerPath);
  } catch {
    fail(`target marker ${PUBLIC_MARKER} is missing`);
  }
  if (
    !markerInfo.isFile() ||
    markerInfo.isSymbolicLink() ||
    readFileSync(markerPath, 'utf8') !== PUBLIC_MARKER_CONTENT
  ) {
    fail(`target marker ${PUBLIC_MARKER} is invalid`);
  }

  return treeInventory(target, target, new Set(['.git', PUBLIC_MARKER]));
}

function publicChangeReport(source, target, files, targetInventory) {
  const sourceSet = new Set(files);
  const targetFiles = targetInventory
    .filter((entry) => entry.kind === 'file')
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
  const remove = targetFiles.filter((name) => !sourceSet.has(name));
  const write = files.filter((name) => {
    const path = join(target, name);
    if (!existsSync(path) || !lstatSync(path).isFile()) return true;
    return !readFileSync(path).equals(readFileSync(join(source, name)));
  });
  return { remove, write };
}

function copyBundle(source, target, files) {
  for (const entry of readdirSync(target)) {
    if (entry === '.git' || entry === PUBLIC_MARKER) continue;
    rmSync(join(target, entry), { recursive: true, force: true });
  }
  for (const name of files) {
    const destination = join(target, name);
    mkdirSync(dirname(destination), { recursive: true, mode: 0o755 });
    copyFileSync(join(source, name), destination);
    chmodSync(destination, 0o644);
  }
}

function validateSynchronizedTarget(target, files, checksums, checksumContents) {
  const inventory = treeInventory(target, target, new Set(['.git', PUBLIC_MARKER]));
  assertExactInventory(
    inventory.sort((left, right) => left.name.localeCompare(right.name)),
    expectedInventory(files),
    'target',
  );
  if (!readFileSync(join(target, 'checksums.json')).equals(checksumContents)) {
    fail('target checksums.json differs after synchronization');
  }
  for (const [name, expectedDigest] of Object.entries(checksums)) {
    const targetDigest = sha256(readFileSync(join(target, name)));
    if (targetDigest !== expectedDigest) {
      fail(`target checksum mismatch after synchronization: ${name}`);
    }
  }
}

function main() {
  const { dryRun, requestedSource, requestedTarget } = parseArguments(process.argv.slice(2));
  const { source, target } = validatePaths(requestedSource, requestedTarget);
  const { checksumContents, checksums, files: checkedFiles, version } = validateBundle(source);
  const files = [...checkedFiles, 'checksums.json'].sort();
  const targetInventory = validatePublicRepository(target);
  const changes = publicChangeReport(source, target, files, targetInventory);

  if (!dryRun) {
    copyBundle(source, target, files);
    validateSynchronizedTarget(target, files, checksums, checksumContents);
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        dryRun,
        fileCount: files.length,
        remove: changes.remove,
        version,
        write: changes.write,
      },
      null,
      2,
    )}\n`,
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
