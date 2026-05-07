import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('workspace pricing and auth gate orchestration is owned by route-local modules', () => {
  const appSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/(workspace)/app/AppClient.tsx'),
    'utf8'
  );
  const hookPath = path.join(
    process.cwd(),
    'frontend/app/(core)/(workspace)/app/_hooks/useWorkspacePricingGate.ts'
  );
  const topUpModalPath = path.join(
    process.cwd(),
    'frontend/app/(core)/(workspace)/app/_components/WorkspaceTopUpModal.tsx'
  );
  const authGateModalPath = path.join(
    process.cwd(),
    'frontend/app/(core)/(workspace)/app/_components/WorkspaceAuthGateModal.tsx'
  );
  const runtimeModalsPath = path.join(
    process.cwd(),
    'frontend/app/(core)/(workspace)/app/_components/WorkspaceRuntimeModals.tsx'
  );

  assert.equal(fs.existsSync(hookPath), true);
  assert.equal(fs.existsSync(topUpModalPath), true);
  assert.equal(fs.existsSync(authGateModalPath), true);
  assert.equal(fs.existsSync(runtimeModalsPath), true);

  const hookSource = fs.readFileSync(hookPath, 'utf8');
  const topUpModalSource = fs.readFileSync(topUpModalPath, 'utf8');
  const authGateModalSource = fs.readFileSync(authGateModalPath, 'utf8');
  const runtimeModalsSource = fs.readFileSync(runtimeModalsPath, 'utf8');

  assert.match(appSource, /import \{ useWorkspacePricingGate \} from '\.\/_hooks\/useWorkspacePricingGate';/);
  assert.match(appSource, /import \{ WorkspaceRuntimeModals \} from '\.\/_components\/WorkspaceRuntimeModals';/);
  assert.match(appSource, /useWorkspacePricingGate\(\{/);

  assert.doesNotMatch(appSource, /const \[preflight, setPreflight\] = useState/);
  assert.doesNotMatch(appSource, /const handleConfirmTopUp = useCallback/);
  assert.doesNotMatch(appSource, /const payload: PreflightRequest =/);
  assert.doesNotMatch(appSource, /const singlePriceCents =/);
  assert.doesNotMatch(appSource, /Wallet balance too low/);

  assert.match(hookSource, /export function useWorkspacePricingGate/);
  assert.match(hookSource, /runPreflight/);
  assert.match(hookSource, /authFetch\('\/api\/member-status'\)/);
  assert.match(hookSource, /authFetch\('\/api\/wallet'/);
  assert.match(hookSource, /const handleConfirmTopUp = useCallback/);
  assert.match(hookSource, /const showComposerError = useCallback/);

  assert.match(topUpModalSource, /export function WorkspaceTopUpModal/);
  assert.match(topUpModalSource, /Wallet balance too low/);
  assert.match(topUpModalSource, /custom-topup/);

  assert.match(authGateModalSource, /export function WorkspaceAuthGateModal/);
  assert.match(authGateModalSource, /ButtonLink/);
  assert.match(authGateModalSource, /encodeURIComponent\(loginRedirectTarget\)/);

  assert.match(runtimeModalsSource, /WorkspaceTopUpModal/);
  assert.match(runtimeModalsSource, /WorkspaceAuthGateModal/);
  assert.match(runtimeModalsSource, /AssetLibraryModal/);
});
