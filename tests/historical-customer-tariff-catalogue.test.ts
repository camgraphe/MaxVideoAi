import assert from 'node:assert/strict';
import test from 'node:test';
import { getRuntimeModelById } from '../frontend/config/model-runtime';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import tariffDocument from '../frontend/config/customer-tariffs.json';
import { withHistoricalCustomerTariffCatalogue } from './helpers/historical-customer-tariff-catalogue';

test('historical tariff rehearsal cannot consume or hide the six new Nano21 fixed-price cells', async () => {
  const nano = getRuntimeModelById('nano-banana-2-1')!;
  const kling = getRuntimeModelById('kling-v4')!;
  const before = [nano.publication.app.published, kling.publication.app.published];
  const cells = structuredClone(tariffDocument.cells.filter(cell => cell.selector.engineId === nano.id));
  assert.equal(cells.length, 6);
  assert.deepEqual(cells.map(cell => cell.price.customerCents), [7, 11, 23, 7, 11, 23]);
  const current = () => collectSellableManualTariffCoverage({ modelId: nano.id }).scenarios;
  assert.equal(current().length, 6);
  await assert.rejects(withHistoricalCustomerTariffCatalogue(async () => {
    assert.equal(current().length, 0, 'the pre-launch catalogue has no historical Nano21 percentage price');
    assert.equal(nano.publication.app.published, false);
    assert.equal(kling.publication.app.published, false);
    throw new Error('rehearsal interrupted');
  }), /rehearsal interrupted/);
  assert.deepEqual([nano.publication.app.published, kling.publication.app.published], before);
  assert.equal(current().length, 6, 'ordinary current financial coverage must still include the new delta');
  assert.deepEqual(tariffDocument.cells.filter(cell => cell.selector.engineId === nano.id), cells);
});

test('historical tariff rehearsal keeps the 39 new Seedream offers outside the pre-launch catalogue', async () => {
  const models = ['seedream-5-5', 'seedream-5-0-flash'].map(id => getRuntimeModelById(id)!);
  const before = models.map(model => model.publication.app.published);
  const cells = structuredClone(tariffDocument.cells.filter(cell => models.some(model => model.id === cell.selector.engineId)));
  assert.equal(cells.length, 39);
  await withHistoricalCustomerTariffCatalogue(async () => {
    assert.deepEqual(models.map(model => model.publication.app.published), [false, false]);
  });
  assert.deepEqual(models.map(model => model.publication.app.published), before);
  assert.deepEqual(tariffDocument.cells.filter(cell => models.some(model => model.id === cell.selector.engineId)), cells);
});
