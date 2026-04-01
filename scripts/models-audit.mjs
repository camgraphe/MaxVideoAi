import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const ENGINE_CATALOG_PATH = path.join(ROOT, 'frontend', 'config', 'engine-catalog.json');
const MODEL_ROSTER_PATH = path.join(ROOT, 'frontend', 'config', 'model-roster.json');
const CONTENT_MODELS_ROOT = path.join(ROOT, 'content', 'models');
const REPORTS_DIR = path.join(ROOT, '.reports');
const REPORT_PATH = path.join(REPORTS_DIR, 'models-audit.json');
const LOCALES = ['en', 'fr', 'es'];
const PRELAUNCH_CONTENT_RULES = [
  {
    modelSlug: 'seedance-2-0',
    requiredAvailability: 'waitlist',
    acceptedLaunchSnippetsByLocale: {
      en: ['coming soon', 'official date tba', 'launch date tba'],
      fr: ['pré-lancement', 'date officielle à confirmer'],
      es: ['prelanzamiento', 'fecha oficial por confirmar'],
    },
  },
];

const CANONICAL_AVAILABILITY = new Set(['available', 'limited', 'waitlist', 'unavailable']);
const LEGACY_AVAILABILITY = new Set(['paused']);
const VALID_STATUS = new Set(['live', 'early_access', 'busy', 'degraded', 'maintenance', 'paused', 'deprecated']);
const VALID_EXAMPLES_STAGES = new Set(['hidden', 'public_noindex', 'indexed']);
const TEMPLATE_MARKER_REGEX = /\{\{[^}]+\}\}/g;
const GRANDFATHERED_DEFAULT_SURFACE_SLUGS = new Set([
  'kling-2-5-turbo',
  'kling-2-6-pro',
  'kling-3-pro',
  'kling-3-standard',
  'ltx-2',
  'ltx-2-3-fast',
  'ltx-2-3-pro',
  'ltx-2-fast',
  'minimax-hailuo-02-text',
  'nano-banana',
  'nano-banana-2',
  'nano-banana-pro',
  'pika-text-to-video',
  'seedance-1-5-pro',
  'seedance-2-0',
  'sora-2',
  'sora-2-pro',
  'veo-3-1',
  'veo-3-1-fast',
  'wan-2-5',
  'wan-2-6',
]);
const GRANDFATHERED_PRELAUNCH_COMPARE_PUBLICATION_SLUGS = new Set(['seedance-2-0']);

function parseArgs(argv) {
  return {
    runtime: argv.includes('--runtime'),
  };
}

async function loadJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

function normalizeAvailability(value) {
  if (typeof value !== 'string') {
    return { normalized: null, legacy: false, valid: false };
  }
  const normalized = value.trim().toLowerCase();
  if (CANONICAL_AVAILABILITY.has(normalized)) {
    return { normalized, legacy: false, valid: true };
  }
  if (LEGACY_AVAILABILITY.has(normalized)) {
    return { normalized: 'unavailable', legacy: true, valid: true };
  }
  return { normalized: null, legacy: false, valid: false };
}

function normalizeStatus(value) {
  if (typeof value !== 'string') {
    return { normalized: null, valid: false };
  }
  const normalized = value.trim().toLowerCase();
  if (!VALID_STATUS.has(normalized)) {
    return { normalized: null, valid: false };
  }
  return { normalized, valid: true };
}

function addIssue(collection, level, type, message, details = {}) {
  collection[level].push({ type, message, ...details });
}

function setFromSlugs(entries, key = 'modelSlug') {
  return new Set(entries.map((entry) => entry?.[key]).filter((slug) => typeof slug === 'string' && slug.length));
}

function diffSet(left, right) {
  const missing = [];
  left.forEach((value) => {
    if (!right.has(value)) missing.push(value);
  });
  return missing.sort((a, b) => a.localeCompare(b, 'en'));
}

async function loadLocaleContentSlugs(locale) {
  const localeDir = path.join(CONTENT_MODELS_ROOT, locale);
  const fileNames = await fs.readdir(localeDir);
  return new Set(
    fileNames
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.replace(/\.json$/, ''))
      .filter(Boolean)
  );
}

