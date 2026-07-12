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
