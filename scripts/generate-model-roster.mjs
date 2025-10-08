import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const FIXTURES_PATH = path.join(ROOT, 'fixtures', 'engines.json');
const SLUGS_PATH = path.join(ROOT, 'frontend', 'config', 'model-slugs.json');
const DOCS_DIR = path.join(ROOT, 'docs');
const FRONTEND_CONFIG_DIR = path.join(ROOT, 'frontend', 'config');

async function loadJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

function normaliseVersionLabel(engine) {
  if (typeof engine.version === 'string' && engine.version.trim().length) {
    return engine.version.trim();
  }
  if (engine.metadata?.versionLabel && typeof engine.metadata.versionLabel === 'string') {
    return engine.metadata.versionLabel.trim();
  }
  return '1';
}

function computeRosterEntry(engine, slugMap) {
  const marketingName = engine.label?.trim();
  const versionLabel = normaliseVersionLabel(engine);
  const modelSlug = slugMap[engine.id];
  if (!marketingName) {
    throw new Error(`Engine "${engine.id}" is missing a marketing name (label).`);
  }
  if (!modelSlug) {
    throw new Error(`Missing model slug for engineId "${engine.id}". Add it to frontend/config/model-slugs.json.`);
  }
  const availability = engine.availability ?? 'available';
  const logoPolicy = engine.brandAssetPolicy?.logoAllowed ? 'logoAllowed' : 'textOnly';
  return {
    engineId: engine.id,
    marketingName,
    brandId: engine.brandId,
    modelSlug,
    versionLabel,
    availability,
    logoPolicy,
  };
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

async function main() {
  const [fixtures, slugMap] = await Promise.all([loadJson(FIXTURES_PATH), loadJson(SLUGS_PATH)]);
  const engines = Array.isArray(fixtures.engines) ? fixtures.engines : [];

  const roster = engines
    .filter((engine) => engine && engine.id && engine.brandId)
    .map((engine) => computeRosterEntry(engine, slugMap))
    .sort((a, b) => {
      if (a.brandId === b.brandId) {
        return a.marketingName.localeCompare(b.marketingName, 'en');
      }
      return a.brandId.localeCompare(b.brandId, 'en');
    });

  await Promise.all([
    fs.mkdir(DOCS_DIR, { recursive: true }),
    fs.mkdir(FRONTEND_CONFIG_DIR, { recursive: true }),
  ]);
  await fs.writeFile(path.join(DOCS_DIR, 'model-roster.json'), JSON.stringify(roster, null, 2));
  await fs.writeFile(path.join(FRONTEND_CONFIG_DIR, 'model-roster.json'), JSON.stringify(roster, null, 2));
  await fs.writeFile(path.join(DOCS_DIR, 'model-roster.csv'), toCsv(roster), 'utf-8');

  console.log(`Generated roster with ${roster.length} entries.`);
}

main().catch((error) => {
  console.error('[model-roster] Failed to generate roster:', error);
  process.exitCode = 1;
});
