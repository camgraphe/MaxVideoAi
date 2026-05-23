import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

type LiveAdvisorLoopOptions = {
  passes: number;
  scenarioSet: 'core' | 'expanded';
  limit?: number;
  offset: number;
  llmJudge: boolean;
  model?: string;
  sleepMs: number;
  continueOnFailure: boolean;
};

type CommandSpec = {
  command: string;
  args: string[];
};

const reportDir = resolve(process.cwd(), '.reports/ai-strategist/live-tool-relevance/batches');

export function parseLiveAdvisorLoopArgs(args: readonly string[]): LiveAdvisorLoopOptions {
  return {
    passes: numberArg(args, '--passes', 20),
    scenarioSet: stringArg(args, '--scenario-set') === 'core' ? 'core' : 'expanded',
    limit: numberArg(args, '--limit'),
    offset: numberArg(args, '--offset', 0) ?? 0,
    llmJudge: args.includes('--llm-judge'),
    model: stringArg(args, '--model'),
    sleepMs: numberArg(args, '--sleep-ms', 1000) ?? 1000,
    continueOnFailure: args.includes('--continue-on-failure'),
  };
}

export function buildLiveAdvisorLoopCommand(options: LiveAdvisorLoopOptions, passIndex: number): CommandSpec {
  const offset = options.offset + Math.max(0, passIndex - 1) * (options.limit ?? 0);
  const args = [
    'tsx',
    '--tsconfig',
    'frontend/tsconfig.json',
    'scripts/evaluate-ai-strategist-live-tool-relevance.ts',
    `--scenario-set=${options.scenarioSet}`,
    `--offset=${offset}`,
  ];

  if (options.limit !== undefined) args.push(`--limit=${options.limit}`);
  if (options.llmJudge) args.push('--llm-judge');
  if (options.model) args.push(`--model=${options.model}`);

  return {
    command: 'npx',
    args,
  };
}

async function main() {
  const options = parseLiveAdvisorLoopArgs(process.argv.slice(2));
  mkdirSync(reportDir, { recursive: true });

  console.log('AI Strategist Live Advisor Loop');
  console.log(`Passes: ${options.passes}`);
  console.log(`Scenario set: ${options.scenarioSet}`);
  console.log(`Limit per pass: ${options.limit ?? 'all remaining scenarios'}`);
  console.log(`LLM judge: ${options.llmJudge ? 'enabled' : 'disabled'}`);
  console.log('RAG connected: no');
  console.log('Auto-generation/credit spend/publish: no');
  console.log('');

  const summaries: string[] = [];
  for (let passIndex = 1; passIndex <= options.passes; passIndex += 1) {
    const command = buildLiveAdvisorLoopCommand(options, passIndex);
    const startedAt = Date.now();
    const result = spawnSync(command.command, command.args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        AI_STRATEGIST_LLM_MAX_RETRIES: process.env.AI_STRATEGIST_LLM_MAX_RETRIES ?? '3',
        AI_STRATEGIST_LLM_RETRY_BASE_MS: process.env.AI_STRATEGIST_LLM_RETRY_BASE_MS ?? '1500',
      },
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 20,
    });
    const elapsedSeconds = Number(((Date.now() - startedAt) / 1000).toFixed(1));
    const logPath = resolve(reportDir, `live-advisor-loop-pass-${String(passIndex).padStart(3, '0')}.log`);
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
    writeFileSync(logPath, output);

    const passed = result.status === 0;
    const summary = `Pass ${passIndex}/${options.passes}: ${passed ? 'PASS' : 'FAIL'} in ${elapsedSeconds}s (${logPath})`;
    summaries.push(summary);
    console.log(summary);
    console.log(tail(output, 24));
    console.log('');

    if (!passed && !options.continueOnFailure) {
      writeLoopSummary(summaries, false);
      process.exitCode = result.status ?? 1;
      return;
    }

    if (passIndex < options.passes && options.sleepMs > 0) {
      await sleep(options.sleepMs);
    }
  }

  writeLoopSummary(summaries, true);
}

function writeLoopSummary(summaries: readonly string[], passed: boolean): void {
  const summaryPath = resolve(reportDir, 'latest-live-advisor-loop-summary.md');
  writeFileSync(
    summaryPath,
    [
      '# AI Strategist Live Advisor Loop',
      '',
      `- Completed at: ${new Date().toISOString()}`,
      `- Overall: ${passed ? 'pass' : 'failed'}`,
      '',
      ...summaries.map((summary) => `- ${summary}`),
      '',
    ].join('\n')
  );
  console.log(`Loop summary: ${summaryPath}`);
}

function stringArg(args: readonly string[], key: string): string | undefined {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? '';
    if (arg === key) return args[index + 1];
    if (arg.startsWith(`${key}=`)) return arg.slice(key.length + 1);
  }
  return undefined;
}

function numberArg(args: readonly string[], key: string, fallback?: number): number | undefined {
  const raw = stringArg(args, key);
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function tail(output: string, lines: number): string {
  const allLines = output.trim().split('\n').filter(Boolean);
  return allLines.slice(-lines).join('\n');
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

if (process.argv[1]?.endsWith('run-ai-strategist-live-advisor-loop.ts')) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
