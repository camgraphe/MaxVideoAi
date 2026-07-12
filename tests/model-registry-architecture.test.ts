import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('../frontend/node_modules/typescript');
const engineDir = 'frontend/src/config/fal-engines';
const registryOwnedProperties = new Set(['modelSlug', 'family', 'category', 'surfaces']);
const ignoredSourceDirectories = new Set(['.next', 'node_modules', 'coverage', '.turbo']);

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory()
      ? ignoredSourceDirectories.has(name) ? [] : walk(path)
      : [path];
  });
}

function objectPropertyName(node: any) {
  const name = node.name;
  return name && ts.isIdentifier(name) ? name.text : name && ts.isStringLiteral(name) ? name.text : null;
}

const publicationSurfaceKeys = new Set(['model', 'modelPage', 'examples', 'compare', 'app', 'pricing', 'sitemap']);
const publicationLeafKeys = new Set([
  'published',
  'indexed',
  'current',
  'indexable',
  'includeInSitemap',
  'includeInFamilyResolver',
  'includeInFamilyCopy',
  'suggestOpponents',
  'publishedPairs',
  'includeInHub',
  'discoveryRank',
  'variantGroup',
  'variantLabel',
  'includeInEstimator',
  'featuredScenario',
]);

function authoredPublicationObjects(path: string, source: string): string[] {
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings: string[] = [];
  const isAuthoredValue = (node: any): boolean =>
    ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node) ||
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    node.kind === ts.SyntaxKind.NullKeyword ||
    (ts.isPrefixUnaryExpression(node) && isAuthoredValue(node.operand)) ||
    (ts.isArrayLiteralExpression(node) && node.elements.every(isAuthoredValue)) ||
    (ts.isObjectLiteralExpression(node) && node.properties.every((property: any) =>
      ts.isPropertyAssignment(property) && isAuthoredValue(property.initializer)
    ));

  function visit(node: any) {
    if (ts.isObjectLiteralExpression(node)) {
      const direct = node.properties.map(objectPropertyName).filter(Boolean) as string[];
      const surfaceCount = direct.filter((name) => publicationSurfaceKeys.has(name)).length;
      let authoredLeafCount = 0;
      function countAuthoredLeaves(child: any) {
        if (ts.isPropertyAssignment(child)) {
          const name = objectPropertyName(child);
          if (name && publicationLeafKeys.has(name) && isAuthoredValue(child.initializer)) authoredLeafCount += 1;
        }
        ts.forEachChild(child, countAuthoredLeaves);
      }
      countAuthoredLeaves(node);
      if (surfaceCount >= 2 && authoredLeafCount >= 3) {
        findings.push(`${path}:${tree.getLineAndCharacterOfPosition(node.pos).line + 1}`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return findings;
}

test('raw engine definitions do not own model identity or publication', () => {
  for (const name of readdirSync(engineDir).filter((file) => file.endsWith('.ts') && file !== 'types.ts')) {
    const path = `${engineDir}/${name}`;
    const source = readFileSync(path, 'utf8');
    const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    function visit(node: any) {
      if (ts.isObjectLiteralExpression(node)) {
        const names = node.properties.map(objectPropertyName).filter(Boolean);
        if (names.includes('id') && names.includes('marketingName')) {
          for (const property of names) {
            assert.equal(registryOwnedProperties.has(property!), false, `${name} owns ${property}`);
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(tree);
  }
});

test('fal engine materialization reads registry-owned model fields', () => {
  const source = readFileSync('frontend/src/config/falEngines.ts', 'utf8');
  assert.match(source, /getRuntimeModelById/);
  assert.match(source, /toLegacyModelSurfaces/);
  assert.doesNotMatch(source, /buildDefaultModelPublicationSurfaces|mergeModelPublicationSurfaces/);
});

test('legacy model policy tables cannot return outside the canonical registry', () => {
  const forbidden = [
    'LEGACY_MODEL_SLUG_ALIASES',
    'manualAliases',
    'LEGACY_SURFACELESS_MODEL_SLUGS',
    'LEGACY_COMPARE_INDEXED_ENGINE_SLUGS',
    'LEGACY_APP_DISCOVERY_PRIORITY',
    'LEGACY_COMPARE_SUGGESTED_OPPONENTS',
    'LEGACY_APP_VARIANTS',
    'GRANDFATHERED_DEFAULT_SURFACE_SLUGS',
  ];
  const sourceFiles = [...walk('frontend'), ...walk('scripts')].filter((file) =>
    /\.(?:ts|tsx|js|mjs)$/.test(file),
  );

  for (const path of sourceFiles) {
    const source = readFileSync(path, 'utf8');
    for (const name of forbidden) {
      assert.doesNotMatch(source, new RegExp(`\\b${name}\\b`), path);
    }
  }
});

test('semantic guard rejects authored publication-shaped config outside the canonical registry', () => {
  const mutation = `const duplicatePolicy = {
    availability: 'available' as EngineAvailability,
    modelPage: { indexable: true, includeInSitemap: true },
    examples: { includeInFamilyResolver: true, includeInFamilyCopy: true },
    pricing: { includeInEstimator: true, featuredScenario: 'launch' },
    app: { discoveryRank: -2 },
  };`;
  assert.equal(authoredPublicationObjects('mutation.ts', mutation).length, 1);

  const sourceFiles = [...walk('frontend'), ...walk('scripts')]
    // The setup command is authorized registry I/O: it emits an unpublished skeleton into the canonical JSON.
    .filter((file) => /\.(?:ts|tsx|js|mjs|cjs)$/.test(file) && file !== 'scripts/model-setup.mjs');
  for (const directory of ['frontend/app/', 'frontend/components/', 'frontend/server/']) {
    assert.ok(sourceFiles.some((path) => path.startsWith(directory)), `${directory} must be guarded`);
  }
  const findings = sourceFiles.flatMap((path) => authoredPublicationObjects(path, readFileSync(path, 'utf8')));
  assert.deepEqual(findings, []);
});

test('browser-safe runtime facade cannot import full registry, validation, or redirects', () => {
  const source = readFileSync('frontend/config/model-runtime.ts', 'utf8');
  assert.doesNotMatch(source, /from ['"].*model-registry(?:\.json|['"])/);
  assert.doesNotMatch(source, /import\s+(?!type\b)[^;]*model-registry-validation/);
  assert.doesNotMatch(source, /next\.config|tombstones|buildModelRegistryRedirects/);
  assert.match(source, /import type \{ ModelRegistryEntry \}/);
});

test('generated runtime projection is checked and never hand-authored', () => {
  const rootPackage = readFileSync('package.json', 'utf8');
  const frontendPackage = readFileSync('frontend/package.json', 'utf8');
  assert.match(rootPackage, /model:registry:check/);
  assert.match(rootPackage, /model:registry:check[^\n]*engine:catalog[^\n]*--check[^\n]*model:generate/);
  assert.match(frontendPackage, /"prebuild":\s*"pnpm --dir \.\. model:registry:check"/);
});

test('engineering and agent guides point model policy changes to the canonical registry', () => {
  for (const path of [
    'AGENTS.md',
    'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/AGENTS.md',
    'docs/engineering/project-structure.md',
    'docs/engineering/llm-working-guide.md',
    'docs/engineering/model-registry.md',
  ]) {
    const source = readFileSync(path, 'utf8');
    assert.match(source, /frontend\/config\/model-registry\.json/, path);
    assert.match(source, /pnpm model:registry:check/, path);
  }
});

test('model setup keeps generated stubs inside registry ownership boundaries', () => {
  const source = readFileSync('scripts/model-setup.mjs', 'utf8');
  const engineStub = source.slice(source.indexOf('function buildEngineStub'), source.indexOf('function buildRegistryEntry'));
  const familyStub = source.slice(source.indexOf('function buildFamilyStub'), source.indexOf('function buildLaunchPacket'));

  assert.match(engineStub, /Partial<RawFalEngineEntry>/);
  assert.doesNotMatch(engineStub, /`\s+modelSlug:|`\s+family:|`\s+category:|`\s+surfaces:/);
  assert.match(familyStub, /defaultModelId/);
  assert.doesNotMatch(familyStub, /defaultModelSlug|publishedModelSlugs|currentModelSlugs/);
});
