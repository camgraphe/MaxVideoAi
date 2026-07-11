import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  HOMEPAGE_CLIENT_MESSAGE_NAMESPACES,
  pickClientMessageNamespaces,
} from '../frontend/lib/i18n/client-message-namespaces.ts';

const root = process.cwd();
const rootPageSource = readFileSync(join(root, 'frontend/app/(root)/page.tsx'), 'utf8');
const defaultLayoutSource = readFileSync(join(root, 'frontend/app/default-marketing-layout.tsx'), 'utf8');
const localeRuntimeSource = readFileSync(join(root, 'frontend/app/_components/LocaleRuntime.tsx'), 'utf8');
const homeComponentsDir = join(root, 'frontend/components/marketing/home');

test('default homepage sends only marketing-shell messages to client components', () => {
  assert.deepEqual(HOMEPAGE_CLIENT_MESSAGE_NAMESPACES, ['nav', 'footer']);
  assert.match(rootPageSource, /clientMessageNamespaces=\{HOMEPAGE_CLIENT_MESSAGE_NAMESPACES\}/);
  assert.match(defaultLayoutSource, /clientMessageNamespaces=\{clientMessageNamespaces\}/);
  assert.match(localeRuntimeSource, /pickClientMessageNamespaces\(fullMessages, clientMessageNamespaces\)/);
});

test('message namespace picker preserves full dictionaries unless a route opts into a scope', () => {
  const dictionary = {
    nav: { brand: 'MaxVideoAI' },
    footer: { languageLabel: 'Language' },
    workspace: { generate: 'Generate' },
  };

  assert.equal(pickClientMessageNamespaces(dictionary), dictionary);
  assert.deepEqual(pickClientMessageNamespaces(dictionary, HOMEPAGE_CLIENT_MESSAGE_NAMESPACES), {
    nav: dictionary.nav,
    footer: dictionary.footer,
  });
});

test('homepage components stay server-localized or receive copy as props', () => {
  const clientTranslationConsumers = readdirSync(homeComponentsDir)
    .filter((file) => file.endsWith('.tsx'))
    .filter((file) => /useI18n|useTranslations/.test(readFileSync(join(homeComponentsDir, file), 'utf8')));

  assert.deepEqual(
    clientTranslationConsumers,
    [],
    `Expand HOMEPAGE_CLIENT_MESSAGE_NAMESPACES before adding client translation consumers: ${clientTranslationConsumers.join(', ')}`
  );
});
