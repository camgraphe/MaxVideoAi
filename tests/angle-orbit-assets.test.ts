import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { ANGLE_ORBIT_ASSETS } from '../frontend/src/components/tools/angle/landing/angle-landing-assets';

const root = process.cwd();
const flatten = (value: unknown): string[] =>
  typeof value === 'string' ? [value] : Object.values(value as Record<string, unknown>).flatMap(flatten);

test('Angle Orbit owns exactly fifteen unique WebP assets', () => {
  const paths = flatten(ANGLE_ORBIT_ASSETS);
  assert.equal(paths.length, 15);
  assert.equal(new Set(paths).size, 15);
  for (const assetPath of paths) {
    assert.match(assetPath, /^\/assets\/tools\/angle-orbit-.+\.webp$/);
    const filePath = join(root, 'frontend/public', assetPath);
    assert.ok(existsSync(filePath), `${assetPath} should exist`);
    assert.ok(readFileSync(filePath).byteLength <= 500_000, `${assetPath} must stay below 500 KB`);
  }
});

test('Angle hero describes one localized dialogue coverage sequence', () => {
  const locales = [
    {
      path: 'frontend/messages/en.json',
      labels: ['Dialogue two-shot', 'Field on Actor B', 'Reverse on Actor A', 'Elevated dialogue view'],
      dialogue: /dialogue|conversation/i,
    },
    {
      path: 'frontend/messages/fr.json',
      labels: ['Plan à deux', 'Champ sur l’acteur B', 'Contrechamp sur l’actrice A', 'Plan dialogue surélevé'],
      dialogue: /dialogue|conversation/i,
    },
    {
      path: 'frontend/messages/es.json',
      labels: ['Plano de dos', 'Campo sobre el actor B', 'Contracampo sobre la actriz A', 'Plano alto del diálogo'],
      dialogue: /diálogo|conversación/i,
    },
  ] as const;

  for (const locale of locales) {
    const angle = JSON.parse(readFileSync(join(root, locale.path), 'utf8')).toolMarketing.angle;
    assert.deepEqual(angle.hero.orbit.views.map((view: { id: string }) => view.id), [
      'front',
      'threeQuarter',
      'profile',
      'elevated',
    ]);
    assert.deepEqual(angle.hero.orbit.views.map((view: { label: string }) => view.label), locale.labels);
    assert.match(angle.meta.imageAlt, locale.dialogue);
    for (const view of angle.hero.orbit.views as Array<{ alt: string }>) {
      assert.match(view.alt, locale.dialogue);
      assert.doesNotMatch(view.alt, /compact cinema camera|caméra de cinéma compacte|cámara de cine compacta/i);
    }
  }
});
