import type { Page } from '@playwright/test';

export async function installSpeechFixture(page: Page) {
  await page.addInitScript(() => {
    (globalThis as any).__name ??= (value: unknown) => value;
    class Speech {
      lang = '';
      onstart?: () => void;
      onend?: () => void;
      onresult?: (event: object) => void;
      start() { Object.assign(window, {speech:this}); this.onstart?.(); }
      stop() {}
      abort() { this.onend?.(); }
    }
    Object.defineProperty(window, 'SpeechRecognition', {value:Speech, configurable:true});
    Object.assign(window, {submissions:0});
  });
}
export function finalWords(page: Page, words: string) {
  return page.evaluate(text => {
    const speech = (window as any).speech;
    const event = {resultIndex:0, results:[{isFinal:true, 0:{transcript:text}}]};
    speech.onresult?.(event);
    speech.onresult?.(event);
    speech.onend?.();
  }, words);
}

export function speechResults(page: Page, results: [string, boolean][], resultIndex = 0) {
  return page.evaluate(({results, resultIndex}) => {
    const speech = (window as any).speech;
    speech.onresult?.({resultIndex, results: results.map(([transcript, isFinal]) => ({isFinal, 0:{transcript}}))});
  }, {results, resultIndex});
}
