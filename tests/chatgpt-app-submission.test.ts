import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const submission = JSON.parse(
  readFileSync('chatgpt-app-submission.json', 'utf8'),
) as Record<string, unknown>;

const expectedTools = [
  'get_account_status',
  'list_models',
  'get_model_details',
  'recommend_models',
  'calculate_project_budget',
  'list_media',
  'create_reference_upload_link',
  'import_reference_files',
  'prepare_generation',
  'confirm_generation',
  'get_generation_status',
  'list_recent_generations',
  'get_generation_download',
  'present_generation',
  'create_topup_link',
] as const;

function record(value: unknown): Record<string, unknown> {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}

test('ChatGPT submission covers the complete production tool inventory with truthful hints', () => {
  assert.equal(
    submission.$schema,
    'https://developers.openai.com/apps-sdk/schemas/chatgpt-app-submission.v1.json',
  );
  assert.equal(submission.schema_version, 1);
  const appInfo = record(submission.app_info);
  assert.equal(appInfo.display_name, 'MaxVideoAI');
  assert.ok(typeof appInfo.subtitle === 'string' && appInfo.subtitle.length <= 30);
  assert.equal(appInfo.category, 'DESIGN');

  const tools = record(submission.tools);
  assert.deepEqual(Object.keys(tools), expectedTools);
  for (const [name, value] of Object.entries(tools)) {
    const tool = record(value);
    const annotations = record(tool.annotations);
    assert.equal(typeof annotations.readOnlyHint, 'boolean', `${name} readOnlyHint`);
    assert.equal(typeof annotations.openWorldHint, 'boolean', `${name} openWorldHint`);
    assert.equal(typeof annotations.destructiveHint, 'boolean', `${name} destructiveHint`);
    const justifications = record(tool.justifications);
    for (const field of [
      'read_only_justification',
      'open_world_justification',
      'destructive_justification',
    ]) {
      assert.ok(typeof justifications[field] === 'string' && justifications[field].length > 20);
    }
  }

  assert.deepEqual(record(record(tools.prepare_generation).annotations), {
    readOnlyHint: false,
    openWorldHint: false,
    destructiveHint: false,
  });
  assert.deepEqual(record(record(tools.confirm_generation).annotations), {
    readOnlyHint: false,
    openWorldHint: true,
    destructiveHint: true,
  });
  assert.deepEqual(record(record(tools.import_reference_files).annotations), {
    readOnlyHint: false,
    openWorldHint: true,
    destructiveHint: false,
  });
});

test('ChatGPT submission has review-ready positive and negative cases without sensitive data', () => {
  const positive = submission.test_cases;
  const negative = submission.negative_test_cases;
  assert.ok(Array.isArray(positive));
  assert.ok(Array.isArray(negative));
  assert.equal(positive.length, 6);
  assert.equal(negative.length, 3);

  const tools = new Set(expectedTools);
  for (const testCase of positive) {
    const value = record(testCase);
    assert.equal(typeof value.user_prompt, 'string');
    assert.equal(typeof value.expected_output, 'string');
    const triggered = String(value.tools_triggered).split(',').map((name) => name.trim());
    assert.ok(triggered.length >= 1);
    for (const name of triggered) assert.ok(tools.has(name as typeof expectedTools[number]));
  }
  for (const testCase of negative) {
    const value = record(testCase);
    assert.equal(value.tools_triggered, null);
  }
  assert.ok(positive.some((testCase) =>
    String(record(testCase).tools_triggered).includes('import_reference_files')
  ));

  const serialized = JSON.stringify(submission);
  assert.doesNotMatch(serialized, /(?:card number|cvv|mfa code|password|access token|private key|\/Users\/|request[-_ ]?id)/i);
});
