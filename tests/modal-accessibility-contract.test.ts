import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const hookPath = 'frontend/components/ui/useAccessibleModal.ts';
const modalPaths = [
  'frontend/app/(core)/billing/_components/BillingAuthGateModal.tsx',
  'frontend/app/(core)/(workspace)/app/_components/WorkspaceAuthGateModal.tsx',
  'frontend/app/(core)/(workspace)/app/_components/WorkspaceTopUpModal.tsx',
];

test('shared modal behavior owns focus, Escape, and scroll cleanup', () => {
  assert.equal(existsSync(hookPath), true);
  const source = readFileSync(hookPath, 'utf8');
  assert.match(source, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /event\.key !== 'Tab'/);
  assert.match(source, /opener\.focus\(\)/);
  assert.match(source, /data-modal-initial-focus/);
});

test('shared modal recovers focus when closeDisabled changes without targeting disabled controls', () => {
  const source = readFileSync(hookPath, 'utf8');
  assert.match(
    source,
    /useEffect\(\(\) => \{\s*const dialog = dialogRef\.current;[\s\S]*?resolveModalFocusRecoveryTarget\([\s\S]*?\}, \[closeDisabled\]\);/
  );
  assert.match(source, /const preferred = focusable\.find\([\s\S]*data-modal-initial-focus/);
  assert.doesNotMatch(
    source,
    /dialog\.querySelector<HTMLElement>\('\[data-modal-initial-focus="true"\]'\)/
  );
});

test('conversion modals expose named modal semantics and shared keyboard behavior', () => {
  for (const path of modalPaths) {
    const source = readFileSync(path, 'utf8');
    assert.match(source, /useAccessibleModal/);
    assert.match(source, /role="dialog"/);
    assert.match(source, /aria-modal="true"/);
    assert.match(source, /aria-labelledby=/);
    assert.match(source, /onKeyDown=\{onDialogKeyDown\}/);
    assert.match(source, /tabIndex=\{-1\}/);
  }
});
