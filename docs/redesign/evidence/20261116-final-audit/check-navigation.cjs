const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const width of [1280, 390]) for (const slug of ['seedream-5-5', 'seedance-2-5-flash']) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    await page.goto(`http://localhost:3116/models/${slug}`, { waitUntil: 'networkidle' });
    const reject = page.getByRole('button', { name: 'Reject all', exact: true });
    if (await reject.count()) await reject.click();
    for (const id of ['examples', ...(slug.includes('seedance') ? ['rendered-examples'] : []), 'prompting', 'specs', 'decision-pricing', 'faq']) {
      await page.locator(`.cinema-nav a[href="#${id}"]`).click();
      await page.waitForTimeout(400);
      const position = await page.evaluate(id => {
        const target = document.getElementById(id);
        const heading = target.querySelector('h2,h3') || target;
        const nav = document.querySelector('.cinema-nav');
        return { heading: heading.getBoundingClientRect().top, navBottom: nav.getBoundingClientRect().bottom,
          overflow: document.documentElement.scrollWidth > innerWidth };
      }, id);
      assert.ok(position.heading >= position.navBottom - 2, `${slug}/${width}/${id}: heading covered ${JSON.stringify(position)}`);
      assert.equal(position.overflow, false);
      results.push({ slug, width, id, ...position });
    }
    // Check a real drawer, escape dismissal and native focus restoration.
    await page.locator('.cinema-nav a[href="#prompting"]').click();
    const trigger = page.locator('#prompting .cinema-prompt-trigger').first();
    await trigger.click();
    const dialog = page.locator('dialog[open]');
    assert.equal(await dialog.count(), 1);
    assert.ok(await dialog.getByRole('link', { name: /Use this prompt/ }).count());
    assert.ok(await dialog.getByRole('link', { name: /Refine with Milo/ }).count());
    assert.ok(await dialog.getByRole('button', { name: /Copy (video )?prompt/ }).count());
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('dialog[open]').count(), 0);
    assert.ok(await trigger.evaluate(el => el === document.activeElement));
    await page.close();
  }
  fs.writeFileSync('docs/redesign/evidence/20261116-final-audit/navigation.json', JSON.stringify(results, null, 2));
  console.log(`${results.length} anchor journeys plus 4 prompt drawers passed at desktop/mobile widths.`);
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