async function loadLocaleContentEntry(locale, slug) {
  const filePath = path.join(CONTENT_MODELS_ROOT, locale, `${slug}.json`);
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

function hasNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function collectStringValues(value, output = []) {
  if (typeof value === 'string') {
    output.push(value);
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectStringValues(entry, output));
    return output;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach((entry) => collectStringValues(entry, output));
  }
  return output;
}

function getMarketingCoverage(content) {
  const custom = content?.custom && typeof content.custom === 'object' ? content.custom : {};

  return {
    hero: Boolean(
      hasNonEmptyString(content?.hero?.title) &&
        hasNonEmptyString(content?.hero?.ctaPrimary?.label) &&
        hasNonEmptyString(content?.hero?.ctaPrimary?.href)
    ),
    useCases: Boolean(
      hasNonEmptyArray(content?.bestUseCases?.items) ||
        hasNonEmptyArray(custom?.bestUseCases) ||
        hasNonEmptyArray(custom?.heroHighlights)
    ),
    specs: Boolean(
      hasNonEmptyArray(content?.technicalOverview) ||
        hasNonEmptyArray(custom?.specSections) ||
        hasNonEmptyString(content?.pricingNotes)
    ),
    prompting: Boolean(
      content?.promptStructure || hasNonEmptyArray(custom?.promptingTabs) || hasNonEmptyArray(content?.prompts)
    ),
    faq: hasNonEmptyArray(content?.faqs),
    gallery: Boolean(
      hasNonEmptyString(custom?.galleryTitle) ||
        hasNonEmptyString(custom?.galleryIntro) ||
        hasNonEmptyString(custom?.galleryAllCta)
    ),
    closingCta: Boolean(
      hasNonEmptyString(custom?.finalPara1) ||
        hasNonEmptyString(custom?.finalButton) ||
        hasNonEmptyString(custom?.relatedTitle) ||
        hasNonEmptyString(custom?.comparisonTitle) ||
        hasNonEmptyArray(custom?.relatedItems)
    ),
  };
}

async function runMarketingContentChecks(catalogBySlug, issues) {
  const modelSlugs = Array.from(catalogBySlug.keys()).sort((a, b) => a.localeCompare(b, 'en'));
  for (const modelSlug of modelSlugs) {
    let content = null;
    try {
      content = await loadLocaleContentEntry('en', modelSlug);
    } catch {
      continue;
    }

    const coverage = getMarketingCoverage(content);
    const missingCriticalBlocks = Object.entries({
      hero: coverage.hero,
      useCases: coverage.useCases,
      specs: coverage.specs,
      prompting: coverage.prompting,
      faq: coverage.faq,
    })
      .filter(([, present]) => !present)
      .map(([key]) => key);

    if (missingCriticalBlocks.length) {
      addIssue(
        issues,
        'critical',
        'marketing_content_blocks_missing',
        `Model "${modelSlug}" is missing required EN marketing blocks: ${missingCriticalBlocks.join(', ')}.`,
        { modelSlug, locale: 'en', missingBlocks: missingCriticalBlocks }
      );
    }

    const missingWarningBlocks = Object.entries({
      gallery: coverage.gallery,
      closingCta: coverage.closingCta,
    })
      .filter(([, present]) => !present)
      .map(([key]) => key);

    if (missingWarningBlocks.length) {
      addIssue(
        issues,
        'warning',
        'marketing_content_blocks_thin',
        `Model "${modelSlug}" is missing optional EN marketing blocks that usually make pages denser: ${missingWarningBlocks.join(', ')}.`,
        { modelSlug, locale: 'en', missingBlocks: missingWarningBlocks }
      );
    }

    for (const locale of LOCALES) {
      let localizedContent = null;
      try {
        localizedContent = locale === 'en' ? content : await loadLocaleContentEntry(locale, modelSlug);
      } catch {
        continue;
      }
      const templateMarkers = Array.from(
        new Set(
          collectStringValues(localizedContent)
            .flatMap((entry) => entry.match(TEMPLATE_MARKER_REGEX) ?? [])
            .filter(Boolean)
        )
      );

      if (templateMarkers.length) {
        addIssue(
          issues,
          'critical',
          'template_markers_left_in_content',
          `Model "${modelSlug}" still contains unresolved template markers in ${locale.toUpperCase()} content: ${templateMarkers.join(', ')}.`,
          { modelSlug, locale, markers: templateMarkers }
        );
      }
    }
  }
}

