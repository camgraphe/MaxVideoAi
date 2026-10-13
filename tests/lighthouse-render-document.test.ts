import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
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
    const effective = [...(settings.chromeIgnoreDefaultFlags ? [] : defaults), ...cliFlags];
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
