import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium, webkit, expect } from '@playwright/test';
import { finalWords, installSpeechFixture, speechResults } from './helpers/browser-speech-recognition';
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
        const stop = page.getByRole('button',{name:/^(Stop dictation|Arrêter la dictée|Detener el dictado)$/});
        const selected = page.locator('.app-reference-selected-summary:visible');
        await expect(selected).toBeVisible();
        const before = await selected.innerText();
        await mic.click();
        assert.equal((await page.evaluate(() => (window as any).speech.lang)).split('-')[0], lang);
        await prompt.fill('Edited @Image1');
        assert.equal(await page.evaluate(() => (window as any).speech.interimResults), true);
        assert.equal(await page.evaluate(() => (window as any).speech.continuous), true);
        await speechResults(page, [['one',false],['two',false]]);
        await expect(prompt).toHaveValue('Edited @Image1 one two');
        await speechResults(page, [['one',false]],1);
        await expect(prompt).toHaveValue('Edited @Image1 one');
        await speechResults(page, []);
        await expect(prompt).toHaveValue('Edited @Image1');
        await speechResults(page, [[words.slice(0,2),false]]);
        await stop.click();
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
        await speechResults(page, [['lights',false]]);
        await expect(ask).toHaveValue('Ask @Image1 lights');
        await ask.fill('Edited lights @Image1');
        await finalWords(page, 'stale transcription');
        await expect(ask).toHaveValue('Edited lights @Image1');
        await ask.fill('Ask @Image1');
        await mic.click();
        await page.getByRole('button',{name:/^(Stop dictation|Arrêter la dictée|Detener el dictado)$/}).click();
        await speechResults(page, [[words.slice(0,2),false]]);
        await expect(ask).toHaveValue('Ask @Image1 '+words.slice(0,2));
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
        await speechResults(page, [['first',true],['draft',false]]);
        await expect(message).toHaveValue('@Image1 first draft');
        await speechResults(page, [['first',true],[words,true]],1);
        await speechResults(page, [['first',true],[words,true]],1);
        const beforePause = '@Image1 first '+words;
        await expect(message).toHaveValue(beforePause);
        await speechResults(page, [['first',true],[words,true],['more',false]],2);
        await page.evaluate(() => {
          const w = window as any;
          w.previousSpeech = w.speech;
          w.oldResult = w.speech.onresult;
          w.speech.onend();
        });
        await expect(stop).toBeVisible();
        await page.waitForFunction(() => (window as any).previousSpeech !== (window as any).speech);
        await page.evaluate(() => (window as any).oldResult({results:[{isFinal:true,0:{transcript:'obsolete'}}]}));
        await speechResults(page, [['next phrase',false]]);
        await expect(message).toHaveValue(beforePause+' more next phrase');
        await stop.click();
        await finalWords(page,'next phrase');
        const fullDraft = beforePause+' more next phrase';
        await expect(mic).toBeEnabled();
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
          await expect(message).toHaveValue(fullDraft);
        }
        const longDraft = Array.from({length:40}, (_, index) => 'Line '+index).join('\n');
        await message.fill(longDraft);
        await message.evaluate(field => { field.scrollTop = 0; });
        await mic.click();
        await speechResults(page, [['visible words',false]]);
        await expect(message).toHaveValue(longDraft+' visible words');
        assert.ok(await message.evaluate(field =>
          field.scrollHeight > field.clientHeight && field.scrollHeight-field.scrollTop-field.clientHeight < 2));
        await page.evaluate(() => {
          const w = window as any;
          w.previousSpeech = w.speech;
          w.speech.onend();
        });
        await stop.click();
        await expect(mic).toBeEnabled();
        await page.waitForTimeout(350);
        assert.equal(await page.evaluate(() => (window as any).previousSpeech === (window as any).speech),true);
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