function validateCatalogEntries(catalog, issues) {
  const familyExamplesState = new Map();
  catalog.forEach((entry) => {
    const engineId = typeof entry?.engineId === 'string' ? entry.engineId : '';
    const modelSlug = typeof entry?.modelSlug === 'string' ? entry.modelSlug : '';
    const availabilityRaw = entry?.availability;
    const statusRaw = entry?.engine?.status;

    if (!engineId) {
      addIssue(issues, 'critical', 'missing_engine_id', 'Catalog entry missing engineId.', { modelSlug });
    }
    if (!modelSlug) {
      addIssue(issues, 'critical', 'missing_model_slug', `Catalog entry missing modelSlug (engineId: ${engineId || 'unknown'}).`);
    }

    const availability = normalizeAvailability(availabilityRaw);
    if (!availability.valid) {
      addIssue(
        issues,
        'critical',
        'invalid_catalog_availability',
        `Catalog entry "${engineId || modelSlug || 'unknown'}" has invalid availability "${String(availabilityRaw)}".`
      );
    } else if (availability.legacy) {
      addIssue(
        issues,
        'warning',
        'legacy_availability_value',
        `Catalog entry "${engineId || modelSlug}" uses legacy availability "paused"; normalized to "unavailable" in audit.`
      );
    }

    const status = normalizeStatus(statusRaw);
    if (!status.valid) {
      addIssue(
        issues,
        'critical',
        'invalid_catalog_status',
        `Catalog entry "${engineId || modelSlug || 'unknown'}" has invalid status "${String(statusRaw)}".`
      );
      return;
    }

    if (status.normalized === 'paused' && availability.normalized === 'available') {
      addIssue(
        issues,
        'critical',
        'incoherent_status_availability',
        `Catalog entry "${engineId || modelSlug}" has status "paused" with availability "available".`
      );
    }

    const modes = Array.isArray(entry?.engine?.modes) ? entry.engine.modes : [];
    const hasVideoMode = modes.some((mode) => typeof mode === 'string' && mode.endsWith('v'));
    const family = typeof entry?.family === 'string' ? entry.family.trim() : '';
    if (hasVideoMode && !family) {
      addIssue(
        issues,
        'critical',
        'missing_catalog_family',
        `Catalog entry "${engineId || modelSlug}" is missing family. Add family to keep examples and compare surfaces automatic.`,
        { modelSlug }
      );
    }

    const surfaces = entry?.surfaces;
    if (!surfaces || typeof surfaces !== 'object') {
      addIssue(
        issues,
        'critical',
        'missing_catalog_surfaces',
        `Catalog entry "${engineId || modelSlug}" is missing surfaces.`,
        { modelSlug }
      );
      return;
    }

    const surfacesSource = typeof entry?.surfacesSource === 'string' ? entry.surfacesSource : 'unknown';
    if (surfacesSource !== 'explicit' && !GRANDFATHERED_DEFAULT_SURFACE_SLUGS.has(modelSlug)) {
      addIssue(
        issues,
        'critical',
        'missing_explicit_surfaces',
        `Catalog entry "${engineId || modelSlug}" still relies on default surfaces. New models must declare surfaces explicitly.`,
        { modelSlug, surfacesSource }
      );
    }

    const examplesSurface = surfaces.examples ?? {};
    if (hasVideoMode && family && examplesSurface.includeInFamilyResolver !== true) {
      addIssue(
        issues,
        'warning',
        'family_resolver_disabled',
        `Catalog entry "${engineId || modelSlug}" has a family but is not routed into examples family resolution.`,
        { modelSlug, family }
      );
    }

    const compareSurface = surfaces.compare ?? {};
    const publishedPairs = Array.isArray(compareSurface.publishedPairs) ? compareSurface.publishedPairs : [];
    if (compareSurface.includeInHub === true && publishedPairs.length === 0) {
      addIssue(
        issues,
        'critical',
        'compare_hub_without_published_pairs',
        `Catalog entry "${engineId || modelSlug}" is published in compare hub without publishedPairs.`,
        { modelSlug }
      );
    }

    if ((compareSurface.includeInHub === true || publishedPairs.length > 0) && availability.normalized === 'waitlist') {
      if (GRANDFATHERED_PRELAUNCH_COMPARE_PUBLICATION_SLUGS.has(modelSlug)) {
        addIssue(
          issues,
          'warning',
          'legacy_prelaunch_compare_publication',
          `Catalog entry "${engineId || modelSlug}" keeps historical compare publication while still in waitlist/prelaunch state.`,
          { modelSlug }
        );
      } else {
        addIssue(
          issues,
          'critical',
          'prelaunch_compare_publication',
          `Catalog entry "${engineId || modelSlug}" is prelaunch/waitlist but still published on compare surfaces.`,
          { modelSlug }
        );
      }
    }

    publishedPairs.forEach((opponentSlug) => {
      if (typeof opponentSlug !== 'string' || !opponentSlug.trim().length) {
        addIssue(
          issues,
          'critical',
          'invalid_compare_pair_entry',
          `Catalog entry "${engineId || modelSlug}" has an invalid publishedPairs entry.`,
          { modelSlug, opponentSlug }
        );
      }
    });

    if (hasVideoMode && family) {
      const familyExamplesPage = entry?.familyExamplesPage;
      if (!familyExamplesPage || typeof familyExamplesPage !== 'object') {
        addIssue(
          issues,
          'critical',
          'missing_family_examples_page',
          `Catalog entry "${engineId || modelSlug}" is missing familyExamplesPage metadata for family "${family}".`,
          { modelSlug, family }
        );
      } else {
        const stage = typeof familyExamplesPage.stage === 'string' ? familyExamplesPage.stage : null;
        const showInNav = Boolean(familyExamplesPage.showInNav);
        const publishedModelSlugs = Array.isArray(familyExamplesPage.publishedModelSlugs)
          ? familyExamplesPage.publishedModelSlugs.filter(
              (slug) => typeof slug === 'string' && slug.trim().length > 0
            )
          : [];

        if (!stage || !VALID_EXAMPLES_STAGES.has(stage)) {
          addIssue(
            issues,
            'critical',
            'invalid_family_examples_stage',
            `Family "${family}" for "${engineId || modelSlug}" is missing a valid examplesPage.stage.`,
            { modelSlug, family, stage }
          );
        }

        if (showInNav && stage === 'hidden') {
          addIssue(
            issues,
            'critical',
            'hidden_family_in_nav',
            `Family "${family}" is hidden but still marked showInNav=true.`,
            { modelSlug, family }
          );
        }

        if (stage === 'indexed' && publishedModelSlugs.length === 0) {
          addIssue(
            issues,
            'critical',
            'indexed_family_without_published_model_slugs',
            `Indexed family "${family}" has no publishedModelSlugs. This removes the SEO guard on canonical examples copy.`,
            { modelSlug, family }
          );
        }

        const signature = JSON.stringify({ stage, showInNav, publishedModelSlugs });
        const existing = familyExamplesState.get(family);
        if (existing && existing !== signature) {
          addIssue(
            issues,
            'critical',
            'family_examples_page_drift',
            `Family "${family}" has inconsistent examplesPage metadata across catalog entries.`,
            { family }
          );
        } else if (!existing) {
          familyExamplesState.set(family, signature);
        }
      }
    }
  });
}

