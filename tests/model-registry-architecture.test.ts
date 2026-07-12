import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('../frontend/node_modules/typescript');
const engineDir = 'frontend/src/config/fal-engines';
const registryOwnedProperties = new Set(['modelSlug', 'family', 'category', 'surfaces']);

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
