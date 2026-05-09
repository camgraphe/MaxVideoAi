import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const handlerPath = join(root, 'frontend/server/fal-webhook-handler.ts');
const mappingPath = join(root, 'frontend/server/fal-webhook-mapping.ts');
const mappingTypesPath = join(root, 'frontend/server/fal-webhook-mapping-types.ts');
const mappingEnginePath = join(root, 'frontend/server/fal-webhook-engine.ts');
const mappingErrorsPath = join(root, 'frontend/server/fal-webhook-errors.ts');
const mappingIdentifiersPath = join(root, 'frontend/server/fal-webhook-identifiers.ts');
const mappingMediaPath = join(root, 'frontend/server/fal-webhook-media.ts');
const mappingPayloadSearchPath = join(root, 'frontend/server/fal-webhook-payload-search.ts');
const mappingStatusPath = join(root, 'frontend/server/fal-webhook-status.ts');
const refundsPath = join(root, 'frontend/server/fal-webhook-refunds.ts');
const provisionalPath = join(root, 'frontend/server/fal-webhook-provisional.ts');
const typesPath = join(root, 'frontend/server/fal-webhook-types.ts');

const handlerSource = readFileSync(handlerPath, 'utf8');
const mappingSource = readFileSync(mappingPath, 'utf8');
const mappingTypesSource = readFileSync(mappingTypesPath, 'utf8');
const mappingEngineSource = readFileSync(mappingEnginePath, 'utf8');
const mappingErrorsSource = readFileSync(mappingErrorsPath, 'utf8');
const mappingIdentifiersSource = readFileSync(mappingIdentifiersPath, 'utf8');
const mappingMediaSource = readFileSync(mappingMediaPath, 'utf8');
const mappingPayloadSearchSource = readFileSync(mappingPayloadSearchPath, 'utf8');
const mappingStatusSource = readFileSync(mappingStatusPath, 'utf8');
const refundsSource = readFileSync(refundsPath, 'utf8');
const provisionalSource = readFileSync(provisionalPath, 'utf8');
const typesSource = readFileSync(typesPath, 'utf8');

test('Fal webhook handler delegates mapping, payload extraction, provisional job, and refund helpers', () => {
  assert.ok(existsSync(mappingPath), 'Fal webhook mapping helpers should live in a sibling server module');
  assert.ok(existsSync(mappingTypesPath), 'Fal webhook mapping types should live in a focused sibling module');
  assert.ok(existsSync(mappingEnginePath), 'Fal webhook engine inference should live in a focused sibling module');
  assert.ok(existsSync(mappingErrorsPath), 'Fal webhook error extraction should live in a focused sibling module');
  assert.ok(existsSync(mappingIdentifiersPath), 'Fal webhook identifier extraction should live in a focused sibling module');
  assert.ok(existsSync(mappingMediaPath), 'Fal webhook media extraction should live in a focused sibling module');
  assert.ok(existsSync(mappingPayloadSearchPath), 'Fal webhook payload search should live in a focused sibling module');
  assert.ok(existsSync(mappingStatusPath), 'Fal webhook status normalization should live in a focused sibling module');
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
  assert.ok(mappingSource.split('\n').length <= 40, `fal-webhook-mapping facade should stay below 40 lines, got ${mappingSource.split('\n').length}`);
  assert.match(mappingSource, /from '\.\/fal-webhook-mapping-types'/);
  assert.match(mappingSource, /from '\.\/fal-webhook-engine'/);
  assert.match(mappingSource, /from '\.\/fal-webhook-errors'/);
  assert.match(mappingSource, /from '\.\/fal-webhook-identifiers'/);
  assert.match(mappingSource, /from '\.\/fal-webhook-media'/);
  assert.match(mappingSource, /from '\.\/fal-webhook-payload-search'/);
  assert.match(mappingSource, /from '\.\/fal-webhook-status'/);
  assert.doesNotMatch(mappingSource, /function extractMediaUrls|const PROVIDER_ENGINE_MAP|const ERROR_MESSAGE_KEYS/);

  assert.match(mappingTypesSource, /export type FalWebhookPayload =/, 'FalWebhookPayload should live with mapping helper types');
  assert.match(mappingTypesSource, /export type WebhookIdentifiers =/, 'WebhookIdentifiers should live with mapping helper types');
  assert.match(mappingEngineSource, /const PROVIDER_ENGINE_MAP/, 'provider alias map should live with engine inference');
  assert.match(mappingEngineSource, /listUpscaleToolEngines/, 'tool engine media lookup should live with engine inference');
  assert.match(mappingEngineSource, /export async function inferEngineFromPayload/);
  assert.match(mappingEngineSource, /export function getUpscaleToolMediaType/);
  assert.match(mappingErrorsSource, /const ERROR_MESSAGE_KEYS/, 'error message key map should live with error extraction');
  assert.match(mappingErrorsSource, /function normalizeErrorText/);
  assert.match(mappingErrorsSource, /function findFirstErrorMessage/);
  assert.match(mappingErrorsSource, /export function extractFalErrorMessage/);
  assert.match(mappingIdentifiersSource, /export function extractIdentifiersFromPayload/);
  assert.match(mappingPayloadSearchSource, /export function findFirstString/);
  assert.match(mappingPayloadSearchSource, /export function extractStringField/);
  assert.match(mappingMediaSource, /export function fallbackThumbnail/);
  assert.match(mappingMediaSource, /export function formatAspectRatioLabel/);
  assert.match(mappingMediaSource, /export function extractMediaUrls/);
  assert.match(mappingMediaSource, /export function normalizeRenderIdList/);
  assert.match(mappingMediaSource, /export function extractImageUrlsFromPayload/);
  assert.match(mappingStatusSource, /export function normalizeStatus/);
  assert.match(mappingStatusSource, /export function isCompletedFalStatus/);
  assert.match(mappingStatusSource, /export function isFailedFalStatus/);
  assert.match(refundsSource, /function coerceNumber\(/, 'numeric coercion should be private to refund helpers');
  assert.match(refundsSource, /function normalizeCurrency\(/, 'currency normalization should be private to refund helpers');
  assert.match(refundsSource, /export async function maybeAutoRefundWalletCharge/);
  assert.match(provisionalSource, /export async function createProvisionalJobFromWebhook/);
  assert.match(provisionalSource, /normalizeStatus/);
  assert.match(typesSource, /export type AppJobRow =/);
});
