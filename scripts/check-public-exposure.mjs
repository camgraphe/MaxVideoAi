#!/usr/bin/env node
/**
 * Repository exposure guard.
 *
 * The check only scans files tracked by git so local ignored secrets such as
 * .env.local do not break normal development.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const MAX_TEXT_FILE_BYTES = 1024 * 1024;

const dangerousNextPublicNames = [
  /\bNEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|SERVICE_ROLE|PRIVATE_KEY|PASSWORD|TOKEN|DATABASE_URL|WEBHOOK)\b/g,
  /\bNEXT_PUBLIC_(?:OPENAI_API_KEY|FAL_API_KEY|FAL_KEY|S3_ACCESS_KEY_ID|S3_SECRET_ACCESS_KEY|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY)\b/g,
  /\bNEXT_PUBLIC_(?:STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|SUPABASE_SERVICE_ROLE_KEY|GA4_API_SECRET|GOOGLE_OAUTH_CLIENT_SECRET)\b/g,
];

const secretValuePatterns = [
  { name: 'Stripe secret key', pattern: /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/g },
  { name: 'Stripe webhook secret', pattern: /\bwhsec_[A-Za-z0-9]{16,}\b/g },
  { name: 'OpenAI API key', pattern: /\bsk-proj-[A-Za-z0-9_-]{20,}\b/g },
  { name: 'AWS access key id', pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'Google OAuth client secret', pattern: /\bGOCSPX-[A-Za-z0-9_-]{16,}\b/g },
  { name: 'Private key block', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
];

function listTrackedFiles() {
  const output = execFileSync('git', ['ls-files', '-z'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return output.split('\0').filter(Boolean);
}

function isAllowedExampleEnvFile(file) {
  const base = path.basename(file);
  return base.includes('.example') || base.endsWith('.sample') || base.endsWith('.template');
}

function isForbiddenTrackedFile(file) {
  if (file.includes('/.vercel/') || file.startsWith('.vercel/')) return true;
  const base = path.basename(file);
  if (base.startsWith('.env') && !isAllowedExampleEnvFile(file)) return true;
  return false;
}

function isLikelyText(buffer) {
  return !buffer.includes(0);
}

function lineAndColumn(content, index) {
  const before = content.slice(0, index);
  const lines = before.split('\n');
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

const findings = [];
const trackedFiles = listTrackedFiles();

for (const file of trackedFiles) {
  if (isForbiddenTrackedFile(file)) {
    findings.push({
      file,
      message: 'Tracked env/Vercel secret file is not allowed.',
    });
    continue;
  }

  const abs = path.join(repoRoot, file);
  if (!existsSync(abs)) continue;
  const stats = statSync(abs);
  if (!stats.isFile() || stats.size > MAX_TEXT_FILE_BYTES) continue;

  const buffer = readFileSync(abs);
  if (!isLikelyText(buffer)) continue;

  const content = buffer.toString('utf8');
  for (const pattern of dangerousNextPublicNames) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
      const position = lineAndColumn(content, match.index ?? 0);
      findings.push({
        file,
        line: position.line,
        column: position.column,
        message: `Dangerous public environment variable name: ${match[0]}`,
      });
    }
  }

  for (const { name, pattern } of secretValuePatterns) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
      const position = lineAndColumn(content, match.index ?? 0);
      findings.push({
        file,
        line: position.line,
        column: position.column,
        message: `${name} value appears to be committed.`,
      });
    }
  }
}

if (!findings.length) {
  console.log('Public exposure check passed.');
  process.exit(0);
}

console.error('Public exposure check failed.');
for (const finding of findings) {
  const location = finding.line ? `${finding.file}:${finding.line}:${finding.column}` : finding.file;
  console.error(`- ${location} - ${finding.message}`);
}
process.exit(1);
