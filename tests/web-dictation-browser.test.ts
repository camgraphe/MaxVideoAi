import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium, webkit, expect } from '@playwright/test';
import { finalWords, installSpeechFixture } from './helpers/browser-speech-recognition';
import { appendDictation } from '../frontend/lib/browser-dictation';
import { startWorkspaceReferenceFixture } from './helpers/workspace-reference-browser-fixture';
import { dictationFixtureOptions } from './helpers/dictation-browser-fixture';

test('dictation respects the existing draft and its UTF-16 length limit', () => {
  assert.equal(appendDictation('Old\n','  Hola  ',8),'Old\nHola');
  assert.equal(appendDictation('🍀','🌙',4),'🍀');
  assert.equal(appendDictation('Long original','anything',5),'Long original');
});

for (const engine of [chromium, webkit]) {
  test(`dictation edits only the active Create or Studio draft (${engine.name()})`, {timeout:90_000}, async () => {
    const fixture = await startWorkspaceReferenceFixture(dictationFixtureOptions());
    const browser = await engine.launch();
    try {
      for (const [lang, label, words] of [['en','Dictate','blue ice'],['fr','Dicter','glace bleue'],['es','Dictar','hielo azul']]) {
        const page = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:lang});
        page.on('pageerror', error => { throw error; });
        await installSpeechFixture(page);
        await page.goto(fixture.url+'/?lang='+lang);
        const prompt = page.locator('[data-workspace-prompt]');
        const mic = page.getByRole('button',{name:label,exact:true});
        const selected = page.locator('.app-reference-selected-summary:visible');
        await expect(selected).toBeVisible();
        const before = await selected.innerText();
        await mic.click();
        assert.equal((await page.evaluate(() => (window as any).speech.lang)).split('-')[0], lang);
        await prompt.fill('Edited @Image1');
        await finalWords(page, words);
        await expect(prompt).toHaveValue('Edited @Image1 '+words);
        assert.equal(await selected.innerText(), before);
        await mic.click();
        await page.evaluate(() => { (window as any).lateResult=(window as any).speech.onresult; });
        await page.getByRole('tab').nth(1).click();
        await page.evaluate(() => (window as any).lateResult({resultIndex:0,results:[{isFinal:true,0:{transcript:'late'}}]}));
        const ask = page.locator('[data-assistance-message]');
        await ask.fill('Ask @Image1');
        await mic.click();
        await page.getByRole('button',{name:/^(Stop dictation|Arrêter la dictée|Detener el dictado)$/}).click();
        await finalWords(page, words);
        await expect(ask).toHaveValue('Ask @Image1 '+words);
        await ask.fill('Reviewed');
        await page.getByRole('tab').nth(0).click();
        await expect(prompt).toHaveValue('Edited @Image1 '+words);
        assert.equal(await selected.innerText(), before);
        assert.equal(await page.evaluate(() => (window as any).submissions),0);

        await page.goto(fixture.url+'/studio?lang='+lang);
        const message = page.getByRole('textbox');
        await mic.click();
        await finalWords(page, words);
        await expect(message).toHaveValue('@Image1 '+words);
        await mic.click();
        await page.evaluate(() => (window as any).speech.onerror({error:'not-allowed'}));
        await expect(page.getByRole('status')).toContainText(/denied|refusé|denegado/);
        await expect(page.getByRole('status')).toBeInViewport({ratio:1});
        for (const [error, notice] of [
          ['service-not-allowed', /Chrome.*Safari/],
          ['network', /connection|connexion|conexión/],
          ['audio-capture', /selected input|micro sélectionné|entrada seleccionada/],
        ] as const) {
          await mic.click();
          await page.evaluate(code => (window as any).speech.onerror({error:code}),error);
          await expect(page.getByRole('status')).toContainText(notice);
          await expect(message).toHaveValue('@Image1 '+words);
        }
        await message.fill('Reviewed @Image1');
        await page.evaluate(() => {
          Object.defineProperty(window,'SpeechRecognition',{value:undefined,configurable:true});
          Object.defineProperty(window,'webkitSpeechRecognition',{value:undefined,configurable:true});
        });
        await mic.click();
        await expect(page.getByRole('status')).toContainText(/keyboard|clavier|teclado/);
        await expect(message).toHaveValue('Reviewed @Image1');
        assert.equal(await page.evaluate(() => (window as any).submissions),0);
        await page.close();
      }
    } finally { await browser.close(); await fixture.close(); }
  });
}
