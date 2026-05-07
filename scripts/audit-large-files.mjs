#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_ROOT = 'frontend';
const DEFAULT_MIN_LINES = 500;
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const IGNORED_SEGMENTS = new Set([
  '.git',
  '.next',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'playwright-report',
  'test-results',
]);

function printHelp() {
  console.log(`Usage: node scripts/audit-large-files.mjs [options]

Options:
  --root <path>       Directory to scan. Defaults to frontend.
  --min-lines <n>    Only include files with at least n lines. Defaults to 500.
  --json             Emit machine-readable JSON.
  --help             Show this help text.

Examples:
  node scripts/audit-large-files.mjs --min-lines 900
  node scripts/audit-large-files.mjs --json --min-lines 900
`);
}

function parseArgs(argv) {
  const options = {
    root: DEFAULT_ROOT,
    minLines: DEFAULT_MIN_LINES,
    json: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--root') {
      const next = argv[index + 1];
      if (!next) throw new Error('--root requires a path');
      options.root = next;
      index += 1;
      continue;
    }
    if (arg === '--min-lines') {
      const next = argv[index + 1];
      if (!next) throw new Error('--min-lines requires a number');
      const parsed = Number.parseInt(next, 10);
      if (!Number.isFinite(parsed) || parsed < 1) {
        throw new Error('--min-lines must be a positive integer');
      }
      options.minLines = parsed;
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function shouldIgnore(filePath) {
  return filePath.split(path.sep).some((segment) => IGNORED_SEGMENTS.has(segment));
}

function collectSourceFiles(root) {
  const files = [];

  function walk(currentPath) {
    if (shouldIgnore(currentPath)) return;
    const stats = statSync(currentPath);
    if (stats.isDirectory()) {
      for (const entry of readdirSync(currentPath)) {
        walk(path.join(currentPath, entry));
      }
      return;
    }
    if (!stats.isFile()) return;
    if (!SOURCE_EXTENSIONS.has(path.extname(currentPath))) return;
    files.push(currentPath);
  }

  walk(root);
  return files;
}

function countLines(filePath) {
  const source = readFileSync(filePath, 'utf8');
  return source.length === 0 ? 0 : source.split('\n').length;
}

function auditLargeFiles({ root, minLines }) {
  return collectSourceFiles(root)
    .map((filePath) => ({
      file: path.relative(process.cwd(), filePath),
      lines: countLines(filePath),
      bytes: statSync(filePath).size,
    }))
    .filter((row) => row.lines >= minLines)
    .sort((a, b) => b.lines - a.lines || a.file.localeCompare(b.file));
}

function printTable(rows, minLines) {
  if (rows.length === 0) {
    console.log(`No source files found at or above ${minLines} lines.`);
    return;
  }

  console.log(`Large source files (>= ${minLines} lines)`);
  console.log('');
  console.log('Lines  Bytes    File');
  console.log('-----  -------  ----');
  for (const row of rows) {
    console.log(`${String(row.lines).padStart(5)}  ${String(row.bytes).padStart(7)}  ${row.file}`);
  }
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    process.exit(0);
  }

  const root = path.resolve(process.cwd(), options.root);
  const rows = auditLargeFiles({ root, minLines: options.minLines });
  if (options.json) {
    console.log(JSON.stringify(rows, null, 2));
  } else {
    printTable(rows, options.minLines);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`architecture audit failed: ${message}`);
  process.exit(1);
}
