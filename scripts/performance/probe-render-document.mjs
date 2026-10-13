// Opt-in paired diagnostics on the unchanged live examples page. Keep every report and trace.
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(path.resolve('package.json'));
const lighthouseRequire = createRequire(require.resolve('lighthouse/package.json', {
  paths: [require.resolve('@lhci/cli/package.json')],
}));
const { Launcher } = lighthouseRequire('chrome-launcher');
const { parseChromeFlags } = await import(pathToFileURL(lighthouseRequire.resolve('lighthouse/cli/run.js')).href);
const chromeSettings = require('../scripts/performance/lighthouse-chrome-settings.cjs');
const cli = lighthouseRequire.resolve('lighthouse/cli/index.js');
const baseline = [...Launcher.defaultFlags(), '--headless=new'];
const candidate = [...parseChromeFlags(chromeSettings.chromeFlags), '--headless=new'];
const root = path.resolve('lighthouse-reports/render-document-probe');
fs.mkdirSync(root, { recursive: true });
fs.writeFileSync(path.join(root, 'flags.json'), JSON.stringify({ baseline, candidate }, null, 2));

for (let run = 1; run <= 5; run++) {
  for (const arm of run % 2 ? ['baseline', 'candidate'] : ['candidate', 'baseline']) {
    const prefix = path.join(root, `${arm}-${run}`);
    const flags = {
      chromeIgnoreDefaultFlags: true,
      chromeFlags: arm === 'baseline' ? baseline : candidate,
      additionalTraceCategories: 'viz,cc,renderer.scheduler,disabled-by-default-cc.debug',
      onlyCategories: ['performance'],
    };
    fs.writeFileSync(`${prefix}-flags.json`, JSON.stringify(flags, null, 2));
    const result = spawnSync(process.execPath, [
      cli, 'https://maxvideoai.com/examples', `--cli-flags-path=${prefix}-flags.json`,
      '--save-assets', '--output=json', `--output-path=${prefix}.json`,
    ], { stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
