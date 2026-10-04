import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(`frontend/${path}`, 'utf8');

test('application email callers share the configured SMTP transport', () => {
  for (const path of ['app/api/contact/route.ts', 'app/api/email-test/route.ts', 'server/legal-reports.ts', 'app/api/cron/infra-costs-alert/route.ts']) {
    const source = read(path);
    assert.match(source, /from '@\/server\/mailer'/);
    assert.doesNotMatch(source, /createTransport|POSTMARK_SERVER_TOKEN|RESEND_API_KEY/);
  }
});

test('SMTP diagnostic GET authenticates and verifies without sending email', () => {
  const source = read('app/api/email-test/route.ts');
  const get = source.slice(source.indexOf('export async function GET'));
  assert.ok(get.indexOf('isAuthorized(req)') < get.indexOf('mailer.verify()'));
  assert.match(get, /await mailer\.verify\(\)/);
  assert.match(get, /emailSent: false/);
  assert.doesNotMatch(get, /sendMail|runTest\(/);
  const post = source.slice(source.indexOf('export async function POST'), source.indexOf('export async function GET'));
  assert.ok(post.indexOf('isAuthorized(req)') < post.indexOf('runTest(to)'));
});

test('reset form does not expose transport errors and blocks concurrent requests', () => {
  const source = read('app/(core)/login/_hooks/useLoginPageController.ts');
  const reset = source.slice(source.indexOf('async function sendReset'), source.indexOf('async function signInWithGoogle'));
  assert.match(reset, /passwordResetPendingRef\.current \|\|/);
  assert.match(reset, /requestPasswordReset/);
  assert.doesNotMatch(reset, /setError\(error\.message\)/);
  const ui = read('app/(core)/login/_components/LoginAuthSurface.tsx');
  assert.match(ui, /disabled=\{isResetSending\}/);
});
