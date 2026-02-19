import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const ENGINE_CATALOG_PATH = path.join(ROOT, 'frontend', 'config', 'engine-catalog.json');
const DOCS_DIR = path.join(ROOT, 'docs');
const FRONTEND_CONFIG_DIR = path.join(ROOT, 'frontend', 'config');
const FRONTEND_ROSTER_PATH = path.join(FRONTEND_CONFIG_DIR, 'model-roster.json');
const DOCS_ROSTER_PATH = path.join(DOCS_DIR, 'model-roster.json');
const DOCS_ROSTER_CSV_PATH = path.join(DOCS_DIR, 'model-roster.csv');
const VALID_AVAILABILITY = new Set(['available', 'limited', 'waitlist', 'unavailable', 'paused']);

function parseArgs(argv) {
  return {
    write: argv.includes('--write'),
  };
}

function runEngineCatalog() {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmCmd, ['run', 'engine:catalog'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error('Failed to run "engine:catalog" before roster generation.');
  }
}

async function loadJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

async function loadCurrentRoster() {
  try {
    return await loadJson(FRONTEND_ROSTER_PATH);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

function normalizeAvailability(value, engineId) {
  if (typeof value !== 'string') {
    throw new Error(`Engine "${engineId}" is missing availability.`);
  }
  const normalized = value.trim().toLowerCase();
  if (!VALID_AVAILABILITY.has(normalized)) {
    throw new Error(
      `Engine "${engineId}" has invalid availability "${value}". Expected one of: ${Array.from(VALID_AVAILABILITY).join(', ')}.`
    );
  }
  return normalized;
}

function normalizeVersionLabel(entry) {
  const direct = typeof entry.versionLabel === 'string' ? entry.versionLabel.trim() : '';
  if (direct.length) return direct;
  const engineVersion = typeof entry.engine?.version === 'string' ? entry.engine.version.trim() : '';
  if (engineVersion.length) return engineVersion;
  return '1';
}

function computeRosterEntry(entry) {
  const engineId = typeof entry.engineId === 'string' ? entry.engineId.trim() : '';
  const modelSlug = typeof entry.modelSlug === 'string' ? entry.modelSlug.trim() : '';
  const marketingName = typeof entry.marketingName === 'string' ? entry.marketingName.trim() : '';
  const brandId = typeof entry.brandId === 'string' ? entry.brandId.trim() : '';
  const logoPolicy = typeof entry.logoPolicy === 'string' ? entry.logoPolicy.trim() : '';

  if (!engineId) throw new Error('Catalog entry is missing engineId.');
  if (!modelSlug) throw new Error(`Engine "${engineId}" is missing modelSlug.`);
  if (!marketingName) throw new Error(`Engine "${engineId}" is missing marketingName.`);
  if (!brandId) throw new Error(`Engine "${engineId}" is missing brandId.`);
  if (!logoPolicy) throw new Error(`Engine "${engineId}" is missing logoPolicy.`);

  return {
    engineId,
    marketingName,
    brandId,
    modelSlug,
    versionLabel: normalizeVersionLabel(entry),
    availability: normalizeAvailability(entry.availability, engineId),
    logoPolicy,
  };
}

function ensureNoShrink(currentRoster, generatedRoster) {
  const currentSlugs = currentRoster.map((entry) => entry?.modelSlug).filter((slug) => typeof slug === 'string');
  const generatedSlugs = generatedRoster.map((entry) => entry.modelSlug);
  const generatedSet = new Set(generatedSlugs);
  const missingSlugs = currentSlugs.filter((slug) => !generatedSet.has(slug));

  if (generatedRoster.length < currentRoster.length) {
    throw new Error(
      `Generated roster would shrink from ${currentRoster.length} to ${generatedRoster.length}. Aborting to prevent page removals.`
    );
  }
  if (missingSlugs.length > 0) {
    throw new Error(`Generated roster is missing existing slugs: ${missingSlugs.join(', ')}`);
  }
}

function toCsv(rows) {
  const header = ['engineId', 'marketingName', 'brandId', 'modelSlug', 'versionLabel', 'availability', 'logoPolicy'];
  const lines = [header.join(',')];
  rows.forEach((row) => {
    const values = header.map((key) => {
      const value = row[key] ?? '';
      const needsQuotes = typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'));
      if (!needsQuotes) return value;
      return `"${value.replace(/"/g, '""')}"`;
    });
    lines.push(values.join(','));
  });
  return `${lines.join('\n')}\n`;
}

function summarizeDiff(currentRoster, generatedRoster) {
  const currentBySlug = new Map(currentRoster.map((entry) => [entry.modelSlug, entry]));
  const generatedBySlug = new Map(generatedRoster.map((entry) => [entry.modelSlug, entry]));

  const added = [];
  const removed = [];
  const changed = [];

  generatedBySlug.forEach((entry, slug) => {
    const existing = currentBySlug.get(slug);
    if (!existing) {
      added.push(slug);
      return;
    }
    if (JSON.stringify(existing) !== JSON.stringify(entry)) {
      changed.push(slug);
    }
  });

  currentBySlug.forEach((_entry, slug) => {
    if (!generatedBySlug.has(slug)) {
      removed.push(slug);
    }
  });

  return { added, removed, changed };
}

async function writeOutputs(roster) {
  await Promise.all([fs.mkdir(DOCS_DIR, { recursive: true }), fs.mkdir(FRONTEND_CONFIG_DIR, { recursive: true })]);
  const payload = `${JSON.stringify(roster, null, 2)}\n`;
  await Promise.all([
    fs.writeFile(DOCS_ROSTER_PATH, payload, 'utf-8'),
    fs.writeFile(FRONTEND_ROSTER_PATH, payload, 'utf-8'),
    fs.writeFile(DOCS_ROSTER_CSV_PATH, toCsv(roster), 'utf-8'),
  ]);
}

async function main() {
  const { write } = parseArgs(process.argv.slice(2));
  runEngineCatalog();

  const [catalog, currentRoster] = await Promise.all([loadJson(ENGINE_CATALOG_PATH), loadCurrentRoster()]);
  if (!Array.isArray(catalog)) {
    throw new Error('engine-catalog.json must be an array.');
  }
  if (!Array.isArray(currentRoster)) {
    throw new Error('frontend/config/model-roster.json must be an array when present.');
  }

  const roster = catalog
    .map((entry) => computeRosterEntry(entry))
    .sort((a, b) => {
      if (a.brandId === b.brandId) {
        return a.marketingName.localeCompare(b.marketingName, 'en');
      }
      return a.brandId.localeCompare(b.brandId, 'en');
    });

  ensureNoShrink(currentRoster, roster);
  const currentJson = JSON.stringify(currentRoster, null, 2);
  const generatedJson = JSON.stringify(roster, null, 2);
  const hasChanges = currentJson !== generatedJson;
  const diff = summarizeDiff(currentRoster, roster);

  if (!hasChanges) {
    console.log(`[model-roster] No changes. Entries: ${roster.length}.`);
    return;
  }

  if (!write) {
    console.error('[model-roster] Drift detected in check mode. Re-run with "--write" to apply.');
    console.error(
      `[model-roster] Summary: +${diff.added.length} added, -${diff.removed.length} removed, ~${diff.changed.length} changed.`
    );
    if (diff.added.length) console.error(`[model-roster] Added slugs: ${diff.added.join(', ')}`);
    if (diff.removed.length) console.error(`[model-roster] Removed slugs: ${diff.removed.join(', ')}`);
    if (diff.changed.length) console.error(`[model-roster] Changed slugs: ${diff.changed.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  await writeOutputs(roster);
  console.log(
    `[model-roster] Wrote ${roster.length} entries to frontend/config/model-roster.json and docs/model-roster.{json,csv}.`
  );
}

main().catch((error) => {
  console.error('[model-roster] Failed to generate roster:', error);
  process.exitCode = 1;
});
