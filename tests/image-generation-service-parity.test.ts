import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const servicePath = join(root, 'frontend/src/server/images/execute-image-generation.ts');
const initialPath = join(root, 'frontend/src/server/images/image-initial-job.ts');
const routePath = join(root, 'frontend/app/api/images/generate/route.ts');
const characterPath = join(root, 'frontend/src/server/tools/character-builder/runner.ts');
const requestTypesPath = join(root, 'frontend/types/image-generation.ts');
const executionContractPath = join(root, 'frontend/src/server/images/image-generation-execution-contract.ts');

test('image web and internal callers use an internal-only wallet reservation contract', () => {
  const service = readFileSync(servicePath, 'utf8');
  const initial = readFileSync(initialPath, 'utf8');
  const route = readFileSync(routePath, 'utf8');
  const character = readFileSync(characterPath, 'utf8');
  const requestTypes = readFileSync(requestTypesPath, 'utf8');
  const executionContract = readFileSync(executionContractPath, 'utf8');

  assert.match(service, /export type \{ ExecuteImageGenerationOptions \}/);
  assert.match(executionContract, /walletReservation: WalletReservation/);
  assert.match(executionContract, /preReservedInitialState/);
  assert.match(service, /createAtomicInitialImageJob\(\{[\s\S]*walletReservation/);
  assert.match(service, /trustedInitialState:\s*preReservedInitialState/);
  assert.match(initial, /walletReservation: WalletReservation/);
  assert.match(initial, /walletReservation === 'reserve'/);
  assert.match(initial, /walletReservation === 'already_reserved'/);
  assert.match(route, /executeImageGeneration\(\{[\s\S]*walletReservation:\s*'reserve'/);
  assert.match(character, /executeImageGeneration\(\{[\s\S]*walletReservation:\s*'reserve'/);
  assert.doesNotMatch(route, /body(?:\?|\.)walletReservation|body\[['"]walletReservation['"]\]/);
  assert.doesNotMatch(requestTypes, /walletReservation/);
});

test('image provider submission remains after initial job reservation and keeps parity hooks', () => {
  const service = readFileSync(servicePath, 'utf8');
  const reservation = service.indexOf('await createAtomicInitialImageJob');
  const directProvider = service.indexOf('await executeDirectImageProviderIfAvailable');
  const falProvider = service.indexOf('await executeImageProviderWithLumaAgentsDirectFallback');
  assert.ok(reservation >= 0 && directProvider > reservation && falProvider > reservation);
  assert.match(service, /buildResponseFromExistingJob/);
  assert.match(service, /persistCompletedImageGeneration/);
  assert.match(service, /persistFailedImageGeneration/);
  assert.match(service, /refundOnFailure:\s*walletChargeMode === 'charge'/);
  assert.match(service, /STORYBOARD_INCLUDED_PAYMENT_STATUS/);
  assert.match(service, /ensureUserPreferredCurrency/);
  assert.match(service, /executeAfterInitialJobReservation/);
});

test('ordinary web image timeout and 5xx failures keep the existing failure and refund path', async () => {
  const policy = await import('../frontend/src/server/images/image-provider-failure-policy');
  const shouldKeepPending = (policy as unknown as {
    shouldKeepImageProviderOutcomePending?: (params: {
      walletReservation: 'reserve' | 'already_reserved';
      hasTrustedQuotedBilling: boolean;
      error: unknown;
      providerJobId?: string;
    }) => boolean;
  }).shouldKeepImageProviderOutcomePending;
  assert.equal(typeof shouldKeepPending, 'function');
  assert.equal(shouldKeepPending!({
    walletReservation: 'reserve',
    hasTrustedQuotedBilling: false,
    error: new Error('provider timeout'),
  }), false);
  assert.equal(shouldKeepPending!({
    walletReservation: 'reserve',
    hasTrustedQuotedBilling: false,
    error: { status: 503 },
  }), false);
  const service = readFileSync(servicePath, 'utf8');
  assert.match(service, /persistFailedImageGeneration/);
  assert.match(service, /refundOnFailure:\s*walletChargeMode === 'charge'/);
});

test('trusted already-reserved MCP image ambiguity stays pending without entering the web refund path', async () => {
  const policy = await import('../frontend/src/server/images/image-provider-failure-policy');
  const shouldKeepPending = (policy as unknown as {
    shouldKeepImageProviderOutcomePending?: (params: {
      walletReservation: 'reserve' | 'already_reserved';
      hasTrustedQuotedBilling: boolean;
      error: unknown;
      providerJobId?: string;
    }) => boolean;
  }).shouldKeepImageProviderOutcomePending;
  assert.equal(typeof shouldKeepPending, 'function');
  assert.equal(shouldKeepPending!({
    walletReservation: 'already_reserved',
    hasTrustedQuotedBilling: true,
    error: new Error('provider timeout'),
  }), true);
  assert.equal(shouldKeepPending!({
    walletReservation: 'already_reserved',
    hasTrustedQuotedBilling: true,
    error: { status: 503 },
    providerJobId: 'provider-job-1',
  }), true);
});
