import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('every customer tariff route authorizes before reading or changing pricing state', () => {
  for (const route of ['inventory', 'scenarios', 'preview', 'confirm', 'history']) {
    const source = readFileSync(`frontend/app/api/admin/pricing/tariffs/${route}/route.ts`, 'utf8');
    const auth = source.indexOf('requireAdmin(req)');
    assert.ok(auth > 0, `${route} must authorize the request`);
    assert.ok(source.indexOf('loadCustomerTariff', auth) > auth || source.indexOf('previewCustomerTariff', auth) > auth ||
      source.indexOf('confirmCustomerTariff', auth) > auth, `${route} must delegate after authorization`);
    assert.doesNotMatch(source, /INSERT INTO|UPDATE app_|DELETE FROM|quoteCanonicalPricing/);
  }
});
