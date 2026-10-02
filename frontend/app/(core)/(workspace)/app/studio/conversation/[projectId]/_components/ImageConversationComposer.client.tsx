"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type Ref } from "react";
import { ArrowUp, Plus } from "lucide-react";
import styles from "../image-conversation.module.css";
import type {ConversationLocale} from '@/lib/studio/conversation-quote-presentation';

export function ImageConversationComposer({
  text,
  onTextChange,
  onSend,
  blocked,
  onOpenLibrary,
  libraryTrigger,
  locale = 'fr',
}: {
  text: string;
  onTextChange: (text: string) => void;
  onSend: () => void;
  blocked: boolean;
  onOpenLibrary: () => void;
  libraryTrigger: Ref<HTMLButtonElement>;
  locale?: ConversationLocale;
}) {
  const t = (en: string, fr: string) => locale === 'fr' ? fr : en;
  const textarea = useRef<HTMLTextAreaElement>(null);
  const resizeTextarea = useCallback(() => {
    const element = textarea.current;
    if (!element) return;
    const maxHeight = Math.max(45, Math.min(160, window.innerHeight * 0.22));
    element.style.height = "45px";
    element.style.height = `${Math.max(45, Math.min(element.scrollHeight, maxHeight))}px`;
  }, []);

  useLayoutEffect(resizeTextarea, [resizeTextarea, text]);
  useEffect(() => {
    window.addEventListener("resize", resizeTextarea);
    return () => window.removeEventListener("resize", resizeTextarea);
  }, [resizeTextarea]);

  return (
    <form
      className={styles.composer}
      onSubmit={(event) => {
        event.preventDefault();
        onSend();
      }}
    >
      <button
        type="button"
        disabled={blocked}
        ref={libraryTrigger}
        aria-label={t('Open library', 'Ouvrir la bibliothèque')}
        onClick={onOpenLibrary}
      >
        <Plus size={21} />
      </button>
      <textarea
        ref={textarea}
        rows={1}
        aria-label={t('Message Studio', 'Message à Studio')}
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        placeholder={t('Describe your idea…', 'Décrivez votre idée…')}
        maxLength={4000}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing &&
            event.nativeEvent.keyCode !== 229
          ) {
            event.preventDefault();
            onSend();
          }
        }}
      />
      <button
        className={styles.send}
        type="submit"
        disabled={!text.trim() || blocked}
        aria-label={t('Send to Studio', 'Envoyer à Studio')}
      >
        <ArrowUp size={20} />
      </button>
    </form>
  );
}
