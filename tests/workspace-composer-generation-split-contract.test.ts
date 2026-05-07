import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const composerHookPath = 'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceComposerState.ts';
const engineModeHookPath = 'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceEngineModeState.ts';
const generationRunnerHookPath = 'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceGenerationRunner.ts';
const walletPreflightHookPath = 'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceWalletPreflight.ts';

test('workspace composer engine and mode orchestration is split from composer field handlers', () => {
  assert.equal(existsSync(engineModeHookPath), true);

  const composerSource = readFileSync(composerHookPath, 'utf8');
  const engineModeSource = readFileSync(engineModeHookPath, 'utf8');

  assert.match(composerSource, /useWorkspaceEngineModeState/);
  assert.match(composerSource, /useWorkspaceEngineModeState\(\{/);

  assert.doesNotMatch(composerSource, /getUnifiedSeedanceMode/);
  assert.doesNotMatch(composerSource, /getUnifiedHappyHorseMode/);
  assert.doesNotMatch(composerSource, /getReferenceInputStatus/);
  assert.doesNotMatch(composerSource, /getModeCaps/);
  assert.doesNotMatch(composerSource, /findGenerateAudioField/);
  assert.doesNotMatch(composerSource, /supportsAudioPricingToggle/);
  assert.doesNotMatch(composerSource, /UNIFIED_VEO_FIRST_LAST_ENGINE_IDS/);

  assert.match(engineModeSource, /export function useWorkspaceEngineModeState/);
  assert.match(engineModeSource, /getUnifiedSeedanceMode/);
  assert.match(engineModeSource, /getUnifiedHappyHorseMode/);
  assert.match(engineModeSource, /getReferenceInputStatus/);
  assert.match(engineModeSource, /getModeCaps/);
  assert.match(engineModeSource, /findGenerateAudioField/);
  assert.match(engineModeSource, /supportsAudioPricingToggle/);
  assert.match(engineModeSource, /UNIFIED_VEO_FIRST_LAST_ENGINE_IDS/);
});

test('workspace generation wallet preflight is split from generation submission orchestration', () => {
  assert.equal(existsSync(walletPreflightHookPath), true);

  const generationRunnerSource = readFileSync(generationRunnerHookPath, 'utf8');
  const walletPreflightSource = readFileSync(walletPreflightHookPath, 'utf8');

  assert.match(generationRunnerSource, /import \{ useWorkspaceWalletPreflight \} from '\.\/useWorkspaceWalletPreflight';/);
  assert.match(generationRunnerSource, /useWorkspaceWalletPreflight\(\{/);

  assert.doesNotMatch(generationRunnerSource, /CURRENCY_LOCALE/);
  assert.doesNotMatch(generationRunnerSource, /authFetch\('\/api\/wallet'\)/);
  assert.doesNotMatch(generationRunnerSource, /const presentInsufficientFunds =/);
  assert.doesNotMatch(generationRunnerSource, /const unitCostCents =/);

  assert.match(walletPreflightSource, /export function useWorkspaceWalletPreflight/);
  assert.match(walletPreflightSource, /CURRENCY_LOCALE/);
  assert.match(walletPreflightSource, /authFetch\('\/api\/wallet'\)/);
  assert.match(walletPreflightSource, /presentInsufficientFunds/);
  assert.match(walletPreflightSource, /verifyWalletBalance/);
});
