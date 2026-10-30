import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium, webkit, expect } from '@playwright/test';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { startWorkspaceReferenceFixture, workspaceReferenceFixtureSource } from './helpers/workspace-reference-browser-fixture';

test('preview writing fields avoid small mobile type and keep Clear beside Multi-prompt', {timeout:60_000}, async () => {
  const catalog = listFalEngines().find(entry => entry.id === 'kling-o3-pro')!.engine;
  const engine = {...catalog, inputLimits:{...catalog.inputLimits,promptMaxChars:26000}};
  const source = workspaceReferenceFixtureSource.replace('assetFields={config.fields}', `multiPrompt={{enabled:false,scenes:[],onToggle:()=>{}}} assetFields={config.fields}`);
  const fixture = await startWorkspaceReferenceFixture({source, assistancePreview:true, config:{engine,locale:'en',fields:[],assets:{},prompt:'',assistance:{scopeKey:'owner',contextKey:'create'}}});
  try {
    for (const browserType of [chromium,webkit]) {
      const browser = await browserType.launch({headless:true});
      try {
        for (const width of [320,390,1440]) {
          const page = await browser.newPage({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600});
          await page.goto(fixture.url);
          const input=page.locator('[data-workspace-prompt]');
          const root=page.locator('[data-prompt-assistance-preview]');
          const restingBorder=await root.evaluate(el=>getComputedStyle(el).borderColor);
          await input.focus();
          if(width<600) assert.ok(await input.evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=16), 'manual text is large enough to avoid iOS focus zoom');
          assert.equal(await page.locator('.app-prompt-surface').evaluate(el=>getComputedStyle(el).boxShadow),'none', 'focus must not outline the inner prompt block');
          assert.notEqual(await root.evaluate(el=>getComputedStyle(el).borderColor),restingBorder, 'the outer rounded boundary shows keyboard focus');
          const clear=page.getByRole('button',{name:'Clear',exact:true});
          await expect(clear).toBeVisible(); await expect(clear).toBeDisabled();
          await input.fill('A long cinematic prompt. '.repeat(420));
          await expect(clear).toBeEnabled();
          const clearBox=await clear.boundingBox();
          const multiBox=await page.getByRole('button',{name:'Multi-prompt',exact:true}).boundingBox();
          assert.ok(clearBox && multiBox && Math.abs(clearBox.y-multiBox.y)<2 && multiBox.x+multiBox.width<=clearBox.x, 'long counters do not displace or cover Clear');
          await clear.click(); await expect(input).toHaveValue('');
          await page.getByRole('button',{name:'Undo clearing',exact:true}).click();
          await expect(input).toHaveValue('A long cinematic prompt. '.repeat(420));
          await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
          const message=page.locator('[data-assistance-message]');
          await message.fill('Keep the camera still.'); await message.press('Enter');
          await expect(page.locator('[data-assistance-apply]')).toBeEnabled();
          if(width<600) {
            const reviewBox=await page.locator('[data-assistance-expand]').boundingBox();
            assert.ok(reviewBox && reviewBox.width>=44 && reviewBox.height>=44, 'the narrow eye button retains a full touch target');
          }
          await page.locator('[data-assistance-preview-open]').focus();
          await page.locator('[data-assistance-preview-open]').press('Enter');
          await expect(page.locator('[data-assistance-editor]')).toBeFocused();
          await page.locator('[data-assistance-expand]').click();
          await page.getByRole('button',{name:'View prompt',exact:true}).click();
          if(width<600) for(const selector of ['[data-assistance-message]','[data-assistance-editor]']) {
            assert.ok(await page.locator(selector).evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=16));
          }
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
          await page.close();
        }
      } finally {await browser.close();}
    }
  } finally {await fixture.close();}
});
