import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const composerSurfacePath = 'frontend/app/(core)/(workspace)/app/_components/WorkspaceComposerSurface.tsx';
const runtimeModalsPath = 'frontend/app/(core)/(workspace)/app/_components/WorkspaceRuntimeModals.tsx';
const hostedCheckoutHookPath = 'frontend/hooks/useHostedWalletCheckout.ts';

test('workspace defers model-specific panels and closed conversion modals', () => {
  const composerSource = readFileSync(composerSurfacePath, 'utf8');
  const runtimeModalsSource = readFileSync(runtimeModalsPath, 'utf8');

  assert.match(composerSource, /dynamic(?:<[^>]+>)?\(\s*\(\) => import\('\.\/LumaRay32KeyframeEditor'\)/);
  assert.match(composerSource, /dynamic(?:<[^>]+>)?\(\s*\(\) => import\('\.\/omni\/OmniStudioPanel\.client'\)/);
  assert.match(composerSource, /dynamic(?:<[^>]+>)?\(\s*\(\) => import\('\.\/StoryboardLaunchModal'\)/);
  assert.doesNotMatch(composerSource, /import \{ LumaRay32KeyframeEditor \} from/);
  assert.doesNotMatch(composerSource, /import \{ OmniStudioPanel/);
  assert.doesNotMatch(composerSource, /import \{ StoryboardLaunchModal \} from/);

  assert.match(runtimeModalsSource, /dynamic(?:<[^>]+>)?\(\s*\(\) => import\('\.\/WorkspaceTopUpModal'\)/);
  assert.match(runtimeModalsSource, /dynamic(?:<[^>]+>)?\(\s*\(\) => import\('\.\/WorkspaceAuthGateModal'\)/);
  assert.doesNotMatch(runtimeModalsSource, /import \{ WorkspaceTopUpModal \} from/);
  assert.doesNotMatch(runtimeModalsSource, /import \{ WorkspaceAuthGateModal \} from/);
});

test('hosted checkout loads Stripe only for the session-id fallback', () => {
  const hookSource = readFileSync(hostedCheckoutHookPath, 'utf8');

  assert.match(hookSource, /import type \{ Stripe \} from '@stripe\/stripe-js';/);
  assert.doesNotMatch(hookSource, /import \{ loadStripe/);
  assert.match(hookSource, /import\('@stripe\/stripe-js'\)/);
  assert.match(hookSource, /if \(result\.sessionId\)/);
  assert.match(hookSource, /getStripePromise\(\)/);
});
