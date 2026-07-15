/* eslint-disable no-console */
import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DOCS_MODEL_LAUNCH_DIR = path.join(ROOT, 'docs', 'model-launch');

const VALID_STAGES = new Set(['hidden', 'public_noindex', 'indexed']);
const VALID_AVAILABILITY = new Set(['available', 'limited', 'waitlist', 'unavailable', 'paused']);
const VALID_MODEL_CATEGORIES = new Set(['video', 'image', 'audio', 'multimodal']);

function usage() {
  return [
    'Usage:',
    '  pnpm model:setup -- --from <source-slug> --slug <target-slug> --name "<Marketing Name>" --family <family-id> [options]',
    '',
    'Required:',
    '  --from <slug>              Existing model page to clone as a base',
    '  --slug <slug>              New model slug',
    '  --name "<name>"            Marketing name for the new model',
    '  --family <family-id>       Family id for examples / compare grouping',
    '',
    'Options:',
    '  --category <video|image|audio|multimodal> Model category (default: video)',
    '  --stage <stage>            hidden | public_noindex | indexed (default: indexed, or hidden with --new-family)',
    '  --availability <status>    available | limited | waitlist | unavailable | paused (default: available)',
    '  --new-family               Emit a family stub for a brand-new examples family',
    '  --family-label "<label>"   Label for the new family stub',
    '  --family-nav-label "<label>" Navigation label for the new family stub',
    '  --version <label>          Optional versionLabel to pass to model:scaffold',
    '  --engine <engine-id>       Optional engine id to use in scaffolded CTAs',
    '  --emit-engine-stub         Also print the generated engine stub to stdout',
    '  --dry-run                  Show what would be generated without writing files',
  ].join('\n');
}

function parseArgs(argv) {
  const options = {
    stage: 'indexed',
    stageExplicit: false,
    availability: 'available',
    category: 'video',
    newFamily: false,
    emitEngineStub: false,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case '--':
        break;
      case '--from':
        options.fromSlug = next;
        index += 1;
        break;
      case '--slug':
        options.slug = next;
        index += 1;
        break;
      case '--name':
        options.name = next;
        index += 1;
        break;
      case '--family':
        options.family = next;
        index += 1;
        break;
      case '--stage':
        options.stage = next;
        options.stageExplicit = true;
        index += 1;
        break;
      case '--category':
        options.category = next;
        index += 1;
        break;
      case '--availability':
        options.availability = next;
        index += 1;
        break;
      case '--new-family':
        options.newFamily = true;
        break;
      case '--family-label':
        options.familyLabel = next;
        index += 1;
        break;
      case '--family-nav-label':
        options.familyNavLabel = next;
        index += 1;
        break;
      case '--version':
        options.version = next;
        index += 1;
        break;
      case '--engine':
        options.engineId = next;
        index += 1;
        break;
      case '--emit-engine-stub':
        options.emitEngineStub = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
      case '-h':
        console.log(usage());
        process.exit(0);
      default:
        throw new Error(`Unknown argument "${arg}".\n\n${usage()}`);
    }
  }

  if (!options.fromSlug || !options.slug || !options.name || !options.family) {
    throw new Error(`Missing required arguments.\n\n${usage()}`);
  }
  if (!VALID_MODEL_CATEGORIES.has(options.category)) {
    throw new Error('--category must be video, image, audio, or multimodal.');
  }
  if (options.newFamily && !options.stageExplicit) {
    options.stage = 'hidden';
  }
  if (!VALID_STAGES.has(options.stage)) {
    throw new Error(`Invalid --stage "${options.stage}". Expected one of: ${Array.from(VALID_STAGES).join(', ')}`);
  }
  if (!VALID_AVAILABILITY.has(options.availability)) {
    throw new Error(
      `Invalid --availability "${options.availability}". Expected one of: ${Array.from(VALID_AVAILABILITY).join(', ')}`
    );
  }
  if (options.newFamily && !options.familyLabel) {
    throw new Error('--new-family requires --family-label.');
  }

  return options;
}