function validateRosterEntries(roster, catalogBySlug, issues) {
  roster.forEach((entry) => {
    const engineId = typeof entry?.engineId === 'string' ? entry.engineId : '';
    const modelSlug = typeof entry?.modelSlug === 'string' ? entry.modelSlug : '';
    const availabilityRaw = entry?.availability;

    if (!engineId) {
      addIssue(issues, 'critical', 'missing_roster_engine_id', 'Roster entry missing engineId.', { modelSlug });
    }
    if (!modelSlug) {
      addIssue(issues, 'critical', 'missing_roster_model_slug', `Roster entry missing modelSlug (engineId: ${engineId || 'unknown'}).`);
      return;
    }

    const availability = normalizeAvailability(availabilityRaw);
    if (!availability.valid) {
      addIssue(
        issues,
        'critical',
        'invalid_roster_availability',
        `Roster entry "${engineId || modelSlug}" has invalid availability "${String(availabilityRaw)}".`
      );
      return;
    }
    if (availability.legacy) {
      addIssue(
        issues,
        'warning',
        'legacy_availability_value',
        `Roster entry "${engineId || modelSlug}" uses legacy availability "paused"; normalized to "unavailable" in audit.`
      );
    }

    const catalogEntry = catalogBySlug.get(modelSlug);
    if (!catalogEntry) return;
    const catalogAvailabilityRaw = catalogEntry.availability;
    const catalogAvailability = normalizeAvailability(catalogAvailabilityRaw);
    if (!catalogAvailability.valid) return;

    if (String(catalogAvailabilityRaw).toLowerCase() !== String(availabilityRaw).toLowerCase()) {
      addIssue(
        issues,
        'critical',
        'catalog_roster_availability_mismatch',
        `Availability mismatch for "${modelSlug}": catalog="${catalogAvailabilityRaw}" roster="${availabilityRaw}".`,
        { modelSlug }
      );
    }
  });
}

