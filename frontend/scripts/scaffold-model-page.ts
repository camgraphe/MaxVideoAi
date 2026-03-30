/* eslint-disable no-console */
import fs from 'node:fs/promises';
import path from 'node:path';

type Locale = 'en' | 'fr' | 'es';

type Options = {
  fromSlug: string;
  targetSlug: string;
  targetName: string;
  targetVersionLabel?: string;
  targetEngineId: string;
  locales: Locale[];
  extraReplacements: Array<[string, string]>;
  dryRun: boolean;
  force: boolean;
};

type ModelOverlay = Record<string, unknown>;

const FRONTEND_ROOT = process.cwd();
const REPO_ROOT = path.resolve(FRONTEND_ROOT, '..');
const MODELS_ROOT = path.join(REPO_ROOT, 'content', 'models');
const DEFAULT_LOCALES: Locale[] = ['en', 'fr', 'es'];
const PROVIDER_PREFIX = /^(OpenAI|Google(?: DeepMind)?|Google|DeepMind)\s+/i;

function usage(): string {
  return [
    'Usage:',
    '  npm run model:setup -- --from <source-slug> --slug <target-slug> --name "<Marketing Name>" --family <family-id>',
    '  npm --prefix frontend run models:scaffold -- --from <source-slug> --slug <target-slug> --name "<Marketing Name>" [options]',
    '',
    'Note:',
    '  models:scaffold is the low-level content helper. Prefer model:setup for the full onboarding flow.',
    '',
    'Options:',
    '  --version <label>          Override versionLabel in the scaffolded files',
    '  --engine <engine-id>       Engine query param to use in CTA hrefs (defaults to target slug)',
    '  --locales en,fr,es         Locales to scaffold (defaults to en,fr,es)',
    '  --replace old=>new         Extra string replacement; repeatable',
    '  --dry-run                  Print planned writes without touching files',
    '  --force                    Overwrite target files if they already exist',
  ].join('\n');
}

function parseArgs(argv: string[]): Options {
  const options: Partial<Options> = {
    locales: DEFAULT_LOCALES,
    extraReplacements: [],
    dryRun: false,
    force: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case '--from':
        options.fromSlug = next;
        index += 1;
        break;
      case '--slug':
        options.targetSlug = next;
        index += 1;
        break;
      case '--name':
        options.targetName = next;
        index += 1;
        break;
      case '--version':
        options.targetVersionLabel = next;
        index += 1;
        break;
      case '--engine':
        options.targetEngineId = next;
        index += 1;
        break;
      case '--locales':
        options.locales = (next ?? '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean) as Locale[];
        index += 1;
        break;
      case '--replace': {
        const rawPair = next ?? '';
        const separatorIndex = rawPair.indexOf('=>');
        if (separatorIndex === -1) {
          throw new Error(`Invalid --replace value "${rawPair}". Expected old=>new.`);
        }
        const from = rawPair.slice(0, separatorIndex).trim();
        const to = rawPair.slice(separatorIndex + 2).trim();
        if (!from) {
          throw new Error(`Invalid --replace value "${rawPair}". Left side cannot be empty.`);
        }
        (options.extraReplacements ??= []).push([from, to]);
        index += 1;
        break;
      }
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--force':
        options.force = true;
        break;
      case '--help':
      case '-h':
        console.log(usage());
        process.exit(0);
      default:
        throw new Error(`Unknown argument "${arg}".\n\n${usage()}`);
    }
  }

  if (!options.fromSlug || !options.targetSlug || !options.targetName) {
    throw new Error(`Missing required arguments.\n\n${usage()}`);
  }

  return {
    fromSlug: options.fromSlug,
    targetSlug: options.targetSlug,
    targetName: options.targetName,
    targetVersionLabel: options.targetVersionLabel,
    targetEngineId: options.targetEngineId ?? options.targetSlug,
    locales: options.locales ?? DEFAULT_LOCALES,
    extraReplacements: options.extraReplacements ?? [],
    dryRun: options.dryRun ?? false,
    force: options.force ?? false,
  };
}

