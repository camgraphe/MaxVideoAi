import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const ROSTER_PATH = path.join(ROOT, 'docs', 'model-roster.json');
const DICTIONARIES_PATH = path.join(ROOT, 'frontend', 'lib', 'i18n', 'dictionaries.ts');
const REPORT_PATH = path.join(ROOT, 'docs', 'model-roster-report.md');

function extractModelMetaSlugs(source) {
  const enIndex = source.indexOf('const en: Dictionary');
  const searchStart = enIndex === -1 ? 0 : enIndex;
  const modelsIndex = source.indexOf('models: {', searchStart);
  if (modelsIndex === -1) return [];
  const metaKeyIndex = source.indexOf('meta:', modelsIndex);
  if (metaKeyIndex === -1) return [];
  const braceStart = source.indexOf('{', metaKeyIndex);
  if (braceStart === -1) return [];
  let depth = 0;
  let i = braceStart;
  while (i < source.length) {
    const char = source[i];
    if (char === '{') depth++;
    else if (char === '}') {
      depth--;
      if (depth === 0) {
        break;
      }
    }
    i++;
  }
  const metaSegment = source.slice(braceStart, i + 1);
  const matches = Array.from(metaSegment.matchAll(/['"]([a-z0-9-]+)['"]\s*:\s*{[^}]*displayName:/g));
  return matches.map((match) => match[1]);
}

function extractSlugsFromGallery(source) {
  const enIndex = source.indexOf('const en: Dictionary');
  const slice = enIndex === -1 ? source : source.slice(enIndex);
  const matches = Array.from(slice.matchAll(/meta:\s*{\s*slug:\s*'([a-z0-9-]+)'/g));
  return matches.map((match) => match[1]);
}

function unique(values) {
  return Array.from(new Set(values));
}

async function main() {
  const [rosterRaw, dictionariesRaw] = await Promise.all([
    fs.readFile(ROSTER_PATH, 'utf-8'),
    fs.readFile(DICTIONARIES_PATH, 'utf-8'),
  ]);

  const roster = JSON.parse(rosterRaw);
  const rosterSlugs = new Set(roster.map((entry) => entry.modelSlug));
  const pausedEntries = roster.filter((entry) => entry.availability === 'paused');

  const metaSlugs = extractModelMetaSlugs(dictionariesRaw);
  const gallerySlugs = extractSlugsFromGallery(dictionariesRaw);
  const marketingSlugs = unique([...metaSlugs, ...gallerySlugs]);

  const missingInRoster = marketingSlugs.filter((slug) => !rosterSlugs.has(slug));
  const rosterWithoutMeta = roster.filter((entry) => !metaSlugs.includes(entry.modelSlug));

  const issues = [];
  if (missingInRoster.length) {
    issues.push(`- Missing roster entries for marketing slugs: ${missingInRoster.join(', ')}`);
  }
  if (pausedEntries.length) {
    const slugs = pausedEntries.map((entry) => entry.modelSlug);
    issues.push(`- Models marked as paused in roster: ${slugs.join(', ')}`);
  }
  if (rosterWithoutMeta.length) {
    const slugs = rosterWithoutMeta.map((entry) => entry.modelSlug);
    issues.push(`- Roster slugs without dictionary meta: ${slugs.join(', ')}`);
  }

  const reportLines = [
    '# Model Roster QA Report',
    '',
    `Generated on ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    `- Roster entries: ${roster.length}`,
    `- Marketing slugs referenced: ${marketingSlugs.length}`,
    '',
    '## Checks',
    '',
  ];

  if (issues.length === 0) {
    reportLines.push('- All checks passed.');
  } else {
    reportLines.push(...issues.map((issue) => `- ${issue}`));
  }

  await fs.writeFile(REPORT_PATH, `${reportLines.join('\n')}\n`, 'utf-8');

  if (issues.length) {
    console.error('[model-roster] Validation failed. See docs/model-roster-report.md for details.');
    process.exitCode = 1;
  } else {
    console.log('[model-roster] Validation passed.');
  }
}

main().catch((error) => {
  console.error('[model-roster] Unable to validate roster:', error);
  process.exitCode = 1;
});