function runSlugParityChecks(catalogSlugs, rosterSlugs, localeSlugMaps, issues) {
  const missingInRoster = diffSet(catalogSlugs, rosterSlugs);
  const missingInCatalogFromRoster = diffSet(rosterSlugs, catalogSlugs);

  if (missingInRoster.length) {
    addIssue(
      issues,
      'critical',
      'missing_roster_slugs',
      `Catalog slugs missing from roster: ${missingInRoster.join(', ')}`,
      { slugs: missingInRoster }
    );
  }
  if (missingInCatalogFromRoster.length) {
    addIssue(
      issues,
      'critical',
      'extra_roster_slugs',
      `Roster slugs missing from catalog: ${missingInCatalogFromRoster.join(', ')}`,
      { slugs: missingInCatalogFromRoster }
    );
  }

  localeSlugMaps.forEach(({ locale, slugs }) => {
    const missingInLocale = diffSet(catalogSlugs, slugs);
    const extraInLocale = diffSet(slugs, catalogSlugs);
    if (missingInLocale.length) {
      addIssue(
        issues,
        'critical',
        'missing_content_locale_slugs',
        `Catalog slugs missing from content/models/${locale}: ${missingInLocale.join(', ')}`,
        { locale, slugs: missingInLocale }
      );
    }
    if (extraInLocale.length) {
      addIssue(
        issues,
        'critical',
        'extra_content_locale_slugs',
        `Content slugs in content/models/${locale} missing from catalog: ${extraInLocale.join(', ')}`,
        { locale, slugs: extraInLocale }
      );
    }
  });
}

async function runPrelaunchContentChecks(catalogBySlug, issues) {
  for (const rule of PRELAUNCH_CONTENT_RULES) {
    const catalogEntry = catalogBySlug.get(rule.modelSlug);
    if (!catalogEntry) continue;
    const catalogAvailability = normalizeAvailability(catalogEntry.availability);
    if (!catalogAvailability.valid) continue;
    if (catalogAvailability.normalized !== rule.requiredAvailability) continue;

    for (const locale of LOCALES) {
      const expectedLaunchSnippets = Array.isArray(rule.acceptedLaunchSnippetsByLocale?.[locale])
        ? rule.acceptedLaunchSnippetsByLocale[locale].filter(
            (snippet) => typeof snippet === 'string' && snippet.trim().length
          )
        : [];
      if (!expectedLaunchSnippets.length) continue;

      let content = null;
      try {
        content = await loadLocaleContentEntry(locale, rule.modelSlug);
      } catch (error) {
        addIssue(
          issues,
          'critical',
          'prelaunch_content_missing',
          `Prelaunch content missing for "${rule.modelSlug}" in locale "${locale}".`,
          { modelSlug: rule.modelSlug, locale, error: error instanceof Error ? error.message : String(error) }
        );
        continue;
      }

      const serialized = JSON.stringify(content).toLowerCase();
      const hasAcceptedLaunchSnippet = expectedLaunchSnippets.some((snippet) =>
        serialized.includes(snippet.toLowerCase())
      );
      if (!hasAcceptedLaunchSnippet) {
        addIssue(
          issues,
          'critical',
          'prelaunch_launch_signal_missing',
          `Missing prelaunch launch-status phrase in content/models/${locale}/${rule.modelSlug}.json. Expected one of: ${expectedLaunchSnippets
            .map((snippet) => `"${snippet}"`)
            .join(', ')}.`,
          { modelSlug: rule.modelSlug, locale, expectedLaunchSnippets }
        );
      }
    }
  }
}

