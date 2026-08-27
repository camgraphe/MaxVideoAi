import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

type ConversationEval = {
  id: string;
  language: 'en' | 'fr' | 'es';
  style: 'natural' | 'imperfect';
  category: 'account' | 'generate' | 'plan' | 'prompting' | 'recovery';
  prompt: string;
  expectedSkill: 'generate' | 'plan';
  expectedTools: string[];
  prohibitedTools: string[];
  checks: string[];
};

const cases = JSON.parse(
  readFileSync('plugins/maxvideoai/evals/conversation-cases.json', 'utf8'),
) as ConversationEval[];

test('conversation eval corpus covers imperfect multilingual user journeys without paid confirmation', () => {
  assert.ok(cases.length >= 30);
  assert.deepEqual([...new Set(cases.map((entry) => entry.language))].sort(), ['en', 'es', 'fr']);
  assert.ok(cases.filter((entry) => entry.style === 'imperfect').length >= 15);
  assert.deepEqual(
    [...new Set(cases.map((entry) => entry.category))].sort(),
    ['account', 'generate', 'plan', 'prompting', 'recovery'],
  );

  const ids = new Set<string>();
  for (const entry of cases) {
    assert.match(entry.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(ids.has(entry.id), false, entry.id);
    ids.add(entry.id);
    assert.ok(entry.prompt.length >= 12, entry.id);
    assert.ok(entry.checks.length >= 2, entry.id);
    assert.equal(new Set(entry.expectedTools).size, entry.expectedTools.length, entry.id);
    assert.equal(new Set(entry.prohibitedTools).size, entry.prohibitedTools.length, entry.id);
    assert.ok(entry.prohibitedTools.includes('confirm_generation'), entry.id);
  }

  assert.ok(cases.some((entry) =>
    entry.category === 'prompting'
      && entry.expectedTools.includes('get_model_details')
      && entry.checks.includes('uses_reviewed_official_prompting_source')
  ));
  assert.ok(cases.some((entry) =>
    entry.category === 'account'
      && entry.checks.includes('explains_account_required')
  ));
  assert.ok(cases.some((entry) =>
    entry.category === 'recovery'
      && entry.expectedTools.includes('list_recent_generations')
  ));
  assert.ok(cases.some((entry) => entry.checks.includes('does_not_substitute_host_attachment')));
  assert.ok(cases.some((entry) => entry.checks.includes('labels_missing_asset_price_as_estimate')));
  assert.ok(cases.some((entry) => entry.checks.includes('treats_expires_at_as_utc')));
});
