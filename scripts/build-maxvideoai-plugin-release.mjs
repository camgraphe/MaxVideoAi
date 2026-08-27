#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  copyFileSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';

const PUBLIC_FILES = [
  '.claude-plugin/marketplace.json',
  '.claude-plugin/plugin.json',
  '.codex-plugin/plugin.json',
  '.mcp.json',
  'CHANGELOG.md',
  'LICENSE',
  'README.md',
  'SECURITY.md',
  'VERSION',
  'assets/logo-mark.svg',
  'skills/generate/SKILL.md',
  'skills/generate/agents/openai.yaml',
  'skills/generate/references/generation-safety.md',
  'skills/generate/references/reference-inputs.md',
  'skills/plan/SKILL.md',
  'skills/plan/agents/openai.yaml',
  'skills/plan/references/budget-planning.md',
];

const FORBIDDEN_NAME = /(^|\/)(\.env(?:\..*)?|.*\.(?:key|pem|p12|pfx|map)|credentials?\.json)$/i;
const FORBIDDEN_CONTENT = [
  { label: 'staging origin', pattern: /maxvideoai-mcp-staging\.vercel\.app/i },
  { label: 'local absolute path', pattern: /\/Users\/[A-Za-z0-9._-]+\// },
  { label: 'private key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { label: 'GitHub token', pattern: /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/ },
  { label: 'OpenAI secret', pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { label: 'Stripe live secret', pattern: /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/ },
];

function fail(message) {
  throw new Error(`Plugin release rejected: ${message}`);
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || !value) {
      fail('expected --source <path> and --out <path>');
    }
    values.set(key, value);
  }
  return {
    source: resolve(values.get('--source') ?? 'plugins/maxvideoai'),
    out: resolve(values.get('--out') ?? 'dist/maxvideoai-plugin-release'),
  };
}

function walk(root, current = root) {
  return readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
    const path = join(current, entry.name);
    const info = lstatSync(path);
    if (info.isSymbolicLink()) {
      fail(`symlink found at ${relative(root, path)}`);
    }
    if (info.isDirectory()) {
      return walk(root, path);
    }
    if (!info.isFile()) {
      fail(`unsupported filesystem entry at ${relative(root, path)}`);
    }
    return [path];
  });
}

function inspectSource(source) {
  const sourceInfo = lstatSync(source);
  if (!sourceInfo.isDirectory() || sourceInfo.isSymbolicLink()) {
    fail('source must be a real directory');
  }

  for (const path of walk(source)) {
    const name = relative(source, path).split(sep).join('/');
    if (FORBIDDEN_NAME.test(name)) {
      fail(`forbidden file found at ${name}`);
    }
    const contents = readFileSync(path);
    if (contents.includes(0)) continue;
    const text = contents.toString('utf8');
    for (const rule of FORBIDDEN_CONTENT) {
      if (rule.pattern.test(text)) {
        fail(`${rule.label} found at ${name}`);
      }
    }
  }

  for (const name of PUBLIC_FILES) {
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

function validateOutput(source, out) {
  const root = parse(out).root;
  if (out === root || out === process.cwd() || source === out || source.startsWith(`${out}${sep}`)) {
    fail('output path is too broad or contains the source');
  }
  if (!isAbsolute(out)) {
    fail('output path must resolve to an absolute path');
  }
}

function sha256(contents) {
  return createHash('sha256').update(contents).digest('hex');
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
  const { source, out } = parseArguments(process.argv.slice(2));
  inspectSource(source);
  validateOutput(source, out);

  const version = readFileSync(join(source, 'VERSION'), 'utf8').trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) fail('VERSION must use semantic versioning');
  for (const manifestName of ['.codex-plugin/plugin.json', '.claude-plugin/plugin.json']) {
    const manifest = JSON.parse(readFileSync(join(source, manifestName), 'utf8'));
    if (manifest.name !== 'maxvideoai' || manifest.version !== version) {
      fail(`${manifestName} name/version does not match maxvideoai@${version}`);
    }
  }

  rmSync(out, { recursive: true, force: true });
  const bundleRoot = join(out, 'maxvideoai-plugin');
  mkdirSync(bundleRoot, { recursive: true });
  for (const name of PUBLIC_FILES) {
    const destination = join(bundleRoot, name);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(join(source, name), destination);
  }

  const checksums = Object.fromEntries(
    PUBLIC_FILES.map((name) => [name, sha256(readFileSync(join(bundleRoot, name)))]),
  );
  writeFileSync(
    join(bundleRoot, 'checksums.json'),
    `${JSON.stringify({ algorithm: 'sha256', files: checksums }, null, 2)}\n`,
  );

  const archiveName = `maxvideoai-plugin-${version}.zip`;
  const archivePath = join(out, archiveName);
  const archiveFiles = [...PUBLIC_FILES, 'checksums.json'].sort();
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
