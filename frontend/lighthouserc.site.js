const matrix = require('../scripts/performance/site-matrix.json');

const device = process.env.CWV_DEVICE || 'mobile';
const locale = process.env.CWV_LOCALE;
const family = process.env.CWV_FAMILY;
const base = new URL(process.env.CWV_BASE_URL || matrix.origin);
if (!['mobile', 'desktop'].includes(device)) throw new Error('CWV_DEVICE must be mobile or desktop');
if (locale && !['en', 'fr', 'es'].includes(locale)) throw new Error('CWV_LOCALE must be en, fr or es');
if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
  throw new Error('CWV_BASE_URL must be a bare origin without credentials, path or query');
}
const routes = matrix.routes.filter(route => (!locale || route.locale === locale) && (!family || route.family === family));
if (!routes.length) throw new Error('No public routes match the selected family/locale');

module.exports = {
  ci: {
    collect: {
      url: routes.map(route => new URL(route.path, base).href),
      numberOfRuns: 3,
      settings: {
        onlyCategories: ['performance'],
        output: ['json', 'html'],
        ...(device === 'desktop' ? { preset: 'desktop' } : {}),
      },
    },
  },
};