function toPascalCase(value) {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function buildScaffoldArgs(options) {
  const args = ['--from', options.fromSlug, '--slug', options.slug, '--name', options.name];
  if (options.version) {
    args.push('--version', options.version);
  }
  if (options.engineId) {
    args.push('--engine', options.engineId);
  }
  if (options.dryRun) {
    args.push('--dry-run');
  }
  return args;
}

function buildEngineStub(options) {
  const constantName = `${toPascalCase(options.slug)}Entry`;
  const showInNav = options.stage === 'indexed';
  return [
    `const ${constantName}: Partial<RawFalEngineEntry> = {`,
    `  id: '${options.engineId ?? options.slug}',`,
    `  marketingName: '${options.name.replace(/'/g, "\\'")}',`,
    `  availability: '${options.availability}',`,
    `  versionLabel: '${options.version ?? ''}',`,
    '};',
    '',
    '// Insert this block into the relevant frontend/src/config/fal-engines provider module and complete execution/spec details.',
    '// Keep model identity, family, category, aliases, and publication in frontend/config/model-registry.json.',
    showInNav ? '// Family stage is indexed; publication still remains explicit in the registry entry.' : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildRegistryEntry(options) {
  return {
    id: options.engineId ?? options.slug,
    slug: options.slug,
    family: options.family || null,
    category: options.category ?? 'video',
    aliases: { internal: [], publicSlugs: [] },
    publication: {
      model: { published: false, indexable: false },
      examples: { published: false, includeInFamilyCopy: false, current: false },
      compare: { published: false, indexed: false, suggestedOpponentIds: [], publishedPairIds: [] },
      app: { published: false },
      pricing: { published: false },
      sitemap: { published: false },
    },
    replacement: null,
  };
}

function buildFamilyStub(options) {
  const showInNav = options.stage === 'indexed';
  return [
    '{',
    `  id: '${options.family}',`,
    `  label: '${(options.familyLabel ?? options.family).replace(/'/g, "\\'")}',`,
    `  navLabel: '${(options.familyNavLabel ?? options.familyLabel ?? options.name).replace(/'/g, "\\'")}',`,
    `  defaultModelId: '${options.engineId ?? options.slug}',`,
    '  routeAliases: [],',
    '  aliases: [],',
    `  prefixes: ['${options.family}'],`,
    '  examplesPage: {',
    `    stage: '${options.stage}',`,
    `    showInNav: ${showInNav},`,
    '  },',
    '},',
    '',
    '// Insert this block into frontend/config/model-families.ts if this is a new public family.',
  ].join('\n');
}

function buildLaunchPacket(options, paths) {
  const stageNote =
    options.stage === 'hidden'
      ? 'Family route stays hidden by default. Keep registry publication disabled until the family is promoted.'
      : options.stage === 'public_noindex'
        ? 'Family route can exist publicly, but it should remain `noindex,follow` until you explicitly promote it to `indexed`.'
        : 'Family route is indexable. Keep examples publication and family-copy membership explicit in the canonical registry.';

  return [
    `# ${options.name} launch packet`,
    '',
    `- Source template: \`${options.fromSlug}\``,
    `- New slug: \`${options.slug}\``,
    `- Family: \`${options.family}\``,
    `- Stage: \`${options.stage}\``,
    `- Availability: \`${options.availability}\``,
    '',
    '## Generated artefacts',
    '',
    `- Marketing JSON scaffold: \`content/models/{en,fr,es}/${options.slug}.json\``,
    `- Engine stub: \`${path.relative(ROOT, paths.engineStubPath)}\``,
    '- Registry entry: printed to stdout for insertion into `frontend/config/model-registry.json`',
    options.newFamily ? `- Family stub: \`${path.relative(ROOT, paths.familyStubPath)}\`` : '- Family stub: not generated (existing family)',
    `- Launch packet: \`${path.relative(ROOT, paths.launchPacketPath)}\``,
    '',
    '## Codex checklist',
    '',
    '1. Complete the raw execution entry in the relevant `frontend/src/config/fal-engines` provider module from real specs, modes, pricing, and provider IDs.',
    '2. Rewrite the EN model page with factual positioning, not template placeholders.',
    '3. Rewrite FR and ES as marketing adaptations, not literal translations.',
    '4. Verify every localized `decision` block, its `modelSlug`, href locale, and metadata before enabling the model page.',
    '5. Verify title, meta description, canonical path, and locale coverage before promoting indexation.',
    '6. Insert the printed entry in `frontend/config/model-registry.json` and decide every publication field explicitly.',
    '7. Keep historical engine inputs in `aliases.internal` and historical URLs in `aliases.publicSlugs`.',
    '8. Keep provider IDs in provider adapters and mode definitions, never in registry aliases.',
    '',
    '## Publication notes',
    '',
    `- ${stageNote}`,
    '- The registry skeleton keeps every surface unpublished; enable each surface only after its content and route prerequisites are ready.',
    '- App and pricing-link exposure stay disabled until their registry publication fields are deliberately enabled.',
    '',
    '## After manual edits',
    '',
    '```bash',
    'pnpm model:registry:generate',
    'pnpm engine:catalog',
    'pnpm model:generate:write',
    'pnpm model:registry:check',
    '```',
  ].join('\n');
}

async function ensureDir(dirPath, dryRun) {
  if (dryRun) return;
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeText(filePath, content, dryRun) {
  if (dryRun) {
    console.log(`[dry-run] write ${path.relative(ROOT, filePath)}`);
    return;
  }
  await fs.writeFile(filePath, `${content}\n`, 'utf8');
}

function runScaffold(options) {
  const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const result = spawnSync(pnpmCmd, ['model:scaffold', ...buildScaffoldArgs(options)], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error('model:scaffold failed.');
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  runScaffold(options);

  const engineStub = buildEngineStub(options);
  const registryEntry = buildRegistryEntry(options);
  const familyStub = options.newFamily ? buildFamilyStub(options) : null;
  const engineStubPath = path.join(DOCS_MODEL_LAUNCH_DIR, `${options.slug}.engine.stub.ts`);
  const familyStubPath = path.join(DOCS_MODEL_LAUNCH_DIR, `${options.slug}.family.stub.ts`);
  const launchPacketPath = path.join(DOCS_MODEL_LAUNCH_DIR, `${options.slug}.md`);
  const launchPacket = buildLaunchPacket(options, { engineStubPath, familyStubPath, launchPacketPath });

  await ensureDir(DOCS_MODEL_LAUNCH_DIR, options.dryRun);
  await writeText(engineStubPath, engineStub, options.dryRun);
  if (familyStub) {
    await writeText(familyStubPath, familyStub, options.dryRun);
  }
  await writeText(launchPacketPath, launchPacket, options.dryRun);

  if (options.emitEngineStub) {
    console.log('');
    console.log(engineStub);
  }

  console.log('');
  console.log('Registry entry skeleton for frontend/config/model-registry.json:');
  console.log(JSON.stringify(registryEntry, null, 2));

  console.log('');
  console.log('After inserting and completing the registry entry:');
  console.log('pnpm model:registry:generate');
  console.log('pnpm engine:catalog');
  console.log('pnpm model:generate:write');
  console.log('pnpm model:registry:check');

  console.log('');
  console.log('Artifacts ready:');
  console.log(`- ${path.relative(ROOT, engineStubPath)}`);
  if (familyStub) {
    console.log(`- ${path.relative(ROOT, familyStubPath)}`);
  }
  console.log(`- ${path.relative(ROOT, launchPacketPath)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
