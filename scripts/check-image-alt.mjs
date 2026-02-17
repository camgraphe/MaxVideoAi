#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const frontendRoot = fs.existsSync(path.join(cwd, 'frontend')) ? path.join(cwd, 'frontend') : cwd;
const scanRoots = [
  path.join(frontendRoot, 'components', 'examples'),
  path.join(frontendRoot, 'components', 'marketing'),
  path.join(frontendRoot, 'app', '(localized)'),
];

const fileExtensions = new Set(['.tsx', '.jsx']);
const srcAllowlistPrefixes = ['/assets/icons/', '/assets/frames/', '/assets/placeholders/'];

function walkFiles(root, collector) {
  if (!fs.existsSync(root)) return;
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, collector);
      continue;
    }
    if (fileExtensions.has(path.extname(entry.name))) {
      collector.push(fullPath);
    }
  }
}

function lineFromIndex(text, index) {
  return text.slice(0, index).split('\n').length;
}

function extractRawAttr(tag, attr) {
  const re = new RegExp(`${attr}\\s*=\\s*({[\\s\\S]*?}|\"[^\"]*\"|'[^']*')`, 'i');
  const match = tag.match(re);
  return match ? match[1] : null;
}

function extractStringAttr(tag, attr) {
  const direct = new RegExp(`${attr}\\s*=\\s*\"([^\"]*)\"`, 'i').exec(tag);
  if (direct) return direct[1];
  const single = new RegExp(`${attr}\\s*=\\s*'([^']*)'`, 'i').exec(tag);
  if (single) return single[1];
  const jsxDouble = new RegExp(`${attr}\\s*=\\s*{\\s*\"([^\"]*)\"\\s*}`, 'i').exec(tag);
  if (jsxDouble) return jsxDouble[1];
  const jsxSingle = new RegExp(`${attr}\\s*=\\s*{\\s*'([^']*)'\\s*}`, 'i').exec(tag);
  if (jsxSingle) return jsxSingle[1];
  return null;
}

function hasTrueAriaHidden(tag) {
  return (
    /\baria-hidden\b(?!\s*=)/i.test(tag) ||
    /\baria-hidden\s*=\s*\"true\"/i.test(tag) ||
    /\baria-hidden\s*=\s*'true'/i.test(tag) ||
    /\baria-hidden\s*=\s*{\s*true\s*}/i.test(tag)
  );
}

function hasPresentationRole(tag) {
  return /\brole\s*=\s*\"presentation\"/i.test(tag) || /\brole\s*=\s*\"none\"/i.test(tag);
}

function hasAllowEmptyMarker(tag) {
  return /\bdata-alt-allow-empty\b/i.test(tag);
}

function isAllowedEmptyAlt(tag) {
  if (hasTrueAriaHidden(tag) || hasPresentationRole(tag) || hasAllowEmptyMarker(tag)) return true;
  const src = extractStringAttr(tag, 'src');
  if (!src) return false;
  return srcAllowlistPrefixes.some((prefix) => src.startsWith(prefix));
}

function hasEmptyLiteralAlt(tag) {
  return (
    /\balt\s*=\s*\"\"/i.test(tag) ||
    /\balt\s*=\s*''/i.test(tag) ||
    /\balt\s*=\s*{\s*\"\"\s*}/i.test(tag) ||
    /\balt\s*=\s*{\s*''\s*}/i.test(tag)
  );
}

function relativeFile(filePath) {
  return path.relative(cwd, filePath);
}

function checkImageTags(filePath, source, failures) {
  const tagRe = /<(Image|img)\b[\s\S]*?>/g;
  let match;
  while ((match = tagRe.exec(source)) !== null) {
    const tag = match[0] ?? '';
    const line = lineFromIndex(source, match.index ?? 0);
    const hasAltAttr = /\balt\s*=/.test(tag);
    if (!hasAltAttr) {
      failures.push(`${relativeFile(filePath)}:${line} missing alt attribute on <${match[1]}>`);
      continue;
    }

    const rawAlt = extractRawAttr(tag, 'alt');
    if (rawAlt && /\bundefined\b/i.test(rawAlt)) {
      failures.push(`${relativeFile(filePath)}:${line} alt contains "undefined" on <${match[1]}>`);
      continue;
    }

    if (hasEmptyLiteralAlt(tag) && !isAllowedEmptyAlt(tag)) {
      failures.push(
        `${relativeFile(filePath)}:${line} empty alt used on non-decorative <${match[1]}> (add aria-hidden/role presentation/data-alt-allow-empty if decorative)`
      );
    }
  }
}

function checkVideoPosterWarnings(filePath, source, warnings) {
  const videoRe = /<video\b[\s\S]*?>/g;
  let match;
  while ((match = videoRe.exec(source)) !== null) {
    const tag = match[0] ?? '';
    if (!/\bposter\s*=/.test(tag)) continue;
    if (hasTrueAriaHidden(tag)) continue;
    const hasAriaLabel = /\baria-label\s*=/.test(tag) || /\baria-labelledby\s*=/.test(tag);
    if (hasAriaLabel) continue;
    const line = lineFromIndex(source, match.index ?? 0);
    warnings.push(`${relativeFile(filePath)}:${line} <video poster=...> has no accessible name`);
  }
}

function run() {
  const files = [];
  scanRoots.forEach((root) => walkFiles(root, files));
  const failures = [];
  const warnings = [];

  files.forEach((filePath) => {
    const source = fs.readFileSync(filePath, 'utf8');
    checkImageTags(filePath, source, failures);
    checkVideoPosterWarnings(filePath, source, warnings);
  });

  if (warnings.length) {
    console.warn(`[check-image-alt] ${warnings.length} warning(s):`);
    warnings.slice(0, 50).forEach((value) => console.warn(`- ${value}`));
    if (warnings.length > 50) console.warn(`- ...and ${warnings.length - 50} more`);
  }

  if (failures.length) {
    console.error(`[check-image-alt] ${failures.length} error(s):`);
    failures.forEach((value) => console.error(`- ${value}`));
    process.exitCode = 1;
    return;
  }

  console.log(`[check-image-alt] OK on ${files.length} files`);
}

run();
