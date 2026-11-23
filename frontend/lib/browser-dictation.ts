/** Web Speech recognition can be prefixed or unavailable even on a browser with microphone support. */
type Result = { isFinal: boolean; 0?: { transcript: string } };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: { resultIndex: number; results: ArrayLike<Result> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

export function appendDictation(value: string, transcript: string, maxLength = Infinity): string {
  const words = transcript.trim();
  const space = value && !/\s$/u.test(value) ? ' ' : '';
  const remaining = Math.max(0, maxLength - value.length - space.length);
  const addition = words.slice(0, remaining).replace(/[\uD800-\uDBFF]$/u, '').trimEnd();
  return addition ? value + space + addition : value;
}

export type DictationPhase = 'starting' | 'listening' | 'stopping';
type Handlers = {
  phase(value: DictationPhase): void;
  transcript(finalText: string, interimText: string): void;
  end(error?: string): void;
};

// A second field takes ownership immediately. Late events cannot mutate the first draft.
let cancelActive: (() => void) | undefined;

export function startBrowserDictation(locale: string, handlers: Handlers) {
  cancelActive?.();
  const browser = window as SpeechWindow;
  const Engine = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
  if (!browser.isSecureContext || !Engine) {
    handlers.end('unavailable');
    return null;
  }

  let recognizer: Recognition;
  try { recognizer = new Engine(); }
  catch { handlers.end('unavailable'); return null; }
  let closed = false;
  let stopping = false;
  let hasFinalText = false;
  let hasInterimText = false;
  let nextFinal = 0;
  let timer: ReturnType<typeof setTimeout>;

  function finish(error?: string, abort = false) {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    if (cancelActive === cancel) cancelActive = undefined;
    recognizer.onstart = recognizer.onend = recognizer.onresult = recognizer.onerror = null;
    if (abort) {
      try { recognizer.abort(); } catch { /* The browser may already have ended the session. */ }
    }
    handlers.end(error);
  }
  function cancel() { finish(undefined, true); }
  function deadline(ms: number) {
    clearTimeout(timer);
    timer = setTimeout(() => finish(hasFinalText || hasInterimText ? undefined : 'timeout', true), ms);
  }

  cancelActive = cancel;
  recognizer.lang = locale;
  recognizer.continuous = false;
  recognizer.interimResults = true;
  recognizer.onstart = () => {
    if (closed || stopping) return;
    handlers.phase('listening');
    deadline(90_000);
  };
  recognizer.onresult = ({ results }) => {
    if (closed || document.hidden) return;
    // Final entries are immutable; the browser can replace or withdraw the whole interim tail.
    const finals: string[] = [];
    const interims: string[] = [];
    for (let i = nextFinal; i < results.length; i++) {
      const result = results[i];
      const text = result[0]?.transcript.trim();
      if (result.isFinal) {
        nextFinal = i + 1;
        if (text) finals.push(text);
      } else if (text) {
        interims.push(text);
      }
    }
    if (finals.length) hasFinalText = true;
    hasInterimText = interims.length > 0;
    handlers.transcript(finals.join(' '), interims.join(' '));
  };
  recognizer.onerror = ({ error }) => finish(error, true);
  recognizer.onend = () => finish(hasFinalText || hasInterimText ? undefined : 'no-speech');
  handlers.phase('starting');
  deadline(45_000);
  try { recognizer.start(); }
  catch { finish('unavailable', true); return null; }
  return closed ? null : {
    cancel,
    stop() {
      if (closed || stopping) return;
      stopping = true;
      handlers.phase('stopping');
      deadline(4_000);
      try { recognizer.stop(); } catch { finish('unavailable', true); }
    },
  };
}
