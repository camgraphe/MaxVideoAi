const chromeSettings = require('../scripts/performance/lighthouse-chrome-settings.cjs');

module.exports = {
  ci: {
    collect: {
      settings: {
        ...chromeSettings,
        output: ['json', 'html'],
      },
    },
  },
};
