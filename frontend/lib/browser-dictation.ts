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
export type DictationHandlers = {
  phase(value: DictationPhase): void;
  transcript(finalText: string, interimText: string): void;
  end(error?: string): void;
};

// A second field takes ownership immediately. Late events cannot mutate the first draft.
let cancelActive: (() => void) | undefined;

export function startBrowserDictation(locale: string, handlers: DictationHandlers) {
  cancelActive?.();
  const browser = window as SpeechWindow;
  const Engine = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
  if (!browser.isSecureContext || !Engine) {
    handlers.end('unavailable');
    return null;
  }

  let recognizer: Recognition | null = null;
  let closed = false;
  let stopping = false;
  let listening = false;
  let receivedText = false;
  let emptyDisconnects = 0;
  let timer: ReturnType<typeof setTimeout>;
  let reconnect: ReturnType<typeof setTimeout>;

  function detach() {
    const active = recognizer;
    if (active) active.onstart = active.onend = active.onresult = active.onerror = null;
    recognizer = null;
    return active;
  }
  function finish(error?: string, abort = false) {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    clearTimeout(reconnect);
    if (cancelActive === cancel) cancelActive = undefined;
    const active = detach();
    if (abort) {
      try { active?.abort(); } catch { /* The browser may already have ended the session. */ }
    }
    handlers.end(error);
  }
  function cancel() { finish(undefined, true); }
  function deadline(ms: number, error: string) {
    clearTimeout(timer);
    timer = setTimeout(() => finish(receivedText ? undefined : error, true), ms);
  }

  function connect() {
    if (closed || stopping || document.hidden || !Engine) return finish();
    let active: Recognition;
    try { active = new Engine(); }
    catch { return finish('unavailable'); }
    recognizer = active;
    let nextFinal = 0;
    let interim = '';
    let started = false;
    let startedAt = 0;
    let spoke = false;
    active.lang = locale;
    active.continuous = true;
    active.interimResults = true;
    active.onstart = () => {
      if (recognizer !== active || stopping) return;
      started = true;
      startedAt = Date.now();
      if (!listening) {
        listening = true;
        handlers.phase('listening');
        deadline(90_000, 'no-speech');
      }
    };
    active.onresult = ({ results }) => {
      if (recognizer !== active || document.hidden) return;
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
      interim = interims.join(' ');
      if (finals.length || interim) {
        receivedText = true;
        spoke = true;
        emptyDisconnects = 0;
        if (!stopping) deadline(90_000, 'no-speech');
      }
      handlers.transcript(finals.join(' '), interim);
    };
    active.onerror = ({ error }) => {
      if (recognizer !== active) return;
      // Silence is followed by an end event. Permission, service and network failures are terminal.
      if (error !== 'no-speech' || !started) finish(error, true);
    };
    active.onend = () => {
      if (recognizer !== active) return;
      detach();
      if (stopping || document.hidden) return finish();
      if (!started) return finish('unavailable');
      if (!spoke && Date.now() - startedAt < 1_500 && ++emptyDisconnects >= 2) return finish('no-speech');
      // Some engines close between phrases. Seal the visible tail before the next result list starts at zero.
      if (interim) handlers.transcript(interim, '');
      reconnect = setTimeout(connect, 250);
    };
    try { active.start(); }
    catch { finish('unavailable', true); }
  }

  cancelActive = cancel;
  handlers.phase('starting');
  deadline(45_000, 'timeout');
  connect();
  return closed ? null : {
    cancel,
    stop() {
      if (closed || stopping) return;
      stopping = true;
      if (!recognizer) return finish();
      handlers.phase('stopping');
      deadline(4_000, 'no-speech');
      try { recognizer.stop(); } catch { finish(undefined, true); }
    },
  };
}