async function runRuntimeChecks(catalog, issues) {
  if (!process.env.DATABASE_URL) {
    addIssue(issues, 'warning', 'runtime_db_unavailable', 'Runtime audit requested, but DATABASE_URL is not set.');
    return;
  }

  const { Client } = await import('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const [settingsRes, overridesRes] = await Promise.all([
      client.query('SELECT engine_id, options FROM engine_settings'),
      client.query('SELECT engine_id, active, availability, status FROM engine_overrides'),
    ]);

    const settingsByEngine = new Map(settingsRes.rows.map((row) => [row.engine_id, row]));
    const overridesByEngine = new Map(overridesRes.rows.map((row) => [row.engine_id, row]));

    catalog.forEach((entry) => {
      const engineId = entry.engineId;
      const modelSlug = entry.modelSlug;
      const catalogAvailability = normalizeAvailability(entry.availability);
      const catalogStatus = normalizeStatus(entry.engine?.status);

      if (!catalogAvailability.valid || !catalogStatus.valid) return;

      let effectiveAvailability = catalogAvailability.normalized;
      let effectiveStatus = catalogStatus.normalized;

      const settings = settingsByEngine.get(engineId);
      const settingsOptions = settings?.options && typeof settings.options === 'object' ? settings.options : null;
      const settingsAvailabilityRaw =
        settingsOptions && typeof settingsOptions.availability === 'string' ? settingsOptions.availability : null;
      const settingsStatusRaw =
        settingsOptions && typeof settingsOptions.status === 'string' ? settingsOptions.status : null;

      if (settingsAvailabilityRaw) {
        const normalized = normalizeAvailability(settingsAvailabilityRaw);
        if (!normalized.valid) {
          addIssue(
            issues,
            'critical',
            'runtime_invalid_settings_availability',
            `engine_settings availability invalid for "${engineId}": "${settingsAvailabilityRaw}".`,
            { engineId, modelSlug }
          );
        } else {
          effectiveAvailability = normalized.normalized;
        }
      }

      if (settingsStatusRaw) {
        const normalized = normalizeStatus(settingsStatusRaw);
        if (!normalized.valid) {
          addIssue(
            issues,
            'critical',
            'runtime_invalid_settings_status',
            `engine_settings status invalid for "${engineId}": "${settingsStatusRaw}".`,
            { engineId, modelSlug }
          );
        } else {
          effectiveStatus = normalized.normalized;
        }
      }

      const override = overridesByEngine.get(engineId);
      if (override && override.active !== false) {
        if (typeof override.availability === 'string' && override.availability.trim().length) {
          const normalized = normalizeAvailability(override.availability);
          if (!normalized.valid) {
            addIssue(
              issues,
              'critical',
              'runtime_invalid_override_availability',
              `engine_overrides availability invalid for "${engineId}": "${override.availability}".`,
              { engineId, modelSlug }
            );
          } else {
            effectiveAvailability = normalized.normalized;
          }
        }
        if (typeof override.status === 'string' && override.status.trim().length) {
          const normalized = normalizeStatus(override.status);
          if (!normalized.valid) {
            addIssue(
              issues,
              'critical',
              'runtime_invalid_override_status',
              `engine_overrides status invalid for "${engineId}": "${override.status}".`,
              { engineId, modelSlug }
            );
          } else {
            effectiveStatus = normalized.normalized;
          }
        }
      }

      if (effectiveAvailability !== catalogAvailability.normalized) {
        addIssue(
          issues,
          'critical',
          'runtime_availability_drift',
          `Runtime availability drift for "${engineId}" (${modelSlug}): catalog="${catalogAvailability.normalized}" runtime="${effectiveAvailability}".`,
          { engineId, modelSlug }
        );
      }

      if (effectiveStatus !== catalogStatus.normalized) {
        addIssue(
          issues,
          'critical',
          'runtime_status_drift',
          `Runtime status drift for "${engineId}" (${modelSlug}): catalog="${catalogStatus.normalized}" runtime="${effectiveStatus}".`,
          { engineId, modelSlug }
        );
      }

      if (effectiveStatus === 'paused' && effectiveAvailability === 'available') {
        addIssue(
          issues,
          'critical',
          'runtime_incoherent_status_availability',
          `Runtime has status "paused" with availability "available" for "${engineId}" (${modelSlug}).`,
          { engineId, modelSlug }
        );
      }
    });
  } finally {
    await client.end();
  }
}

