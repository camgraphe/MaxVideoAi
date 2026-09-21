import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MCP_TOOL_INPUT_SCHEMAS } from '../../../frontend/src/server/mcp/tool-input-schemas';

const directory = fileURLToPath(new URL('.', import.meta.url));
const read = (name: string) => JSON.parse(readFileSync(`${directory}/${name}`, 'utf8'));
const expected = read('mapping-predeclared-review.json').cases;
const rows = [];
for (const variant of ['a', 'b']) {
  const output = read(`${variant}-mapping-output.json`);
  assert.deepEqual(output.cases.map((item: any) => item.id).sort(), Object.keys(expected).sort());
  for (const item of output.cases) {
    const parsed = MCP_TOOL_INPUT_SCHEMAS.recommend_models.safeParse(item.arguments);
    const prioritiesMatch = JSON.stringify(item.arguments.priorities ?? null) === JSON.stringify(expected[item.id].priorities);
    const resolutionMatches = expected[item.id].resolution === undefined || item.arguments.resolution === expected[item.id].resolution;
    rows.push({ variant, id: item.id, schemaValid: parsed.success, prioritiesMatch, resolutionMatches });
  }
}
const result = { date: '2026-09-22', evidenceKind: 'controlled-field-mapping-only', realHostEvidence: false, rows };
writeFileSync(`${directory}/mapping-mechanical-review.json`, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ probes: rows.length, correct: rows.filter(row => row.schemaValid && row.prioritiesMatch && row.resolutionMatches).length }));
// Check recorded responses against the checkout; this never calls a model.
assert.ok(rows.every(row => row.schemaValid && row.prioritiesMatch && row.resolutionMatches));
