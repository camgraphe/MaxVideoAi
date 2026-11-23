'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { appendDictation, startBrowserDictation, type DictationPhase } from '@/lib/browser-dictation';
import styles from './dictation.module.css';

const regionalLanguage = { en: 'en-US', fr: 'fr-FR', es: 'es-ES' };

const copy = {
  en: {
    start: 'Dictate',
    cancel: 'Cancel dictation',
    stop: 'Stop dictation',
    listening: 'Listening…',
    starting: 'Starting dictation…',
    stopping: 'Finishing dictation…',
    denied: 'Microphone or speech recognition access was denied. Check the site permissions or use keyboard dictation.',
    unavailable: 'Voice dictation is unavailable here. Try Chrome, Safari or keyboard dictation.',
    service: 'This browser can’t start speech recognition. Open the page in Chrome or Safari, or use keyboard dictation.',
    network: 'Can’t reach the speech service. Check your connection and try again.',
    microphone: 'Can’t hear the microphone. Check the selected input in your device settings and try again.',
    silent: 'No speech detected. Try dictating again.',
  },
  fr: {
    start: 'Dicter',
    cancel: 'Annuler la dictée',
    stop: 'Arrêter la dictée',
    listening: 'À l’écoute…',
    starting: 'Démarrage de la dictée…',
    stopping: 'Fin de la dictée…',
    denied: 'L’accès au micro ou à la reconnaissance vocale a été refusé. Vérifiez les autorisations du site ou utilisez la dictée du clavier.',
    unavailable: 'La dictée vocale est indisponible ici. Essayez Chrome, Safari ou la dictée du clavier.',
    service: 'Ce navigateur ne peut pas démarrer la dictée. Ouvrez la page dans Chrome ou Safari, ou utilisez la dictée du clavier.',
    network: 'Le service de dictée est injoignable. Vérifiez votre connexion et réessayez.',
    microphone: 'Impossible de capter le son du micro. Vérifiez le micro sélectionné dans les réglages de votre appareil.',
    silent: 'Aucune parole détectée. Réessayez de dicter.',
  },
  es: {
    start: 'Dictar',
    cancel: 'Cancelar el dictado',
    stop: 'Detener el dictado',
    listening: 'Escuchando…',
    starting: 'Iniciando el dictado…',
    stopping: 'Finalizando el dictado…',
    denied: 'Se ha denegado el acceso al micrófono o al reconocimiento de voz. Revisa los permisos del sitio o usa el dictado del teclado.',
    unavailable: 'El dictado por voz no está disponible aquí. Prueba Chrome, Safari o el dictado del teclado.',
    service: 'Este navegador no puede iniciar el dictado. Abre la página en Chrome o Safari, o usa el dictado del teclado.',
    network: 'No se puede conectar con el servicio de dictado. Comprueba tu conexión y vuelve a intentarlo.',
    microphone: 'No se puede captar el sonido del micrófono. Comprueba la entrada seleccionada en los ajustes del dispositivo.',
    silent: 'No se ha detectado voz. Inténtalo de nuevo.',
  },
};

type DictationButtonProps = {
  locale: string;
  value: string;
  onChange: (text: string) => void;
  maxLength?: number;
  disabled?: boolean;
};

export function DictationButton({ locale, value, onChange, maxLength, disabled = false }: DictationButtonProps) {
  const language = locale.startsWith('fr') ? 'fr' : locale.startsWith('es') ? 'es' : 'en';
  const words = copy[language];
  const [phase, setPhase] = useState<DictationPhase | null>(null);
  const [error, setError] = useState('');
  const control = useRef<HTMLSpanElement>(null);
  const notice = useRef<HTMLSpanElement>(null);
  const session = useRef<ReturnType<typeof startBrowserDictation>>(null);
  const interimBase = useRef<string | null>(null);
  const draft = useRef({ value, onChange, maxLength });
  const noticeId = useId();

  useLayoutEffect(() => {
    if (draft.current.value !== value && (interimBase.current !== null || !value)) {
      // An edit to the displayed hypothesis takes ownership of the draft.
      session.current?.cancel();
    }
    draft.current = { value, onChange, maxLength };
  }, [value, onChange, maxLength]);
  useLayoutEffect(() => {
    setError('');
    const cancel = () => session.current?.cancel();
    const hide = () => { if (document.hidden) cancel(); };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', cancel);
    return () => {
      cancel();
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', cancel);
    };
  }, [disabled, locale]);

  useLayoutEffect(() => {
    const bubble = notice.current;
    const anchor = control.current;
    if (!error || !bubble || !anchor) return;
    const bounds = anchor.getBoundingClientRect();
    bubble.style.top = bounds.top < bubble.offsetHeight + 8 ? '100%' : '';
    bubble.style.bottom = bubble.style.top ? 'auto' : '';
    const left = Math.max(8, Math.min(bounds.right - bubble.offsetWidth, window.innerWidth - bubble.offsetWidth - 8));
    bubble.style.left = (left - bounds.left) + 'px';
    return () => {
      bubble.style.removeProperty('top');
      bubble.style.removeProperty('bottom');
      bubble.style.removeProperty('left');
    };
  }, [error]);
  useEffect(() => {
    if (!error) return;
    const dismiss = (event: PointerEvent) => {
      if (!control.current?.contains(event.target as Node)) setError('');
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [error]);

  function press() {
    if (document.hidden || disabled) return;
    if (session.current) {
      if (phase === 'starting') session.current.cancel();
      else session.current.stop();
      return;
    }
    setError('');
    const lang = navigator.languages.find(item => item.split('-')[0] === language) ?? regionalLanguage[language];
    session.current = startBrowserDictation(lang, {
      phase: setPhase,
      transcript(finalText, interimText) {
        const current = draft.current;
        const committed = appendDictation(interimBase.current ?? current.value, finalText, current.maxLength);
        const next = appendDictation(committed, interimText, current.maxLength);
        interimBase.current = interimText ? committed : null;
        if (next !== current.value) {
          current.value = next;
          current.onChange(next);
        }
      },
      end(reason) {
        interimBase.current = null;
        session.current = null;
        setPhase(null);
        const feedback: Record<string, string> = {
          'not-allowed': words.denied,
          'service-not-allowed': words.service,
          'network': words.network,
          'audio-capture': words.microphone,
          'no-speech': words.silent,
        };
        setError(reason ? (feedback[reason] ?? words.unavailable) : '');
      },
    });
  }

  const label = phase === 'starting' ? words.cancel : phase ? words.stop : words.start;
  return <span ref={control} className={styles.control}>
    <button type="button" className={styles.mic} aria-label={label} title={label} aria-pressed={!!phase}
      aria-describedby={error ? noticeId : undefined} disabled={disabled || phase === 'stopping' || (!phase && value.length >= (maxLength ?? Infinity))}
      onBlur={() => setError('')} onClick={press}>
      {phase ? <Square size={16} fill="currentColor" aria-hidden /> : <Mic size={18} aria-hidden />}
    </button>
    <span ref={notice} id={noticeId} aria-live="polite" role={phase || error ? 'status' : undefined} className={error ? styles.notice : 'sr-only'}>{error || (phase && words[phase])}</span>
  </span>;
}
