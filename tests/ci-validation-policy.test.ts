import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const selector = path.resolve('scripts/select-ci-validation.mjs');
const gate = path.resolve('scripts/check-ci-validation.mjs');

function select(files: string[], eventName = 'pull_request', options: {
  baseFiles?: string[];
  rename?: [string, string];
  missingBase?: boolean;
  zeroBase?: boolean;
} = {}) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'ci-selection-'));
  try {
    const eventPath = path.join(directory, 'event.json');
    const outputPath = path.join(directory, 'output');
    const git = (args: string[]) => {
      const result = spawnSync('git', args, { cwd: directory, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout.trim();
    };
    git(['init', '-q']);
    git(['config', 'user.name', 'CI fixture']);
    git(['config', 'user.email', 'ci@example.invalid']);
    git(['config', 'commit.gpgsign', 'false']);
    git(['config', 'core.hooksPath', path.join(directory, 'no-hooks')]);
    writeFileSync(path.join(directory, 'README.md'), 'baseline');
    for (const file of options.baseFiles ?? []) {
      const target = path.join(directory, file);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, 'baseline');
    }
    git(['add', '.']);
    git(['commit', '-qm', 'baseline']);
    const base = git(['rev-parse', 'HEAD']);
    for (const file of files) {
      const target = path.join(directory, file);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, 'changed');
      git(['add', '.']);
      git(['commit', '-qm', 'candidate change']);
    }
    if (options.rename) {
      mkdirSync(path.dirname(path.join(directory, options.rename[1])), { recursive: true });
      git(['mv', ...options.rename]);
      git(['commit', '-qm', 'rename candidate']);
    } else if (!files.length) {
      git(['commit', '--allow-empty', '-qm', 'empty candidate']);
    }
    const head = git(['rev-parse', 'HEAD']);
    writeFileSync(eventPath, JSON.stringify({
      pull_request: { base: { sha: options.missingBase ? 'f'.repeat(40) : base }, head: { sha: head } },
      before: options.zeroBase ? '0'.repeat(40) : base, after: head,
    }));
    const result = spawnSync(process.execPath, [selector], {
      cwd: directory, encoding: 'utf8',
      env: { ...process.env, GITHUB_EVENT_NAME: eventName, GITHUB_EVENT_PATH: eventPath, GITHUB_OUTPUT: outputPath },
    });
    assert.equal(result.status, 0, result.stderr);
    return Object.fromEntries(readFileSync(outputPath, 'utf8').trim().split('\n').map(line => line.split('=')));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('documentation and public content do not replay financial cutovers', () => {
  for (const files of [
    ['AGENTS.md', 'docs/engineering/pricing-engine.md'],
    ['content/fr/blog/example.mdx'],
  ]) {
    assert.deepEqual(select(files), { integration: 'false', tariffs: 'false', browser: 'false' });
  }
});

test('marketing components, layout CSS and translated UI preserve browser behavior coverage', () => {
  for (const file of [
    'frontend/components/marketing/home/HomeConversionSections.tsx',
    'frontend/components/marketing/SoraPromptingTabs.client.tsx',
    'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelHero.tsx',
    'frontend/app/globals.css',
    'frontend/messages/fr.json',
  ]) {
    assert.deepEqual(select([file]), { integration: 'false', tariffs: 'false', browser: 'true' }, file);
  }
});

test('application UI changes keep integration and browser coverage without unrelated exhaustive cutovers', () => {
  assert.deepEqual(select(['frontend/components/library/MediaActionPanel.client.tsx']), {
    integration: 'true', tariffs: 'false', browser: 'true',
  });
});

test('non-financial runtime and validation changes defer exhaustive cutovers to full runs', () => {
  for (const file of [
    'frontend/lib/arbitrary-shared-helper.ts',
    'frontend/content/feature-flags.ts',
    'content/new-runtime.ts',
    'frontend/public/sw.js',
    'frontend/messages/runtime.ts',
    'frontend/styles/runtime.js',
    'frontend/config/model-registry.json',
    'frontend/config/model-runtime.json',
    'frontend/src/config/engineCatalog.overrides.ts',
    'frontend/src/config/fal-engine-materialization.ts',
    'frontend/app/api/generate/route.ts',
    'frontend/app/auth/callback/route.ts',
    'frontend/app/(core)/admin/consents.csv/route.ts',
    'frontend/app/(core)/admin/users/page.tsx',
    'frontend/src/server/studio/conversation-director-instructions.ts',
    'tests/studio-assistance-director.test.ts',
    'tests/helpers/disposable-postgres.ts',
    '.github/workflows/quality.yml',
    'scripts/select-ci-validation.mjs',
    'scripts/_lib/ci-validation-policy.mjs',
    'pnpm-lock.yaml',
    'frontend/next.config.js',
    'neon/migrations/51_example.sql',
    'unknown/new-runtime.ts',
  ]) {
    assert.deepEqual(select([file]), { integration: 'true', tariffs: 'false', browser: 'true' }, file);
  }
  assert.equal(select(['frontend/server/activity-feed.ts', 'tests/activity-feed.test.ts'], 'push').tariffs, 'false');
});

test('financial presentation and ordinary tests retain normal coverage without exhaustive cutovers', () => {
  for (const file of [
    'frontend/components/admin/ManualCreditForm.tsx',
    'frontend/components/PriceFactorsBar.tsx',
    'frontend/app/(core)/admin/pricing/page.tsx',
    'frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/_components/StudioAssistanceCredits.client.tsx',
    'tests/studio-assistance-credits-dialog.test.ts',
    'tests/pricing-canonical-kernel.test.ts',
    'tests/wallet-direct-pricing.test.ts',
    'tests/provider-cost.test.ts',
  ]) {
    assert.deepEqual(select([file]), { integration: 'true', tariffs: 'false', browser: 'true' }, file);
  }
  for (const file of [
    'frontend/components/marketing/PriceEstimator.tsx',
    'frontend/app/(core)/admin/pricing/pricing.css',
    'frontend/app/(core)/admin/pricing/provider-cost.css',
    'frontend/messages/pricing.fr.json',
  ]) {
    assert.deepEqual(select([file]), { integration: 'true', tariffs: 'false', browser: 'true' }, file);
  }
  assert.deepEqual(select(['content/en/blog/pricing.mdx']), { integration: 'true', tariffs: 'false', browser: 'true' });
});

test('tariff and billing changes retain exhaustive cutovers', () => {
  for (const file of [
    'frontend/server/pricing/quote-billing.ts',
    'frontend/src/lib/wan3-pricing.ts',
    'frontend/app/(core)/(workspace)/app/_hooks/useWorkspacePreflightQuote.ts',
    'packages/pricing/src/index.ts',
    'frontend/app/api/stripe/webhook/route.ts',
    'frontend/server/fal-webhook-refunds.ts',
    'frontend/src/server/studio/assistance-ledger.ts',
    'frontend/src/lib/currency.ts',
    'frontend/src/config/topupTiers.ts',
    'frontend/src/server/video-providers/google-vertex-veo/cost.ts',
    'frontend/server/byteplus-accounting.ts',
    'neon/migrations/54_customer_tariff_cells.sql',
    'tests/fixtures/customer-tariff-seed.json',
    'tests/customer-tariff-initial-cutover-postgres.test.ts',
    'tests/local-customer-tariff-activation-postgres.test.ts',
  ]) {
    assert.deepEqual(select([file]), { integration: 'true', tariffs: 'true', browser: 'true' }, file);
  }
});

test('commercial input owners without financial filenames retain exhaustive cutovers', () => {
  for (const file of [
    'frontend/config/engine-catalog.json',
    'frontend/config/published-supplier-rates.json',
    'frontend/fixtures/fal-models.json',
    'frontend/src/config/falEngines.ts',
    'frontend/src/config/fal-engines/seedance-2-byteplus.ts',
    'frontend/src/lib/fal-catalog.ts',
    'frontend/src/lib/audio-generation.ts',
    'frontend/src/server/engine-settings.ts',
    'frontend/src/server/engine-settings-defaults.ts',
    'frontend/src/server/engine-configuration-read.ts',
    'frontend/src/server/engine-configuration-projection.ts',
    'neon/migrations/09_engine_settings.sql',
  ]) {
    assert.deepEqual(select([file]), { integration: 'true', tariffs: 'true', browser: 'true' }, file);
  }
});

test('image and video tool supplier rates retain exhaustive cutovers', () => {
  for (const file of [
    'frontend/src/config/tools-angle-engines.ts',
    'frontend/src/config/tools-upscale-engines.ts',
    'frontend/src/config/tools-background-removal-engines.ts',
  ]) {
    assert.equal(select([file]).tariffs, 'true', file);
  }
});

test('unnamed monetary formulas and Studio tariffs retain exhaustive cutovers', () => {
  for (const file of [
    'frontend/lib/image/gptImage2.ts',
    'frontend/src/lib/tools-angle.ts',
    'frontend/src/lib/tools-upscale.ts',
    'frontend/src/lib/tools-background-removal.ts',
    'frontend/src/lib/exchange.ts',
    'frontend/src/lib/fxProvider.ts',
    'frontend/src/lib/kling-3-turbo.ts',
    'frontend/src/lib/studio/assistance-contract.ts',
    'frontend/src/server/studio/assistance-provider-facts.ts',
    'frontend/src/server/studio/media-analysis/policy.ts',
    'frontend/config/studio-media-analysis-policy.json',
    'frontend/src/server/tools/creator-profiles-lipsync.ts',
    'frontend/src/server/tools/creator-profiles-motion.ts',
  ]) {
    assert.equal(select([file]).tariffs, 'true', file);
  }
});

test('nightly, manual, empty and unavailable comparisons fail closed to exhaustive validation', () => {
  for (const event of ['schedule', 'workflow_dispatch', 'unrecognized']) {
    assert.deepEqual(select(['README.md'], event), { integration: 'true', tariffs: 'true', browser: 'true' });
  }
  assert.deepEqual(select([]), { integration: 'true', tariffs: 'true', browser: 'true' });
  const result = spawnSync(process.execPath, [selector], {
    encoding: 'utf8',
    env: { ...process.env, GITHUB_EVENT_NAME: 'pull_request', GITHUB_EVENT_PATH: '/missing-ci-event', GITHUB_OUTPUT: '' },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { integration: true, tariffs: true, browser: true });
});

test('push selection accounts for the whole pushed batch', () => {
  for (const event of ['push', 'pull_request']) {
    assert.equal(select(['frontend/server/activity-feed.ts', 'frontend/server/wallet.ts', 'frontend/components/PriceFactorsBar.tsx', 'README.md'], event).tariffs, 'true');
  }
});

test('moving a financial owner into a presentation path retains the removed owner in the comparison', () => {
  assert.deepEqual(select([], 'pull_request', {
    baseFiles: ['frontend/server/wallet.ts'],
    rename: ['frontend/server/wallet.ts', 'content/en/blog/example.mdx'],
  }), { integration: 'true', tariffs: 'true', browser: 'true' });
});

test('unavailable Git history and a first push cannot establish a safe lightweight selection', () => {
  assert.deepEqual(select(['README.md'], 'pull_request', { missingBase: true }), {
    integration: 'true', tariffs: 'true', browser: 'true',
  });
  assert.deepEqual(select(['README.md'], 'push', { zeroBase: true }), {
    integration: 'true', tariffs: 'true', browser: 'true',
  });
});

function check(results: Record<string, unknown>) {
  return spawnSync(process.execPath, [gate], {
    encoding: 'utf8', env: { ...process.env, CI_JOB_RESULTS: JSON.stringify(results) },
  });
}

test('the required gate accepts intentionally skipped lanes and rejects missing, failed or canceled required jobs', () => {
  const outputs = { integration: 'false', tariffs: 'false', browser: 'false' };
  const results = {
    plan: { result: 'success', outputs },
    fast: { result: 'success' },
    integration: { result: 'skipped' },
    tariffs: { result: 'skipped' },
    browser: { result: 'skipped' },
  };
  assert.equal(check(results).status, 0);
  for (const name of ['plan', 'fast']) {
    for (const result of ['failure', 'cancelled', 'skipped']) {
      assert.equal(check({ ...results, [name]: { ...results[name as 'plan' | 'fast'], result } }).status, 1);
    }
  }
  for (const name of ['integration', 'tariffs', 'browser']) {
    const selected = { ...results, plan: { result: 'success', outputs: { ...outputs, [name]: 'true' } } };
    assert.equal(check({ ...selected, [name]: { result: 'success' } }).status, 0);
    for (const result of ['failure', 'cancelled', 'skipped', undefined]) {
      assert.equal(check({ ...selected, [name]: { result } }).status, 1);
    }
  }
  assert.equal(check({ ...results, plan: { result: 'success', outputs: {} } }).status, 1);
});
