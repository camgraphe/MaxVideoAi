import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

type StopInput = {
  cleanRuns: number;
  stopAfterCleanRuns: number;
  iteration: number;
  maxIterations: number;
};

export function shouldStopStrategistLoop(input: StopInput): boolean {
  return input.cleanRuns >= input.stopAfterCleanRuns || input.iteration >= input.maxIterations;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  let cleanRuns = 0;
  const reportDir = resolve(process.cwd(), '.reports/ai-strategist');
  mkdirSync(reportDir, { recursive: true });

  for (let iteration = 1; iteration <= options.iterations; iteration += 1) {
    const fixturePath = resolve(reportDir, `generated-scenarios-${iteration}.json`);
    const jsonReportPath = resolve(reportDir, `eval-report-${iteration}.json`);
    const markdownReportPath = resolve(reportDir, `eval-report-${iteration}.md`);
    const offset = (iteration - 1) * options.batchSize;

    runOrThrow('npx', [
      'tsx',
      '--tsconfig',
      'frontend/tsconfig.json',
      'scripts/generate-ai-strategist-scenarios.ts',
      fixturePath,
      '--batch-size',
      String(options.batchSize),
      '--offset',
      String(offset),
      ...(options.englishFirst ? [] : ['--no-english-first']),
    ]);

    const evalResult = run('npx', [
      'tsx',
      '--tsconfig',
      'frontend/tsconfig.json',
      'scripts/evaluate-ai-strategist-conversations.ts',
      '--fixture',
      fixturePath,
      '--json-output',
      jsonReportPath,
      '--markdown-output',
      markdownReportPath,
      ...(options.liveJudge ? ['--live'] : []),
    ]);

    const passed = evalResult.status === 0;
    cleanRuns = passed ? cleanRuns + 1 : 0;
    const summary = buildSummary({
      iteration,
      passed,
      cleanRuns,
      stopAfterCleanRuns: options.stopAfterCleanRuns,
      fixturePath,
      jsonReportPath,
      markdownReportPath,
    });

    writeFileSync(resolve(reportDir, 'latest-loop-summary.md'), summary);
    console.log(summary);

    if (!passed || shouldStopStrategistLoop({
      cleanRuns,
      stopAfterCleanRuns: options.stopAfterCleanRuns,
      iteration,
      maxIterations: options.iterations,
    })) {
      process.exitCode = passed ? 0 : 1;
      return;
    }
  }
}

function buildSummary(input: {
  iteration: number;
  passed: boolean;
  cleanRuns: number;
  stopAfterCleanRuns: number;
  fixturePath: string;
  jsonReportPath: string;
  markdownReportPath: string;
}) {
  return [
    `# AI Strategist Loop Iteration ${input.iteration}`,
    '',
    `- Passed: ${input.passed ? 'yes' : 'no'}`,
    `- Clean runs: ${input.cleanRuns}/${input.stopAfterCleanRuns}`,
    `- Fixture: ${input.fixturePath}`,
    `- JSON report: ${input.jsonReportPath}`,
    `- Markdown report: ${input.markdownReportPath}`,
    '',
    input.passed
      ? 'No deterministic failures found in this iteration.'
      : 'Fix the highest-impact failure cluster, run targeted evals, run full evals, commit, then restart the loop.',
    '',
  ].join('\n');
}

function parseArgs(args: string[]) {
  return {
    iterations: numberArg(args, '--iterations', 20),
    batchSize: numberArg(args, '--batch-size', 80),
    stopAfterCleanRuns: numberArg(args, '--stop-after-clean-runs', 3),
    englishFirst: args.includes('--english-first') || !args.includes('--no-english-first'),
    writeReports: args.includes('--write-reports'),
    liveJudge: args.includes('--live-judge'),
  };
}

function numberArg(args: string[], key: string, fallback: number): number {
  const direct = args.find((arg) => arg.startsWith(`${key}=`));
  if (direct) return Number(direct.slice(key.length + 1)) || fallback;
  const index = args.indexOf(key);
  if (index >= 0) return Number(args[index + 1]) || fallback;
  return fallback;
}

function runOrThrow(command: string, args: string[]) {
  const result = run(command, args);
  if (result.status !== 0) throw new Error(`Command failed: ${command} ${args.join(' ')}`);
}

function run(command: string, args: string[]) {
  return spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });
}

if (process.argv[1]?.endsWith('run-ai-strategist-improvement-loop.ts')) main();
