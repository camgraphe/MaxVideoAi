import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('../frontend/node_modules/typescript');
const engineDir = 'frontend/src/config/fal-engines';
const registryOwnedProperties = new Set(['modelSlug', 'family', 'category', 'surfaces']);

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function objectPropertyName(node: any) {
  const name = node.name;
  return name && ts.isIdentifier(name) ? name.text : name && ts.isStringLiteral(name) ? name.text : null;
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
  assert.match(frontendPackage, /"prebuild":\s*"pnpm --dir \.\. model:registry:check"/);
});
