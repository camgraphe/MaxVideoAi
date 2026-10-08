import { spawnSync } from 'node:child_process';
import { reportTestPostgres, resolveTestPostgres } from './_lib/test-postgres-toolchain.mjs';

const [command, ...args] = process.argv.slice(2);
if (!command) {
  process.stderr.write('Usage: node scripts/run-postgres-tests.mjs <command> [arguments...]\n');
  process.exit(1);
}

try {
  const toolchain = resolveTestPostgres();
  reportTestPostgres(toolchain);
  const executable = process.platform === 'win32' && command === 'pnpm' ? 'pnpm.cmd' : command;
  const result = spawnSync(executable, args, { stdio: 'inherit', env: toolchain.env });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