async function writeReport(report) {
  await fs.mkdir(REPORTS_DIR, { recursive: true });
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
}

function printIssues(issues, level) {
  if (!issues[level].length) return;
  const prefix = level === 'critical' ? '[critical]' : '[warning]';
  issues[level].forEach((issue) => {
    console[level === 'critical' ? 'error' : 'warn'](`${prefix} ${issue.type}: ${issue.message}`);
  });
}

async function main() {
  const { runtime } = parseArgs(process.argv.slice(2));
  const issues = { critical: [], warning: [] };

  const [catalog, roster] = await Promise.all([loadJson(ENGINE_CATALOG_PATH), loadJson(MODEL_ROSTER_PATH)]);
  if (!Array.isArray(catalog)) {
    throw new Error('engine-catalog.json must contain an array.');
  }
  if (!Array.isArray(roster)) {
    throw new Error('model-roster.json must contain an array.');
  }

  const localeSlugMaps = await Promise.all(
    LOCALES.map(async (locale) => ({ locale, slugs: await loadLocaleContentSlugs(locale) }))
  );

  const catalogSlugs = setFromSlugs(catalog, 'modelSlug');
  const rosterSlugs = setFromSlugs(roster, 'modelSlug');
  const catalogBySlug = new Map(catalog.map((entry) => [entry.modelSlug, entry]));

  runSlugParityChecks(catalogSlugs, rosterSlugs, localeSlugMaps, issues);
  validateCatalogEntries(catalog, issues);
  validateRosterEntries(roster, catalogBySlug, issues);
  await runPrelaunchContentChecks(catalogBySlug, issues);
  await runMarketingContentChecks(catalogBySlug, issues);

  if (runtime) {
    await runRuntimeChecks(catalog, issues);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    runtimeChecked: runtime,
    summary: {
      catalogCount: catalog.length,
      rosterCount: roster.length,
      contentCounts: Object.fromEntries(localeSlugMaps.map((entry) => [entry.locale, entry.slugs.size])),
      critical: issues.critical.length,
      warning: issues.warning.length,
    },
    critical: issues.critical,
    warning: issues.warning,
  };

  await writeReport(report);

  console.table([
    { metric: 'catalog', value: catalog.length },
    { metric: 'roster', value: roster.length },
    { metric: 'content_en', value: localeSlugMaps.find((entry) => entry.locale === 'en')?.slugs.size ?? 0 },
    { metric: 'content_fr', value: localeSlugMaps.find((entry) => entry.locale === 'fr')?.slugs.size ?? 0 },
    { metric: 'content_es', value: localeSlugMaps.find((entry) => entry.locale === 'es')?.slugs.size ?? 0 },
    { metric: 'critical', value: issues.critical.length },
    { metric: 'warning', value: issues.warning.length },
  ]);

  printIssues(issues, 'warning');
  printIssues(issues, 'critical');

  if (issues.critical.length) {
    console.error(`[models:audit] Failed with ${issues.critical.length} critical issue(s). Report: .reports/models-audit.json`);
    process.exitCode = 1;
    return;
  }

  console.log(`[models:audit] Passed with ${issues.warning.length} warning(s). Report: .reports/models-audit.json`);
}

main().catch((error) => {
  console.error('[models:audit] Failed:', error);
  process.exitCode = 1;
});
