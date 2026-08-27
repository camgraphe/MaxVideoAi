import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_OPENING_LINES = 60;
const MAX_PROSE_WORDS = 220;
const MAX_CONSECUTIVE_TEXT_ONLY_H2 = 2;

const bannedCommercialShortcuts = [
  'revolutionary',
  'game-changing',
  'ultimate',
  'unleash',
  'effortless magic',
];

const unsupportedSuperlatives = [
  'best',
  'most',
  'unmatched',
  'unrivaled',
  'unrivalled',
  "world's first",
  'world-leading',
  'leading',
];

function countWords(line) {
  return (line.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []).length;
}

function hasUsefulVisualBreak(line) {
  return /!\[[^\]]*\]\([^\n)]+\)/.test(line)
    || /^\s*(```|~~~)/.test(line)
    || /^\s*\|?\s*:?-{3,}:?\s*\|/.test(line)
    || /<\/?(?:video|picture)\b/i.test(line)
    || /\.(?:gif|mp4|webm|mov)(?:[?#)]|$)/i.test(line)
    || /^\s*(?:>\s*)?(?:\*\*)?example(?:\*\*)?:\s+\S/i.test(line);
}

function isNonProseLine(line) {
  return /^\s*(?:#{1,6}\s|<\/?(?:video|picture)\b|!\[|\|)/.test(line)
    || /^\s*(```|~~~)/.test(line);
}

function findInvalidAltText(line) {
  const altTexts = [];
  const imagePattern = /!\[([^\]]*)\]\([^\n)]+\)/g;
  for (const match of line.matchAll(imagePattern)) {
    altTexts.push(match[1].trim());
  }

  const htmlImagePattern = /<img\b[^>]*>/gi;
  for (const imageTag of line.matchAll(htmlImagePattern)) {
    const altAttribute = /\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(imageTag[0]);
    altTexts.push((altAttribute?.[1] ?? altAttribute?.[2] ?? altAttribute?.[3] ?? '').trim());
  }

  return altTexts.filter((altText) => !altText || /^(?:(?:a|an|the)\s+)?(?:screenshot|image|demo|photo|graphic|picture|illustration|visual|artwork|media)(?:\s+(?:screenshot|image|demo|photo|graphic|picture|illustration|visual|artwork|media))?$/i.test(altText));
}

function findBannedLanguage(line) {
  const normalized = line.toLowerCase();
  const findings = [];

  for (const phrase of bannedCommercialShortcuts) {
    if (normalized.includes(phrase)) findings.push(`Banned commercial shortcut: "${phrase}"`);
  }
  if (/\b(?:only\s+)?\d+\s*(?:minutes?|hours?|days?)\s+left\b|\b(?:offer|sale)\s+ends\s+(?:today|soon|in\s+\d+)/i.test(line)) {
    findings.push('Banned commercial shortcut: urgency countdown');
  }
  if (/^\s*#{1,6}\s+\p{Extended_Pictographic}/u.test(line)) {
    findings.push('Banned commercial shortcut: emoji-led heading');
  }
  if (/\b(?:trusted by|join)\s+(?:over\s+)?\d+[\d,.]*\s+(?:creators|customers|teams|users)\b/i.test(line)) {
    findings.push('Banned commercial shortcut: invented social proof');
  }
  if (/\b(?:better than|beats|outperforms)\s+(?:all|every|any|the competition|competitors?)\b|\b(?:number|no\.)\s*1\b/i.test(line)) {
    findings.push('Banned commercial shortcut: competitive claim without evidence');
  }
  for (const term of unsupportedSuperlatives) {
    if (new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(line)) {
      findings.push(`Unsupported superlative: "${term}"`);
    }
  }
  return findings;
}

export function checkGithubContent(markdown, { filePath = 'README.md' } = {}) {
  const errors = [];
  const lines = markdown.split(/\r?\n/);
  let hasOpeningBreak = false;
  let proseWords = 0;
  let firstProseLine = 1;
  let inFence = false;
  let currentH2 = null;
  const h2Sections = [];

  function finishH2() {
    if (currentH2) h2Sections.push(currentH2);
  }

  function finishProseRun(lineNumber) {
    if (proseWords > MAX_PROSE_WORDS) {
      errors.push(`${filePath}:${firstProseLine}-${lineNumber}: more than ${MAX_PROSE_WORDS} consecutive prose words without a useful visual break (${proseWords} found)`);
    }
    proseWords = 0;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNumber = index + 1;
    const isFence = /^\s*(```|~~~)/.test(line);
    const isBreak = hasUsefulVisualBreak(line);
    const h2Match = /^\s*##\s+(.+?)\s*#*\s*$/.exec(line);

    if (!inFence && !isFence) {
      for (const altText of findInvalidAltText(line)) {
        errors.push(`${filePath}:${lineNumber}: every image needs descriptive alt text; "${altText || '(empty)'}" is not descriptive`);
      }
      for (const finding of findBannedLanguage(line)) {
        errors.push(`${filePath}:${lineNumber}: ${finding}`);
      }
    }

    if (h2Match) {
      finishH2();
      currentH2 = { title: h2Match[1], lineNumber, hasVisualBreak: false };
    }

    if (isBreak) {
      if (lineNumber <= MAX_OPENING_LINES) hasOpeningBreak = true;
      if (currentH2) currentH2.hasVisualBreak = true;
      finishProseRun(lineNumber - 1);
    }

    if (isFence) inFence = !inFence;
    if (!inFence && !isBreak && !isNonProseLine(line)) {
      const words = countWords(line);
      if (words > 0 && proseWords === 0) firstProseLine = lineNumber;
      proseWords += words;
    }
  }

  finishProseRun(lines.length);
  finishH2();

  if (!hasOpeningBreak) {
    errors.push(`${filePath}: no real visual or install block appears within the first ${MAX_OPENING_LINES} README lines`);
  }

  let consecutiveTextOnlyH2 = 0;
  for (const section of h2Sections) {
    consecutiveTextOnlyH2 = section.hasVisualBreak ? 0 : consecutiveTextOnlyH2 + 1;
    if (consecutiveTextOnlyH2 > MAX_CONSECUTIVE_TEXT_ONLY_H2) {
      errors.push(`${filePath}:${section.lineNumber}: more than two consecutive H2 sections are text-only`);
      break;
    }
  }

  return errors;
}

function runCli(paths) {
  if (paths.length === 0) {
    console.error('Usage: node scripts/check-github-content.mjs <markdown-path> [...markdown-paths]');
    return 1;
  }

  const errors = [];
  for (const filePath of paths) {
    try {
      errors.push(...checkGithubContent(readFileSync(filePath, 'utf8'), { filePath }));
    } catch (error) {
      errors.push(`${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (errors.length > 0) {
    console.error(errors.join('\n'));
    return 1;
  }

  console.log(`✓ ${paths.join(', ')} passes GitHub content checks`);
  return 0;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  process.exitCode = runCli(process.argv.slice(2));
}
