import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { GET } from '../frontend/app/api/billing-products/route';
import { getDb } from '../frontend/src/lib/db';
import { invalidateBillingProductsCache } from '../frontend/src/lib/billing-products';

test('billing-products GET reads only the migrated catalogue, filters active products and never bootstraps on failure', async () => {
  const database = await startDisposablePostgres('billing-products-read');
  const previous = process.env.DATABASE_URL;
  try {
    await database.pool.query(`CREATE TABLE app_billing_products(
      product_key text PRIMARY KEY, surface text, label text, currency text, unit_kind text,
      unit_price_cents int, active boolean, metadata jsonb);
      INSERT INTO app_billing_products VALUES
      ('angle-qwen-single','angle','Angle','USD','run',7,true,NULL),
      ('character-draft','character','Character','USD','image',8,true,NULL),
      ('inactive','angle','Inactive','USD','run',100,false,NULL);
      ALTER ROLE postgres SET default_transaction_read_only = on;`);
    process.env.DATABASE_URL = database.databaseUrl;
    invalidateBillingProductsCache();
    const read = (query: string) => GET(new NextRequest('http://localhost/api/billing-products' + query));
    const list = await read('');
    assert.equal(list.status, 200, 'a public GET must succeed with read-only DB permissions');
    const payload = await list.json();
    assert.deepEqual(payload.products.map((p: any) => p.productKey).sort(), ['angle-qwen-single', 'character-draft']);
    const filtered = await (await read('?surface=angle')).json();
    assert.deepEqual(filtered.products.map((p: any) => p.productKey), ['angle-qwen-single']);
    const single = await (await read('?productKey=angle-qwen-single')).json();
    assert.equal(single.product.unitPriceCents, 7);
    assert.equal((await read('?productKey=inactive')).status, 404);
    assert.equal((await read('?productKey=missing')).status, 404);
    await database.pool.query("UPDATE app_billing_products SET unit_price_cents=23 WHERE product_key='angle-qwen-single'");
    invalidateBillingProductsCache();
    assert.equal((await (await read('?productKey=angle-qwen-single')).json()).product.unitPriceCents, 23);
    await database.pool.query('DROP TABLE app_billing_products');
    invalidateBillingProductsCache();
    const errors: unknown[][] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => { errors.push(args); };
    try {
      const missing = await read('');
      assert.equal(missing.status, 500);
      assert.ok(errors.some(args => args.some((error: any) => error?.code === '42P01')));
    } finally { console.error = originalError; }
    assert.equal((await database.pool.query("SELECT to_regclass('public.app_billing_products') AS name")).rows[0].name, null);
  } finally {
    await getDb().end();
    invalidateBillingProductsCache();
    if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous;
    await database.cleanup();
  }
});
