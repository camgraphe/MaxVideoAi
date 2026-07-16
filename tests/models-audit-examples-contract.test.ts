import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const ROOT = process.cwd();
const AUDIT_SCRIPT = join(ROOT, 'scripts/models-audit.mjs');
const TSX_BIN = join(ROOT, 'node_modules/.bin/tsx');
const TS_CONFIG = join(ROOT, 'frontend/tsconfig.json');

function updateDocument(
  contentRoot: string,
  locale: 'en' | 'fr' | 'es',
  slug: string,
  update: (document: Record<string, unknown>) => void,
) {
  const filePath = join(contentRoot, locale, `${slug}.json`);
  const document = JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>;
  update(document);
  writeFileSync(filePath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
}

test('model audit fails malformed and divergent localized Examples with critical findings', () => {
  const sandbox = mkdtempSync(join(tmpdir(), 'maxvideo-models-audit-'));
  const contentRoot = join(sandbox, 'models');
  const reportPath = join(sandbox, 'models-audit.json');

  try {
    cpSync(join(ROOT, 'content/models'), contentRoot, { recursive: true });

    updateDocument(contentRoot, 'es', 'sora-2', (document) => {
      delete document.examples;
    });
    updateDocument(contentRoot, 'fr', 'sora-2-pro', (document) => {
      document.examples = {};
    });
    updateDocument(contentRoot, 'fr', 'luma-uni-1', (document) => {
      (document.examples as { modelSlug: string }).modelSlug = 'wrong-model';
    });
    updateDocument(contentRoot, 'es', 'nano-banana-pro', (document) => {
      (document.examples as { filters: Array<{ id: string; label: string }> })
        .filters.push({ id: 'edit', label: 'Edit' });
    });
    updateDocument(contentRoot, 'fr', 'gpt-image-2', (document) => {
      const proofItems = (document.examples as { proofItems: unknown[] }).proofItems;
      [proofItems[0], proofItems[1]] = [
        proofItems[1],
        proofItems[0],
      ];
    });
    updateDocument(contentRoot, 'es', 'luma-uni-1', (document) => {
      const fallbackItems = (document.examples as { fallbackItems: unknown[] }).fallbackItems;
      [fallbackItems[0], fallbackItems[1]] = [
        fallbackItems[1],
        fallbackItems[0],
      ];
    });
    updateDocument(contentRoot, 'fr', 'veo-3-1', (document) => {
      (document.custom as Record<string, unknown>).galleryTitle = 'Legacy gallery owner';
    });
    updateDocument(contentRoot, 'es', 'wan-2-5', (document) => {
      document.galleryIntro = 'Legacy root gallery owner';
    });
    updateDocument(contentRoot, 'fr', 'wan-2-6', (document) => {
      (document.examples as { showWhenEmpty: boolean }).showWhenEmpty = false;
    });
    updateDocument(contentRoot, 'en', 'happy-horse-1-0', (document) => {
      (document.examples as Record<string, unknown>).unexpected = true;
    });
    updateDocument(contentRoot, 'en', 'happy-horse-1-1', (document) => {
      (document.examples as { section: { title: string } }).section.title = '   ';
    });
    updateDocument(contentRoot, 'en', 'kling-2-5-turbo', (document) => {
      const filters = (document.examples as { filters: unknown[] }).filters;
      [filters[0], filters[1]] = [filters[1], filters[0]];
    });
    updateDocument(contentRoot, 'en', 'kling-2-6-pro', (document) => {
      const filters = (document.examples as { filters: Array<{ id: string }> }).filters;
      filters[2].id = filters[1].id;
    });
    updateDocument(contentRoot, 'en', 'kling-3-4k', (document) => {
      (document.examples as { filters: Array<{ id: string }> }).filters[1].id = 'unsupported';
    });
    updateDocument(contentRoot, 'en', 'kling-3-pro', (document) => {
      (document.examples as { proofItems: Array<{ icon: string }> }).proofItems[0].icon = 'unsupported';
    });
    updateDocument(contentRoot, 'en', 'kling-3-standard', (document) => {
      const proofItems = (document.examples as { proofItems: Array<{ id: string }> }).proofItems;
      proofItems[1].id = proofItems[0].id;
    });
    updateDocument(contentRoot, 'en', 'minimax-hailuo-02-text', (document) => {
      (document.examples as { proofItems: unknown[] }).proofItems.pop();
    });
    updateDocument(contentRoot, 'en', 'nano-banana', (document) => {
      const fallbackItems = (document.examples as { fallbackItems: Array<{ id: string }> }).fallbackItems;
      fallbackItems[1].id = fallbackItems[0].id;
    });
    updateDocument(contentRoot, 'en', 'seedream', (document) => {
      (document.examples as { fallbackItems: Array<{ tags: string[] }> }).fallbackItems[0].tags = ['grounded'];
    });

    const result = spawnSync(
      TSX_BIN,
      [
        '--tsconfig',
        TS_CONFIG,
        AUDIT_SCRIPT,
        '--content-root',
        contentRoot,
        '--report-path',
        reportPath,
      ],
      { cwd: ROOT, encoding: 'utf8' },
    );

    assert.equal(result.status, 1, result.stdout || result.stderr);
    const report = JSON.parse(readFileSync(reportPath, 'utf8')) as {
      summary: { critical: number };
      critical: Array<{
        type: string;
        modelSlug?: string;
        locale?: string;
        differences?: string[];
      }>;
    };
    assert.equal(report.summary.critical, 19, JSON.stringify(report.critical, null, 2));
    assert.match(result.stderr, /Failed with 19 critical issue\(s\)/);

    const strictFailures = report.critical.filter(
      ({ type }) => type === 'invalid_localized_examples_content',
    );
    assert.ok(strictFailures.some(({ modelSlug, locale }) => modelSlug === 'sora-2' && locale === 'es'));
    assert.ok(strictFailures.some(({ modelSlug, locale }) => modelSlug === 'sora-2-pro' && locale === 'fr'));
    assert.ok(strictFailures.some(({ modelSlug, locale }) => modelSlug === 'luma-uni-1' && locale === 'fr'));
    assert.equal(strictFailures.length, 13);
    for (const modelSlug of [
      'happy-horse-1-0',
      'happy-horse-1-1',
      'kling-2-5-turbo',
      'kling-2-6-pro',
      'kling-3-4k',
      'kling-3-pro',
      'kling-3-standard',
      'minimax-hailuo-02-text',
      'nano-banana',
      'seedream',
    ]) {
      assert.ok(
        strictFailures.some(({ modelSlug: candidate, locale }) =>
          candidate === modelSlug && locale === 'en'),
        modelSlug,
      );
    }

    const parityFailures = report.critical.filter(
      ({ type }) => type === 'localized_examples_parity_mismatch',
    );
    assert.ok(parityFailures.some(
      ({ modelSlug, locale, differences }) =>
        modelSlug === 'nano-banana-pro' &&
        locale === 'es' &&
        differences?.includes('structure') &&
        differences.includes('filters'),
    ));
    assert.ok(parityFailures.some(
      ({ modelSlug, locale, differences }) =>
        modelSlug === 'gpt-image-2' && locale === 'fr' && differences?.includes('proofItems'),
    ));
    assert.ok(parityFailures.some(
      ({ modelSlug, locale, differences }) =>
        modelSlug === 'luma-uni-1' && locale === 'es' && differences?.includes('fallbackItems'),
    ));
    assert.ok(parityFailures.some(
      ({ modelSlug, locale, differences }) =>
        modelSlug === 'wan-2-6' && locale === 'fr' && differences?.includes('showWhenEmpty'),
    ));
    assert.ok(report.critical.some(
      ({ type, modelSlug, locale }) =>
        type === 'legacy_examples_ownership' && modelSlug === 'veo-3-1' && locale === 'fr',
    ));
    assert.ok(report.critical.some(
      ({ type, modelSlug, locale }) =>
        type === 'legacy_examples_ownership' && modelSlug === 'wan-2-5' && locale === 'es',
    ));
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});
