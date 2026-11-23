import type { Recording } from '@soniox/client';
import { startBrowserDictation, type DictationHandlers } from './browser-dictation';

type Control = { cancel(): void; stop(): void };
let active: Control | null = null;

export function startDictation(locale: string, handlers: DictationHandlers): Control | null {
  active?.cancel();
  if (process.env.NEXT_PUBLIC_SONIOX_DICTATION !== '1' || !navigator.mediaDevices?.getUserMedia) {
    return startBrowserDictation(locale, handlers);
  }

  let closed = false;
  let listening = false;
  let stopping = false;
  let confirmed = '';
  let hasTranscript = false;
  let recording: Recording | undefined;
  let browser: Control | null = null;
  let timer: ReturnType<typeof setTimeout>;
  const controller = new AbortController();

  function finish(reason?: string) {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    if (active === control) active = null;
    recording?.cancel();
    controller.abort();
    browser?.cancel();
    handlers.end(reason);
  }

  function fallbackToBrowser() {
    if (closed) return;
    clearTimeout(timer);
    const previous = recording;
    recording = undefined;
    previous?.cancel();
    controller.abort();
    browser = startBrowserDictation(locale, { ...handlers, end: finish });
  }

  function idleDeadline() {
    clearTimeout(timer);
    timer = setTimeout(() => control.stop(), 90_000);
  }

  const control: Control = {
    cancel: () => finish(),
    stop() {
      if (browser) return browser.stop();
      if (closed || stopping) return;
      if (!recording || !listening) return finish();
      stopping = true;
      clearTimeout(timer);
      handlers.phase('stopping');
      timer = setTimeout(() => finish(), 5_000);
      void recording.stop().then(() => finish(), () => finish('network'));
    },
  };

  async function connect() {
    try {
      const { SonioxClient, AudioPermissionError, AudioDeviceError, AuthError, QuotaError } = await import('@soniox/client');
      if (closed) return;
      const client = new SonioxClient({
        config: async () => {
          const response = await fetch('/api/dictation/session', {
            method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
          });
          if (!response.ok) throw new Error('Hosted dictation unavailable');
          const { api_key, region } = await response.json();
          if (typeof api_key !== 'string' || !api_key) throw new Error('Missing dictation session');
          return { api_key, region };
        },
      });
      const current = client.realtime.record({
        model: 'stt-rt-v6', signal: controller.signal,
        language_hints: [...new Set([locale.split('-')[0], 'en', 'fr', 'es'])],
        context: { terms: ['MaxVideoAI', 'Milo', 'Seedance', 'Kling'] },
      });
      recording = current;
      current.on('connected', () => {
        if (closed || recording !== current) return;
        listening = true;
        handlers.phase('listening');
        idleDeadline();
      });
      current.on('result', ({ tokens }) => {
        if (closed || recording !== current || document.hidden || !tokens.length) return;
        let interim = '';
        for (const token of tokens) {
          if (token.text === '<end>' || token.text === '<fin>') continue;
          if (token.is_final) confirmed += token.text;
          else interim += token.text;
        }
        // A token can be half a word or punctuation. Replace the entire spoken suffix exactly.
        if (confirmed || interim) hasTranscript = true;
        handlers.transcript('', confirmed + interim);
        if (!stopping) idleDeadline();
      });
      current.on('finished', () => { if (recording === current) finish(); });
      current.on('error', (error) => {
        if (closed || recording !== current) return;
        if (error instanceof AudioPermissionError) return finish('not-allowed');
        if (error instanceof AudioDeviceError) return finish('audio-capture');
        if (!listening || (!hasTranscript && (error instanceof QuotaError || error instanceof AuthError))) {
          return fallbackToBrowser();
        }
        finish('network');
      });
    } catch {
      if (!closed) fallbackToBrowser();
    }
  }

  active = control;
  handlers.phase('starting');
  timer = setTimeout(() => finish('timeout'), 45_000);
  void connect();
  return control;
}
