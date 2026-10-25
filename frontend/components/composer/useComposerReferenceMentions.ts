'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { ComposerProps } from './composer-types';
import { buildReferenceMentions, changedReferenceMentions, insertReferenceMention, type ReferenceMention } from './workspace-reference-mentions';

export function useComposerReferenceMentions({ engine, assetFields, assets, prompt, onPromptChange, textareaRef, multiPrompt }: Pick<ComposerProps, 'engine' | 'assetFields' | 'assets' | 'prompt' | 'onPromptChange' | 'textareaRef' | 'multiPrompt'>) {
  const input = useRef<HTMLTextAreaElement | null>(null);
  const mentions = useMemo(() => buildReferenceMentions(engine, assetFields, assets), [engine, assetFields, assets]);
  const reviewed = useRef<ReferenceMention[]>(mentions);
  const [, refreshReview] = useReducer((value: number) => value + 1, 0);
  // Both forms persist across mode toggles; inactive prose must retain its associations too.
  const allPrompts = [prompt, ...(multiPrompt?.scenes.map(scene => scene.prompt) ?? [])].join('\n');
  const changed = changedReferenceMentions(allPrompts, reviewed.current, mentions);
  const needsReview = changed.length > 0;
  // Advance only a safe association; keep the old one while review is pending.
  useEffect(() => { if (!needsReview) reviewed.current = mentions; }, [mentions, needsReview]);
  const attachInput = useCallback((node: HTMLTextAreaElement | null) => {
    input.current = node;
    if (typeof textareaRef === 'function') textareaRef(node);
    else if (textareaRef) (textareaRef as MutableRefObject<HTMLTextAreaElement | null>).current = node;
  }, [textareaRef]);
  const insert = useCallback((token: string) => {
    const textarea = input.current;
    if (!textarea || !mentions.some(mention => mention.token === token)) return;
    const result = insertReferenceMention(prompt, token, textarea.selectionStart, textarea.selectionEnd);
    onPromptChange(result.text);
    requestAnimationFrame(() => {
      if (input.current !== textarea) return;
      textarea.focus();
      textarea.setSelectionRange(result.caret, result.caret);
    });
  }, [mentions, prompt, onPromptChange]);
  return { mentions, attachInput, insert, changed, needsReview, review: () => { reviewed.current = mentions; refreshReview(); } };
}
