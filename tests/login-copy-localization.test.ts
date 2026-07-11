import assert from 'node:assert/strict';
import test from 'node:test';
import en from '../frontend/messages/en.json';
import fr from '../frontend/messages/fr.json';
import es from '../frontend/messages/es.json';

function scalarPaths(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return prefix ? [prefix] : [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === 'object' && !Array.isArray(child)
      ? scalarPaths(child, path)
      : [path];
  });
}

function readPath(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (current, key) =>
      current && typeof current === 'object'
        ? (current as Record<string, unknown>)[key]
        : undefined,
    value
  );
}

test('auth locales cover every English auth copy field', () => {
  const expected = scalarPaths(en.auth);
  for (const [locale, copy] of Object.entries({ fr: fr.auth, es: es.auth })) {
    const missing = expected.filter((path) => typeof readPath(copy, path) !== 'string');
    assert.deepEqual(missing, [], `${locale} missing: ${missing.join(', ')}`);
  }
});

test('auth copy includes localized mode, visibility, validation, and feedback groups', () => {
  for (const copy of [en.auth, fr.auth, es.auth]) {
    assert.equal(typeof copy.modeGroup, 'string');
    assert.equal(typeof copy.passwordVisibility.show, 'string');
    assert.equal(typeof copy.validation.formAttention, 'string');
    assert.equal(typeof copy.validation.emailRequired, 'string');
    assert.equal(typeof copy.validation.ageRequired, 'string');
    assert.equal(typeof copy.feedback.completingSignIn, 'string');
    assert.equal(typeof copy.feedback.googleRedirecting, 'string');
  }
});
