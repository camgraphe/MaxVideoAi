import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const frontendRequire = createRequire(resolve('frontend/package.json'));
const lighthouseRequire = createRequire(frontendRequire.resolve('lighthouse/package.json', {
  paths: [frontendRequire.resolve('@lhci/cli/package.json')],
}));
const { Launcher } = lighthouseRequire('chrome-launcher');
const defaults: string[] = Launcher.defaultFlags();

function features(flags: string[], prefix: string) {
  return flags.filter(flag => flag.startsWith(prefix)).flatMap(flag => flag.slice(prefix.length).split(','));
}

for (const name of ['lighthouserc.js', 'lighthouserc.site.js']) {
  test(`${name} keeps modern document rendering and preserves unrelated Chrome defaults`, async () => {
    const config = frontendRequire(resolve('frontend', name));
    const settings = config.ci.collect.settings;
    const { parseChromeFlags } = await import(pathToFileURL(lighthouseRequire.resolve('lighthouse/cli/run.js')).href);
    const NodeRunner = frontendRequire('@lhci/cli/src/collect/node-runner.js');
    const invocation = NodeRunner.computeArgumentsAndCleanup('https://maxvideoai.com/examples', { settings });
    let issuedSettings;
    try {
      const flagsPath = invocation.args[invocation.args.indexOf('--cli-flags-path') + 1];
      issuedSettings = JSON.parse(readFileSync(flagsPath, 'utf8'));
    } finally { invocation.cleanupFn(); }
    const cliFlags = parseChromeFlags(issuedSettings.chromeFlags);
    assert.equal(issuedSettings.chromeIgnoreDefaultFlags, true, 'the actual LHCI invocation retains the override');
    const effective = new Launcher({
      userDataDir: false,
      ignoreDefaultFlags: issuedSettings.chromeIgnoreDefaultFlags,
      chromeFlags: cliFlags,
    }).flags as string[];
    assert.ok(!features(effective, '--disable-features=').includes('RenderDocument'),
      'the audit must not disable Chrome document rendering and introduce delayed presentation');
    assert.ok(features(effective, '--enable-features=').includes('RenderDocument'));
    assert.equal(settings.chromeIgnoreDefaultFlags, true,
      'the original disabled-feature list must not be silently appended again');
    assert.equal(effective.filter(flag => flag.startsWith('--disable-features=')).length, 1,
      'one feature list preserves the upstream defaults without CLI overrides');
    assert.deepEqual(features(effective, '--disable-features='), [
      'Translate', 'OptimizationHints', 'MediaRouter', 'DialMediaRouteProvider',
      'CalculateNativeWinOcclusion', 'InterestFeedContentSuggestions',
      'CertificateTransparencyComponentUpdater', 'AutofillServerCommunication', 'PrivacySandboxSettings4',
    ]);
    for (const flag of defaults.filter(flag => !flag.startsWith('--disable-features='))) {
      assert.ok(effective.includes(flag), `preserve upstream flag ${flag}`);
    }
    assert.ok(effective.includes('--headless=new'), 'LHCI must still launch a headless browser on GitHub');
    assert.deepEqual(settings.output, ['json', 'html']);
    assert.equal(settings.throttlingMethod, undefined, 'keep Lighthouse standard simulated throttling');
    assert.equal(settings.blockedUrlPatterns, undefined, 'measure the complete native page');
    assert.equal(settings.disableStorageReset, undefined, 'keep the fresh-browser-cache protocol');
  });
}

for (const platform of ['darwin', 'linux']) {
  test(`the ${platform} launcher changes only RenderDocument, including platform defaults`, () => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import { createRequire } from 'node:module';
      import { resolve } from 'node:path';
      import { pathToFileURL } from 'node:url';
      Object.defineProperty(process, 'platform', { value: ${JSON.stringify(platform)} });
      const require = createRequire(resolve('frontend/package.json'));
      const lh = createRequire(require.resolve('lighthouse/package.json', {
        paths: [require.resolve('@lhci/cli/package.json')],
      }));
      const { Launcher } = lh('chrome-launcher');
      const { parseChromeFlags } = await import(pathToFileURL(lh.resolve('lighthouse/cli/run.js')).href);
      const settings = require('../scripts/performance/lighthouse-chrome-settings.cjs');
      const baseline = new Launcher({ userDataDir: false }).flags;
      const candidate = new Launcher({
        userDataDir: false, ignoreDefaultFlags: settings.chromeIgnoreDefaultFlags,
        chromeFlags: parseChromeFlags(settings.chromeFlags),
      }).flags;
      process.stdout.write(JSON.stringify({ baseline, candidate }));
    `], { encoding: 'utf8', env: { ...process.env, HEADLESS: '1' } });
    assert.equal(result.status, 0, result.stderr);
    const { baseline, candidate } = JSON.parse(result.stdout) as { baseline: string[]; candidate: string[] };
    const unchanged = (flags: string[]) => flags.filter(flag => !/^--(?:enable|disable)-features=/.test(flag));
    assert.deepEqual(unchanged(candidate).sort(), unchanged(baseline).sort());
    assert.deepEqual(features(candidate, '--disable-features='),
      features(baseline, '--disable-features=').filter(name => name !== 'RenderDocument'));
    assert.deepEqual(features(candidate, '--enable-features='),
      [...features(baseline, '--enable-features='), 'RenderDocument']);
    assert.equal(candidate.includes('--disable-setuid-sandbox'), platform === 'linux');
  });
}
