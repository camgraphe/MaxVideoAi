import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from '../frontend/node_modules/typescript/lib/typescript.js';

const routePath = 'frontend/app/api/auth/signout/route.ts';

function loadSignoutRoute(signOut: (options?: { scope: string }) => Promise<unknown>) {
  const source = ts.transpileModule(readFileSync(routePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: { POST?: () => Promise<Response> } = {};
  runInNewContext(source, {
    exports,
    console: { error() {} },
    require(id: string) {
      if (id === 'next/server') return { NextResponse: Response };
      if (id === '@/lib/supabase-ssr') {
        return { createSupabaseRouteClient: async () => ({ auth: { signOut } }) };
      }
      throw new Error(`Unexpected dependency: ${id}`);
    },
  });
  return exports.POST!;
}

test('browser signout requests only the current session, preserving independently authorized MCP sessions', async () => {
  const calls: unknown[] = [];
  const post = loadSignoutRoute(async (options) => {
    calls.push(options);
    return { error: null };
  });
  const response = await post();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{ scope: 'local' }]);
});

test('signout reports an SDK rejection instead of claiming a successful logout', async () => {
  const post = loadSignoutRoute(async () => ({ error: new Error('Auth unavailable') }));
  const response = await post();
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { ok: false, error: 'Unable to sign out' });
});

test('signout handles a thrown Auth error without retrying with a broader scope', async () => {
  let calls = 0;
  const post = loadSignoutRoute(async () => {
    calls += 1;
    throw new Error('Auth unavailable');
  });
  assert.equal((await post()).status, 500);
  assert.equal(calls, 1);
});

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

test('all ordinary signout and session-cleanup call sites explicitly use local scope', () => {
  const violations: string[] = [];
  let checked = 0;
  for (const directory of ['frontend/app', 'frontend/components', 'frontend/lib', 'frontend/src']) {
    for (const file of sourceFiles(directory)) {
      const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
          && node.expression.name.text === 'signOut'
          && ts.isPropertyAccessExpression(node.expression.expression)
          && node.expression.expression.name.text === 'auth') {
          checked += 1;
          const options = node.arguments[0];
          const scope = options && ts.isObjectLiteralExpression(options)
            ? options.properties.find((property) => ts.isPropertyAssignment(property)
              && property.name.getText(source).replace(/['"]/g, '') === 'scope')
            : undefined;
          if (!scope || !ts.isPropertyAssignment(scope) || !ts.isStringLiteral(scope.initializer)
            || scope.initializer.text !== 'local') {
            violations.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
  }
  assert.ok(checked >= 8, 'must inspect both browser and server signout/cleanup paths');
  assert.deepEqual(violations, [], 'unscoped signOut defaults to global and revokes MCP refresh sessions');
});
