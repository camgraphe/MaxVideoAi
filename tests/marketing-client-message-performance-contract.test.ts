import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  MARKETING_CLIENT_MESSAGE_NAMESPACES,
  pickClientMessageNamespaces,
} from '../frontend/lib/i18n/client-message-namespaces.ts';

const root = process.cwd();
const localizedLayoutPath = join(root, 'frontend/app/(localized)/[locale]/layout.tsx');
const defaultLayoutPath = join(root, 'frontend/app/default-marketing-layout.tsx');

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
