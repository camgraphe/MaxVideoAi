import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium } from '@playwright/test';
import { ExampleReaderStyles } from '../frontend/components/examples/example-reader-styles';

test('reader keeps the same dialog frame while delayed content replaces loading or an error', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [{ width: 1365, height: 900 }, { width: 900, height: 900 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport });
      await page.setContent(`<style>*{box-sizing:border-box}body{margin:0}</style>${renderToStaticMarkup(React.createElement(ExampleReaderStyles))}<div class="video-reader-backdrop"><section class="video-reader-dialog"><div class="video-reader-loading">Loading</div></section></div>`);
      const dialog = page.locator('.video-reader-dialog');
      const loading = await dialog.boundingBox();
      assert.ok(loading);
      const status = await page.locator('.video-reader-loading').boundingBox();
      assert.ok(status);
      assert.ok(Math.abs(status.y + status.height / 2 - loading.y - loading.height / 2) <= 8, 'loading and retry content stay centered inside the stable frame');
      for (const height of [1000, 100, 1600]) {
        await dialog.evaluate((element, contentHeight) => { element.innerHTML = `<div style="height:${contentHeight}px">Video details</div>`; }, height);
        const ready = await dialog.boundingBox();
        assert.ok(ready);
        assert.ok(Math.abs(ready.y - loading.y) <= 1, `at ${viewport.width}px the dialog moved from ${loading.y}px to ${ready.y}px`);
        assert.ok(Math.abs(ready.height - loading.height) <= 1, 'the scrollable frame must survive different video lengths and retry states');
        assert.equal(await dialog.evaluate(element => element.scrollHeight > element.clientHeight), height > ready.height, 'long content remains scrollable inside the frame');
      }
      await dialog.evaluate(element => { element.classList.add('video-reader-standalone'); element.innerHTML = '<div style="height:1200px">Watch page</div>'; });
      assert.ok((await dialog.boundingBox())!.height > viewport.height, 'the standalone watch page keeps normal document scrolling');
      await page.close();
    }
  } finally { await browser.close(); }
});
