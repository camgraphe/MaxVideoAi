import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appClientPath = 'frontend/app/(core)/(workspace)/app/AppClient.tsx';
const inputSchemaHookPath = 'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceInputSchemaState.ts';

test('workspace input schema derivation is owned by a route-local hook', () => {
  assert.equal(existsSync(inputSchemaHookPath), true);

  const appSource = readFileSync(appClientPath, 'utf8');
  const hookSource = readFileSync(inputSchemaHookPath, 'utf8');

  assert.match(appSource, /import \{ useWorkspaceInputSchemaState \} from '\.\/_hooks\/useWorkspaceInputSchemaState';/);
  assert.match(appSource, /useWorkspaceInputSchemaState\(\{/);

  assert.doesNotMatch(appSource, /summarizeWorkspaceInputSchema/);
  assert.doesNotMatch(appSource, /buildAssetFieldIdSet/);
  assert.doesNotMatch(appSource, /buildReferenceAudioFieldIds/);
  assert.doesNotMatch(appSource, /getPrimaryAssetFieldLabel/);
  assert.doesNotMatch(appSource, /revokeAssetPreview/);
  assert.doesNotMatch(appSource, /SEEDANCE_REFERENCE_AUDIO_FIELD_IDS/);

  assert.match(hookSource, /export function useWorkspaceInputSchemaState/);
  assert.match(hookSource, /summarizeWorkspaceInputSchema/);
  assert.match(hookSource, /buildAssetFieldIdSet/);
  assert.match(hookSource, /buildReferenceAudioFieldIds/);
  assert.match(hookSource, /getPrimaryAssetFieldLabel/);
  assert.match(hookSource, /revokeAssetPreview/);
  assert.match(hookSource, /SEEDANCE_REFERENCE_AUDIO_FIELD_IDS/);
});
