const { createRequire } = require('node:module');
const path = require('node:path');

const frontendRequire = createRequire(path.resolve(__dirname, '../../frontend/package.json'));
const lighthouseRequire = createRequire(frontendRequire.resolve('lighthouse/package.json', {
  paths: [frontendRequire.resolve('@lhci/cli/package.json')],
}));
const { Launcher } = lighthouseRequire('chrome-launcher');
const chromeDefaults = require('./lighthouse-chrome-defaults.cjs');

// Preserve the installed launcher's defaults, restoring only Chrome's document renderer.
// Copying the list also prevents ChromeLauncher from appending RenderDocument-disabled again.
const flags = chromeDefaults(Launcher).flatMap(flag => {
  if (!flag.startsWith('--disable-features=')) return [flag];
  const disabled = flag.slice('--disable-features='.length).split(',').filter(name => name !== 'RenderDocument');
  return disabled.length ? ['--disable-features=' + disabled.join(',')] : [];
});
const enabledIndex = flags.findIndex(flag => flag.startsWith('--enable-features='));
if (enabledIndex < 0) flags.push('--enable-features=RenderDocument');
else if (!flags[enabledIndex].slice('--enable-features='.length).split(',').includes('RenderDocument')) {
  flags[enabledIndex] += ',RenderDocument';
}

module.exports = {
  chromeIgnoreDefaultFlags: true,
  // LHCI appends its headless flag to this string. Quote values, not whole arguments:
  // Lighthouse's parser strips wrapping quotes from the complete expression.
  chromeFlags: flags.map(flag => {
    const equal = flag.indexOf('=');
    return equal >= 0 && /\s/.test(flag.slice(equal + 1))
      ? flag.slice(0, equal + 1) + JSON.stringify(flag.slice(equal + 1))
      : flag;
  }).join(' '),
};
