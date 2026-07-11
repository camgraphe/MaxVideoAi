import assert from 'node:assert/strict';
import test from 'node:test';
import enMessages from '../frontend/messages/en.json';
import esMessages from '../frontend/messages/es.json';
import frMessages from '../frontend/messages/fr.json';
import { DEFAULT_COPY } from '../frontend/app/(core)/(workspace)/app/image/_lib/image-workspace-copy';

type UnknownRecord = Record<string, unknown>;

const localeMessages = {
  en: enMessages,
  fr: frMessages,
  es: esMessages,
} as const;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function scalarPaths(value: unknown, prefix = ''): string[] {
  if (!isRecord(value)) return prefix ? [prefix] : [];
  return Object.entries(value).flatMap(([key, nested]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return isRecord(nested) ? scalarPaths(nested, path) : [path];
  });
}

function readPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    return isRecord(current) ? current[key] : undefined;
  }, source);
}

test('image workspace locales cover every fallback copy field', () => {
  const expectedPaths = scalarPaths(DEFAULT_COPY);

  for (const [locale, messages] of Object.entries(localeMessages)) {
    const imageCopy = messages.workspace.image;
    const missing = expectedPaths.filter((path) => typeof readPath(imageCopy, path) !== 'string');
    assert.deepEqual(missing, [], `${locale} is missing image workspace copy: ${missing.join(', ')}`);
  }
});

test('image preview and sidebar actions are localized in every workspace locale', () => {
  const requiredPaths = [
    'workspace.image.preview.editImage',
    'workspace.image.preview.openModal',
    'workspace.sidebar.newModel.label',
    'workspace.sidebar.newModel.name',
    'workspace.sidebar.newModel.quality1',
    'workspace.sidebar.newModel.quality2',
    'workspace.sidebar.newModel.quality3',
    'workspace.sidebar.newModel.cta',
  ];

  for (const [locale, messages] of Object.entries(localeMessages)) {
    const missing = requiredPaths.filter((path) => typeof readPath(messages, path) !== 'string');
    assert.deepEqual(missing, [], `${locale} is missing visible workspace copy: ${missing.join(', ')}`);
  }
});

test('video preview empty, download, and error copy are localized in every workspace locale', () => {
  const requiredPaths = [
    'workspace.generate.preview.empty',
    'workspace.generate.preview.controls.download.label',
    'workspace.generate.preview.controls.download.aria',
    'workspace.generate.preview.errorTitle',
    'workspace.generate.preview.errorBody',
  ];

  for (const [locale, messages] of Object.entries(localeMessages)) {
    const missing = requiredPaths.filter((path) => typeof readPath(messages, path) !== 'string');
    assert.deepEqual(missing, [], `${locale} is missing video preview copy: ${missing.join(', ')}`);
  }
});

test('video and image auth gates promise only a return to the workspace', () => {
  for (const [locale, messages] of Object.entries(localeMessages)) {
    for (const gate of [messages.workspace.generate.authGate, messages.workspace.image.authGate]) {
      assert.match(gate.body, /return|ramèner|volver/i, `${locale} should explain workspace return`);
      assert.doesNotMatch(
        gate.body,
        /free|gratuit|gratis|credit|crédit|price|prix|precio/i,
        `${locale} should not promise a signup incentive`
      );
    }
  }
});
