"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, type Ref } from "react";
import { ArrowUp, Plus } from "lucide-react";
import styles from "../image-conversation.module.css";
import type {ConversationLocale} from '@/lib/studio/conversation-quote-presentation';

export function ImageConversationComposer({
  text,
  onTextChange,
  onSend,
  blocked,
  sendBlocked=false,
  onOpenLibrary,
  libraryTrigger,
  locale = 'en',
  readOnly = false,
  libraryLabel,
  compact = false,
}: {
  text: string;
  onTextChange: (text: string) => void;
  onSend: () => void;
  blocked: boolean;
  sendBlocked?:boolean;
  onOpenLibrary: (trigger: HTMLButtonElement) => void;
  libraryTrigger: Ref<HTMLButtonElement>;
  locale?: ConversationLocale | 'es';
  readOnly?: boolean;
  libraryLabel?: string;
  compact?: boolean;
}) {
  const t = (en: string, fr: string, es=en) => locale === 'fr' ? fr : locale === 'es' ? es : en;
  const textarea = useRef<HTMLTextAreaElement>(null);
  const lengthNoticeId = useId();
  const tooLong = text.length > 4000;
  const canSend = !blocked && !sendBlocked && Boolean(text.trim()) && !tooLong;
  const resizeTextarea = useCallback(() => {
    const element = textarea.current;
    if (!element) return;
    const viewportHeight = compact ? window.visualViewport?.height ?? window.innerHeight : window.innerHeight;
    const maxHeight = Math.max(45, Math.min(160, viewportHeight * 0.22));
    element.style.height = "45px";
    element.style.height = `${Math.max(45, Math.min(element.scrollHeight, maxHeight))}px`;
  }, [compact]);

  useLayoutEffect(resizeTextarea, [resizeTextarea, text]);
  useEffect(() => {
    window.addEventListener("resize", resizeTextarea);
    if (compact) window.visualViewport?.addEventListener("resize", resizeTextarea);
    return () => {
      window.removeEventListener("resize", resizeTextarea);
      if (compact) window.visualViewport?.removeEventListener("resize", resizeTextarea);
    };
  }, [compact, resizeTextarea]);

  return (
    <><form
      className={styles.composer}
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSend();
      }}
    >
      <button
        type="button"
        disabled={blocked}
        ref={libraryTrigger}
        aria-label={libraryLabel??t('Open library', 'Ouvrir la bibliothèque')}
        onClick={event => onOpenLibrary(event.currentTarget)}
      >
        <Plus size={21} />
      </button>
      <textarea
        ref={textarea}
        rows={1}
        aria-label={t('Message Milo', 'Message à Milo', 'Mensaje a Milo')}
        value={text}
        readOnly={readOnly}
        onChange={(event) => onTextChange(event.target.value)}
        placeholder={compact ? t('Message Milo…', 'Écrivez à Milo…', 'Escribe a Milo…') : t('Tell Milo what you have in mind…', 'Dites à Milo ce que vous avez en tête…', 'Cuéntale a Milo lo que tienes en mente…')}
        maxLength={4000}
        aria-invalid={tooLong || undefined}
        aria-describedby={tooLong ? lengthNoticeId : undefined}
        enterKeyHint="send"
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing &&
            event.nativeEvent.keyCode !== 229
          ) {
            event.preventDefault();
            if (canSend) onSend();
          }
        }}
      />
      <button
        className={styles.send}
        type="submit"
        disabled={!canSend}
        aria-label={t('Send to Milo', 'Envoyer à Milo', 'Enviar a Milo')}
      >
        <ArrowUp size={20} />
      </button>
    </form>
    {tooLong && <p id={lengthNoticeId} className={styles.footnote} role="status">{t(
      'The full request is preserved. Shorten it to 4,000 characters before sending.',
      'La demande complète est conservée. Raccourcissez-la à 4 000 caractères avant de l’envoyer.',
      'Se conserva la solicitud completa. Redúcela a 4.000 caracteres antes de enviarla.',
    )}</p>}</>
  );
}
