import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const handlerPath = join(root, 'frontend/server/fal-webhook-handler.ts');
const mappingPath = join(root, 'frontend/server/fal-webhook-mapping.ts');
const refundsPath = join(root, 'frontend/server/fal-webhook-refunds.ts');
const provisionalPath = join(root, 'frontend/server/fal-webhook-provisional.ts');
const typesPath = join(root, 'frontend/server/fal-webhook-types.ts');

const handlerSource = readFileSync(handlerPath, 'utf8');
const mappingSource = readFileSync(mappingPath, 'utf8');
const refundsSource = readFileSync(refundsPath, 'utf8');
const provisionalSource = readFileSync(provisionalPath, 'utf8');
const typesSource = readFileSync(typesPath, 'utf8');

test('Fal webhook handler delegates mapping, payload extraction, provisional job, and refund helpers', () => {
  assert.ok(existsSync(mappingPath), 'Fal webhook mapping helpers should live in a sibling server module');
  assert.ok(existsSync(refundsPath), 'Fal webhook refund helpers should live in a sibling server module');
  assert.ok(existsSync(provisionalPath), 'Fal webhook provisional job recovery should live in a sibling server module');
  assert.ok(existsSync(typesPath), 'Fal webhook row contracts should live in a sibling server module');
  assert.match(handlerSource, /from '\.\/fal-webhook-mapping'/, 'webhook handler should import mapping helpers');
  assert.match(handlerSource, /from '\.\/fal-webhook-refunds'/, 'webhook handler should import refund helpers');
  assert.match(handlerSource, /from '\.\/fal-webhook-provisional'/, 'webhook handler should import provisional job helpers');
  assert.match(handlerSource, /from '\.\/fal-webhook-types'/, 'webhook handler should import shared row types');

  for (const implementationName of [
    'fallbackThumbnail',
    'formatAspectRatioLabel',
    'extractStringField',
    'extractIdentifiersFromPayload',
    'inferEngineFromPayload',
    'findFirstString',
    'extractMediaUrls',
    'normalizeRenderIdList',
    'extractImageUrlsFromPayload',
    'normalizeErrorText',
    'findFirstErrorMessage',
    'extractFalErrorMessage',
    'normalizeStatus',
    'coerceNumber',
    'normalizeCurrency',
    'maybeAutoRefundWalletCharge',
    'createProvisionalJobFromWebhook',
  ]) {
    assert.doesNotMatch(
      handlerSource,
      new RegExp(`function ${implementationName}\\(`),
      `${implementationName} belongs in fal-webhook-mapping.ts`
    );
  }

  assert.doesNotMatch(handlerSource, /PROVIDER_ENGINE_MAP/, 'provider engine mapping belongs in fal-webhook-mapping.ts');
  assert.doesNotMatch(handlerSource, /ERROR_MESSAGE_KEYS/, 'error message key mapping belongs in fal-webhook-mapping.ts');
  assert.doesNotMatch(handlerSource, /listUpscaleToolEngines/, 'tool engine media lookup belongs in fal-webhook-mapping.ts');
  assert.doesNotMatch(handlerSource, /type AppJobRow =/, 'AppJobRow belongs in fal-webhook-types.ts');

  const lineCount = handlerSource.split('\n').length;
  assert.ok(lineCount <= 690, `Fal webhook handler should stay below 690 lines after provisional job extraction, got ${lineCount}`);
});

test('Fal webhook mapping module exposes the expected helper contract', () => {
  for (const exportName of [
    'fallbackThumbnail',
    'formatAspectRatioLabel',
    'extractIdentifiersFromPayload',
    'inferEngineFromPayload',
    'findFirstString',
    'extractMediaUrls',
    'normalizeRenderIdList',
    'extractImageUrlsFromPayload',
    'extractFalErrorMessage',
    'normalizeStatus',
    'getUpscaleToolMediaType',
    'isCompletedFalStatus',
    'isFailedFalStatus',
  ]) {
    assert.match(
      mappingSource,
      new RegExp(`export (async function|function) ${exportName}`),
      `${exportName} should be exported by fal-webhook-mapping.ts`
    );
  }

  assert.match(mappingSource, /export type FalWebhookPayload =/, 'FalWebhookPayload should move with mapping helpers');
  assert.match(mappingSource, /export type WebhookIdentifiers =/, 'WebhookIdentifiers should move with mapping helpers');
  assert.match(mappingSource, /const PROVIDER_ENGINE_MAP/, 'provider alias map should live with engine inference');
  assert.match(mappingSource, /const ERROR_MESSAGE_KEYS/, 'error message key map should live with error extraction');
  assert.match(refundsSource, /function coerceNumber\(/, 'numeric coercion should be private to refund helpers');
  assert.match(refundsSource, /function normalizeCurrency\(/, 'currency normalization should be private to refund helpers');
  assert.match(refundsSource, /export async function maybeAutoRefundWalletCharge/);
  assert.match(provisionalSource, /export async function createProvisionalJobFromWebhook/);
  assert.match(provisionalSource, /normalizeStatus/);
  assert.match(typesSource, /export type AppJobRow =/);
});
