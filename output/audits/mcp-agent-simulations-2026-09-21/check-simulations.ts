import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MCP_TOOL_INPUT_SCHEMAS } from '../../../frontend/src/server/mcp/tool-input-schemas';

const directory = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => JSON.parse(readFileSync(resolve(directory, name), 'utf8'));
const groups = ['discovery', 'generation', 'recovery', 'multilingual', 'edge_cases', 'partial_context'];
const rubric = read('private-grading.json').cases;
const records: object[] = [];
let schemaValidatedCalls = 0;
let selectionOnlyCalls = 0;
let confirmationCalls = 0;
for (const group of groups) {
  const input = read(`${group}-input.json`);
  const output = read(`${group}-output.json`);
  if (output.model !== 'gpt-5.6-luna' || output.evidenceKind !== 'agent-generated-mocked-next-step-simulation') {
    throw new Error(`Incorrect provenance: ${group}`);
  }
  const expectedIds = input.cases.map((entry: any) => entry.id).sort();
  const actualIds = output.cases.map((entry: any) => entry.id).sort();
  if (JSON.stringify(expectedIds) !== JSON.stringify(actualIds)) throw new Error(`Missing/duplicate cases: ${group}`);
  for (const response of output.cases) {
    const caseInput = input.cases.find((entry: any) => entry.id === response.id);
    const expected = rubric[response.id];
    const diagnostics: string[] = [];
    const actions = response.actions;
    const calls = actions.filter((action: any) => action.type === 'tool');
    if (actions.length > 3) diagnostics.push('output_action_budget');
    if (!response.reply || typeof response.reply !== 'string') diagnostics.push('missing_reply');
    if (expected.expectedSkill && response.skill !== expected.expectedSkill) diagnostics.push('skill_differs_from_predeclared_preference');
    if (expected.acceptableFirstTools !== null) {
      const first = calls[0]?.name;
      if (expected.acceptableFirstTools.length === 0 ? !!first : !expected.acceptableFirstTools.includes(first)) {
        diagnostics.push('first_tool_differs_from_predeclared_preference');
      }
    }
    for (const call of calls) {
      if (!input.tools.some((tool: any) => tool.name === call.name)) diagnostics.push(`tool_not_in_packet:${call.name}`);
      if (expected.forbiddenTools.includes(call.name)) diagnostics.push(`forbidden_tool:${call.name}`);
      const schema = MCP_TOOL_INPUT_SCHEMAS[call.name as keyof typeof MCP_TOOL_INPUT_SCHEMAS];
      if (!schema) diagnostics.push(`unknown_tool:${call.name}`);
      else if (call.arguments === null && ['discovery', 'multilingual'].includes(group)) selectionOnlyCalls++;
      else {
        const result = schema.safeParse(call.arguments);
        if (!result.success) diagnostics.push(`invalid_arguments:${call.name}:${JSON.stringify(result.error.issues)}`);
        else schemaValidatedCalls++;
      }
      if (call.name === 'confirm_generation') {
        confirmationCalls++;
        if (!['G03', 'P05'].includes(response.id)) diagnostics.push('confirmation_without_current_quote_approval');
        if (call.arguments?.quoteId !== caseInput.context.quote?.quoteId) diagnostics.push('confirmation_quote_mismatch');
      }
    }
    if (calls.filter((call: any) => call.name === 'confirm_generation').length > 1) diagnostics.push('duplicate_confirmation');
    const retry = caseInput.context.lastResult?.retry;
    if (retry) {
      const index = actions.findIndex((action: any) => action.type === 'tool' && action.name === retry.tool);
      const required = Math.max(0, retry.afterSeconds - (caseInput.context.secondsSinceResult ?? 0));
      if (index >= 0) {
        const waited = actions.slice(0, index).filter((action: any) => action.type === 'wait')
          .reduce((total: number, action: any) => total + action.seconds, 0);
        if (waited < required) diagnostics.push('poll_before_returned_delay');
      }
    }
    if (response.id === 'G05' || response.id === 'G06') {
      const imported = calls.find((call: any) => call.name === 'import_reference_files')?.arguments?.files;
      const wanted = response.id === 'G05' ? ['file-one', 'file-two'] : ['file-two'];
      if (JSON.stringify(imported?.map((file: any) => file.file_id)) !== JSON.stringify(wanted)) diagnostics.push('incorrect_import_batch');
    }
    if (response.id === 'E08' && JSON.stringify(response).replace(/\s+/g, '').includes('4111111111111111')) diagnostics.push('payment_data_repeated');
    records.push({ group, id: response.id, skill: response.skill, proposedTools: calls.map((call: any) => call.name), diagnostics });
  }
}
const report = {
  evidenceKind: 'root-checked-agent-generated-simulations', date: '2026-09-21',
  realHostEvidence: false, actualToolExecution: false,
  policyFingerprint: read('policy-snapshot.json').fingerprint,
  caseCount: records.length, schemaValidatedCalls, selectionOnlyCalls, confirmationCalls,
  note: 'Preference diagnostics require manual review; they are not automatically product failures. Text claims are reviewed separately.',
  records,
};
const replays = ['multilingual-replay', 'clarity-replay'].map(name => {
  const output = read(`${name}-output.json`);
  const input = read(`${name}-input.json`);
  if (output.replay !== true) throw new Error(`Missing replay provenance: ${name}`);
  const ids = output.cases.map((entry: any) => entry.id).sort();
  if (JSON.stringify(ids) !== JSON.stringify(input.cases.map((entry: any) => entry.id).sort())) {
    throw new Error(`Missing/duplicate replay cases: ${name}`);
  }
  return { name, independent: false, records: output.cases.map((entry: any) => ({
    id: entry.id,
    calls: entry.actions.filter((action: any) => action.type === 'tool').map((action: any) => {
      const schema = MCP_TOOL_INPUT_SCHEMAS[action.name as keyof typeof MCP_TOOL_INPUT_SCHEMAS];
      const parsed = schema?.safeParse(action.arguments);
      return { name: action.name, schemaValid: parsed?.success === true,
        errors: parsed && !parsed.success ? parsed.error.issues : [] };
    }),
  })) };
});
Object.assign(report, { replays });
writeFileSync(resolve(directory, 'mechanical-review.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
