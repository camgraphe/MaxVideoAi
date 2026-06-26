#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');
const LLMS_PATH = path.join(ROOT, 'frontend/public/llms.txt');

const REQUIRED_URLS = [
  'https://maxvideoai.com/',
  'https://maxvideoai.com/pay-as-you-go-ai-video-generator',
  'https://maxvideoai.com/pricing',
  'https://maxvideoai.com/models',
  'https://maxvideoai.com/examples',
  'https://maxvideoai.com/ai-video-engines',
  'https://maxvideoai.com/ai-video-engines/best-for',
  'https://maxvideoai.com/blog',
  'https://maxvideoai.com/docs',
  'https://maxvideoai.com/models/veo-3-1',
  'https://maxvideoai.com/models/kling-3-pro',
  'https://maxvideoai.com/legal/privacy',
  'https://maxvideoai.com/legal/terms',
];

const FORBIDDEN_EXACT_URLS = [
  'https://maxvideoai.com/models/veo-3-fast',
  'https://maxvideoai.com/models/kling',
  'https://maxvideoai.com/privacy',
  'https://maxvideoai.com/terms',
];

const FORBIDDEN_URL_PATTERNS = [
  /http:\/\/maxvideoai\.com(?:\/|\b)/,
  /https:\/\/www\.maxvideoai\.com(?:\/|\b)/,
];

const PRIVATE_PATH_PATTERNS = [
  /https:\/\/maxvideoai\.com\/api(?:\/|\b)/,
  /https:\/\/maxvideoai\.com\/admin(?:\/|\b)/,
  /https:\/\/maxvideoai\.com\/app(?:\/|\b)/,
  /https:\/\/maxvideoai\.com\/billing(?:\/|\b)/,
  /https:\/\/maxvideoai\.com\/settings(?:\/|\b)/,
  /https:\/\/maxvideoai\.com\/dashboard(?:\/|\b)/,
  /https:\/\/maxvideoai\.com\/jobs(?:\/|\b)/,
];

const errors = [];

function assert(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

const source = fs.readFileSync(LLMS_PATH, 'utf8');

for (const url of REQUIRED_URLS) {
  assert(source.includes(url), `Missing required llms.txt URL: ${url}`);
}

for (const pattern of PRIVATE_PATH_PATTERNS) {
  assert(!pattern.test(source), `Private or app URL must not be listed in llms.txt: ${pattern}`);
}

const listedUrls = (source.match(/https?:\/\/[^\s)]+/g) ?? []).map((url) => url.replace(/[.,;]+$/, ''));
const listedUrlSet = new Set(listedUrls);

for (const url of FORBIDDEN_EXACT_URLS) {
  assert(!listedUrlSet.has(url), `Forbidden stale llms.txt URL found: ${url}`);
}

for (const pattern of FORBIDDEN_URL_PATTERNS) {
  assert(!pattern.test(source), `Forbidden noncanonical llms.txt URL pattern found: ${pattern}`);
}

for (const url of listedUrls) {
  if (url === 'https://llmstxt.org/') continue;
  assert(url.startsWith('https://maxvideoai.com/'), `External or noncanonical URL in llms.txt: ${url}`);
}

if (errors.length) {
  console.error('llms-guard: FAILED');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('llms-guard: OK');
