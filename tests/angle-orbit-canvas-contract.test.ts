import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import path from 'node:path';

const root = process.cwd();
const canvasPath = path.join(root, 'frontend/src/components/tools/AngleOrbitCanvas.tsx');

test('angle orbit canvas avoids react-three-fiber reconciler in the app route bundle', () => {
  const source = readFileSync(canvasPath, 'utf8');

  assert.doesNotMatch(source, /@react-three\/fiber/);
  assert.doesNotMatch(source, /useFrame/);
  assert.doesNotMatch(source, /useThree/);
  assert.match(source, /import \* as THREE from 'three'/);
  assert.match(source, /new THREE\.WebGLRenderer/);
});
