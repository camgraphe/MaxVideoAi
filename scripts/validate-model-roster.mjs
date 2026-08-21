import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'docs', 'model-roster-report.md');

function runScript(scriptPath, args = [], runner = 'node') {
  const absolutePath = path.join(ROOT, scriptPath);
  const command = runner === 'tsx' ? path.join(ROOT, 'node_modules', '.bin', 'tsx') : process.execPath;
  const commandArgs = runner === 'tsx'
    ? ['--tsconfig', path.join(ROOT, 'frontend', 'tsconfig.json'), absolutePath, ...args]
    : [absolutePath, ...args];
  const result = spawnSync(command, commandArgs, {
    cwd: ROOT,
    stdio: 'inherit',
  });
  return result.status === 0;
}

async function writeReport(stepResults) {
  const failed = stepResults.filter((step) => !step.ok);
  const lines = [
    '# Model Roster QA Report',
    '',
    `Generated on ${new Date().toISOString()}`,
    '',
    '## Steps',
    '',
    ...stepResults.map((step) => `- ${step.ok ? 'PASS' : 'FAIL'}: ${step.label}`),
    '',
    '## Summary',
    '',
    failed.length === 0
      ? '- All checks passed.'
      : `- ${failed.length} step(s) failed: ${failed.map((step) => step.label).join(', ')}`,
  ];
  await fs.writeFile(REPORT_PATH, `${lines.join('\n')}\n`, 'utf-8');
}

async function main() {
  const runtimeArgs = process.argv.slice(2).includes('--runtime') ? ['--runtime'] : [];
  const steps = [
    {
      label: 'model:generate (check mode)',
      scriptPath: 'scripts/generate-model-roster.mjs',
      args: [],
    },
    {
      label: runtimeArgs.length ? 'models:audit --runtime' : 'models:audit',
      scriptPath: 'scripts/models-audit.mjs',
      args: runtimeArgs,
      runner: 'tsx',
    },
  ];

  const results = steps.map((step) => ({
    label: step.label,
    ok: runScript(step.scriptPath, step.args, step.runner),
  }));

  await writeReport(results);

  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) {
    console.error(`[model-roster] Validation failed (${failed.length} step(s)). See docs/model-roster-report.md.`);
    process.exitCode = 1;
    return;
  }

  console.log('[model-roster] Validation passed.');
}

main().catch((error) => {
  console.error('[model-roster] Unable to validate roster:', error);
  process.exitCode = 1;
});
