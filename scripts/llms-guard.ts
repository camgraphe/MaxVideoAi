#!/usr/bin/env node

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import mcpPublication from '../frontend/config/mcp-publication.json';
import { getMcpPublicationState } from '../frontend/lib/mcp-publication';
import { buildLlmsText } from '../frontend/lib/seo/llms-text';

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

const MCP_SOURCE_URLS = [
  'https://maxvideoai.com/mcp',
  'https://maxvideoai.com/integrations/chatgpt',
  'https://maxvideoai.com/integrations/claude',
  'https://maxvideoai.com/integrations/codex',
  'https://maxvideoai.com/docs/mcp',
];

const ENABLED_PUBLICATION = {
  publicMarketing: true,
  publicIndexing: true,
  transport: true,
  oauth: true,
  discovery: true,
  paidGeneration: true,
  trial: true,
  referenceUploads: true,
};

const FORBIDDEN_EXACT_URLS = [
  'https://maxvideoai.com/models/veo-3-fast',
  'https://maxvideoai.com/models/kling',
  'https://maxvideoai.com/privacy',
  'https://maxvideoai.com/terms',
];

const FORBIDDEN_URL_PATTERNS = [
  /http:\/\/maxvideoai\.com(?:\/|\b)/,
  /https:\/\/www\.maxvideoai\.com(?:\/|\b)/,
  /https:\/\/api\.maxvideoai\.com(?:\/|\b)/,
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

const ALLOWED_EXTERNAL_URLS = new Set([
  'https://llmstxt.org/',
  'https://github.com/camgraphe/maxvideoai-plugin',
]);

export function validateLlmsSourceUrls(candidates: string[]): string[] {
  const errors: string[] = [];
  const assert = (condition: boolean, message: string) => {
    if (!condition) errors.push(message);
  };

  for (const candidate of candidates) {
    for (const pattern of PRIVATE_PATH_PATTERNS) {
      assert(!pattern.test(candidate), `Private or app URL must not be listed in llms.txt: ${pattern}`);
    }
    for (const pattern of FORBIDDEN_URL_PATTERNS) {
      assert(!pattern.test(candidate), `Forbidden noncanonical llms.txt URL pattern found: ${pattern}`);
    }
    const listedUrls = (candidate.match(/https?:\/\/[^\s)]+/g) ?? []).map((url) => url.replace(/[.,;]+$/, ''));
    const listedUrlSet = new Set(listedUrls);
    for (const url of FORBIDDEN_EXACT_URLS) {
      assert(!listedUrlSet.has(url), `Forbidden stale llms.txt URL found: ${url}`);
    }
    for (const url of listedUrls) {
      assert(
        url.startsWith('https://maxvideoai.com/') || ALLOWED_EXTERNAL_URLS.has(url),
        `External or noncanonical URL in llms.txt: ${url}`,
      );
    }
  }

  return errors;
}

export function collectLlmsGuardErrors(): string[] {
  const errors: string[] = [];
  const assert = (condition: boolean, message: string) => {
    if (!condition) errors.push(message);
  };

  const source = buildLlmsText(mcpPublication);
  const enabledSource = buildLlmsText(ENABLED_PUBLICATION);
  const sourceIsIndexable = getMcpPublicationState(mcpPublication).indexable;

  for (const url of REQUIRED_URLS) {
    assert(source.includes(url), `Missing required llms.txt URL: ${url}`);
  }
  for (const url of MCP_SOURCE_URLS) {
    const sourceCount = source.split(url).length - 1;
    assert(
      sourceIsIndexable ? sourceCount === 1 : sourceCount === 0,
      sourceIsIndexable
        ? `Published MCP source must appear exactly once: ${url}`
        : `Gated MCP source must be absent while indexable=false: ${url}`,
    );
    assert(enabledSource.split(url).length - 1 === 1, `Enabled MCP source must appear exactly once: ${url}`);
  }
  errors.push(...validateLlmsSourceUrls([source, enabledSource]));
  return errors;
}

function runLlmsGuard(): void {
  const errors = collectLlmsGuardErrors();
  if (errors.length) {
    console.error('llms-guard: FAILED');
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log('llms-guard: OK');
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) runLlmsGuard();
