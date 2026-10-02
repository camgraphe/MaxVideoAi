import { assertValidationResults } from './_lib/ci-validation-policy.mjs';

try {
  assertValidationResults(JSON.parse(process.env.CI_JOB_RESULTS ?? '{}'));
  process.stdout.write('All required CI lanes passed.\n');
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
