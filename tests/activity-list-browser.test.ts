import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium, expect } from '@playwright/test';
import { startActivityFixture } from './helpers/activity-list-fixture';

test('Activity remains a compact list on desktop and mobile without loading originals', {timeout:90000}, async()=>{
  const fixture=await startActivityFixture();
  const browser=await chromium.launch();
  try {
    for(const width of [1200,390,360]) {
      const page=await browser.newPage({viewport:{width,height:844}});
      const errors:string[]=[],originals:string[]=[];
      page.on('pageerror',error=>errors.push(error.message));
      page.on('request',request=>{if(request.url().includes('media.fixture.test')) originals.push(request.url());});
      await page.goto(fixture.url);
      const rows=page.locator('[data-activity-id]');
      await expect(rows).toHaveCount(24);
      const dimensions=await rows.first().boundingBox();
      assert.ok(dimensions&&dimensions.height<=112,`compact row at ${width}px`);
      assert.equal(await page.locator('video,audio').count(),0);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal overflow');
      await expect(page.getByRole('link',{name:'Open Studio',exact:true})).toHaveAttribute('href','/app/studio/workspace/project_fixture');
      await expect(page.locator('[data-activity-id="job-6"]')).toContainText('MCP');
      await rows.first().getByRole('button',{name:/View details/}).click();
      await expect(page.locator('[data-opened]')).toHaveAttribute('data-opened','job-0');
      await page.getByRole('combobox',{name:'Status of loaded activity'}).selectOption('failed');
      await expect(rows).toHaveCount(1);
      await expect(rows).toContainText('Failed');
      await page.getByRole('combobox',{name:'Status of loaded activity'}).selectOption('all');
      await page.getByRole('button',{name:'Load more',exact:true}).click();
      await expect(rows).toHaveCount(48);
      assert.equal(await rows.first().getAttribute('data-activity-id'),'job-0');
      assert.equal(await page.locator('video,audio').count(),0);
      assert.deepEqual(originals,[],'history never fetches AV or image originals');
      await rows.first().getByRole('button',{name:'Actions · Wan 3 Prime',exact:true}).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('button',{name:'Fermer',exact:true}).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(rows).toHaveCount(48);
      assert.deepEqual(errors,[]);
      await page.close();
    }
  } finally {await browser.close();await fixture.close();}
});
