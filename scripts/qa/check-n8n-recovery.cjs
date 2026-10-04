#!/usr/bin/env node
// Uses a separately installed, disposable n8n runtime. It never invokes a live
// MCP node: only n8n's engine and native control/data nodes execute unchanged.
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const { tmpdir } = require('node:os');
const path = require('node:path');

async function main() {
  const [runtimePath, candidatePath, reportPath] = process.argv.slice(2);
  assert.ok(runtimePath && candidatePath,
    'Usage: node scripts/qa/check-n8n-recovery.cjs <disposable-runtime> <workflow.json> [report.json]');
  assert.equal(process.versions.node.split('.')[0], '24', 'This qualification is pinned to Node.js 24');
  const runtime = path.resolve(runtimePath);
  const requireRuntime = createRequire(path.join(runtime, 'package.json'));
  assert.equal(requireRuntime('n8n/package.json').version, '2.38.7', 'Use n8n@2.38.7');
  const state = mkdtempSync(path.join(tmpdir(), 'maxvideoai-n8n-engine-'));
  process.env.N8N_USER_FOLDER = state;
  process.env.N8N_DIAGNOSTICS_ENABLED = 'false';
  process.env.N8N_VERSION_NOTIFICATIONS_ENABLED = 'false';
  process.env.N8N_TEMPLATES_ENABLED = 'false';

  try {
    requireRuntime('reflect-metadata');
    const { Workflow } = requireRuntime('n8n-workflow');
    const { WorkflowExecute } = requireRuntime('n8n-core');
    const { ExecutionLifecycleHooks } = requireRuntime('n8n-core/dist/execution-engine/execution-lifecycle-hooks');
    const { If } = requireRuntime('n8n-nodes-base/dist/nodes/If/If.node');
    const { RenameKeys } = requireRuntime('n8n-nodes-base/dist/nodes/RenameKeys/RenameKeys.node');
    const { Wait } = requireRuntime('n8n-nodes-base/dist/nodes/Wait/Wait.node');
    const { NoOp } = requireRuntime('n8n-nodes-base/dist/nodes/NoOp/NoOp.node');
    const { Set: SetNode } = requireRuntime('n8n-nodes-base/dist/nodes/Set/Set.node');
    const { StickyNote } = requireRuntime('n8n-nodes-base/dist/nodes/StickyNote/StickyNote.node');
    const { McpClient } = requireRuntime(path.join(runtime,
      'node_modules/@n8n/n8n-nodes-langchain/dist/nodes/mcp/McpClient/McpClient.node.js'));
    const source = readFileSync(path.resolve(candidatePath));
    const original = JSON.parse(source);
    assert.equal(original.active, false);
    assert.ok(original.nodes.every((node) => !node.credentials), 'Use the credential-free source export');
    const results = [];
    const response = (delay = 0.001, status = 'accepted') => ({
      jobId: 'fixture-job', status,
      retry: { tool: 'get_generation_status', arguments: { jobId: 'fixture-job' }, afterSeconds: delay },
    });

    async function runCase(name, {
      initial = response(), next = [{ jobId: 'fixture-job', status: 'completed', retry: null }],
      approval = { approved: true, quoteId: 'fixture-quote' }, expectedStatus = 1,
      expectedResult = 'Present Result', minimumWait = 0,
    } = {}) {
      const calls = [];
      const types = {
        'n8n-nodes-base.renameKeys': new RenameKeys(), 'n8n-nodes-base.if': new If(),
        'n8n-nodes-base.wait': new Wait(), 'n8n-nodes-base.noOp': new NoOp(),
        'n8n-nodes-base.set': new SetNode(), 'n8n-nodes-base.stickyNote': new StickyNote(),
      };
      // Preserve the real MCP parameter descriptor so n8n evaluates jsonInput.
      // Replace its entire execute method and remove credential requirements;
      // no connection to the workflow's endpoint or provider is created.
      const description = structuredClone(new McpClient().description);
      delete description.credentials;
      types['@n8n/n8n-nodes-langchain.mcpClient'] = {
        description,
        async execute() {
          const tool = this.getNodeParameter('tool', 0).value;
          const raw = this.getNodeParameter('jsonInput', 0);
          const args = typeof raw === 'string' ? JSON.parse(raw) : raw;
          calls.push({ tool, args, at: Date.now() });
          let data;
          if (tool === 'prepare_generation') data = { quoteId: 'fixture-quote', price: 0.12 };
          else if (tool === 'confirm_generation') {
            assert.deepEqual(args, { quoteId: 'fixture-quote', confirmed: true });
            data = initial;
          } else if (tool === 'get_generation_status') {
            assert.deepEqual(args, { jobId: 'fixture-job' });
            const index = calls.filter((call) => call.tool === tool).length - 1;
            data = next[Math.min(index, next.length - 1)];
          } else if (tool === 'present_generation') {
            assert.deepEqual(args, { jobId: 'fixture-job' });
            data = { jobId: 'fixture-job', status: 'completed' };
          } else {
            assert.ok(['list_models', 'recommend_models', 'calculate_project_budget'].includes(tool),
              `Unexpected tool: ${tool}`);
            data = {};
          }
          return [[{ json: { structuredContent: structuredClone(data) } }]];
        },
      };
      types['n8n-nodes-base.manualTrigger'] = {
        description: {
          name: 'manualTrigger', displayName: 'Fixture input', version: 1, group: ['trigger'],
          defaults: { name: 'Brief Input' }, inputs: [], outputs: ['main'], properties: [],
        },
        async execute() {
          return [[{ json: {
            recommendationRequest: { surface: 'video' }, projectBudgetRequest: {}, generationRequest: {},
          } }]];
        },
      };
      const nodeTypes = {
        getByNameAndVersion(typeName, version) {
          const type = types[typeName];
          assert.ok(type, `Node type outside the deterministic fixture: ${typeName}`);
          return type.getNodeType ? type.getNodeType(version) : type;
        },
        getKnownTypes() { return {}; },
      };
      const workflow = new Workflow({ ...structuredClone(original), id: `qualification-${name}`, nodeTypes });
      const hooks = new ExecutionLifecycleHooks('manual', `fixture-${name}`, original);
      const additional = {
        hooks, currentNodeExecutionIndex: 0, executionId: `fixture-${name}`,
        variables: {}, credentialsHelper: {}, getRuntimeCredential: async () => undefined,
        restApiUrl: 'http://127.0.0.1/', instanceBaseUrl: 'http://127.0.0.1/',
        formBaseUrl: 'http://127.0.0.1/form', formWaitingBaseUrl: 'http://127.0.0.1/form-wait',
        formTestBaseUrl: 'http://127.0.0.1/form-test', webhookBaseUrl: 'http://127.0.0.1/hook',
        webhookWaitingBaseUrl: 'http://127.0.0.1/wait', webhookTestBaseUrl: 'http://127.0.0.1/test',
        logAiEvent() {},
        executeWorkflow() { throw Error('Unexpected subworkflow'); },
        startRunnerTask() { throw Error('Unexpected runner'); },
      };
      let run = await new WorkflowExecute(additional, 'manual').run({ workflow });
      assert.equal(run.status, 'waiting', JSON.stringify(run.data.resultData.error));
      assert.equal(calls.filter((call) => call.tool === 'confirm_generation').length, 0);
      assert.equal(run.data.resultData.lastNodeExecuted, 'Human Approval');
      // Simulate the approval webhook payload in the actual paused execution.
      // Resume the real engine with its existing item lineage and run indices.
      run.data.executionData.nodeExecutionStack[0].data.main[0] = [{ json: { body: approval } }];
      const started = Date.now();
      run = await new WorkflowExecute(additional, 'manual', run.data).processRunExecutionData(workflow);
      const elapsedMs = Date.now() - started;
      assert.equal(run.status, 'success', JSON.stringify(run.data.resultData.error));
      assert.equal(run.data.resultData.lastNodeExecuted, expectedResult);
      assert.equal(calls.filter((call) => call.tool === 'get_generation_status').length, expectedStatus);
      const confirmationCount = calls.filter((call) => call.tool === 'confirm_generation').length;
      assert.equal(confirmationCount, expectedResult === 'Approval Rejected' ? 0 : 1);
      // Measure the first recovery call, not presentation or the total runtime.
      if (minimumWait > 0) {
        const confirmedAt = calls.find((call) => call.tool === 'confirm_generation').at;
        const statusAt = calls.find((call) => call.tool === 'get_generation_status').at;
        assert.ok(statusAt - confirmedAt >= minimumWait * 1000 - 30,
          `${statusAt - confirmedAt}ms below returned ${minimumWait}s`);
      }
      const guardRuns = run.data.resultData.runData['Continue Polling?']?.length ?? 0;
      const waitRuns = run.data.resultData.runData['Wait Before Status']?.length ?? 0;
      assert.equal(waitRuns, expectedStatus);
      if (expectedStatus === 20) assert.equal(guardRuns, 21);
      results.push({ name, passed: true, elapsedMs, statusCalls: expectedStatus,
        confirmationCount, terminalNode: expectedResult, guardRuns, waitRuns });
      console.log('PASS', name, `${elapsedMs}ms`);
    }

    await runCase('accepted-to-completed');
    for (const [name, initial] of [
      ['null-retry', { ...response(), retry: null }],
      ['missing-retry', { jobId: 'fixture-job', status: 'running' }],
      ['wrong-tool', { ...response(), retry: { ...response().retry, tool: 'confirm_generation' } }],
      ['wrong-job', { ...response(), retry: { ...response().retry, arguments: { jobId: 'different' } } }],
      ['zero-delay', response(0)], ['negative-delay', response(-1)], ['string-delay', response('30')],
    ]) await runCase(name, { initial, expectedStatus: 0, expectedResult: 'Polling Timed Out' });
    await runCase('initial-completed', {
      initial: { jobId: 'fixture-job', status: 'completed', retry: null }, expectedStatus: 0,
    });
    await runCase('initial-failed', {
      initial: { jobId: 'fixture-job', status: 'failed', retry: null }, expectedStatus: 0,
    });
    await runCase('status-null-stops', {
      next: [{ ...response(), retry: null }], expectedResult: 'Polling Timed Out',
    });
    await runCase('twenty-status-bound', {
      next: [response()], expectedStatus: 20, expectedResult: 'Polling Timed Out',
    });
    for (const [name, approval] of [
      ['rejected', { approved: false, quoteId: 'fixture-quote' }],
      ['wrong-quote', { approved: true, quoteId: 'wrong' }],
      ['string-approval', { approved: 'true', quoteId: 'fixture-quote' }],
    ]) await runCase(name, { approval, expectedStatus: 0, expectedResult: 'Approval Rejected' });
    // Real wall-clock Wait nodes run concurrently to keep the check under a minute.
    await Promise.all([5, 15, 30, 45].map((delay) => runCase(`real-wait-${delay}`, {
      initial: response(delay), minimumWait: delay,
    })));
    const report = {
      scope: 'Real n8n engine and native nodes; deterministic MCP responses and approval resume payload. No live MCP, OAuth, provider, or paid generation.',
      workflowSha256: createHash('sha256').update(source).digest('hex'),
      n8nVersion: requireRuntime('n8n/package.json').version,
      coreVersion: requireRuntime('n8n-core/package.json').version,
      workflowVersion: requireRuntime('n8n-workflow/package.json').version,
      nodeVersion: process.version, count: results.length, results,
    };
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    if (reportPath) writeFileSync(path.resolve(reportPath), serialized, { flag: 'wx' });
    else console.log(serialized);
  } finally {
    rmSync(state, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
