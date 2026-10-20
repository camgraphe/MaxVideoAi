import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  MARKETING_CLIENT_MESSAGE_NAMESPACES,
  pickClientMessageNamespaces,
} from '../frontend/lib/i18n/client-message-namespaces.ts';

const root = process.cwd();
const localizedLayoutPath = join(root, 'frontend/app/(localized)/[locale]/layout.tsx');
const defaultLayoutPath = join(root, 'frontend/app/default-marketing-layout.tsx');
const watchLayoutPath = join(root, 'frontend/app/(public-watch)/layout.tsx');
const coreLayoutPath = join(root, 'frontend/app/(core)/layout.tsx');
const appRuntimePath = join(root, 'frontend/app/_components/AppRuntime.tsx');

test('marketing routes send only client-consumed message namespaces', () => {
  assert.deepEqual(MARKETING_CLIENT_MESSAGE_NAMESPACES, ['nav', 'footer']);
  assert.match(
    readFileSync(localizedLayoutPath, 'utf8'),
    /clientMessageNamespaces=\{MARKETING_CLIENT_MESSAGE_NAMESPACES\}/
  );
  assert.match(
    readFileSync(defaultLayoutPath, 'utf8'),
    /clientMessageNamespaces=\{MARKETING_CLIENT_MESSAGE_NAMESPACES\}/
  );
  assert.match(readFileSync(watchLayoutPath, 'utf8'),
    /<AppRuntime clientMessageNamespaces=\{MARKETING_CLIENT_MESSAGE_NAMESPACES\}>/);
});

test('watch isolation filters both client props in the shared runtime while Core retains full messages', () => {
  const runtime = readFileSync(appRuntimePath, 'utf8');
  const core = readFileSync(coreLayoutPath, 'utf8');
  const watch = readFileSync(watchLayoutPath, 'utf8');
  assert.match(core, /<AppRuntime>\{children\}<\/AppRuntime>/);
  assert.doesNotMatch(core, /clientMessageNamespaces|MARKETING_CLIENT_MESSAGE_NAMESPACES/);
  assert.match(runtime, /pickClientMessageNamespaces\(fullDictionary, clientMessageNamespaces\)/);
  assert.match(runtime, /fullFallback === fullDictionary\s*\? dictionary\s*:\s*pickClientMessageNamespaces\(fullFallback, clientMessageNamespaces\)/,
    'filter the English fallback before serialization and preserve EN shared-object identity');
  assert.match(runtime, /<I18nProvider locale=\{locale\} dictionary=\{dictionary\} fallback=\{fallback\}>/);
  for (const layout of [core, watch]) {
    assert.match(layout, /export \{ metadata, viewport \} from '@\/app\/_lib\/app-runtime-metadata'/);
    assert.doesNotMatch(layout, /LocaleRuntime|next\/headers|usePathname|<html|<body/);
  }
  assert.ok(existsSync(join(root, 'frontend/app/(public-watch)/video/[id]/page.tsx')));
  assert.equal(existsSync(join(root, 'frontend/app/(core)/video')), false, 'there is only one public watch route tree');
  const reader = readFileSync(join(root, 'frontend/components/examples/ExampleReaderContent.tsx'), 'utf8');
  assert.match(reader, /from '@\/components\/examples\/VideoWatchShare\.client'/);
  assert.doesNotMatch(reader, /@\/app\//, 'the shared reader must not reach into a route group');
});

test('marketing message selection excludes unrelated workspace copy', () => {
  const dictionary = {
    nav: { brand: 'MaxVideoAI' },
    footer: { languageLabel: 'Language' },
    home: { proofTabs: [] },
    models: { meta: {} },
    pricing: { priceChipPrefix: 'This render' },
    workspace: { generate: 'Generate' },
  };

  assert.deepEqual(pickClientMessageNamespaces(dictionary, MARKETING_CLIENT_MESSAGE_NAMESPACES), {
    nav: dictionary.nav,
    footer: dictionary.footer,
  });
});

test('connected marketing navigation has localized account copy inside its small message payload', () => {
  for (const [locale, generate, signOut] of [
    ['en', 'Generate', 'Sign out'], ['fr', 'Générer', 'Se déconnecter'], ['es', 'Generar', 'Cerrar sesión'],
  ]) {
    const dictionary = JSON.parse(readFileSync(join(root, `frontend/messages/${locale}.json`), 'utf8'));
    const client = pickClientMessageNamespaces(dictionary, MARKETING_CLIENT_MESSAGE_NAMESPACES);
    assert.equal(client.nav.cta, generate);
    assert.equal(client.nav.account?.signOut, signOut);
    for (const id of ['generate', 'generate-image', 'generate-audio', 'tools', 'library', 'jobs', 'billing', 'settings']) {
      assert.ok(client.nav.account?.links[id], `${locale} account link ${id} must be translated`);
    }
    assert.equal(client.workspace, undefined);
  }
  for (const file of ['MarketingAccountMenu.tsx', 'MarketingMobileMenu.tsx']) {
    assert.doesNotMatch(readFileSync(join(root, 'frontend/components/marketing', file), 'utf8'), /t\(['`"]workspace\./);
  }
  assert.doesNotMatch(readFileSync(join(root, 'frontend/components/marketing/MarketingNav.tsx'), 'utf8'), /t\('nav\.generate'/);
});
