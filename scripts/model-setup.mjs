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

function usage() {
  return [
    'Usage:',
    '  npm run model:setup -- --from <source-slug> --slug <target-slug> --name "<Marketing Name>" --family <family-id> [options]',
    '',
    'Required:',
    '  --from <slug>              Existing model page to clone as a base',
    '  --slug <slug>              New model slug',
    '  --name "<name>"            Marketing name for the new model',
    '  --family <family-id>       Family id for examples / compare grouping',
    '',
    'Options:',
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
    newFamily: false,
    emitEngineStub: false,
    dryRun: false,
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
    `const ${constantName}: Partial<FalEngineEntry> = {`,
    `  id: '${options.engineId ?? options.slug}',`,
    `  modelSlug: '${options.slug}',`,
    `  marketingName: '${options.name.replace(/'/g, "\\'")}',`,
    `  family: '${options.family}',`,
    `  availability: '${options.availability}',`,
    `  versionLabel: '${options.version ?? ''}',`,
    '  surfaces: {',
    '    modelPage: {',
    '      indexable: true,',
    '      includeInSitemap: true,',
    '    },',
    '    examples: {',
    '      includeInFamilyResolver: true,',
    `      includeInFamilyCopy: ${options.stage !== 'hidden'},`,
    '    },',
    '    compare: {',
    '      suggestOpponents: [],',
    '      publishedPairs: [],',
    '      includeInHub: false,',
    '    },',
    '    app: {',
    '      enabled: true,',
    '      discoveryRank: undefined,',
    '      variantGroup: undefined,',
    '      variantLabel: undefined,',
    '    },',
    '    pricing: {',
    '      includeInEstimator: true,',
    '      featuredScenario: undefined,',
    '    },',
    '  },',
    '};',
    '',
    '// Insert this block into frontend/src/config/falEngines.ts and complete engine/spec details.',
    showInNav ? '// Family stage is indexed, so decide separately when to add compare publication and examples copy exposure.' : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildFamilyStub(options) {
  const publishedModelSlugs = options.stage === 'indexed' ? `'${options.slug}'` : '';
  const showInNav = options.stage === 'indexed';
  return [
    '{',
    `  id: '${options.family}',`,
    `  label: '${(options.familyLabel ?? options.family).replace(/'/g, "\\'")}',`,
    `  navLabel: '${(options.familyNavLabel ?? options.familyLabel ?? options.name).replace(/'/g, "\\'")}',`,
    `  defaultModelSlug: '${options.slug}',`,
    '  routeAliases: [],',
    '  aliases: [],',
    `  prefixes: ['${options.family}'],`,
    '  examplesPage: {',
    `    stage: '${options.stage}',`,
    `    showInNav: ${showInNav},`,
    `    publishedModelSlugs: [${publishedModelSlugs}],`,
    '  },',
    '},',
    '',
    '// Insert this block into frontend/config/model-families.ts if this is a new public family.',
  ].join('\n');
}

function buildLaunchPacket(options, paths) {
  const stageNote =
    options.stage === 'hidden'
      ? 'Family route stays hidden by default. Keep examples exposure on `/examples?engine=<slug>` until the family is promoted.'
      : options.stage === 'public_noindex'
        ? 'Family route can exist publicly, but it should remain `noindex,follow` until you explicitly promote it to `indexed`.'
        : 'Family route is indexable. Keep `publishedModelSlugs` intentional so canonical examples copy does not drift automatically.';

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
    options.newFamily ? `- Family stub: \`${path.relative(ROOT, paths.familyStubPath)}\`` : '- Family stub: not generated (existing family)',
    `- Launch packet: \`${path.relative(ROOT, paths.launchPacketPath)}\``,
    '',
    '## Codex checklist',
    '',
    '1. Complete the engine entry in `frontend/src/config/falEngines.ts` from real specs, modes, pricing, and provider ids.',
    '2. Rewrite the EN model page with factual positioning, not template placeholders.',
    '3. Rewrite FR and ES as marketing adaptations, not literal translations.',
    '4. Verify title, meta description, canonical path, and locale coverage before promoting indexation.',
    '5. Decide explicitly whether examples copy should mention this model by updating `publishedModelSlugs`.',
    '6. Decide explicitly whether compare should publish any pairs by filling `surfaces.compare.publishedPairs`.',
    '7. Decide explicitly whether pricing marketing should feature this model with `surfaces.pricing.featuredScenario`.',
    '',
    '## Publication notes',
    '',
    `- ${stageNote}`,
    '- Model pages remain public quickly, but compare hub/sitemap should not expand unless publication is explicit.',
    '- App and estimator can stay automatic as long as the engine entry is complete and `surfaces.app` / `surfaces.pricing` are left enabled.',
    '',
    '## After manual edits',
    '',
    '```bash',
    'npm run engine:catalog',
    'npm run model:generate:write',
    'npm run models:audit',
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
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmCmd, ['run', 'model:scaffold', '--', ...buildScaffoldArgs(options)], {
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
