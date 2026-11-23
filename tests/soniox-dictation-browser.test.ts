import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium, webkit, expect, type WebSocketRoute } from '@playwright/test';
import { dictationFixtureOptions } from './helpers/dictation-browser-fixture';
import { installSpeechFixture, speechResults } from './helpers/browser-speech-recognition';
import { startWorkspaceReferenceFixture } from './helpers/workspace-reference-browser-fixture';

for (const engine of [chromium, webkit]) {
  test(`hosted dictation preserves token boundaries, edits, references and guest fallback (${engine.name()})`, async () => {
    const fixture = await startWorkspaceReferenceFixture({ ...dictationFixtureOptions(), hostedDictation: true });
    const browser = await engine.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
      await installSpeechFixture(page);
      await page.addInitScript(() => {
        const tracks: MediaStreamTrack[] = [];
        Object.assign(window, { dictationTracks: tracks });
        Object.defineProperty(navigator, 'mediaDevices', {
          configurable: true,
          value: {
            async getUserMedia() {
              const ctx = new AudioContext();
              const stream = ctx.createMediaStreamDestination().stream;
              tracks.push(...stream.getAudioTracks());
              return stream;
            },
          },
        });
      });
      let guest = false;
      await page.route('**/api/dictation/session', route => route.fulfill({
        status: guest ? 401 : 200, json: guest ? {} : { api_key: 'synthetic-once' },
      }));
      const sockets: WebSocketRoute[] = [];
      const configs: Record<string, unknown>[] = [];
      await page.routeWebSocket('wss://stt-rt.soniox.com/**', socket => {
        sockets.push(socket);
        socket.onMessage(data => {
          if (typeof data === 'string' && data.startsWith('{')) {
            const config = JSON.parse(data);
            if (config.model) configs.push(config);
          }
          if (!data.length) socket.send(JSON.stringify({ tokens: [], finished: true }));
        });
      });
      await page.goto(fixture.url + '/?lang=fr');
      const prompt = page.locator('[data-workspace-prompt]');
      const mic = page.getByRole('button', { name: 'Dicter', exact: true });
      const stop = page.getByRole('button', { name: 'Arrêter la dictée', exact: true });
      const reference = page.locator('.app-reference-selected-summary:visible');
      const original = await prompt.inputValue();
      const attachment = await reference.innerText();
      await mic.click();
      await expect.poll(() => configs.length).toBe(1);
      assert.deepEqual(configs[0].language_hints, ['fr', 'en', 'es']);
      assert.equal(configs[0].model, 'stt-rt-v6');
      assert.equal(configs[0].translation, undefined);
      const words = (text: string, is_final: boolean) => ({ text, is_final });
      const send = (...tokens: ReturnType<typeof words>[]) => sockets.at(-1)!.send(JSON.stringify({ tokens }));
      send(words('Kli', true), words('m', false));
      await expect(prompt).toHaveValue(original + ' Klim');
      send(words('ng', true), words(' 9', true), words(':16', false));
      await expect(prompt).toHaveValue(original + ' Kling 9:16');
      send(words(':16', true), words('.', true), words('<end>', true));
      await stop.click();
      await expect(mic).toBeEnabled();
      await expect(prompt).toHaveValue(original + ' Kling 9:16.');
      assert.equal(await reference.innerText(), attachment);
      await expect.poll(() => page.evaluate(() =>
        (window as unknown as { dictationTracks: MediaStreamTrack[] }).dictationTracks[0]?.readyState)).toBe('ended');

      await page.getByRole('tab').nth(1).click();
      const ask = page.locator('[data-assistance-message]');
      await mic.click();
      await expect.poll(() => configs.length).toBe(2);
      send(words('Keep', false));
      await expect(ask).toHaveValue('Keep');
      await ask.fill('Edited');
      await expect(mic).toBeEnabled();
      await expect(ask).toHaveValue('Edited');

      for (const [lang, start, end, line, hints] of [
        ['es', 'Dictar', 'Detener el dictado', 'Haz el hielo más azul.', ['es', 'en', 'fr']],
        ['en', 'Dictate', 'Stop dictation', 'Keep the blue ice.', ['en', 'fr', 'es']],
      ] as const) {
        await page.goto(fixture.url + '/studio?lang=' + lang);
        const previousCount = configs.length;
        await page.getByRole('button', { name: start, exact: true }).click();
        await expect.poll(() => configs.length).toBe(previousCount + 1);
        assert.deepEqual(configs.at(-1)?.language_hints, hints);
        send(words(line.slice(0, 3), false));
        await expect(page.getByRole('textbox')).toHaveValue('@Image1 ' + line.slice(0, 3));
        send(words(line, true), words('<fin>', true));
        await page.getByRole('button', { name: end, exact: true }).click();
        await expect(page.getByRole('textbox')).toHaveValue('@Image1 ' + line);
        assert.equal(await page.evaluate(() => (window as unknown as { submissions: number }).submissions), 0);
      }

      await page.goto(fixture.url + '/studio?lang=fr');
      await mic.click();
      await expect.poll(() => configs.length).toBe(5);
      sockets.at(-1)!.send(JSON.stringify({ error_code: 402, error_message: 'No test credits' }));
      await page.waitForFunction(() => Boolean((window as unknown as { speech: unknown }).speech));
      await speechResults(page, [['texte conservé', true]]);
      await expect(page.getByRole('textbox')).toHaveValue('@Image1 texte conservé');

      guest = true;
      await page.goto(fixture.url + '/studio?lang=fr');
      await mic.click();
      await expect(stop).toBeVisible();
      await speechResults(page, [['glace bleue', true]]);
      await expect(page.getByRole('textbox')).toHaveValue('@Image1 glace bleue');
      assert.equal(configs.length, 5);
      await expect.poll(() => page.evaluate(() =>
        (window as unknown as { dictationTracks: MediaStreamTrack[] }).dictationTracks.every(t => t.readyState === 'ended'))).toBe(true);
      assert.equal(await page.evaluate(() => (window as unknown as { submissions: number }).submissions), 0);
    } finally {
      await browser.close();
      await fixture.close();
    }
  });
}
