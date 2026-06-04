#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_PROJECT_ID = 'shy-flower-71253790';
const DEFAULT_BRANCH_LIMIT = 8;
const DEFAULT_DELETE_PATTERN = '^preview/';
const DEFAULT_API_BASE_URL = 'https://console.neon.tech/api/v2';

function parseArgs(argv) {
  const options = {
    projectId: process.env.NEON_BRANCH_GUARD_PROJECT_ID || process.env.NEON_PROJECT_ID || DEFAULT_PROJECT_ID,
    limit: parsePositiveInteger(process.env.NEON_BRANCH_LIMIT, DEFAULT_BRANCH_LIMIT),
    deleteArchived: process.env.NEON_BRANCH_DELETE_ARCHIVED === '1',
    deletePattern: process.env.NEON_BRANCH_DELETE_PATTERN || DEFAULT_DELETE_PATTERN,
    dryRun: process.env.NEON_BRANCH_GUARD_DRY_RUN === '1',
    apiBaseUrl: process.env.NEON_API_BASE_URL || DEFAULT_API_BASE_URL,
  };

  argv.forEach((arg, index) => {
    if (arg === '--delete-archived') options.deleteArchived = true;
    if (arg === '--dry-run') options.dryRun = true;
    if (arg === '--project-id') options.projectId = argv[index + 1] ?? options.projectId;
    if (arg.startsWith('--project-id=')) options.projectId = arg.slice('--project-id='.length);
    if (arg === '--limit') options.limit = parsePositiveInteger(argv[index + 1], options.limit);
    if (arg.startsWith('--limit=')) options.limit = parsePositiveInteger(arg.slice('--limit='.length), options.limit);
    if (arg === '--delete-pattern') options.deletePattern = argv[index + 1] ?? options.deletePattern;
    if (arg.startsWith('--delete-pattern=')) options.deletePattern = arg.slice('--delete-pattern='.length);
  });

  return options;
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function resolveToken() {
  const explicit = process.env.NEON_API_KEY || process.env.NEON_API_TOKEN;
  if (explicit?.trim()) return explicit.trim();

  const credentialsPath = path.join(os.homedir(), '.config', 'neonctl', 'credentials.json');
  try {
    const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));
    const accessToken = typeof credentials.access_token === 'string' ? credentials.access_token.trim() : '';
    return accessToken || null;
  } catch {
    return null;
  }
}

async function neonApi(options, token, resourcePath, init = {}) {
  const url = new URL(resourcePath, `${options.apiBaseUrl.replace(/\/$/, '')}/`);
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Neon API ${init.method ?? 'GET'} ${url.pathname} failed with ${response.status}: ${body}`);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function listBranches(options, token) {
  const payload = await neonApi(options, token, `projects/${options.projectId}/branches`);
  if (!Array.isArray(payload?.branches)) {
    throw new Error('Neon API response did not include a branches array.');
  }
  return payload.branches;
}

async function deleteBranch(options, token, branchId) {
  return neonApi(options, token, `projects/${options.projectId}/branches/${branchId}`, { method: 'DELETE' });
}

function branchStateSummary(branches) {
  const counts = new Map();
  branches.forEach((branch) => {
    const state = branch.current_state || 'unknown';
    counts.set(state, (counts.get(state) ?? 0) + 1);
  });
  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([state, count]) => `${state}:${count}`)
    .join(', ');
}

function printBranchSummary(label, options, branches) {
  console.log(
    `[neon-branch-guard] ${label}: project=${options.projectId} total=${branches.length} limit=${options.limit} states=${branchStateSummary(branches)}`
  );
}

function buildDeleteCandidates(branches, deletePattern) {
  const pattern = new RegExp(deletePattern);
  return branches
    .filter((branch) => branch.primary !== true)
    .filter((branch) => branch.current_state === 'archived')
    .filter((branch) => pattern.test(branch.name ?? ''))
    .sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')));
}

function printOverLimitBranches(branches, limit) {
  const nonPrimary = branches
    .filter((branch) => branch.primary !== true)
    .sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')));
  const sample = nonPrimary.slice(0, 20);
  console.error(`[neon-branch-guard] branch count ${branches.length} exceeds limit ${limit}.`);
  sample.forEach((branch) => {
    console.error(
      `[neon-branch-guard] excess candidate id=${branch.id} name=${branch.name} state=${branch.current_state} created_at=${branch.created_at}`
    );
  });
  if (nonPrimary.length > sample.length) {
    console.error(`[neon-branch-guard] ${nonPrimary.length - sample.length} additional non-primary branches omitted.`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const token = await resolveToken();
  if (!token) {
    throw new Error('Set NEON_API_KEY or NEON_API_TOKEN, or authenticate neonctl locally before running this guard.');
  }

  let branches = await listBranches(options, token);
  printBranchSummary('before', options, branches);

  if (options.deleteArchived) {
    const candidates = buildDeleteCandidates(branches, options.deletePattern);
    console.log(
      `[neon-branch-guard] archived preview branches eligible for deletion=${candidates.length} dry_run=${options.dryRun}`
    );

    for (const [index, branch] of candidates.entries()) {
      if (!options.dryRun) {
        await deleteBranch(options, token, branch.id);
      }
      if ((index + 1) % 25 === 0 || index + 1 === candidates.length) {
        console.log(`[neon-branch-guard] prune progress ${index + 1}/${candidates.length}`);
      }
    }

    if (candidates.length && !options.dryRun) {
      branches = await listBranches(options, token);
      printBranchSummary('after prune', options, branches);
    }
  }

  if (branches.length > options.limit) {
    printOverLimitBranches(branches, options.limit);
    process.exitCode = 1;
    return;
  }

  console.log('[neon-branch-guard] ok');
}

main().catch((error) => {
  console.error(`[neon-branch-guard] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