function deriveNameVariants(name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) return [];

  const variants = new Set<string>([trimmed]);
  const providerStripped = trimmed.replace(PROVIDER_PREFIX, '').trim();
  if (providerStripped && providerStripped !== trimmed) {
    variants.add(providerStripped);
  }
  return Array.from(variants).sort((left, right) => right.length - left.length);
}

function replaceAll(value: string, replacements: Array<[string, string]>): string {
  return replacements.reduce((result, [from, to]) => {
    if (!from || from === to) return result;
    return result.split(from).join(to);
  }, value);
}

function transformValue(value: unknown, replacements: Array<[string, string]>): unknown {
  if (typeof value === 'string') {
    return replaceAll(value, replacements);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => transformValue(entry, replacements));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, transformValue(entry, replacements)])
    );
  }
  return value;
}

async function readOverlay(locale: Locale, slug: string): Promise<ModelOverlay> {
  const filePath = path.join(MODELS_ROOT, locale, `${slug}.json`);
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as ModelOverlay;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeOverlay(filePath: string, data: ModelOverlay, dryRun: boolean) {
  const serialized = `${JSON.stringify(data, null, 2)}\n`;
  if (dryRun) {
    console.log(`[dry-run] write ${path.relative(REPO_ROOT, filePath)}`);
    return;
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, serialized, 'utf8');
  console.log(`wrote ${path.relative(REPO_ROOT, filePath)}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.fromSlug === options.targetSlug) {
    throw new Error('--from and --slug must be different.');
  }

  const sourceEn = await readOverlay('en', options.fromSlug);
  const sourceName = typeof sourceEn.marketingName === 'string' ? sourceEn.marketingName : options.fromSlug;
  const sourceNameVariants = deriveNameVariants(sourceName);
  const targetNameVariants = deriveNameVariants(options.targetName);
  const aliasPairs: Array<[string, string]> = sourceNameVariants
    .map((from, index) => [from, targetNameVariants[index] ?? options.targetName] as [string, string])
    .filter((pair): pair is [string, string] => Boolean(pair[0]) && Boolean(pair[1]));

  const baseReplacements: Array<[string, string]> = ([
    [sourceName, options.targetName] as [string, string],
    ...aliasPairs,
    [`/models/${options.fromSlug}`, `/models/${options.targetSlug}`] as [string, string],
    [`/examples/${options.fromSlug}`, `/examples/${options.targetSlug}`] as [string, string],
    [`examples-${options.fromSlug}`, `examples-${options.targetSlug}`] as [string, string],
    [`engine=${options.fromSlug}`, `engine=${options.targetEngineId}`] as [string, string],
    ...options.extraReplacements,
  ] satisfies Array<[string, string]>)
    .filter((pair): pair is [string, string] => Boolean(pair[0]) && pair[0] !== pair[1])
    .sort((left, right) => right[0].length - left[0].length);

  for (const locale of options.locales) {
    const sourceOverlay = await readOverlay(locale, options.fromSlug);
    const transformed = transformValue(sourceOverlay, baseReplacements) as ModelOverlay;

    transformed.marketingName = options.targetName;
    if (options.targetVersionLabel) {
      transformed.versionLabel = options.targetVersionLabel;
    }

    const targetPath = path.join(MODELS_ROOT, locale, `${options.targetSlug}.json`);
    if (!options.force && (await fileExists(targetPath))) {
      throw new Error(`Target file already exists: ${path.relative(REPO_ROOT, targetPath)} (use --force to overwrite)`);
    }
    await writeOverlay(targetPath, transformed, options.dryRun);
  }

  console.log('');
  console.log('Next steps:');
  console.log(`1. Review content/models/{en,fr,es}/${options.targetSlug}.json and replace template-specific specs and prompts.`);
  console.log('2. If the target model is new in the engine catalog, add its catalog/config entries separately.');
  console.log('3. Run locale QA and roster checks before shipping.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
