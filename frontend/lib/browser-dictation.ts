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
  append(text: string): void;
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
  let received = false;
  let nextResult = 0;
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
    timer = setTimeout(() => finish(received ? undefined : 'timeout', true), ms);
  }

  cancelActive = cancel;
  recognizer.lang = locale;
  recognizer.continuous = false;
  recognizer.interimResults = false;
  recognizer.onstart = () => {
    if (closed || stopping) return;
    handlers.phase('listening');
    deadline(90_000);
  };
  recognizer.onresult = ({ resultIndex, results }) => {
    if (closed || document.hidden) return;
    for (let i = Math.max(nextResult, resultIndex); i < results.length; i++) {
      if (!results[i].isFinal) break;
      nextResult = i + 1;
      const text = results[i][0]?.transcript.trim();
      if (text) { received = true; handlers.append(text); }
    }
  };
  recognizer.onerror = ({ error }) => finish(error, true);
  recognizer.onend = () => finish(received ? undefined : 'no-speech');
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
